import { ServiceItem, BusinessNeed, WorkStep } from '../types';

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
