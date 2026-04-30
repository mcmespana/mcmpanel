import type { ProfileType } from '@/types/profileConfig';

export const KNOWN_TABS = [
  'index', 'cancionero', 'contigo', 'calendario', 'fotos', 'comunica', 'mas',
] as const;

export const KNOWN_HOME_BUTTONS = [
  'comunica', 'cancionero', 'fotos', 'evangelio', 'mas',
] as const;

export const KNOWN_MAS_ITEMS = [
  'comunica', 'comunica-gestion', 'jubileo',
] as const;

export const KNOWN_ALBUM_TAGS = [
  'all', 'general', 'encuentros', 'interno', 'monitores', 'miembros',
] as const;

export const KNOWN_NOTIFICATION_TOPICS = [
  'general', 'eventos', 'familias', 'monitores', 'miembros',
] as const;

export const PROFILE_TYPES: ProfileType[] = ['familia', 'monitor', 'miembro'];

export const TAB_LABELS: Record<string, string> = {
  index: 'Inicio',
  cancionero: 'Cancionero',
  contigo: 'Contigo',
  calendario: 'Calendario',
  fotos: 'Fotos',
  comunica: 'Comunica',
  mas: 'Más',
};

export const HOME_BUTTON_LABELS: Record<string, string> = {
  comunica: 'Comunica',
  cancionero: 'Cancionero',
  fotos: 'Fotos',
  evangelio: 'Evangelio',
  mas: 'Más',
};

export const MAS_ITEM_LABELS: Record<string, string> = {
  comunica: 'Comunica',
  'comunica-gestion': 'Comunica (gestión)',
  jubileo: 'Jubileo',
};

export const ALBUM_TAG_LABELS: Record<string, string> = {
  all: 'Todos',
  general: 'General',
  encuentros: 'Encuentros',
  interno: 'Interno',
  monitores: 'Monitores',
  miembros: 'Miembros',
};

export const NOTIFICATION_TOPIC_LABELS: Record<string, string> = {
  general: 'General',
  eventos: 'Eventos',
  familias: 'Familias',
  monitores: 'Monitores',
  miembros: 'Miembros',
};

export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
