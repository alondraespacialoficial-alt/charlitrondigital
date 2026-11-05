import { CONTACT_EMAIL } from '../../data/content';

// Mientras sea false el formulario de registro permanece cerrado aunque la base lo abra.
// Solo debe pasar a true cuando LEGAL_PENDING este vacio y un responsable legal haya aprobado los textos.
export const ALIADOS_LEGAL_APPROVED = false;

export const ALIADOS_PRIVACY_CONTACT = CONTACT_EMAIL;

// Datos legales que NO constan en los documentos existentes y no deben inventarse.
export const LEGAL_PENDING: readonly string[] = [
  'Identidad legal del responsable: el aviso general nombra a José Adrián Álvarez Carlos "y/o" Charlitron Digital S.A. de C.V.; falta confirmar cuál es el responsable del programa y su RFC.',
  'Domicilio completo del responsable (calle, número, código postal): solo consta "San Luis Potosí, S.L.P., México".',
  'Canal oficial de privacidad y ARCO: el aviso general usa nadrian18@gmail.com; ALIADOS-LEGAL-REVIEW.md menciona privacidad@charlitrondigital.com y aliados@charlitron.com (dominio distinto).',
  'Plazos de conservación: el borrador dice que las solicitudes rechazadas se eliminan a los 7 días, pero el sistema las conserva al menos 30 días (enfriamiento anti-abuso) y no existe un proceso de eliminación.',
  'Procedimiento y plazos para ejercer derechos ARCO y para revocar el consentimiento; alcance de los derechos adicionales (portabilidad, limitación) que menciona el borrador.',
  'Transferencias y encargados: confirmar la redacción sobre Supabase y Vercel como proveedores (posible tratamiento fuera de México).',
  'Datos de terceros referidos: aviso o declaración que debe hacer el aliado sobre la autorización de las personas que recomienda.',
  'Esquema de comisiones por escrito (cómo se acuerda cada proyecto) y obligaciones fiscales de su pago (comprobante, retenciones).',
  'Plazos de aviso previo para cambios del programa o terminación (el borrador propone 48 h y 30 días sin validar).',
  'Ley aplicable, jurisdicción y tribunales competentes; aplicabilidad de GDPR/CCPA.',
  'Revisión y firma de abogado o responsable legal, y fecha de vigencia de ambos textos.',
];

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Responsable',
    paragraphs: [
      'José Adrián Álvarez Carlos, en representación de Charlitron Digital. Domicilio: San Luis Potosí, S.L.P., México (domicilio completo por confirmar).',
      `Contacto para temas de privacidad: ${CONTACT_EMAIL}`,
    ],
  },
  {
    title: 'Datos que recabamos',
    items: [
      'Solicitud de registro: nombre completo, correo electrónico, WhatsApp, ciudad y la fecha y hora en que aceptas este aviso y los términos.',
      'Cuenta de aliado: correo y contraseña. La contraseña la gestiona el servicio de autenticación y Charlitron no puede verla.',
      'Recomendaciones que registres: nombre, correo, teléfono, ciudad y organización de las personas o negocios que recomiendas.',
      'Operación del programa: ventas, cobros, comisiones y pagos asociados a tus recomendaciones, y el registro de cambios (quién, cuándo y qué cambió).',
    ],
  },
  {
    title: 'Para qué usamos tus datos',
    items: [
      'Revisar y gestionar tu solicitud de registro como aliado.',
      'Permitirte registrar recomendaciones y dar seguimiento a su avance.',
      'Registrar ventas, cobros y comisiones acordadas, y comunicarte cambios del programa.',
      'Mantener la seguridad, la auditoría y el cumplimiento de obligaciones legales y administrativas del programa.',
    ],
  },
  {
    title: 'Consentimiento',
    paragraphs: [
      'Al marcar la casilla de aceptación en el formulario confirmas que leíste este aviso y los Términos del Programa Aliados, y autorizas el tratamiento de tus datos para las finalidades anteriores. No usaremos tus datos para otros fines sin tu consentimiento adicional.',
    ],
  },
  {
    title: 'Con quién compartimos tus datos',
    paragraphs: [
      'Solo puede verlos el personal autorizado de Charlitron. No los compartimos con terceros sin tu autorización por escrito, salvo requerimiento de una autoridad competente.',
      'Para operar el programa usamos proveedores tecnológicos de base de datos, autenticación y alojamiento (Supabase y Vercel).',
    ],
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      `Puedes solicitar el Acceso, la Rectificación, la Cancelación y la Oposición (derechos ARCO) respecto de tus datos escribiendo a ${CONTACT_EMAIL} con tu nombre y el detalle de tu petición.`,
    ],
  },
  {
    title: 'Conservación',
    paragraphs: [
      'Conservamos tus datos mientras participes en el programa y el tiempo necesario para cumplir obligaciones legales. Los plazos exactos están pendientes de validación legal.',
    ],
  },
  {
    title: 'Cambios a este aviso',
    paragraphs: ['Podemos actualizar este aviso por requerimientos legales u operativos. Publicaremos los cambios en esta misma página.'],
  },
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Qué es el programa',
    paragraphs: [
      'Aliados Charlitron es un programa de recomendación. No genera relación laboral, de representación ni sociedad, y no implica exclusividad.',
    ],
  },
  {
    title: 'Registro y aprobación',
    items: [
      'El registro es voluntario y requiere información veraz.',
      'Cada solicitud la revisa Charlitron de forma manual y puede aprobarla o rechazarla.',
      'La aprobación no garantiza recomendaciones, ventas ni pagos.',
      'Si se aprueba, recibirás una invitación por correo para crear tu contraseña. El enlace tiene vigencia limitada.',
    ],
  },
  {
    title: 'Recomendación válida',
    paragraphs: [
      'Debe tratarse de un negocio con interés real y que haya aceptado ser contactado. Charlitron decide si atiende cada recomendación y, si dos aliados recomiendan al mismo negocio, decide cómo se asigna.',
    ],
  },
  {
    title: 'Datos de los referidos',
    items: [
      'El aliado protege la información de los negocios y personas que recomienda y la comparte únicamente para fines del programa.',
      'Desde tu panel solo ves el estado de tus recomendaciones y tus comisiones; no ves montos de venta, cobros internos ni notas administrativas.',
    ],
  },
  {
    title: 'Ventas y comisiones',
    items: [
      'La comisión se acuerda por escrito para cada proyecto. No hay porcentajes fijos ni ingresos garantizados.',
      'Solo se libera después de que Charlitron cobra al cliente y en proporción a lo realmente cobrado.',
      'Las comisiones se asignan, autorizan y pagan de forma manual; la asignación no equivale a la autorización.',
      'Si un cobro se revierte, la comisión liberable se reduce en consecuencia.',
    ],
  },
  {
    title: 'Conducta del aliado',
    items: [
      'No enviar spam ni hacer declaraciones engañosas sobre servicios o precios.',
      'No usar el nombre de Charlitron fuera de lo acordado ni interferir en la negociación con el referido.',
      'Mantener la confidencialidad de clientes, montos y condiciones internas.',
    ],
  },
  {
    title: 'Cambios y baja',
    paragraphs: [
      'Charlitron puede modificar el programa o dar de baja cuentas, por ejemplo por incumplimiento o actividad fraudulenta. El aliado puede pedir su baja en cualquier momento. Las comisiones ya devengadas se respetan conforme al acuerdo del proyecto.',
    ],
  },
  {
    title: 'Limitación de responsabilidad',
    paragraphs: [
      'Charlitron no garantiza recibir recomendaciones ni que estas se conviertan en ventas, y el aliado asume el riesgo propio de este modelo.',
    ],
  },
  {
    title: 'Ley aplicable',
    paragraphs: ['Pendiente de definir por el responsable legal.'],
  },
];
