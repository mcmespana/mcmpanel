// Catálogos y límites compartidos por el composer de push y por la pestaña de
// notificaciones silenciosas. Espejo de la MCM App (types/notifications.ts y
// utils/notificationRoutes.ts): si cambia allí, cambia aquí.

// Tap por defecto: NO se manda internalRoute y la app abre ESTA notificación en
// grande dentro de la campana (casa data.id con /notifications/<id>).
export const DETAIL = '__detail';

// Cada categoría es también, desde la build de agosto de 2026, un canal de
// Android separado (mismo id salvo "general" → "default").
export const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'cancionero', label: 'Cancionero' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'celebraciones', label: 'Celebraciones' },
  { id: 'urgente', label: 'Urgente' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
];

// Rutas REALES de la MCM App (Expo Router) agrupadas para el desplegable.
// Las del grupo "según perfil" (⚠️) dependen del perfil del usuario: si su
// perfil no tiene esa tab, la navegación puede no ir a ningún sitio. Para
// envíos universales usa Inicio, Calendario, Fotos o Más.
export const ROUTE_GROUPS: { label: string; routes: { id: string; label: string }[] }[] = [
  {
    label: 'Secciones para todos',
    routes: [
      { id: '/(tabs)/index', label: 'Inicio' },
      { id: '/(tabs)/calendario', label: 'Calendario' },
      { id: '/(tabs)/fotos', label: 'Fotos / Álbumes' },
      { id: '/(tabs)/mas', label: 'Más (Jubileo, Visita del Papa…)' },
    ],
  },
  {
    label: 'Según perfil del usuario ⚠️',
    routes: [
      { id: '/(tabs)/cancionero', label: 'Cancionero' },
      { id: '/(tabs)/contigo', label: 'Contigo' },
      { id: '/(tabs)/contigo/evangelio', label: 'Contigo · Evangelio del día' },
      { id: '/(tabs)/contigo/oracion', label: 'Contigo · Oración' },
      { id: '/(tabs)/contigo/revision', label: 'Contigo · Revisión' },
      { id: '/(tabs)/contigo/bookmarks', label: 'Contigo · Favoritos' },
      { id: '/(tabs)/visitapapa', label: 'Visita del Papa (si está activa)' },
    ],
  },
];

export const MAX_TITLE = 50;
export const MAX_BODY = 200;
export const MAX_BODY_LONG = 2000;
