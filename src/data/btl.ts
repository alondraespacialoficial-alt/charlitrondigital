// ============================================================================
// Catálogo comercial BTL — Charlitron Agencia (unidad de ejecución presencial).
// Fuente única de verdad para las páginas SEO /agencia/*: lo consumen tanto
// los componentes React (features/btl) como el prerender (scripts/prerender.ts).
//
// Reglas de contenido (brief comercial aprobado):
//   - NO inventar métricas, ROI, ventas, asistentes ni resultados.
//   - NO afirmar contratación directa por una marca si hubo agencia intermediaria.
//   - NO prometer cobertura nacional (ejecución local en SLP).
//   - NO publicar precios no confirmados.
// ============================================================================

export interface BtlFaq {
  question: string;
  answer: string;
}

/** Caso documentado enlazable desde una página de servicio (blog o texto). */
export interface BtlCase {
  title: string;
  /** Ruta interna (ej. artículo del blog). Si falta, se muestra solo texto. */
  href?: string;
  /** Aclaración obligatoria cuando hubo agencia intermediaria u otro matiz. */
  note?: string;
}

export interface BtlService {
  slug: string;
  /** Nombre corto para tarjetas y enlaces. */
  shortName: string;
  /** Nombre del servicio (schema serviceType). */
  serviceType: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  queIncluye: string[];
  usos: string[];
  cobertura: string;
  proceso: string[];
  /** FAQs visibles en la página (requisito para emitir FAQPage en JSON-LD). */
  faqs: BtlFaq[];
  whatsappMessage: string;
  /** Slugs de servicios hermanos para enlazado interno. */
  relatedSlugs: string[];
  /** Casos documentados (redacción cuidadosa; nunca clientes directos si hubo intermediaria). */
  casos?: BtlCase[];
}

export const AGENCY_HUB = {
  metaTitle: 'Charlitron Agencia | Agencia BTL en San Luis Potosí',
  metaDescription:
    'Agencia BTL en San Luis Potosí con más de 10 años de experiencia: demostradoras, promotores, edecanes, activaciones, perifoneo, volanteo y producción audiovisual para marcas y agencias.',
  h1: 'Agencia BTL en San Luis Potosí',
  tagline: 'Más de 10 años creando experiencias que se viven en campo.',
  intro:
    'Charlitron Agencia es la unidad de ejecución presencial y BTL de la marca Charlitron. Diseñamos y operamos acciones en campo —demostraciones, promoción, edecanes, activaciones, perifoneo y volanteo— para marcas locales y como partner de ejecución local para agencias y marcas nacionales.',
  whatsappMessage:
    'Hola Charlitron, vi su página de Agencia BTL y quiero información sobre activaciones y servicios para mi marca.',
} as const;

export const BTL_SERVICES: BtlService[] = [
  {
    slug: 'demostradoras-san-luis-potosi',
    shortName: 'Demostradoras',
    serviceType: 'Demostradoras de productos',
    metaTitle: 'Demostradoras en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Demostradoras de productos en San Luis Potosí para punto de venta, activaciones y lanzamientos. Atención al consumidor, apoyo promocional y coordinación operativa según el alcance contratado.',
    h1: 'Demostradoras de productos en San Luis Potosí',
    intro:
      'Ponemos a tu producto en manos del consumidor. Nuestras demostradoras presentan, explican y dan a probar tu producto en punto de venta, activaciones y lanzamientos, con un trato cuidado que representa bien a tu marca.',
    queIncluye: [
      'Demostradoras con perfil acorde a tu producto y punto de venta',
      'Atención directa al consumidor: presentación, explicación y degustación o prueba del producto',
      'Apoyo promocional: entrega de material, muestras y dinámicas sencillas en punto',
      'Coordinación operativa según el alcance contratado (horarios, puntos y supervisión)',
    ],
    usos: [
      'Demostraciones y degustaciones en punto de venta',
      'Activaciones de marca en plazas y zonas comerciales',
      'Lanzamientos de producto',
      'Ferias, expos y eventos comerciales',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos compartes el producto, el punto de venta y las fechas',
      'Definimos contigo el alcance: perfil del personal, duración y coordinación',
      'Confirmamos equipo y logística antes de la fecha',
      'Ejecutamos la demostración en campo',
    ],
    faqs: [
      {
        question: '¿Con cuánta anticipación debo contratar?',
        answer:
          'Depende del alcance y la disponibilidad del equipo. Escríbenos por WhatsApp con tus fechas tentativas y te confirmamos factibilidad lo antes posible.',
      },
      {
        question: '¿El servicio incluye supervisión y reportes?',
        answer:
          'La coordinación operativa se define según el alcance contratado: puede ir desde solo el personal en punto hasta esquemas con supervisión y evidencia de actividad. Todo lo acordamos por escrito antes de iniciar.',
      },
      {
        question: '¿En qué zonas trabajan?',
        answer:
          'Principalmente San Luis Potosí capital y zona metropolitana. Si tu punto de venta está en otro municipio del estado, cuéntanos y lo evaluamos por proyecto.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, necesito demostradoras para mi producto en San Luis Potosí.',
    relatedSlugs: [
      'promotores-san-luis-potosi',
      'edecanes-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
  },
  {
    slug: 'promotores-san-luis-potosi',
    shortName: 'Promotores',
    serviceType: 'Promotores de ventas y personal promocional',
    metaTitle: 'Promotores de Ventas en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Promotores de ventas y personal promocional en San Luis Potosí: impulso en punto de venta, activaciones y campañas en campo con coordinación operativa según el alcance contratado. Cotiza por WhatsApp.',
    h1: 'Promotores y personal promocional en San Luis Potosí',
    intro:
      'Personal promocional que da mayor presencia a tu producto donde ocurre la compra: en el punto de venta y en la calle. Nuestros promotores comunican el mensaje de tu marca, interactúan con el público y apoyan la promoción y atención al consumidor en campo.',
    queIncluye: [
      'Promotores con perfil comercial para promoción en punto de venta',
      'Personal promocional para activaciones, rutas y campañas en campo',
      'Comunicación del mensaje y las promociones vigentes de tu marca',
      'Coordinación operativa según el alcance contratado',
    ],
    usos: [
      'Promoción y presencia de producto en tiendas, mostradores y autoservicios',
      'Activaciones de marca en zonas de alto tráfico',
      'Campañas de promoción por rutas o zonas',
      'Apoyo en lanzamientos y temporadas comerciales',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos cuentas qué vendes, dónde y en qué fechas',
      'Definimos perfiles, esquema de trabajo y alcance de la promoción',
      'Confirmamos el equipo y los puntos asignados',
      'Ejecutamos la promoción en campo',
    ],
    faqs: [
      {
        question: '¿Puedo contratar por día o por campaña completa?',
        answer:
          'Ambos esquemas son posibles. Trabajamos por jornada, por paquete de fechas o por campaña, según lo que necesite tu operación. Lo definimos en la cotización.',
      },
      {
        question: '¿Qué perfiles de personal manejan?',
        answer:
          'Depende de tu producto y tu punto de venta: promotor de impulso, vendedor en campo o personal de apoyo promocional. Platicamos tu caso y proponemos el perfil adecuado.',
      },
      {
        question: '¿En qué zonas trabajan?',
        answer:
          'Principalmente San Luis Potosí capital y zona metropolitana. Otras ubicaciones del estado se evalúan por proyecto.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, necesito promotores para mi campaña en San Luis Potosí.',
    relatedSlugs: [
      'demostradoras-san-luis-potosi',
      'edecanes-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
  },
  {
    slug: 'edecanes-san-luis-potosi',
    shortName: 'Edecanes',
    serviceType: 'Edecanes para eventos y activaciones',
    metaTitle: 'Edecanes para Eventos en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Edecanes para eventos, activaciones e inauguraciones en San Luis Potosí. Imagen profesional, atención a invitados y apoyo operativo. Cotiza por WhatsApp.',
    h1: 'Edecanes para eventos y activaciones en San Luis Potosí',
    intro:
      'Imagen y atención profesional para tu evento o activación. Nuestros edecanes reciben a tus invitados, apoyan la logística en sitio y representan a tu marca con la presentación que el evento requiere.',
    queIncluye: [
      'Edecanes con imagen y presentación acorde a tu evento y marca',
      'Atención a invitados: recepción, orientación y acompañamiento',
      'Apoyo operativo en sitio: registro, entrega de materiales y dinámicas',
      'Coordinación de horarios y logística según el alcance contratado',
    ],
    usos: [
      'Eventos corporativos e inauguraciones',
      'Activaciones de marca y lanzamientos',
      'Ferias, expos y stands',
      'Eventos deportivos y culturales',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos cuentas tipo de evento, fecha y sede',
      'Definimos número de edecanes, funciones y vestuario según tus lineamientos',
      'Confirmamos equipo y logística',
      'Atendemos tu evento en sitio',
    ],
    faqs: [
      {
        question: '¿Para qué tipo de eventos prestan servicio?',
        answer:
          'Eventos corporativos, inauguraciones, activaciones de marca, ferias, expos y eventos deportivos o culturales. Cuéntanos tu evento y te decimos cómo podemos apoyar.',
      },
      {
        question: '¿El vestuario está incluido?',
        answer:
          'Se define según los lineamientos de tu marca y el alcance contratado: desde uniforme proporcionado por ti hasta propuestas coordinadas de nuestra parte.',
      },
      {
        question: '¿Con cuánta anticipación debo reservar?',
        answer:
          'Depende de la fecha y del número de perfiles requeridos. Escríbenos por WhatsApp con la fecha de tu evento y confirmamos disponibilidad.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, necesito edecanes para mi evento en San Luis Potosí.',
    relatedSlugs: [
      'demostradoras-san-luis-potosi',
      'promotores-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
  },
  {
    slug: 'ejecucion-local-agencias',
    shortName: 'Ejecución local para agencias',
    serviceType: 'Ejecución local de campañas para agencias y marcas nacionales',
    metaTitle: 'Ejecución Local en SLP para Agencias | Charlitron Agencia',
    metaDescription:
      'Ejecutamos tu campaña en San Luis Potosí: demostradoras, promotores, edecanes, activaciones y perifoneo con coordinación local y evidencia de campo cuando forme parte del alcance contratado. Partner BTL para agencias nacionales.',
    h1: 'Tu proveedor local en San Luis Potosí para campañas nacionales',
    intro:
      'Si tu agencia o marca nacional necesita ejecutar en San Luis Potosí, somos tu equipo en campo. Operamos demostradoras, promotores, edecanes, activaciones, perifoneo y volanteo con coordinación local, comunicación directa y evidencia según lo acordado. Cuando una campaña llega a través de una agencia intermediaria, nuestra relación comercial es con la agencia: ejecutamos como su partner local.',
    queIncluye: [
      'Reclutamiento y coordinación local de personal: demostradoras, promotores y edecanes',
      'Ejecución de activaciones, perifoneo y volanteo en los puntos acordados',
      'Coordinación en campo y evidencia de actividad según el alcance contratado',
      'Comunicación directa con tu equipo durante toda la campaña',
    ],
    usos: [
      'Campañas nacionales que requieren ejecución en San Luis Potosí',
      'Activaciones simultáneas en varios puntos de la ciudad y zona metropolitana',
      'Programas continuos de demostración o promoción en punto de venta',
      'Apoyo local para agencias sin operación propia en la plaza',
    ],
    cobertura:
      'Ejecutamos en San Luis Potosí capital y zona metropolitana. Tu campaña puede ser nacional; nuestra ejecución es local, en la plaza que mejor conocemos.',
    proceso: [
      'Nos compartes el brief: fechas, puntos, perfiles y materiales',
      'Respondemos con propuesta operativa y cotización',
      'Alineamos alcance, evidencia requerida y cadena de comunicación',
      'Ejecutamos en campo y reportamos según lo acordado',
    ],
    faqs: [
      {
        question: '¿Qué necesitan para cotizar una ejecución?',
        answer:
          'Con un brief básico nos basta para empezar: fechas, puntos o zonas, número y perfil de personal, materiales involucrados y la evidencia que tu cliente espera. Envíalo por WhatsApp o correo.',
      },
      {
        question: '¿Entregan evidencia de la ejecución?',
        answer:
          'Sí, la evidencia (fotográfica, reportes u otros formatos) se acuerda por escrito según el alcance contratado, para que tu agencia pueda rendir cuentas a su cliente.',
      },
      {
        question: '¿Trabajan fuera de San Luis Potosí?',
        answer:
          'Nos concentramos en San Luis Potosí capital y zona metropolitana, que es la plaza que mejor operamos. Si tu campaña requiere otra ubicación del estado, lo evaluamos por proyecto.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, soy agencia/marca nacional y necesito ejecución local en San Luis Potosí.',
    relatedSlugs: [
      'demostradoras-san-luis-potosi',
      'promotores-san-luis-potosi',
      'edecanes-san-luis-potosi',
    ],
  },
  // ===================== Fase 2 =====================
  {
    slug: 'activaciones-btl-san-luis-potosi',
    shortName: 'Activaciones BTL',
    serviceType: 'Activaciones de marca y BTL',
    metaTitle: 'Activaciones BTL en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Activaciones BTL en San Luis Potosí para marcas, tiendas y lanzamientos. Dinámicas promocionales, personal e interacción con el público según el alcance contratado.',
    h1: 'Activaciones de marca y BTL en San Luis Potosí',
    intro:
      'Llevamos tu marca frente al público con activaciones planeadas según el objetivo de tu campaña: dinámicas promocionales, personal promocional e interacción directa en el punto que elijas.',
    queIncluye: [
      'Planeación de dinámicas comerciales acordes a tu campaña',
      'Personal promocional para la activación',
      'Animación e interacción con el público',
      'Juegos e incentivos según la campaña',
      'Apoyo en instalaciones y materiales según cotización',
      'Perifoneo o volanteo solo cuando se contraten como parte de la campaña',
      'Documentación operativa únicamente cuando se acuerde',
    ],
    usos: [
      'Lanzamientos de producto',
      'Promociones en tienda y punto de venta',
      'Activaciones en plazas y zonas comerciales',
      'Campañas de temporada',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos compartes el objetivo, la fecha y el punto de la activación',
      'Proponemos la dinámica, el personal y los materiales necesarios',
      'Definimos alcance, cotización y logística por escrito',
      'Ejecutamos la activación en campo',
    ],
    faqs: [
      {
        question: '¿Qué incluye una activación BTL?',
        answer:
          'Depende del objetivo de tu campaña: dinámicas promocionales, personal promocional, animación e interacción con el público, juegos e incentivos. El apoyo en instalaciones y materiales se cotiza según el alcance.',
      },
      {
        question: '¿La activación incluye perifoneo o volanteo?',
        answer:
          'Solo cuando se contraten como parte de la campaña. Pueden sumarse a la activación o contratarse como servicios independientes.',
      },
      {
        question: '¿Entregan documentación o evidencia de la activación?',
        answer:
          'La documentación operativa (fotografías, reportes u otros formatos) se entrega únicamente cuando se acuerda como parte del alcance contratado.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, quiero cotizar una activación BTL en San Luis Potosí.',
    relatedSlugs: [
      'demostradoras-san-luis-potosi',
      'perifoneo-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
    casos: [
      {
        title: 'Caso OXXO en San Luis Potosí: activación BTL',
        href: '/blog/caso-oxxo-en-san-luis-potosi-activacion-btl-y-resultados-reales',
      },
      {
        title: 'Activación navideña para RAC en San Luis Potosí',
        href: '/blog/activacion-navidena-para-rac-en-san-luis-potosi-marketing-btl-familiar',
      },
      {
        title: 'Caso Hellmann’s en San Luis Potosí: activación y promoción en punto de venta',
        href: '/blog/caso-hellmann-s-en-san-luis-potosi-activacion-btl-y-promocion-en-punto-de-venta',
        note: 'Ejecución realizada mediante agencia intermediaria.',
      },
    ],
  },
  {
    slug: 'perifoneo-san-luis-potosi',
    shortName: 'Perifoneo estratégico',
    serviceType: 'Perifoneo publicitario estratégico',
    metaTitle: 'Perifoneo Estratégico en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Perifoneo en San Luis Potosí para promociones, aperturas, reclutamiento y campañas locales. Planeación de rutas y mensajes adaptados al objetivo del servicio.',
    h1: 'Perifoneo publicitario estratégico en San Luis Potosí',
    intro:
      'Difusión móvil con planeación: definimos contigo las rutas, las zonas y el mensaje según el objetivo de tu campaña, para que tu publicidad se escuche donde está tu público.',
    queIncluye: [
      'Difusión móvil con audio publicitario',
      'Planeación de rutas y zonas según tu público y objetivo',
      'Adaptación del mensaje al objetivo del servicio',
      'Apoyo a activaciones cuando se contrata junto con ellas',
      'Monitoreo operativo únicamente según el servicio contratado',
    ],
    usos: [
      'Promociones y ofertas locales',
      'Aperturas de negocio',
      'Reclutamiento de personal',
      'Campañas por colonia o zona',
      'Refuerzo de activaciones BTL',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos cuentas qué quieres difundir y a qué zona o público va dirigido',
      'Planeamos rutas, horarios y el mensaje del perifoneo',
      'Confirmamos fechas y alcance por escrito',
      'Salimos a ruta según lo planeado',
    ],
    faqs: [
      {
        question: '¿Qué tipo de mensajes puedo difundir?',
        answer:
          'Promociones, aperturas, reclutamiento de personal y actividades comerciales. Adaptamos el mensaje al objetivo de tu servicio.',
      },
      {
        question: '¿Cómo eligen las rutas del perifoneo?',
        answer:
          'Las planeamos contigo según tu público y tu objetivo: colonias, zonas comerciales, cruceros o rutas específicas de la ciudad y la zona metropolitana.',
      },
      {
        question: '¿El servicio incluye monitoreo?',
        answer:
          'El monitoreo operativo se realiza únicamente cuando forma parte del servicio contratado. Lo definimos por escrito antes de iniciar.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, quiero cotizar perifoneo en San Luis Potosí.',
    relatedSlugs: [
      'volanteo-san-luis-potosi',
      'activaciones-btl-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
    casos: [
      {
        title: 'Caso OXXO en San Luis Potosí: perifoneo y reclutamiento',
        href: '/blog/caso-oxxo-en-san-luis-potosi-activacion-btl-y-resultados-reales',
      },
    ],
  },
  {
    slug: 'volanteo-san-luis-potosi',
    shortName: 'Volanteo',
    serviceType: 'Volanteo y distribución publicitaria',
    metaTitle: 'Volanteo en San Luis Potosí | Charlitron Agencia',
    metaDescription:
      'Volanteo en San Luis Potosí para promociones, aperturas y campañas locales. Distribución dirigida por zonas y personal de reparto según el alcance contratado.',
    h1: 'Volanteo y distribución publicitaria en San Luis Potosí',
    intro:
      'Tu publicidad, directo en las manos de tu público. Organizamos el reparto con personal y una planeación de puntos y zonas dirigida según tu campaña.',
    queIncluye: [
      'Personal para el reparto de volantes y material publicitario',
      'Planeación de puntos y zonas de distribución',
      'Distribución dirigida según tu público objetivo',
      'Supervisión o evidencia únicamente cuando formen parte del servicio contratado',
    ],
    usos: [
      'Promociones y descuentos',
      'Aperturas de negocio',
      'Campañas locales por colonia o zona',
      'Apoyo a activaciones y eventos',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos compartes tu campaña, tu público y tus fechas',
      'Planeamos puntos, zonas y cantidad de personal',
      'Definimos alcance y cotización por escrito',
      'Ejecutamos el reparto en los puntos acordados',
    ],
    faqs: [
      {
        question: '¿En qué zonas pueden repartir?',
        answer:
          'Planeamos los puntos contigo: plazas, cruceros, colonias o zonas comerciales de San Luis Potosí capital y zona metropolitana.',
      },
      {
        question: '¿Ustedes producen el material impreso?',
        answer:
          'La producción del material se define en la cotización según el alcance; también puedes proporcionarlo tú y nosotros lo distribuimos.',
      },
      {
        question: '¿El reparto incluye supervisión o evidencia?',
        answer:
          'La supervisión y la evidencia (fotográfica o de otro tipo) se incluyen únicamente cuando forman parte del servicio contratado.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, quiero cotizar un servicio de volanteo en San Luis Potosí.',
    relatedSlugs: [
      'perifoneo-san-luis-potosi',
      'activaciones-btl-san-luis-potosi',
      'promotores-san-luis-potosi',
    ],
  },
  {
    slug: 'produccion-audiovisual-san-luis-potosi',
    shortName: 'Producción audiovisual',
    serviceType: 'Producción audiovisual y videos para empresas',
    metaTitle: 'Producción Audiovisual en San Luis Potosí | Charlitron',
    metaDescription:
      'Producción audiovisual en San Luis Potosí: videos empresariales, promocionales, entrevistas y testimonios. Grabación, edición y narrativa según las necesidades del proyecto.',
    h1: 'Producción audiovisual y videos para empresas en San Luis Potosí',
    intro:
      'Videos que cuentan bien tu historia: planeamos, grabamos y editamos contenido audiovisual para empresas, con narrativa adaptada a las necesidades de tu proyecto.',
    queIncluye: [
      'Planeación audiovisual según el objetivo del proyecto',
      'Videos corporativos y promocionales',
      'Entrevistas y testimonios',
      'Edición de video',
      'Narración y musicalización según proyecto',
      'Grabación con dron solo cuando se acuerde y sea viable',
      'Adaptación a formatos digitales según alcance',
    ],
    usos: [
      'Video empresarial para tu sitio web y presentaciones',
      'Promocionales para campañas y redes sociales',
      'Entrevistas y testimonios de clientes',
      'Documentales de marca',
    ],
    cobertura:
      'San Luis Potosí capital y zona metropolitana. Otras ubicaciones dentro del estado se evalúan por proyecto.',
    proceso: [
      'Nos cuentas qué quieres comunicar y a qué audiencia',
      'Proponemos el enfoque, el formato y la planeación de la producción',
      'Definimos alcance, entregables y cotización por escrito',
      'Grabamos y editamos según lo acordado',
    ],
    faqs: [
      {
        question: '¿Qué tipo de videos producen?',
        answer:
          'Videos empresariales y promocionales, entrevistas, testimonios y documentales de marca. La narrativa y el formato se definen según las necesidades de tu proyecto.',
      },
      {
        question: '¿Incluyen grabación con dron?',
        answer:
          'Solo cuando se acuerda dentro del proyecto y es viable en la ubicación. Lo evaluamos juntos antes de confirmarlo.',
      },
      {
        question: '¿Entregan versiones para redes sociales?',
        answer:
          'La adaptación a formatos digitales (verticales, cortos, versiones por plataforma) se define según el alcance del proyecto.',
      },
    ],
    whatsappMessage:
      'Hola Charlitron, quiero cotizar un video empresarial en San Luis Potosí.',
    relatedSlugs: [
      'activaciones-btl-san-luis-potosi',
      'edecanes-san-luis-potosi',
      'ejecucion-local-agencias',
    ],
    casos: [
      {
        title: 'Proyecto documental para Restaurante Galicia',
      },
    ],
  },
];

export function getBtlService(slug: string): BtlService | undefined {
  return BTL_SERVICES.find((s) => s.slug === slug);
}
