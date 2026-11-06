import { CONTACT_EMAIL } from '../../data/content';

// El registro publico NO se abre desde el codigo: el programa funciona solo por invitacion administrativa.
// Esta bandera debe seguir en false. Aunque la base tuviera registration_open = true, la pagina publica de
// registro no mostraria el formulario mientras esta bandera sea false (doble llave).
export const ALIADOS_LEGAL_APPROVED = false;

export const ALIADOS_PRIVACY_CONTACT = CONTACT_EMAIL;

// Versiones vigentes de los documentos que el aliado acepta o confirma en la pantalla de aceptacion electronica.
// Deben coincidir con ally_legal_documents (migracion 0006); una prueba lo verifica.
export const TERMS_VERSION = '1.0';
export const PRIVACY_VERSION = '1.2';
export const LEGAL_DOCUMENTS_DATE = '2026-11-05';
export const LEGAL_DOCUMENTS_DATE_LABEL = '5 de noviembre de 2026';
export const LEGAL_PROGRAM_LABEL = 'Aliados Charlitron · «Si nos refieres, ganas»';

// Puntos que siguen pendientes para operar con prospectos reales. Los textos legales ya son los aprobados por el
// responsable; esto lista lo que no se resuelve con texto en el sitio. No deben resolverse por suposicion.
export const LEGAL_PENDING: readonly string[] = [
  'Revisión y validación de abogado de los dos documentos (Aviso Integral de Privacidad v1.2 y Términos y Condiciones v1.0); constan como aprobados por el responsable, no como revisados por un abogado.',
  'Constancia escrita de la designación de Carlos Leonardo Álvarez Cedillo como titular fiscal y responsable legal, y de su aceptación.',
  'Canal ARCO: nadrian18@gmail.com pertenece al administrador del programa; confirmar que es el canal oficial del responsable y tener operando el procedimiento interno de atención ARCO (no se publica en este repositorio).',
  'Mecanismo y evidencia de la puesta a disposición del aviso al prospecto recomendado y de sus oposiciones (apartado 5 del Aviso): aún no existe en la aplicación; el procedimiento interno de prospectos no se publica en este repositorio.',
  'Mecanismo de consentimiento expreso, separado de la aceptación de términos, para datos fiscales y bancarios y para comunicaciones secundarias (apartados 4 y 8): no se implementa en esta versión. La casilla del aviso solo confirma que estuvo a disposición.',
  'Plazos de conservación y bloqueo por categoría de datos, y tratamiento de bitácoras y respaldos al atender cancelaciones (apartado 9): sin plazos definitivos y sin eliminación automática.',
  'Remisiones y transferencias: confirmar los acuerdos con Supabase, Vercel y Resend y si hay tratamiento fuera de México (apartado 7).',
  'Formato y contenido mínimo del acuerdo individual de comisión por proyecto, y quién lo firma (apartado 6 de los Términos).',
  'Documentación fiscal: comprobantes (CFDI) y retenciones por el pago de comisiones, y facturación de los cobros (apartado 8 de los Términos).',
  'Ley aplicable y autoridades competentes: los Términos las remiten a la legislación mexicana aplicable; confirmar con el abogado.',
];

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  type: 'privacy' | 'terms';
  version: string;
  effectiveDate: string;
  title: string;
  subtitle: string;
  sections: readonly LegalSection[];
}

// Textos aprobados por Carlos Leonardo Álvarez Cedillo, fechados el 5 de noviembre de 2026.
// NO editar el contenido: cualquier cambio exige una nueva version y una nueva fila en ally_legal_documents.
export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Identidad, alcance y responsable',
    paragraphs: [
      'Carlos Leonardo Álvarez Cedillo, persona física que opera comercialmente bajo la marca Charlitron Digital, con domicilio en calle Lanzagorta 330, colonia San Sebastián, C. P. 78349, San Luis Potosí, San Luis Potosí, México. José Adrián Álvarez Carlos es administrador comercial y operativo, sin sustituir al responsable.',
      'Este aviso es específico del programa Aliados Charlitron y no sustituye el aviso general de los demás servicios de Charlitron Digital. Se dirige a solicitantes, personas invitadas, aliados vigentes o dados de baja, personas físicas de contacto de prospectos y personas que ejercen derechos sobre sus datos.',
    ],
  },
  {
    title: 'Datos personales tratados y su procedencia',
    paragraphs: [
      'De solicitantes y aliados: nombre completo, correo electrónico, teléfono o WhatsApp y ciudad, cuando se capture; datos de autenticación y sesión; origen de alta, estado de autorización, fecha y versión de aceptaciones efectivamente registradas; identificadores de cuenta y registros de acceso, seguridad y auditoría. El registro público actualmente está cerrado; en invitaciones administrativas, nombre y correo son obligatorios y teléfono y ciudad pueden ser opcionales.',
      'Para la operación: recomendaciones, datos de contacto comercial, comunicaciones y notas pertinentes, ventas, cobros, acuerdos, importes de comisiones, referencias de pagos y registros de auditoría. Para pagos de comisiones, cuando sean necesarios y mediante los mecanismos legalmente aplicables, podrán solicitarse datos fiscales y bancarios por medios indicados directamente a la persona interesada.',
      'De prospectos recomendados: nombre, teléfono y/o correo cuando se proporcione, ciudad y negocio u organización. Esos datos pueden llegar indirectamente por un aliado. No se solicitan regularmente datos personales sensibles; la información no necesaria será evaluada para supresión o tratamiento legalmente procedente.',
    ],
  },
  {
    title: 'Finalidades indispensables',
    paragraphs: [
      'Invitar, identificar, verificar y gestionar solicitudes y perfiles; autenticar accesos; aplicar permisos y medidas de seguridad; recibir y evaluar recomendaciones, comprobar duplicados y gestionar seguimiento; comunicarse en relación con oportunidades de servicio; documentar proyectos, ventas, pagos de clientes, comisiones y sus pagos; prevenir usos no autorizados; atender aclaraciones, derechos ARCO, controversias y obligaciones legales, fiscales, contables y contractuales.',
      'Los datos de prospectos se emplearán para evaluar la referencia, establecer contacto comercial inicial cuando proceda y dar seguimiento solo en la medida lícita y necesaria. Recibir una recomendación no autoriza por sí solo campañas publicitarias indiscriminadas.',
    ],
  },
  {
    title: 'Finalidades opcionales y oposición',
    paragraphs: [
      'Las comunicaciones promocionales o invitaciones no indispensables para el funcionamiento del programa se tratarán como finalidades secundarias y requerirán el mecanismo de elección o consentimiento que corresponda. No se enviarán comunicaciones promocionales opcionales sin contar con el fundamento y mecanismo legal correspondiente. La negativa no impedirá las funciones necesarias del programa.',
    ],
  },
  {
    title: 'Datos proporcionados por aliados y aviso al prospecto',
    paragraphs: [
      'El aliado solo deberá remitir información mínima obtenida lícitamente y declarará la procedencia de la referencia. Esa declaración no sustituye la obligación del responsable de contar con fundamento para el tratamiento ni la entrega oportuna del aviso. Charlitron pondrá a disposición del prospecto la información sobre responsable, finalidades y mecanismos de privacidad, atendiendo las reglas aplicables a datos obtenidos indirectamente.',
      'Charlitron documentará la puesta a disposición o comunicación del aviso al prospecto, así como cualquier oposición, conforme a la normativa aplicable y sin atribuirle consentimiento por silencio.',
    ],
  },
  {
    title: 'Invitación administrativa y aceptación de documentos',
    paragraphs: [
      'La invitación y aprobación de un aliado no prueban aceptación de términos ni consentimiento para datos. Una invitación no equivale a aceptación de términos. El acceso a funciones comerciales requerirá un acto afirmativo verificable que permita identificar al aliado, la fecha y la versión aceptada.',
    ],
  },
  {
    title: 'Proveedores tecnológicos, remisiones y transferencias',
    paragraphs: [
      'Para prestar el servicio se utiliza infraestructura tecnológica de Supabase y Vercel, así como servicios de envío de correo electrónico de Resend. Estos proveedores pueden tratar datos técnicos o personales por cuenta del responsable según sus servicios y acuerdos. Se distinguirán las remisiones a personas encargadas de las transferencias a responsables distintos.',
      'Las comunicaciones de datos a terceros distintos de los encargados se sujetarán a los requisitos y excepciones establecidos por la ley. Las personas titulares podrán solicitar información sobre su tratamiento mediante el correo de privacidad.',
    ],
  },
  {
    title: 'Sesiones, almacenamiento técnico y seguridad',
    paragraphs: [
      'La plataforma utiliza almacenamiento técnico necesario para conservar la sesión y proteger el acceso de las cuentas. Otras tecnologías del sitio, cuando resulten aplicables, se informarán conforme a la normativa correspondiente.',
      'La plataforma aplica controles de acceso basados en permisos. El responsable debe mantener medidas administrativas, técnicas y físicas proporcionales a riesgos, con confidencialidad, revisión de incidentes y comunicación de vulneraciones cuando legalmente proceda. No se garantiza seguridad absoluta.',
    ],
  },
  {
    title: 'Conservación, bloqueo y cancelación',
    paragraphs: [
      'Los datos se conservarán solamente por las finalidades y obligaciones legales aplicables, con revisión por categoría y periodo de bloqueo cuando corresponda. Una cuenta suspendida, solicitud rechazada o baja no implica eliminación instantánea de todos los registros.',
      'Las ventas, cobros, comisiones y bitácoras pueden estar sujetos a conservación y restricciones técnicas. Los registros de auditoría y respaldos se revisarán al atender solicitudes de cancelación, bloqueo o supresión, atendiendo los límites legales y técnicos aplicables. No se ofrece eliminación inmediata o automática de todos los registros.',
    ],
  },
  {
    title: 'Derechos ARCO',
    paragraphs: [
      'La persona titular o su representante podrán solicitar acceso, rectificación, cancelación u oposición al correo nadrian18@gmail.com. Incluirán: nombre y medio para recibir notificaciones, elementos para acreditar identidad o representación, identificación de los datos cuando corresponda, derecho solicitado y información que facilite su localización. Para rectificación, describirán cambios y sustento documental.',
      'El responsable comunicará su determinación en un máximo de 20 días hábiles desde la recepción y, si procede, la hará efectiva dentro de los 15 días hábiles siguientes a la comunicación. Los periodos pueden ampliarse una sola vez por uno igual si se justifica. La cancelación podrá dar lugar a bloqueo antes de supresión, y se aplicarán las excepciones legales pertinentes. La atención es gratuita salvo costos permitidos de reproducción o envío.',
    ],
  },
  {
    title: 'Revocación y límites de uso o divulgación',
    paragraphs: [
      'La persona titular podrá solicitar revocación del consentimiento cuando proceda y limitación de uso o divulgación a nadrian18@gmail.com; la revocación no es retroactiva ni elimina por sí sola deberes legales pendientes. La exclusión de comunicaciones secundarias se atenderá por dicho canal.',
    ],
  },
  {
    title: 'Contacto, cambios y vigencia',
    paragraphs: [
      'Canal ARCO: nadrian18@gmail.com. Asunto sugerido: “Privacidad / Derechos ARCO - Aliados Charlitron”. El responsable atenderá estas solicitudes a través del canal señalado, directamente o mediante el personal autorizado.',
      'Las modificaciones se informarán en https://www.charlitrondigital.com/aliados/privacidad, con identificación de versión y fecha; las modificaciones que exijan nuevo consentimiento no lo sustituyen con la mera publicación.',
    ],
  },
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Naturaleza y participantes',
    paragraphs: [
      'El programa “Aliados Charlitron - Si nos refieres, ganas” es un esquema privado de recomendaciones comerciales operado por Carlos Leonardo Álvarez Cedillo bajo la marca Charlitron Digital. Durante la etapa inicial se participa exclusivamente por invitación y aprobación administrativa. Los presentes términos serán aplicables desde su aceptación documentada por cada participante.',
    ],
  },
  {
    title: 'Elegibilidad y acceso',
    paragraphs: [
      'El programa es gratuito y no exige exclusividad, cuotas de referidos ni volumen mínimo. La persona interesada deberá proporcionar información verdadera y mantener sus datos de contacto actualizados. Charlitron podrá validar identidad y pertinencia comercial, aprobar o rechazar solicitudes y suspender cuentas cuando exista una causa razonable documentada. El registro público permanece cerrado.',
    ],
  },
  {
    title: 'Función del aliado y límites de representación',
    paragraphs: [
      'El aliado identifica y recomienda oportunidades comerciales, sin facultad para representar legalmente a Charlitron, pactar precios, ofrecer descuentos, emitir facturas, firmar contratos, garantizar resultados ni recibir dinero de clientes por cuenta de Charlitron, salvo autorización previa y específica por escrito. Charlitron conserva la negociación, cotización, ejecución, facturación y cobranza. El aliado no puede usar la marca, logos ni materiales más allá de lo autorizado.',
    ],
  },
  {
    title: 'Referidos adecuados y licitud de datos',
    paragraphs: [
      'El aliado debe registrar únicamente prospectos con datos obtenidos y compartidos lícitamente; no enviará bases compradas, datos sensibles, información íntima ni contactos obtenidos por engaño. La declaración de autorización no exonera al responsable de sus obligaciones de privacidad. Charlitron podrá rechazar información incompleta, improcedente, ilícita, engañosa o respecto de la cual el prospecto se oponga a su tratamiento.',
    ],
  },
  {
    title: 'Registro, prioridad y duplicados',
    paragraphs: [
      'Una recomendación queda sometida a validación y no asegura aceptación ni comisión. Se considerarán datos de contacto verificables, oportunidad específica, fecha de registro y relaciones comerciales previas. Cuando exista duplicidad, se usará el primer registro válido como antecedente y Charlitron decidirá los casos posteriores mediante revisión administrativa razonada; se documentará la decisión. Ningún aliado tendrá propiedad sobre datos personales o prospectos.',
    ],
  },
  {
    title: 'Comisiones: acuerdo individual necesario',
    paragraphs: [
      'No existe porcentaje general ni ingreso garantizado. Cada comisión requiere acuerdo individual documentado, identificando aliado, prospecto/proyecto, importe fijo o fórmula inequívoca, alcance, condiciones para generarse, base de cálculo, devoluciones, impuestos, plazos y medios de pago. Registrar un referido o concretar una venta no crea por sí mismo un derecho a comisión. No se presume un acuerdo económico por aparecer una oportunidad en el panel.',
    ],
  },
  {
    title: 'Cobros parciales, pagos y devoluciones',
    paragraphs: [
      'Cuando así se acuerde individualmente, la comisión liberable se calculará conforme al importe efectivamente cobrado del cliente y las condiciones pactadas, sin exceder el importe total acordado. Se podrán reconocer cobros parciales. Los pagos al aliado requerirán autorización y requisitos fiscales aplicables. Si hay cancelación, devolución, contracargo o reducción de cobro, se aplicará el mecanismo definido en el acuerdo individual y se registrará cualquier corrección. No hay obligación de pagar importes no liberados.',
    ],
  },
  {
    title: 'Datos fiscales, medios de pago y gastos',
    paragraphs: [
      'Cuando sea necesario efectuar una comisión se podrán solicitar los datos fiscales y bancarios imprescindibles, a través de un canal identificado y protegido, sujeto a aviso de privacidad y consentimiento aplicable. No hay reembolso de gastos, viáticos o inversiones del aliado salvo acuerdo escrito previo. El tratamiento fiscal concreto y la procedencia de CFDI o retenciones serán revisados según la situación de las partes.',
    ],
  },
  {
    title: 'Confidencialidad, conducta y comunicación',
    paragraphs: [
      'El aliado guardará reserva de propuestas, precios no públicos, clientes, credenciales y materiales internos. No realizará spam, afirmaciones engañosas, promesas de ingresos, prácticas discriminatorias, acoso ni uso no autorizado de datos. Evitará divulgar información de otros aliados y notificará accesos o contactos irregulares al administrador.',
    ],
  },
  {
    title: 'Panel, errores y seguridad',
    paragraphs: [
      'El acceso es personal y está sujeto a autenticación y permisos. El aliado se compromete a proteger sus credenciales y reportar usos no autorizados. La información visible en el panel es administrativa y puede estar sujeta a conciliación documental. Los errores y ajustes de ventas, cobros o comisiones deberán corregirse por los procedimientos autorizados con trazabilidad.',
    ],
  },
  {
    title: 'Suspensión, baja y efectos',
    paragraphs: [
      'Charlitron podrá suspender o dar de baja a un aliado por incumplimiento, datos falsos, abuso de la marca, divulgación indebida, fraude, violación de privacidad o riesgos graves. También podrá terminar la participación sin exclusividad, comunicando las condiciones aplicables. Una baja no extingue automáticamente comisiones ya devengadas y debidamente acreditadas; se revisarán conforme al acuerdo individual, ni produce la supresión inmediata de registros sujetos a obligaciones legales.',
    ],
  },
  {
    title: 'Relación jurídica y ausencia de garantía',
    paragraphs: [
      'Las partes pretenden una relación independiente de colaboración por recomendaciones comerciales, sin salario, horario impuesto, subordinación ni representación general. Esta cláusula no impide la aplicación de normas laborales o fiscales si los hechos de una relación concreta configuran sus elementos. Charlitron no garantiza ventas, aceptación de referidos ni ingresos.',
    ],
  },
  {
    title: 'Cambios, avisos y controversias',
    paragraphs: [
      'Las nuevas versiones de términos se identificarán con fecha y número. Los cambios sustanciales se comunicarán y, cuando corresponda, requerirán nueva aceptación antes de continuar operando. Las controversias se procurarán resolver mediante comunicación documentada, sin renuncia a derechos irrenunciables. La ley aplicable será la mexicana y las autoridades competentes serán las que correspondan conforme a la legislación aplicable.',
    ],
  },
  {
    title: 'Aceptación y condiciones de inicio',
    paragraphs: [
      'La invitación o aprobación administrativa no equivale a aceptar términos. Antes de operar, el aliado deberá acceder a los documentos completos y realizar aceptación afirmativa registrando cuenta, fecha, versión y evidencia técnica. Si no acepta, no debe comenzar a registrar recomendaciones.',
    ],
  },
];

export const PRIVACY_DOCUMENT: LegalDocument = {
  type: 'privacy',
  version: PRIVACY_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_DATE,
  title: 'Aviso integral de privacidad',
  subtitle: `${LEGAL_PROGRAM_LABEL} · v${PRIVACY_VERSION} · ${LEGAL_DOCUMENTS_DATE_LABEL}.`,
  sections: PRIVACY_SECTIONS,
};

export const TERMS_DOCUMENT: LegalDocument = {
  type: 'terms',
  version: TERMS_VERSION,
  effectiveDate: LEGAL_DOCUMENTS_DATE,
  title: 'Términos y condiciones del programa',
  subtitle: `${LEGAL_PROGRAM_LABEL} · v${TERMS_VERSION} · ${LEGAL_DOCUMENTS_DATE_LABEL}.`,
  sections: TERMS_SECTIONS,
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS_DOCUMENT, PRIVACY_DOCUMENT];

// Representacion canonica (orden y espacios fijos) sobre la que se calcula la huella SHA-256 de cada version.
export function canonicalLegalContent(doc: LegalDocument): string {
  return JSON.stringify({
    type: doc.type,
    version: doc.version,
    effectiveDate: doc.effectiveDate,
    title: doc.title,
    subtitle: doc.subtitle,
    sections: doc.sections.map((section) => ({
      title: section.title,
      paragraphs: section.paragraphs ?? [],
      items: section.items ?? [],
    })),
  });
}
