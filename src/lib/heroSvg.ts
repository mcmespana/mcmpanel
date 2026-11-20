// Espejo de `mcm-app/utils/eventHeroSvg.ts` (repo mcmapp): qué SVG acepta la app
// como logo de un evento. Si cambia allí, cambia aquí.
export const HERO_SVG_MAX_LENGTH = 24_000;

const FORBIDDEN =
  /<\s*(script|foreignObject|image|iframe|use|style|a)\b|\bon\w+\s*=|javascript:|data:|\bhref\s*=|<!ENTITY|<!DOCTYPE/i;

/** Motivo por el que la app NO pintaría este SVG, o `null` si lo acepta. */
export function heroSvgProblem(value: string): string | null {
  const svg = value.trim();
  if (!svg) return null;
  if (svg.length > HERO_SVG_MAX_LENGTH) return `Pesa demasiado (máx. ${HERO_SVG_MAX_LENGTH} caracteres).`;
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return 'Tiene que empezar por <svg y acabar en </svg>.';
  if (FORBIDDEN.test(svg)) return 'Lleva algo que la app no admite (script, image, use, style, href, on…=, data:).';
  return null;
}

/** Para la vista previa: `currentColor` se pinta con la tinta indicada. */
export function previewHeroSvgSrc(svg: string, ink: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim().replace(/currentColor/gi, ink))}`;
}
