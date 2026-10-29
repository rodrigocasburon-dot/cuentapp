// Textos legales (fase 9). BORRADORES para el proyecto académico: no son
// asesoramiento jurídico y deben revisarse antes de cualquier uso real
// (SUPUESTOS.md, D-48). Los datos del responsable son ficticios.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Texto {
  titulo: string;
  secciones: { h: string; p: string[] }[];
}

const RESPONSABLE = "Cuentapp (proyecto académico; titular y NIF pendientes de definir)";

const TEXTOS: Record<string, Texto> = {
  "aviso-legal": {
    titulo: "Aviso legal",
    secciones: [
      { h: "Titular", p: [`${RESPONSABLE}. Contacto: el indicado por el equipo del proyecto.`] },
      { h: "Objeto", p: ["Cuentapp es una aplicación para que una empresa reúna sus facturas y tickets, revise sus datos y los prepare para su gestor cada trimestre."] },
      { h: "Responsabilidad", p: ["La lectura automática puede equivocarse. Los datos solo se consideran correctos cuando una persona los valida. Cuentapp no presta asesoramiento fiscal ni contable."] },
    ],
  },
  privacidad: {
    titulo: "Política de privacidad",
    secciones: [
      { h: "Responsable", p: [RESPONSABLE] },
      { h: "Qué datos tratamos", p: ["Datos de la cuenta: nombre, email y contraseña (guardada cifrada, nadie puede leerla). Datos de la empresa: nombre y NIF. Los documentos que subes y los datos que se leen de ellos."] },
      { h: "Para qué", p: ["Para prestar el servicio: guardar tus documentos, leerlos, mostrarte el semáforo del trimestre y generar el Excel para tu gestor. Base legal: la ejecución del contrato."] },
      {
        h: "Dónde y con quién",
        p: [
          "En esta versión local todo se guarda en el equipo donde se ejecuta la aplicación. La lectura automática se hace en ese mismo equipo: los documentos no se envían a servicios de inteligencia artificial.",
          "Para convertir importes en moneda extranjera se consulta el tipo de cambio del BCE (Frankfurter): solo se envían la moneda y la fecha, nunca el documento.",
        ],
      },
      { h: "Cuánto tiempo", p: ["Los documentos se conservan al menos el plazo que exige la normativa fiscal y mercantil (4 a 6 años). Por eso, al dar de baja la cuenta no se borran: se dejan de usar y nadie puede entrar con ella."] },
      { h: "Tus derechos", p: ["Puedes pedir acceso, rectificación, supresión (con el límite de conservación anterior), oposición, limitación y portabilidad, y reclamar ante la Agencia Española de Protección de Datos (aepd.es)."] },
    ],
  },
  terminos: {
    titulo: "Términos de uso",
    secciones: [
      { h: "Planes", p: ["Prueba: gratis 14 días, hasta 30 documentos. Cuentapp: 20 € al mes sin IVA, hasta 250 documentos al mes. En esta versión no se cobra nada: el cambio de plan es una simulación."] },
      { h: "Tus documentos", p: ["Sube solo documentos de tu empresa. Guardamos el original sin modificarlo. Tú decides cuándo un documento está validado."] },
      { h: "Uso correcto", p: ["No intentes acceder a datos de otras empresas ni subir archivos dañinos. Podemos suspender las cuentas que lo hagan."] },
    ],
  },
  cookies: {
    titulo: "Cookies",
    secciones: [
      { h: "Qué cookies usamos", p: ["Solo una cookie técnica, «cuentapp_sesion», que mantiene tu sesión iniciada durante 7 días. No usamos cookies de análisis ni de publicidad, por eso no te pedimos consentimiento."] },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(TEXTOS).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const t = TEXTOS[(await params).pagina];
  return { title: t ? `${t.titulo} · Cuentapp` : "Cuentapp" };
}

export default async function PaginaLegal({ params }: { params: Promise<{ pagina: string }> }) {
  const t = TEXTOS[(await params).pagina];
  if (!t) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="mb-4">
        <Link href="/" className="underline underline-offset-4">
          ← Cuentapp
        </Link>
      </p>
      <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">{t.titulo}</h1>
      <p className="mb-8 rounded-lg border-2 border-dashed border-marron px-4 py-2 text-sm">
        Borrador para un proyecto académico. No es asesoramiento jurídico.
      </p>
      {t.secciones.map((s) => (
        <section key={s.h} className="mb-6">
          <h2 className="mb-2 text-xl font-bold">{s.h}</h2>
          {s.p.map((p, i) => (
            <p key={i} className="mb-2 leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
