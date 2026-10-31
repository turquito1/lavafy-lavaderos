import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        Lavafy (“Lavafy”, “nosotros”) es una plataforma que permite a lavaderos de autos publicar su agenda y a sus clientes sacar turnos online. Esta política explica
        qué datos personales tratamos, para qué y cuáles son tus derechos, conforme a la Ley 25.326 de Protección de Datos Personales de la República Argentina.
      </p>

      <h2>1. Responsable</h2>
      <p>
        El responsable de la base de datos es Ignacio López Mora, con domicilio en la Provincia de Córdoba, Argentina. Contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Qué datos recolectamos</h2>
      <ul>
        <li><strong>Datos de tu cuenta de Google</strong> al iniciar sesión: nombre, dirección de email y foto de perfil. No accedemos a tu contraseña, a tus mails ni a otros datos de tu cuenta.</li>
        <li><strong>Datos del turno</strong> que cargás: nombre, teléfono, patente, marca y modelo del vehículo, servicio elegido, fecha y hora, y comentarios.</li>
        <li><strong>Datos del lavadero</strong> (para dueños): nombre comercial, dirección, ubicación, teléfono, redes, servicios, precios, horarios e imágenes.</li>
        <li><strong>Ubicación aproximada</strong>, solo si tocás “Cerca mío” y lo autorizás en tu navegador. Se usa en el momento para ordenar resultados y no se guarda.</li>
        <li><strong>Datos técnicos</strong> mínimos (por ejemplo, registros de errores y cookies de sesión) necesarios para que el servicio funcione de forma segura.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y gestionar tus turnos, y que el lavadero elegido pueda atenderte.</li>
        <li>Enviarte emails sobre tus turnos: confirmación, cambios, cancelación, recordatorios y aviso de que tu vehículo está listo.</li>
        <li>Permitir a los lavaderos administrar su agenda y sus clientes.</li>
        <li>Mantener la seguridad del servicio, prevenir abusos y corregir errores.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>

      <h2>4. Con quién los compartimos</h2>
      <ul>
        <li><strong>El lavadero donde sacás el turno</strong> ve los datos de ese turno (nombre, teléfono, email, vehículo y comentarios) para poder atenderte.</li>
        <li>
          <strong>Proveedores que nos prestan servicios</strong>, solo en la medida necesaria: Vercel (hosting), Neon (base de datos), Resend (envío de emails) y Google
          (inicio de sesión). Algunos de estos proveedores pueden almacenar datos fuera de Argentina, con medidas de seguridad adecuadas.
        </li>
        <li>Autoridades, únicamente cuando una ley o una orden judicial lo exija.</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y recordar el lavadero que administrás. No usamos cookies de publicidad.
      </p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <p>
        Guardamos los datos mientras tengas una cuenta o mientras el lavadero necesite el historial de turnos. Podés pedirnos que los eliminemos en cualquier momento
        (ver punto 7), salvo los que debamos conservar por una obligación legal.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés pedir acceso, rectificación, actualización o supresión de tus datos escribiendo a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Respondemos dentro de
        los plazos de la Ley 25.326 (10 días corridos para acceso y 5 días hábiles para rectificación o supresión).
      </p>
      <p>
        La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos
        que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Las conexiones están cifradas (HTTPS) y el acceso a los datos está restringido: cada lavadero solo ve sus propios turnos y cada cliente solo los suyos.
      </p>

      <h2>9. Menores de edad</h2>
      <p>El servicio está dirigido a mayores de 18 años.</p>

      <h2>10. Cambios</h2>
      <p>
        Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha de actualización. Ver también los{" "}
        <Link href="/terminos">Términos y condiciones</Link>.
      </p>
    </LegalPage>
  );
}
