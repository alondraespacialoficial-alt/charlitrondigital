import { ServiceItem, BusinessNeed, ShowcaseProject, WorkStep } from '../types';

export const PHONE_DISPLAY = "444 423 70 92";
export const PHONE_RAW = "524444237092";
export const CONTACT_EMAIL = "nadrian18@gmail.com";
export const FACEBOOK_URL = "https://www.facebook.com/charlitronagencia";
export const INSTAGRAM_URL = "https://www.instagram.com/charlitron_agencia/";
export const HERO_VIDEO_SRC = "/hero-video.mp4"; // Ruta local en /public o link directo (ej. https://...)

export function createWhatsAppUrl(message: string): string {
  return `https://wa.me/${PHONE_RAW}?text=${encodeURIComponent(message)}`;
}

export const SERVICES_LIST: ServiceItem[] = [
  {
    id: "webs",
    title: "Webs",
    description: "Sitios rápidos, modernos y orientados a generar contactos o ventas.",
    iconName: "Globe",
    detailPoints: [
      "Velocidad de carga inmediata en celular y computadora",
      "Diseño enfocado 100% en conversión a WhatsApp o llamada",
      "Estructura clara para que el cliente entienda y compre rápido"
    ],
    sampleOutcome: "Ideal para captar clientes desde redes sociales y Google"
  },
  {
    id: "apps",
    title: "Apps",
    description: "Aplicaciones y herramientas diseñadas alrededor de procesos reales del negocio.",
    iconName: "Smartphone",
    detailPoints: [
      "Adaptadas al flujo exacto de tu equipo y clientes",
      "Acceso web o móvil sin instalaciones complicadas",
      "Manejo de pedidos, seguimiento y control operativo"
    ],
    sampleOutcome: "Elimina libretas, notas sueltas y errores manuales"
  },
  {
    id: "automatizaciones",
    title: "Automatizaciones",
    description: "Reducimos tareas repetitivas y conectamos procesos.",
    iconName: "Zap",
    detailPoints: [
      "Notificaciones automáticas a clientes por WhatsApp",
      "Sincronización entre formularios, hojas de cálculo y correos",
      "Generación de reportes y avisos sin intervención humana"
    ],
    sampleOutcome: "Ahorra horas cada semana en tareas repetitivas"
  },
  {
    id: "ia",
    title: "Inteligencia Artificial",
    description: "Integramos IA cuando realmente aporta valor al negocio.",
    iconName: "Bot",
    detailPoints: [
      "Respuestas inteligentes a preguntas frecuentes de clientes",
      "Clasificación automática de prospectos y cotizaciones",
      "Análisis rápido de información comercial para decisiones clave"
    ],
    sampleOutcome: "Atención 24/7 sin descuidar el trato personalizado"
  }
];

export const BUSINESS_NEEDS: BusinessNeed[] = [
  {
    id: "vender-mas",
    label: "Quiero vender más",
    description: "Webs y flujos de captación para recibir prospectos listos para comprar.",
    iconName: "TrendingUp",
    whatsappMessage: "Hola, vi Charlitron Digital. Quiero vender más en mi negocio.",
    highlight: true
  },
  {
    id: "automatizar",
    label: "Quiero automatizar procesos",
    description: "Elimina pasos manuales entre recepción, confirmación y entrega.",
    iconName: "Cpu",
    whatsappMessage: "Hola, vi Charlitron Digital. Quiero automatizar un proceso de mi negocio.",
    highlight: true
  },
  {
    id: "organizar-citas",
    label: "Quiero organizar citas o clientes",
    description: "Calendarios automáticos y recordatorios para evitar cancelaciones.",
    iconName: "CalendarCheck",
    whatsappMessage: "Hola, vi Charlitron Digital. Quiero organizar citas y el seguimiento de clientes."
  },
  {
    id: "cotizar-rapido",
    label: "Quiero cotizar más rápido",
    description: "Calculadoras y cotizadores que entregan presupuestos al instante.",
    iconName: "Calculator",
    whatsappMessage: "Hola, vi Charlitron Digital. Quiero agilizar y digitalizar mis cotizaciones."
  },
  {
    id: "app-negocio",
    label: "Quiero una app para mi negocio",
    description: "Herramienta a la medida para operaciones internas o para tus clientes.",
    iconName: "LayoutGrid",
    whatsappMessage: "Hola, vi Charlitron Digital. Quiero una app a la medida para mi negocio."
  },
  {
    id: "asesoria",
    label: "No sé qué necesito — quiero asesoría",
    description: "Cuéntanos tu rutina actual y te decimos por dónde empezar.",
    iconName: "HelpCircle",
    whatsappMessage: "Hola, vi Charlitron Digital. No sé qué tecnología necesito exactamente, me gustaría recibir asesoría para mi negocio.",
    highlight: true
  }
];

export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    id: "charlitron-vet",
    tag: "Sistema Especializado",
    title: "Charlitron VET",
    subtitle: "Software operativo para clínicas y servicios veterinarios",
    description: "Plataforma integral diseñada para el control diario de consultas, pacientes y comunicación con dueños de mascotas.",
    badge: "Caso Real",
    keyFeatures: [
      "Agenda médica por doctor con bloqueo inteligente de horarios",
      "Expedientes clínicos de mascotas con historial de vacunas y tratamientos",
      "Recordatorios automáticos a dueños vía WhatsApp",
      "Panel de caja, ventas diarias y control de insumos"
    ],
    metrics: [
      { label: "Reducción de ausentismo", value: "-65%" },
      { label: "Tiempo ahorrado al día", value: "2.5 hrs" },
      { label: "Satisfacción clientes", value: "98%" }
    ],
    visualType: "vet",
    whatsappMessage: "Hola, me interesa conocer más sobre el sistema Charlitron VET para veterinarias.",
    liveUrl: "https://charlitronvet.com/"
  },
  {
    id: "eventos-360",
    tag: "Plataforma de Directorio",
    title: "Charlitron Eventos 360",
    subtitle: "Directorio y gestión para proveedores de eventos",
    description: "Ecosistema digital donde salones, fotógrafos, banqueteros y DJ's muestran sus servicios y cotizan paquetes en segundos.",
    badge: "Caso Real",
    keyFeatures: [
      "Perfiles profesionales con galerías de alta resolución",
      "Constructor de paquetes y cotizador interactivo para clientes",
      "Estadísticas en tiempo real de visitas y prospectos generados",
      "Conexión directa a WhatsApp de cada proveedor"
    ],
    metrics: [
      { label: "Proveedores activos", value: "+120" },
      { label: "Cotizaciones generadas", value: "3,400+" },
      { label: "Carga promedio", value: "< 0.8s" }
    ],
    visualType: "eventos",
    whatsappMessage: "Hola, vi Charlitron Eventos 360 y me interesa una plataforma similar para mi sector.",
    liveUrl: "https://charlitroneventos360.com/"
  },
  {
    id: "sistemas-citas",
    tag: "Herramienta Operativa",
    title: "Sistemas de Citas y Reservas",
    subtitle: "Gestión autónoma de horarios y reservas",
    description: "Organiza reservas, horarios y seguimiento sin depender de mensajes desordenados ni libretas.",
    badge: "Solución Lista",
    keyFeatures: [
      "Disponibilidad en tiempo real para autoservicio del cliente",
      "Sincronización con calendarios de Google o internos",
      "Confirmación automática y botón de reprogramación",
      "Filtro por sucursal, especialista o tipo de servicio"
    ],
    metrics: [
      { label: "Cero empalmes", value: "100%" },
      { label: "Atención fuera de horario", value: "24/7" }
    ],
    visualType: "citas",
    whatsappMessage: "Hola, me interesa implementar un sistema de citas para organizar las reservas de mi negocio."
  },
  {
    id: "cotizadores-digitales",
    tag: "Herramienta de Ventas",
    title: "Cotizadores Digitales",
    subtitle: "Presupuestos precisos e instantáneos",
    description: "Convierte preguntas repetitivas en solicitudes estructuradas listas para atender y cerrar.",
    badge: "Solución Lista",
    keyFeatures: [
      "Cálculo automático de medidas, materiales o paquetes",
      "Resumen formal descargable o enviado a WhatsApp al instante",
      "Filtro previo que ahorra horas de llamadas de sondeo",
      "Recolección estandarizada de datos del prospecto"
    ],
    metrics: [
      { label: "Tiempo de respuesta", value: "Instantáneo" },
      { label: "Cierre de ventas", value: "+40%" }
    ],
    visualType: "cotizador",
    whatsappMessage: "Hola, quiero un cotizador digital para que mis clientes calculen presupuestos automáticamente."
  },
  {
    id: "paneles-administrativos",
    tag: "Control de Negocio",
    title: "Paneles Administrativos",
    subtitle: "Visión clara y centralizada de tu operación",
    description: "Información importante del negocio en un solo lugar, accesible desde cualquier dispositivo.",
    badge: "Solución Lista",
    keyFeatures: [
      "Tableros ejecutivos con métricas de ventas, cobros y pedidos",
      "Filtros por fecha, vendedor o línea de producto",
      "Permisos por rol (administrador, encargado, operador)",
      "Reportes listos para exportar con un solo clic"
    ],
    metrics: [
      { label: "Visibilidad total", value: "360°" },
      { label: "Decisiones con datos", value: "En vivo" }
    ],
    visualType: "dashboard",
    whatsappMessage: "Hola, necesito un panel administrativo para centralizar la información de mi negocio."
  }
];

export const WORK_STEPS: WorkStep[] = [
  {
    number: "01",
    title: "Escuchamos",
    description: "Nos explicas cómo funciona actualmente tu negocio, sin tecnicismos.",
    iconName: "Ear"
  },
  {
    number: "02",
    title: "Detectamos",
    description: "Identificamos dónde se pierde tiempo, clientes o dinero.",
    iconName: "SearchCheck"
  },
  {
    number: "03",
    title: "Proponemos",
    description: "Diseñamos una solución adecuada y directa al problema.",
    iconName: "Lightbulb"
  },
  {
    number: "04",
    title: "Construimos",
    description: "Desarrollamos solo lo necesario, rápido y con pruebas reales.",
    iconName: "Wrench"
  }
];

export const AGENCY_SERVICES = [
  "Producción de video",
  "Activaciones de marca",
  "Perifoneo profesional",
  "Publicidad BTL",
  "Contenido y campañas"
];
