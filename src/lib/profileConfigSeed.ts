import type { ProfileConfigData } from '@/types/profileConfig';

export const SEED_PROFILE_CONFIG: ProfileConfigData = {
  global: {
    defaultTab: 'index',
    showNotificationsIcon: true,
    showOnboarding: true,
    showChangeNameButton: false,
    maintenanceMode: false,
    maintenanceMessage: '',
    minAppVersion: '0.0.0',
    appReviewMode: false,
  },
  profiles: {
    familia: {
      label: 'Familia',
      description: 'Padres, madres y familiares',
      tabs: ['index', 'cancionero', 'contigo', 'calendario', 'fotos', 'mas'],
      homeButtons: ['comunica', 'cancionero', 'fotos', 'evangelio', 'mas'],
      masItems: ['comunica', 'eventos-pasados'],
      defaultCalendars: [],
      albumTags: ['all'],
      notificationTopics: ['general', 'eventos', 'familias'],
    },
    monitor: {
      label: 'Monitor/a',
      description: 'Monitores y catequistas',
      tabs: ['index', 'cancionero', 'contigo', 'calendario', 'fotos', 'comunica', 'mas', 'visitapapa'],
      homeButtons: ['comunica', 'cancionero', 'fotos', 'evangelio', 'mas', 'visitapapa'],
      masItems: ['comunica', 'comunica-gestion', 'eventos-pasados'],
      defaultCalendars: [],
      albumTags: ['all'],
      notificationTopics: ['general', 'eventos', 'monitores'],
    },
    miembro: {
      label: 'Miembro MCM',
      description: 'Miembros del movimiento',
      tabs: ['index', 'cancionero', 'contigo', 'calendario', 'fotos', 'comunica', 'mas', 'visitapapa'],
      homeButtons: ['comunica', 'cancionero', 'fotos', 'evangelio', 'mas', 'visitapapa'],
      masItems: ['comunica', 'comunica-gestion', 'eventos-pasados'],
      defaultCalendars: [],
      albumTags: ['all'],
      notificationTopics: ['general', 'eventos', 'miembros'],
    },
  },
  delegations: {
    _default: { label: 'General' },
  },
  delegationList: [],
  overrides: {},
};
