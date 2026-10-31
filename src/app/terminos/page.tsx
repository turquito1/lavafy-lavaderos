import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones">
      <p>
        Estos términos regulan el uso de Lavafy, la plataforma de turnos online para lavaderos de autos. Al usar Lavafy aceptás estos términos y la{" "}
        <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <h2>1. Qué es Lavafy</h2>
      <p>
        Lavafy es una herramienta que conecta a lavaderos con sus clientes para reservar turnos. <strong>Lavafy no presta el servicio de lavado</strong>: cada lavadero es
        responsable de sus servicios, precios, horarios, calidad del trabajo, cuidado de los vehículos y cobro.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>Para confirmar un turno o administrar un lavadero tenés que iniciar sesión con una cuenta de Google y ser mayor de 18 años.</li>
        <li>Sos responsable de la veracidad de los datos que cargás y del uso de tu cuenta.</li>
      </ul>

      <h2>3. Para clientes</h2>
      <ul>
        <li>Al reservar, el turno queda confirmado o pendiente de aprobación según la configuración del lavadero. Te avisamos por email.</li>
        <li>Podés cancelar o reprogramar desde el link de tu turno hasta el plazo que defina cada lavadero (como mínimo 1 hora antes). Pasado ese plazo, coordinalo directamente con el lavadero.</li>
        <li>El pago se realiza directamente al lavadero, salvo que se indique otra cosa.</li>
        <li>No presentarte sin cancelar puede hacer que el lavadero no acepte futuras reservas tuyas.</li>
      </ul>

      <h2>4. Para lavaderos</h2>
      <ul>
        <li>Te comprometés a publicar información veraz (servicios, precios, horarios y ubicación) y a respetar los turnos confirmados o avisar con anticipación si no podés cumplirlos.</li>
        <li>Los datos de tus clientes que recibís a través de Lavafy solo pueden usarse para gestionar sus turnos y comunicarte con ellos por ese motivo, conforme a la Ley 25.326.</li>
        <li>
          Lavafy ofrece un período de prueba gratuito. Al finalizar, el uso continuo puede requerir la contratación de un plan pago, que te informaremos con anticipación.
          Si no se abona, podremos pausar la publicación del lavadero.
        </li>
        <li>Podemos suspender lavaderos que publiquen información falsa, incumplan reiteradamente los turnos o hagan un uso indebido del servicio.</li>
      </ul>

      <h2>5. Uso aceptable</h2>
      <p>
        No está permitido usar Lavafy para actividades ilegales, cargar contenido ofensivo o de terceros sin autorización, intentar acceder a datos de otros usuarios ni
        afectar el funcionamiento del servicio.
      </p>

      <h2>6. Disponibilidad y responsabilidad</h2>
      <p>
        Trabajamos para que Lavafy funcione siempre, pero el servicio se brinda “tal cual” y puede tener interrupciones o errores. En la medida permitida por la ley,
        Lavafy no es responsable por daños derivados de la relación entre clientes y lavaderos, ni por turnos perdidos por fallas técnicas.
      </p>

      <h2>7. Cambios</h2>
      <p>Podemos actualizar estos términos. Publicaremos la versión vigente en esta página con su fecha de actualización.</p>

      <h2>8. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Ante cualquier consulta escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
