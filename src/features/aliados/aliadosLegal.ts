import { CONTACT_EMAIL } from '../../data/content';
import {
  ALIADOS_ADMIN_NAME,
  ALIADOS_ADMIN_ROLE,
  LEGAL_ADDRESS_LINE,
  LEGAL_ADDRESS_PUBLICATION_AUTHORIZED,
  LEGAL_RESPONSIBLE_NAME,
  LEGAL_RESPONSIBLE_ROLE,
} from '../../data/legalEntity';

// Mientras sea false el formulario de registro permanece cerrado aunque la base lo abra.
// Solo debe pasar a true cuando LEGAL_PENDING este vacio y un responsable legal haya aprobado los textos.
export const ALIADOS_LEGAL_APPROVED = false;

export const ALIADOS_PRIVACY_CONTACT = CONTACT_EMAIL;

// Puntos que requieren revision juridica o datos que aun no constan. No deben resolverse por suposicion.
export const LEGAL_PENDING: readonly string[] = [
  'Autorización expresa de Carlos Leonardo Álvarez Cedillo para publicar su domicilio fiscal como domicilio del responsable del tratamiento. El domicilio ya está capturado en src/data/legalEntity.ts pero no se muestra hasta activar LEGAL_ADDRESS_PUBLICATION_AUTHORIZED. No publicar CURP, RFC, idCIF ni copias de la constancia.',
  'Constancia escrita de la designación de Carlos Leonardo Álvarez Cedillo como titular fiscal y responsable legal, y de su aceptación.',
  'Relación de José Adrián Álvarez Carlos con el tratamiento de datos (administra el programa): confirmar si actúa como personal del responsable o como encargado, y ajustar la redacción.',
  'Canal de privacidad y ARCO: nadrian18@gmail.com es el correo propuesto; confirmar que es el canal oficial del responsable, ya que corresponde al administrador del programa.',
  'Procedimiento, medio y plazos para ejercer derechos ARCO y revocar el consentimiento; alcance de derechos adicionales (portabilidad, limitación) que mencionaba el borrador anterior.',
  'Conservación: plazos definitivos y mecanismo de eliminación. Hoy el sistema no elimina nada automáticamente: las solicitudes rechazadas se conservan sin plazo definido (los 30 días son solo el enfriamiento antes de aceptar una nueva solicitud del mismo correo). Los plazos propuestos para aliados (vigencia + 3 años) y recomendaciones (vigencia + 1 año) no están validados, y no debe prometerse eliminación automática hasta implementarla.',
  'Cancelación frente a registros inmutables: ventas, comisiones, cobros y auditoría no pueden borrarse por diseño; definir qué se bloquea, por cuánto tiempo y cómo se informa al titular.',
  'Transferencias y encargados: confirmar la redacción sobre Supabase y Vercel (posible tratamiento fuera de México) y si se requieren cláusulas o avisos adicionales.',
  'Datos de las personas recomendadas: cómo se les informa del tratamiento al ser contactadas y el alcance de la autorización que declara el aliado.',
  'Documentación fiscal: comprobantes y retenciones por el pago de comisiones a aliados, y facturación de los cobros a nombre del titular fiscal.',
  'Acuerdo escrito de comisión por proyecto: formato, contenido mínimo y quién lo firma.',
  'Plazos de aviso previo para cambios del programa o terminación (el borrador anterior proponía 48 h y 30 días sin validar).',
  'Ley aplicable, jurisdicción y tribunales competentes; aplicabilidad de GDPR/CCPA.',
  'Revisión y firma de abogado, y fecha de vigencia del aviso general, del aviso de Aliados y de los términos.',
];

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const RESPONSIBLE_PARAGRAPH = `${LEGAL_RESPONSIBLE_NAME}, ${LEGAL_RESPONSIBLE_ROLE}. Domicilio: ${LEGAL_ADDRESS_LINE}${
  LEGAL_ADDRESS_PUBLICATION_AUTHORIZED ? '' : ' (domicilio fiscal por confirmar)'
}.`;

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Responsable',
    paragraphs: [
      RESPONSIBLE_PARAGRAPH,
      `El programa lo administra ${ALIADOS_ADMIN_NAME}, ${ALIADOS_ADMIN_ROLE}.`,
      `Contacto para temas de privacidad: ${CONTACT_EMAIL}`,
    ],
  },
  {
    title: 'Alcance de este aviso',
    paragraphs: [
      'Este aviso aplica solo al programa Aliados Charlitron. Es independiente del aviso de privacidad general del sitio, que trata los datos de quienes solicitan información o cotizaciones, y no modifica sus tratamientos ni finalidades.',
    ],
  },
  {
    title: 'Datos que recabamos',
    items: [
      'Solicitud de registro: nombre completo, correo electrónico, WhatsApp, ciudad y la fecha y hora en que aceptas este aviso y los términos.',
      'Cuenta de aliado: correo y contraseña. La contraseña la gestiona el servicio de autenticación y Charlitron no puede verla.',
      'Recomendaciones: nombre, correo, teléfono, ciudad y organización de las personas o negocios que recomiendas. Son datos de terceros que nos entregas.',
      'Operación del programa: ventas, cobros, comisiones y pagos asociados a tus recomendaciones, y el registro de cambios (quién, cuándo y qué cambió).',
    ],
  },
  {
    title: 'Finalidades sobre tus datos como aliado',
    items: [
      'Revisar y gestionar tu solicitud de registro.',
      'Crear y mantener tu cuenta y permitirte registrar recomendaciones y consultar su avance.',
      'Registrar y pagar las comisiones acordadas y comunicarte cambios del programa.',
      'Mantener la seguridad, la auditoría y el cumplimiento de obligaciones legales, administrativas y fiscales del programa.',
    ],
  },
  {
    title: 'Finalidades sobre los datos de las personas que recomiendas',
    items: [
      'Contactar a la persona o negocio recomendado para ofrecerle servicios de Charlitron Digital.',
      'Dar seguimiento a la recomendación, detectar recomendaciones repetidas y relacionarla con una venta y su comisión.',
      'No se usan para otros fines ni se comparten con otros aliados.',
    ],
  },
  {
    title: 'Consentimiento',
    paragraphs: [
      'Al marcar la casilla de aceptación en el formulario confirmas que leíste este aviso y los Términos del Programa Aliados, y autorizas el tratamiento de tus datos para las finalidades sobre tus datos como aliado.',
      'Antes de recomendar a alguien, la plataforma te pide confirmar que esa persona autorizó compartir sus datos con Charlitron. Eres responsable de contar con esa autorización.',
    ],
  },
  {
    title: 'Con quién compartimos tus datos',
    paragraphs: [
      'Solo puede verlos el personal autorizado de Charlitron. Un aliado nunca ve los datos de otros aliados ni de sus recomendaciones. No los compartimos con terceros sin tu autorización por escrito, salvo requerimiento de una autoridad competente.',
      'Para operar el programa usamos proveedores tecnológicos de base de datos, autenticación y alojamiento (Supabase y Vercel).',
    ],
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      `Puedes solicitar el Acceso, la Rectificación, la Cancelación y la Oposición (derechos ARCO) respecto de tus datos escribiendo a ${CONTACT_EMAIL} con tu nombre y el detalle de tu petición. El procedimiento y los plazos de respuesta se confirmarán en la versión final de este aviso.`,
    ],
  },
  {
    title: 'Conservación',
    items: [
      'Las solicitudes rechazadas se conservan mientras no se defina su plazo de eliminación. Tras un rechazo, el mismo correo no puede volver a solicitar el registro durante 30 días; es una medida contra el abuso, no el plazo de conservación.',
      'Los datos de tu cuenta y de tus recomendaciones se conservan mientras participes en el programa y el tiempo necesario para cumplir obligaciones legales; los plazos exactos están pendientes de validación legal.',
      'Los registros de ventas, cobros, comisiones y auditoría no se eliminan por su naturaleza contable y de control; el alcance de tu derecho de cancelación respecto de ellos está pendiente de validación legal.',
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
      `Aliados Charlitron es un programa de recomendación de Charlitron Digital, operación cuyo responsable legal es ${LEGAL_RESPONSIBLE_NAME}, y administrado por ${ALIADOS_ADMIN_NAME}. No genera relación laboral, de representación ni sociedad, y no implica exclusividad.`,
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
    title: 'Recomendación válida y duplicados',
    items: [
      'Debe tratarse de un negocio o persona con interés real y que haya aceptado ser contactado. Charlitron decide si atiende cada recomendación.',
      'Si más de un aliado registra al mismo contacto, el sistema toma como referencia la primera recomendación y Charlitron decide manualmente cómo se atienden las demás.',
    ],
  },
  {
    title: 'Datos de los referidos',
    items: [
      'Antes de recomendar a alguien debes contar con su autorización para compartir sus datos con Charlitron, y la plataforma te pedirá confirmarla.',
      'Charlitron usa esos datos para contactar a la persona, dar seguimiento y vincularla con una venta y su comisión, conforme al Aviso de Privacidad del programa.',
      'Desde tu panel solo ves el estado de tus recomendaciones y tus comisiones; no ves montos de venta, cobros internos ni notas administrativas.',
    ],
  },
  {
    title: 'Ventas y comisiones',
    items: [
      'La comisión es un monto acordado por escrito para cada proyecto. No hay porcentajes fijos ni ingresos garantizados.',
      'La parte liberable de la comisión es proporcional a lo que Charlitron cobra al cliente y nunca excede el monto acordado.',
      'Las comisiones se asignan, autorizan y pagan de forma manual; la asignación no equivale a la autorización. Los pagos pueden hacerse en parcialidades por el medio que se acuerde.',
      'Si un cobro se revierte, la comisión liberable se reduce en consecuencia.',
      'Charlitron informará los requisitos de documentación fiscal aplicables antes de pagar una comisión.',
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
    title: 'Contacto',
    paragraphs: [`Dudas sobre estos términos: ${CONTACT_EMAIL}`],
  },
  {
    title: 'Ley aplicable',
    paragraphs: ['Pendiente de definir por el responsable legal.'],
  },
];
