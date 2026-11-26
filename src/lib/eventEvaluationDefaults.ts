import type { SurveyConfig } from '@/lib/surveys';

// ─────────────────────────────────────────────────────────────────────────────
// ESPEJO de mcm-app/constants/evaluation.ts (DEFAULT_EVENT_EVALUATION +
// EVENT_EVALUATION_DEFAULTS). Generado desde el código de la app el 2026-11-26.
//
// Por qué existe: si activities/<evento>/evaluacion/data no trae `questions`,
// la app pinta las del código (getEventEvaluationDefault). El Congreso M+C
// (congresomc26) es así: en Firebase solo está la programación. Sin este espejo
// el panel analizaría preguntas inferidas: sin enunciados, sin opciones y sin
// rutas (showIf). Mismo patrón que DEFAULT_APP_EVALUATION en surveys.ts.
//
// ⚠️ Si la app cambia estas preguntas, cópialas aquí (o, mejor, súbelas a
// Firebase desde el editor del panel: entonces mandan las de Firebase).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_EVENT_EVALUATION: SurveyConfig = {
  evaluationOpen: true,
  title: 'Evalúa la actividad',
  intro: 'Tu opinión nos ayuda a mejorar los próximos encuentros. Te llevará un par de minutos 🙏',
  questions: [
    {
      id: 'general',
      type: 'stars',
      label: 'Valoración general',
    },
    {
      id: 'organizacion_mcm',
      type: 'stars',
      label: 'Organización MCM',
      optional: true,
    },
    {
      id: 'organizacion_papa',
      type: 'stars',
      label: 'Organización Visita del Papa (general)',
      optional: true,
    },
    {
      id: 'convivencia',
      type: 'stars',
      label: 'Convivencia',
      optional: true,
    },
    {
      id: 'gustado',
      type: 'text',
      label: '¿Qué es lo que más te ha gustado?',
      placeholder: 'Eso que te llevas de estos días…',
      optional: true,
    },
    {
      id: 'mejorar',
      type: 'text',
      label: '¿Qué mejorarías?',
      placeholder: 'Tus sugerencias, con cariño…',
      optional: true,
    },
    {
      id: 'comentarios',
      type: 'text',
      label: 'Comentarios',
      placeholder: 'Cualquier otra cosa que quieras contarnos…',
      optional: true,
    },
  ],
};

export const EVENT_EVALUATION_DEFAULTS: Record<string, SurveyConfig> = {
  congresomc26: {
    status: 'scheduled',
    opensAt: 1795942800000,
    closesAt: 1796079600000,
    title: 'Evalúa el Congreso M+C',
    intro:
      'Cuéntanos qué tal ha ido el Congreso. Tu opinión nos ayuda a preparar los próximos. Te llevará un par de minutos 🙏',
    thanksTitle: '¡Gracias!',
    thanksBody: 'Tu opinión nos ayuda a seguir despertando evangelizadores 🧡',
    closedTitle: 'La evaluación ya está cerrada',
    closedBody: 'Gracias por haber vivido el Congreso con nosotros.',
    questions: [
      {
        id: 'curso',
        type: 'single',
        label: '¿En qué parte del Congreso has participado?',
        options: [
          {
            value: 'premonitores',
            label: 'Formación de Pre-monitores',
          },
          {
            value: 'despierta',
            label: 'Curso Despierta',
          },
        ],
      },
      {
        id: 'pm_valoracion',
        type: 'scale',
        section: 'Pre-monitores',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label: '¿Qué valoración le das al curso?',
        min: 1,
        max: 8,
        minLabel: 'Muy baja',
        maxLabel: 'Muy alta',
      },
      {
        id: 'pm_quedas',
        type: 'text',
        section: 'Pre-monitores',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label:
          '¿Con qué te quedas? ¿Qué formaciones te han resultado más útiles y por qué? ¿Qué es lo que más te ha gustado?',
        placeholder: 'Cuéntanos con calma…',
      },
      {
        id: 'pm_falta',
        type: 'text',
        section: 'Pre-monitores',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label: 'Respecto a la formación, ¿qué te ha faltado?',
        placeholder: 'Temas, tiempo, materiales…',
      },
      {
        id: 'pm_formato',
        type: 'single',
        section: 'Pre-monitores',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label: 'Para las próximas formaciones, ¿qué prefieres?',
        options: [
          {
            value: 'cortas',
            label:
              'Formaciones cortas, de una hora como máximo y variadas: pequeñas pinceladas y profundizar en el futuro',
          },
          {
            value: 'profundas',
            label: 'Centrarnos solo en algunos temas y profundizar mucho más en ellos',
          },
          {
            value: 'mixtas',
            label: 'Mezclar formaciones más largas, de más de una hora, con otras cortas',
          },
          {
            value: 'asi',
            label: 'Los tiempos de las formaciones han estado bien: dejarlo así',
          },
        ],
      },
      {
        id: 'pm_mat',
        type: 'single',
        section: 'Pre-monitores',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label: '¿Tienes intención de hacer el MAT Consolación en el verano de 2027?',
        options: [
          {
            value: 'si',
            label:
              'Sí, me gustaría hacer el curso oficial de Monitor de Actividades de Tiempo Libre Consolación',
          },
          {
            value: 'pensarlo',
            label: 'Me lo tengo que pensar mucho',
          },
          {
            value: 'no',
            label: 'No, no me interesa',
          },
          {
            value: 'nosequees',
            label: 'MAT… ¿de qué me hablas? No sé qué es',
          },
        ],
      },
      {
        id: 'dp_expectativas',
        type: 'scale',
        section: 'Curso Despierta',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label: 'Antes de empezar el curso, ¿qué expectativas traías? ¿Con cuánta motivación llegaste?',
        min: 1,
        max: 8,
        minLabel: 'Muy poca motivación',
        maxLabel: 'Muchas ganas',
      },
      {
        id: 'dp_valio',
        type: 'yesno',
        section: 'Curso Despierta',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label:
          '¿Consideras que ha valido la pena hacer un Curso Despierta como parte de la formación de monitores, dentro de un congreso de monitores?',
      },
      {
        id: 'dp_momentos',
        type: 'multi',
        section: 'Curso Despierta',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label: '¿Qué momentos del curso te han gustado más? (hasta 3)',
        maxSelect: 3,
        options: [
          {
            value: 'te_invito_a_despertar',
            label: 'Viernes · Te invito a despertar',
          },
          {
            value: 'cambiar_la_mentalidad',
            label: 'Viernes · Cambiar la mentalidad',
          },
          {
            value: 'el_estilo_de_jesus',
            label: 'Sábado · El estilo de Jesús',
          },
          {
            value: 'proyecto_despierta',
            label: 'Sábado · Proyecto #Despierta',
          },
          {
            value: 'el_anuncio_del_kerigma',
            label: 'Sábado · El anuncio del Kerigma',
          },
          {
            value: 'jovenes_destinatarios',
            label: 'Sábado · Jóvenes: destinatarios/as de la evangelización',
          },
          {
            value: 'la_finalidad_de_la_evangelizacion',
            label: 'Sábado · La finalidad de la evangelización',
          },
          {
            value: 'adoracion_y_alabanza',
            label: 'Sábado · Adoración y alabanza',
          },
          {
            value: 'iglesia_tema_candente',
            label: 'Domingo · Iglesia: tema candente',
          },
          {
            value: 'evangelizacion_conjunta',
            label: 'Domingo · Evangelización conjunta… ¿y ahora qué?',
          },
          {
            value: 'comparte_tu_despierta',
            label: 'Domingo · Comparte tu despierta',
          },
        ],
      },
      {
        id: 'practicos',
        type: 'ratings',
        section: 'Aspectos prácticos',
        label: 'Valora los aspectos prácticos',
        items: [
          {
            value: 'lugar',
            label: 'El lugar: Benicàssim, zona La Plana',
          },
          {
            value: 'albergue',
            label: 'El albergue Argentina',
          },
          {
            value: 'almuerzos_meriendas',
            label: 'Almuerzos y meriendas',
          },
          {
            value: 'comidas_albergue',
            label: 'Comidas del albergue',
          },
          {
            value: 'ambiente_grupo',
            label: 'Ambiente en el grupo',
          },
        ],
      },
      {
        id: 'pm_mejora',
        type: 'text',
        optional: true,
        section: 'Para terminar',
        showIf: {
          questionId: 'curso',
          equals: 'premonitores',
        },
        label: '¿Tienes alguna propuesta de mejora para el curso en general?',
        placeholder: 'Tus ideas, con cariño…',
      },
      {
        id: 'dp_participacion',
        type: 'text',
        optional: true,
        section: 'Para terminar',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label: '¿Qué crees que podríamos hacer para incrementar la participación en este tipo de encuentros?',
        placeholder: 'Tus ideas…',
      },
      {
        id: 'dp_mejora',
        type: 'text',
        optional: true,
        section: 'Para terminar',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label: 'Sugerencias de mejora en general',
        placeholder: 'Tus sugerencias, con cariño…',
      },
      {
        id: 'dp_otra',
        type: 'text',
        optional: true,
        section: 'Para terminar',
        showIf: {
          questionId: 'curso',
          equals: 'despierta',
        },
        label: '¿Algo más que quieras decirnos?',
        placeholder: 'Cualquier otra cosa que quieras contarnos…',
      },
    ],
  },
};

export const getEventEvaluationDefault = (eventId: string): SurveyConfig =>
  EVENT_EVALUATION_DEFAULTS[eventId] ?? DEFAULT_EVENT_EVALUATION;
