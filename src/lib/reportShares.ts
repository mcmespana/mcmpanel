import { onValue, ref, remove, set, update, get } from 'firebase/database';
import { getDB } from '@/lib/firebase';
import { guardWrite, onRulesError } from '@/lib/firebaseRules';
import { pruneUndefined } from '@/lib/surveys';
import { slugify } from '@/lib/profileCatalog';
import type { ReportOptions, SurveyReport } from '@/lib/surveyReport';

// ─────────────────────────────────────────────────────────────────────────────
// Enlaces públicos de informes — nodo `/surveyReports/<slug>`:
//
//   surveyReports/<slug>
//   ├── updatedAt: ms
//   ├── data: SurveyReport      ← lo que pinta la página pública (ya agregado)
//   └── meta: { surveyKey, options, createdAt }  ← para regenerarlo desde el panel
//
// La página pública (`/informe/<slug>`) lee SOLO `surveyReports/<slug>/data`.
// Reglas (mcm-app/database.rules.json): `$slug` legible por cualquiera; la raíz
// solo con `legacyPanelWrites` (no se puede listar desde fuera). El slug lleva
// un sufijo aleatorio para que no se pueda adivinar.
// ─────────────────────────────────────────────────────────────────────────────

export const REPORTS_NODE = 'surveyReports';

export interface ReportShare {
  slug: string;
  updatedAt?: number;
  title: string;
  responses: number;
  meta: { surveyKey: string; options: ReportOptions; createdAt: number };
}

export function randomSuffix(len = 6): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export function suggestSlug(title: string): string {
  return `${slugify(title).slice(0, 32).replace(/-+$/, '') || 'informe'}-${randomSuffix()}`;
}

/** Solo minúsculas, números y guiones; RTDB no admite . # $ [ ] / en claves. */
export function cleanSlug(raw: string): string {
  return slugify(raw).slice(0, 64).replace(/^-+|-+$/g, '');
}

export function publicReportUrl(slug: string): string {
  return `${window.location.origin}/informe/${slug}`;
}

export function subscribeReportShares(cb: (shares: ReportShare[]) => void): () => void {
  return onValue(
    ref(getDB(), REPORTS_NODE),
    (snap) => {
      const val = (snap.val() ?? {}) as Record<string, { updatedAt?: number; data?: SurveyReport; meta?: ReportShare['meta'] }>;
      const list = Object.entries(val)
        .filter(([, v]) => v && v.meta)
        .map(([slug, v]) => ({
          slug,
          updatedAt: v.updatedAt,
          title: v.data?.title ?? slug,
          responses: v.data?.totals?.responses ?? 0,
          meta: v.meta!,
        }))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      cb(list);
    },
    onRulesError(REPORTS_NODE, 'Encuestas · informes'),
  );
}

export async function slugExists(slug: string): Promise<boolean> {
  const snap = await get(ref(getDB(), `${REPORTS_NODE}/${slug}/updatedAt`));
  return snap.exists();
}

/** Crea o regenera el enlace. `createdAt` se conserva si ya existía. */
export async function publishReport(
  slug: string,
  report: SurveyReport,
  surveyKey: string,
  options: ReportOptions,
  createdAt?: number,
): Promise<void> {
  const path = `${REPORTS_NODE}/${slug}`;
  const now = Date.now();
  await guardWrite(path, 'Encuestas · informes', () =>
    set(
      ref(getDB(), path),
      pruneUndefined({
        updatedAt: now,
        data: report,
        meta: { surveyKey, options, createdAt: createdAt ?? now },
      }),
    ),
  );
}

export async function touchReport(slug: string, report: SurveyReport): Promise<void> {
  const path = `${REPORTS_NODE}/${slug}`;
  await guardWrite(path, 'Encuestas · informes', () =>
    update(ref(getDB(), path), { data: pruneUndefined(report), updatedAt: Date.now() }),
  );
}

export async function deleteReport(slug: string): Promise<void> {
  const path = `${REPORTS_NODE}/${slug}`;
  await guardWrite(path, 'Encuestas · informes', () => remove(ref(getDB(), path)));
}
