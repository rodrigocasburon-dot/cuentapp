// Cobro de planes con Stripe en modo de pruebas (D-60). Sin red: fetch falso.

import { afterEach, describe, expect, it, vi } from "vitest";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import {
  cancelarSuscripcion,
  claveStripe,
  conIva,
  crearPagoPlan,
  leerPago,
  pagoValido,
  type SesionPago,
} from "@/servidor/pagos/stripe";
import { bdDePrueba } from "./ayudas";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** fetch falso que apunta cada llamada y responde con `respuesta`. */
function fetchFalso(respuesta: unknown, estado = 200) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(respuesta), { status: estado });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

const PLAN = { id: "cuentapp", nombre: "Cuentapp", precio_centimos: 2000 };
const pagada = (cambios: Partial<SesionPago> = {}): SesionPago => ({
  id: "cs_test_abc", url: null, status: "complete", payment_status: "paid", client_reference_id: "A",
  metadata: { empresa_id: "A", plan_id: "cuentapp" }, subscription: "sub_1", amount_total: 2420, currency: "eur", ...cambios,
});

describe("configuración", () => {
  it("solo acepta claves de pruebas: una clave real se ignora", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(claveStripe({})).toBeNull();
    expect(claveStripe({ STRIPE_SECRET_KEY: "sk_test_123" })).toBe("sk_test_123");
    expect(claveStripe({ STRIPE_SECRET_KEY: "sk_live_123" })).toBeNull();
  });

  it("el precio se cobra con el 21 % de IVA", () => {
    expect(conIva(2000)).toBe(2420);
    expect(conIva(4000)).toBe(4840);
  });
});

describe("llamadas a Stripe", () => {
  it("crea una suscripción mensual con el plan, la empresa y el importe con IVA, sin datos personales", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_falsa");
    const { f, llamadas } = fetchFalso({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const s = await crearPagoPlan({ empresaId: "A", plan: PLAN, urlVuelta: "http://localhost:3000/cuenta/pago?session_id={CHECKOUT_SESSION_ID}", urlCancelar: "http://x/c" }, f);
    expect(s.url).toContain("checkout.stripe.com");
    expect(llamadas[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((llamadas[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_falsa");
    const cuerpo = new URLSearchParams(String(llamadas[0].init.body));
    expect(cuerpo.get("mode")).toBe("subscription");
    expect(cuerpo.get("client_reference_id")).toBe("A");
    expect(cuerpo.get("metadata[plan_id]")).toBe("cuentapp");
    expect(cuerpo.get("line_items[0][price_data][unit_amount]")).toBe("2420");
    expect(cuerpo.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(cuerpo.get("success_url")).toContain("{CHECKOUT_SESSION_ID}");
    expect(cuerpo.has("customer_email")).toBe(false);
  });

  it("sin clave no llama a Stripe; un error de Stripe se propaga", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { f, llamadas } = fetchFalso({});
    await expect(leerPago("cs_test_1", f)).rejects.toThrow(/no está configurado/);
    expect(llamadas).toHaveLength(0);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_falsa");
    await expect(leerPago("cs_test_1", fetchFalso({ error: { message: "No such session" } }, 404).f)).rejects.toThrow(/No such session/);
  });

  it("no acepta identificadores raros (no se cuelan rutas en la URL de Stripe)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_falsa");
    const { f, llamadas } = fetchFalso({});
    await expect(leerPago("cs_test_1/../../v1/charges", f)).rejects.toThrow();
    await expect(leerPago("cs_live_1", f)).rejects.toThrow();
    await expect(cancelarSuscripcion("sub_1?x=1", f)).rejects.toThrow();
    expect(llamadas).toHaveLength(0);
  });
});

describe("validación del pago a la vuelta", () => {
  it("solo vale si es de esta empresa, está pagado y coinciden plan e importe", () => {
    expect(pagoValido(pagada(), "A", PLAN)).toBe(true);
    expect(pagoValido(pagada(), "B", PLAN)).toBe(false); // pago de otra empresa
    expect(pagoValido(pagada({ payment_status: "unpaid" }), "A", PLAN)).toBe(false);
    expect(pagoValido(pagada({ status: "open" }), "A", PLAN)).toBe(false);
    expect(pagoValido(pagada({ amount_total: 2000 }), "A", PLAN)).toBe(false);
    expect(pagoValido(pagada({ metadata: { empresa_id: "A", plan_id: "pro" } }), "A", PLAN)).toBe(false);
    expect(pagoValido(pagada(), "A", undefined)).toBe(false);
  });

  it("registrar el pago cambia el plan una sola vez y aislado por empresa", () => {
    const bd = bdDePrueba();
    bd.prepare("UPDATE empresas SET plan_id = 'prueba', prueba_hasta = '2026-11-01T00:00:00Z' WHERE id = 'A'").run();
    const repoA = repositorioDeEmpresa(bd, "A");
    const pago = { planId: "pro", stripeSesion: "cs_test_1", stripeSuscripcion: "sub_1", importeCentimos: 4840, moneda: "eur" };
    expect(repoA.registrarPago(pago)).toBe(true);
    expect(repoA.plan()).toMatchObject({ id: "pro", prueba_hasta: null });
    expect(repoA.registrarPago(pago)).toBe(false); // recargar la vuelta no duplica
    expect(repoA.suscripcionesActivas()).toEqual(["sub_1"]);
    expect(repoA.suscripcionesActivas("sub_1")).toEqual([]);
    expect(repositorioDeEmpresa(bd, "B").suscripcionesActivas()).toEqual([]);
    repoA.marcarSuscripcionCancelada("sub_1");
    expect(repoA.suscripcionesActivas()).toEqual([]);
  });

  it("solo se cobran planes contratables", () => {
    const repo = repositorioDeEmpresa(bdDePrueba(), "A");
    expect(repo.planContratable("pro")).toMatchObject({ precio_centimos: 4000 });
    expect(repo.planContratable("prueba")).toBeUndefined();
    expect(repo.planContratable("despacho")).toBeUndefined();
  });
});
