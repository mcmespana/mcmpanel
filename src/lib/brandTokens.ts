/**
 * Colores de marca de MCM — **espejo** de `mcm-app/constants/colors.ts`.
 *
 * Misma convención que `src/lib/profileCatalog.ts`: el repo `mcmapp` manda, y
 * aquí se copia a mano cuando cambie allí.
 *
 * ⚠️ NO es la paleta del panel. El panel es oscuro tipo consola y tiene la
 * suya en `src/index.css`, a propósito (ver `design.md`). Esto es para lo
 * ÚNICO que no puede diferir: cuando el panel **representa** algo que la
 * persona verá en la app —el color de un calendario, el acento de un evento o
 * de una encuesta, un perfil, la previsualización de una notificación— tiene
 * que pintarlo con el color real, no con el cian del panel. Si no, el admin
 * está eligiendo a ciegas.
 */

/**
 * Paleta cromática de marca (los colores del logo). No es semántica: el estado
 * en la app se expresa con otros tokens, igual que aquí se expresa con los de
 * shadcn (`destructive`, `warning`, `success`).
 */
export const brand = {
  primary: '#253883', // Azul fondo — identidad MCM
  secondary: '#95d2f2', // Azul letras
  accent: '#E15C62', // Rojo MIC
  info: '#31AADF', // Celeste
  green: '#A3BD31', // Verde COM
  yellow: '#FCD200', // Amarillo COM
  purple: '#9D1E74', // Morado LC
  text: '#002B81', // Azul COM
} as const;

/** Color de cabecera de cada tab de la app. */
export const tabHeaderColors = {
  cancionero: '#f4c11e',
  visitapapa: '#FCD200',
  calendario: '#31AADF',
  fotos: '#E15C62',
  comunica: 'rgba(157, 30, 116, 0.87)',
  contigo: '#C4922A',
} as const;

/**
 * Colores que se ofrecen para un calendario. Los de marca primero: son los
 * que hacen que el calendario de la app se vea como la app y no como una
 * ensalada de pasteles.
 */
export const calendarColorOptions: { hex: string; label: string }[] = [
  { hex: brand.primary, label: 'Azul MCM' },
  { hex: brand.info, label: 'Celeste' },
  { hex: brand.accent, label: 'Rojo MIC' },
  { hex: brand.green, label: 'Verde COM' },
  { hex: brand.yellow, label: 'Amarillo COM' },
  { hex: brand.purple, label: 'Morado LC' },
  { hex: brand.secondary, label: 'Azul claro' },
  { hex: '#F97316', label: 'Naranja' },
  { hex: '#8B5CF6', label: 'Violeta' },
  { hex: '#EC4899', label: 'Rosa' },
  { hex: '#10B981', label: 'Esmeralda' },
  { hex: '#CC0628', label: 'Granate' },
  // Pasteles heredados: se mantienen para no cambiarle el color a ningún
  // calendario que ya lo tenga elegido.
  { hex: '#FFB3B3', label: 'Pastel rojo' },
  { hex: '#FFD1B3', label: 'Pastel naranja' },
  { hex: '#FFFFB3', label: 'Pastel amarillo' },
  { hex: '#D1FFB3', label: 'Pastel lima' },
  { hex: '#B3FFD1', label: 'Pastel menta' },
  { hex: '#B3D1FF', label: 'Pastel azul' },
  { hex: '#D1B3FF', label: 'Pastel lila' },
  { hex: '#FFB3D1', label: 'Pastel rosa' },
];

/** Acento por defecto de una encuesta nueva. Debe ser un color de la app. */
export const DEFAULT_SURVEY_ACCENT = brand.info;
