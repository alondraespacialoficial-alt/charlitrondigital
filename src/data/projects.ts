export type ProjectGroup = 'software' | 'experience';

export type ProjectFeatureStatus =
  | 'published'
  | 'implemented-pending-validation'
  | 'confirmed-scope-evidence-pending'
  | 'demonstration-pending';

export interface ProjectFeature {
  name: string;
  status: ProjectFeatureStatus;
  description?: string;
}

export interface ProjectSection {
  title: string;
  description: string;
  features: ProjectFeature[];
}

export interface ProjectImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface PortfolioProject {
  slug: string;
  group: ProjectGroup;
  title: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  problem: string;
  solution: string;
  officialUrl: string;
  images?: ProjectImage[];
  features: ProjectFeature[];
  sections?: ProjectSection[];
  whatsappMessage: string;
}

export const PROJECTS: PortfolioProject[] = [
  {
    slug: 'charlitron-vet',
    group: 'software',
    title: 'Charlitron VET',
    summary: 'Software especializado para clínicas veterinarias y sus procesos operativos.',
    metaTitle: 'Charlitron VET | Proyecto de Charlitron Digital',
    metaDescription:
      'Charlitron VET, software especializado para clínicas veterinarias y procesos operativos.',
    problem:
      'Las clínicas veterinarias necesitan herramientas que se adapten a sus procesos de atención y operación.',
    solution:
      'Charlitron VET es un software especializado para clínicas veterinarias. Las funciones específicas se documentarán cuando haya capturas autorizadas y validación del producto.',
    officialUrl: 'https://charlitronvet.com/',
    features: [],
    whatsappMessage: 'Hola, me interesa una solución similar a Charlitron VET.',
  },
  {
    slug: 'eventos-360',
    group: 'software',
    title: 'Charlitron Eventos 360',
    summary: 'Plataforma digital de servicios y proveedores para eventos.',
    metaTitle: 'Charlitron Eventos 360 | Proyecto de Charlitron Digital',
    metaDescription:
      'Charlitron Eventos 360, plataforma de servicios y proveedores para eventos.',
    problem:
      'Quienes organizan eventos necesitan encontrar y conocer opciones de servicios y proveedores.',
    solution:
      'Charlitron Eventos 360 es una plataforma para servicios y proveedores de eventos. Las funciones específicas se documentarán cuando haya capturas autorizadas y validación del producto.',
    officialUrl: 'https://charlitroneventos360.com/',
    features: [],
    whatsappMessage: 'Hola, me interesa una plataforma similar a Charlitron Eventos 360.',
  },
  {
    slug: 'planeaslp-celebra-tu-evento',
    group: 'software',
    title: 'PlaneaSLP / Celebra tu Evento',
    summary: 'Una plataforma para organizar eventos e invitaciones digitales.',
    metaTitle: 'PlaneaSLP / Celebra tu Evento | Proyecto de Charlitron Digital',
    metaDescription:
      'PlaneaSLP / Celebra tu Evento: invitaciones digitales y herramientas para organizar eventos.',
    problem:
      'La información de un evento puede quedar repartida entre invitaciones, horarios, itinerarios y ubicaciones.',
    solution:
      'Una misma plataforma reúne invitaciones digitales y herramientas para organizar la información del evento. Invitaciones V2 está publicada en producción.',
    officialUrl: 'https://planeaslp.com/',
    features: [
      {
        name: 'Invitaciones V2',
        status: 'published',
      },
      {
        name: 'Presentación móvil, galería, horarios independientes de ceremonia y recepción, itinerario, mapas y navegación entre secciones',
        status: 'published',
      },
      {
        name: 'Panel Super Admin, portal de clientes, cotizaciones, RSVP y pases QR',
        status: 'implemented-pending-validation',
        description: 'Módulos implementados; los flujos completos aún requieren pruebas.',
      },
    ],
    whatsappMessage: 'Hola, me interesa una plataforma similar a PlaneaSLP / Celebra tu Evento.',
  },
  {
    slug: 'viajero-del-tiempo',
    group: 'experience',
    title: 'Charlitron El Viajero del Tiempo',
    summary:
      'Proyecto de historia y memoria cultural de San Luis Potosí, con narrativa, investigación y producción audiovisual.',
    metaTitle: 'El Viajero del Tiempo | Proyecto cultural de Charlitron Digital',
    metaDescription:
      'El Viajero del Tiempo: historia y memoria cultural de San Luis Potosí con narrativa y producción audiovisual.',
    problem:
      'La historia y la memoria cultural de San Luis Potosí pueden explorarse mediante formatos narrativos y audiovisuales.',
    solution:
      'El proyecto combina narrativa histórica, investigación, producción audiovisual y recreaciones asistidas por IA. La disponibilidad de cada experiencia se mostrará solo con evidencia.',
    officialUrl: 'https://charlitronviajerodeltiempo.com/',
    features: [],
    sections: [
      {
        title: 'Narrativa histórica e investigación',
        description: 'Contenido histórico e investigación alrededor de la memoria cultural potosina.',
        features: [
          { name: 'Narrativa histórica e investigación', status: 'confirmed-scope-evidence-pending' },
        ],
      },
      {
        title: 'Producción audiovisual y recreaciones asistidas por IA',
        description: 'Producción audiovisual y recreaciones históricas asistidas por inteligencia artificial.',
        features: [
          { name: 'Producción audiovisual', status: 'confirmed-scope-evidence-pending' },
          { name: 'Recreaciones asistidas por IA', status: 'confirmed-scope-evidence-pending' },
        ],
      },
      {
        title: 'Avatares interactivos',
        description: 'La disponibilidad y el alcance de esta experiencia requieren demostración.',
        features: [{ name: 'Avatares interactivos', status: 'demonstration-pending' }],
      },
      {
        title: 'Jardín de la Memoria',
        description: 'La experiencia y su disponibilidad requieren demostración.',
        features: [{ name: 'Jardín de la Memoria', status: 'demonstration-pending' }],
      },
      {
        title: 'Experiencias inmersivas en tiempo real',
        description: 'La experiencia y su operación en tiempo real requieren demostración.',
        features: [{ name: 'Experiencias inmersivas en tiempo real', status: 'demonstration-pending' }],
      },
    ],
    whatsappMessage: 'Hola, me interesa una experiencia similar a Charlitron El Viajero del Tiempo.',
  },
];

export const PROJECT_FEATURE_STATUS_LABELS: Record<ProjectFeatureStatus, string> = {
  published: 'Publicado en producción',
  'implemented-pending-validation': 'Implementado; pruebas completas pendientes',
  'confirmed-scope-evidence-pending': 'Confirmado en el alcance; evidencia pendiente',
  'demonstration-pending': 'Demostración pendiente',
};

export const CONCEPT_SOLUTIONS = [
  {
    title: 'Citas y reservas',
    description: 'Concepto de agenda y reservas para adaptar a las necesidades de cada proyecto.',
  },
  {
    title: 'Cotizadores',
    description: 'Concepto de flujo para recopilar datos y preparar cotizaciones.',
  },
  {
    title: 'Paneles administrativos',
    description: 'Concepto de interfaz para organizar información y tareas de una operación.',
  },
];