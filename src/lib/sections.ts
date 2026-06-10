import type { JSONData } from '@/components/JSONManager';
import {
  Home,
  Database,
  Images,
  Calendar,
  Music,
  Gamepad2,
  Zap,
  Bell,
  Users,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for the app's main sections: their identity, the
 * URL slug used in the address bar, the icon and the copy shown in the
 * sidebar and the home dashboard. Keeping this in one place lets routing,
 * navigation and the home shortcuts stay perfectly in sync.
 */
export type SectionId =
  | 'home'
  | 'app'
  | 'albums'
  | 'calendars'
  | 'songs'
  | 'wordle'
  | 'activities'
  | 'notifications'
  | 'surveys'
  | 'profileConfig';

export interface SectionMeta {
  id: SectionId;
  /** Short title used in the sidebar and breadcrumb. */
  title: string;
  /** One-line description used in the sidebar and home cards. */
  description: string;
  /** URL slug, e.g. `/notificaciones`. Empty string for home (`/`). */
  slug: string;
  icon: LucideIcon;
}

export const SECTION_META: Record<SectionId, SectionMeta> = {
  home: {
    id: 'home',
    title: 'Inicio',
    description: 'Atajos rápidos',
    slug: '',
    icon: Home,
  },
  notifications: {
    id: 'notifications',
    title: 'Notificaciones',
    description: 'Enviar push',
    slug: 'notificaciones',
    icon: Bell,
  },
  surveys: {
    id: 'surveys',
    title: 'Encuestas',
    description: 'Encuestas y evaluaciones',
    slug: 'encuestas',
    icon: ClipboardList,
  },
  app: {
    id: 'app',
    title: 'App',
    description: 'Feedback y config',
    slug: 'app',
    icon: Database,
  },
  albums: {
    id: 'albums',
    title: 'Álbumes',
    description: 'Galerías de fotos',
    slug: 'albums',
    icon: Images,
  },
  calendars: {
    id: 'calendars',
    title: 'Calendarios',
    description: 'Eventos y fechas',
    slug: 'calendarios',
    icon: Calendar,
  },
  songs: {
    id: 'songs',
    title: 'Cantoral',
    description: 'Canciones y repertorio',
    slug: 'cantoral',
    icon: Music,
  },
  wordle: {
    id: 'wordle',
    title: 'Wordle',
    description: 'Palabra diaria',
    slug: 'wordle',
    icon: Gamepad2,
  },
  activities: {
    id: 'activities',
    title: 'Actividades',
    description: 'Eventos y secciones',
    slug: 'actividades',
    icon: Zap,
  },
  profileConfig: {
    id: 'profileConfig',
    title: 'Perfiles',
    description: 'Perfiles, delegaciones, sistema',
    slug: 'perfiles',
    icon: Users,
  },
};

/** Order of the sections as shown in the sidebar (after "Inicio"). */
export const SECTION_ORDER: SectionId[] = [
  'app',
  'albums',
  'calendars',
  'songs',
  'wordle',
  'activities',
  'notifications',
  'surveys',
  'profileConfig',
];

const SLUG_TO_SECTION: Record<string, SectionId> = Object.values(SECTION_META).reduce(
  (acc, meta) => {
    if (meta.id !== 'home') acc[meta.slug] = meta.id;
    return acc;
  },
  {} as Record<string, SectionId>,
);

/** Resolve the URL path (`/notificaciones`) for a section. */
export function pathForSection(id: SectionId): string {
  return id === 'home' ? '/' : `/${SECTION_META[id].slug}`;
}

/** Resolve a section from the first segment of the URL path. */
export function sectionForPath(pathname: string): SectionId {
  const slug = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  if (!slug) return 'home';
  return SLUG_TO_SECTION[slug] ?? 'home';
}

/**
 * Whether a section already has content in Firebase, used to render the
 * "has data" dot in the sidebar and home dashboard. Notifications has no
 * stored blob (it acts on a live queue), so it always counts as present.
 */
export function sectionHasData(jsonData: JSONData, id: SectionId): boolean {
  if (id === 'notifications' || id === 'home' || id === 'surveys') return true;
  const value = jsonData[id as keyof JSONData] as unknown;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  if (id === 'app') {
    const feedback = record.feedback;
    return !!feedback && typeof feedback === 'object' && Object.keys(feedback).length > 0;
  }
  if (id === 'profileConfig') {
    return !!record.data;
  }
  if (record.data !== undefined) {
    if (Array.isArray(record.data)) return record.data.length > 0;
    return (
      !!record.data &&
      typeof record.data === 'object' &&
      Object.keys(record.data).length > 0
    );
  }
  return Object.keys(record).length > 0;
}
