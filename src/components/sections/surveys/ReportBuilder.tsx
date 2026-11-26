import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileDown,
  ImageDown,
  Link2,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
  Trash2,
  MessageCircle,
  Star,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  dedupResponses,
  filterResponses,
  formatDateTime,
  localInputToMs,
  segmentOptions,
  type SegmentFilter,
  type SurveyEntry,
  type SurveyQuestion,
} from '@/lib/surveys';
import {
  buildReport,
  DEFAULT_REPORT_OPTIONS,
  profileLabel,
  platformLabel,
  type CommentMode,
  type ReportOptions,
} from '@/lib/surveyReport';
import {
  cleanSlug,
  deleteReport,
  publicReportUrl,
  publishReport,
  slugExists,
  subscribeReportShares,
  suggestSlug,
  type ReportShare,
} from '@/lib/reportShares';
import { captureNode, copyImage, exportNodeAsImage, fileSafe, printReport, shareOrDownload } from '@/lib/reportExport';
import { ReportView } from '@/components/report/ReportView';
import { ReportSummaryCard } from '@/components/report/ReportSummaryCard';
import { Offscreen, PrintPortal } from '@/components/report/PrintPortal';

const ALL = '__all';
const COMMENT_MODE_LABELS: Record<CommentMode, string> = {
  all: 'Todos los comentarios',
  favorites: 'Solo mis favoritos ★',
  none: 'Ninguno (solo cifras)',
};

function draftKey(surveyKey: string) {
  return `mcm-panel:report-draft:${surveyKey}`;
}
function loadDraft(surveyKey: string): ReportOptions {
  try {
    const raw = localStorage.getItem(draftKey(surveyKey));
    if (raw) return { ...DEFAULT_REPORT_OPTIONS, ...(JSON.parse(raw) as Partial<ReportOptions>) };
  } catch {
    /* sin almacenamiento: opciones por defecto */
  }
  return DEFAULT_REPORT_OPTIONS;
}

export function ReportBuilder({
  entry,
  questions,
  favoriteIds,
  onToggleFavorite,
}: {
  entry: SurveyEntry;
  questions: SurveyQuestion[];
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const { toast } = useToast();
  const [opts, setOpts] = useState<ReportOptions>(() => loadDraft(entry.key));
  const [busy, setBusy] = useState<string | null>(null);
  const [shares, setShares] = useState<ReportShare[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ReportShare | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(entry.key), JSON.stringify(opts));
    } catch {
      /* no pasa nada */
    }
  }, [entry.key, opts]);

  useEffect(() => subscribeReportShares(setShares), []);
  const myShares = useMemo(() => shares.filter((s) => s.meta.surveyKey === entry.key), [shares, entry.key]);

  // Los favoritos del panel SON los destacados del informe.
  const effectiveOpts = useMemo<ReportOptions>(() => ({ ...opts, highlights: favoriteIds }), [opts, favoriteIds]);
  const report = useMemo(() => buildReport(entry, questions, effectiveOpts), [entry, questions, effectiveOpts]);
  const segs = useMemo(() => segmentOptions(entry.responses), [entry.responses]);
  const excluded = new Set(opts.excludedQuestions ?? []);
  const base = fileSafe(report.title);

  const set = (patch: Partial<ReportOptions>) => setOpts((p) => ({ ...p, ...patch }));
  const setFilter = (patch: Partial<SegmentFilter>) =>
    setOpts((p) => {
      const filter = { ...(p.filter ?? {}), ...patch };
      for (const k of Object.keys(filter) as (keyof SegmentFilter)[]) if (filter[k] == null || filter[k] === '') delete filter[k];
      return { ...p, filter };
    });

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast({ title: ok });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const doPublish = () =>
    run('publish', async () => {
      const clean = cleanSlug(slug);
      if (clean.length < 3) throw new Error('La dirección necesita al menos 3 caracteres.');
      if (await slugExists(clean)) throw new Error(`Ya existe un informe en /informe/${clean}. Elige otra dirección.`);
      await publishReport(clean, report, entry.key, effectiveOpts);
      setPublishOpen(false);
      await navigator.clipboard?.writeText(publicReportUrl(clean)).catch(() => undefined);
      toast({ title: 'Enlace publicado', description: `${publicReportUrl(clean)} (copiado)` });
    });

  /** Regenera un enlace con SUS opciones guardadas y los datos de ahora. */
  const refreshShare = (s: ReportShare) =>
    run(
      `refresh:${s.slug}`,
      async () => {
        const o: ReportOptions = { ...DEFAULT_REPORT_OPTIONS, ...s.meta.options };
        await publishReport(s.slug, buildReport(entry, questions, o), entry.key, o, s.meta.createdAt);
      },
      'Informe actualizado con los datos de ahora',
    );

  /** Pisa un enlace con lo que hay ahora en el editor (opciones + favoritos). */
  const overwriteShare = (s: ReportShare) =>
    run(
      `over:${s.slug}`,
      () => publishReport(s.slug, report, entry.key, effectiveOpts, s.meta.createdAt),
      'Enlace actualizado con la configuración del editor',
    );

  const freshCount = (s: ReportShare) => dedupResponses(filterResponses(entry.responses, s.meta.options.filter ?? {})).deduped.length;

  return (
    <div className="space-y-5">
      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => printReport(base)}>
          <FileDown className="mr-2 h-4 w-4" /> PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy === 'summary'}
          onClick={() =>
            run('summary', async () => {
              if (!summaryRef.current) return;
              await shareOrDownload(await captureNode(summaryRef.current), `${base}-resumen.png`, report.title);
            })
          }
        >
          {busy === 'summary' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
          Imagen resumen
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy === 'copy'}
          onClick={() =>
            run('copy', async () => {
              if (!summaryRef.current) return;
              const okCopy = await copyImage(await captureNode(summaryRef.current));
              toast({
                title: okCopy ? 'Imagen copiada' : 'Este navegador no deja copiar imágenes',
                description: okCopy ? 'Pégala en WhatsApp Web con Ctrl/Cmd+V.' : 'Usa «Imagen resumen» para descargarla.',
              });
            })
          }
        >
          <Copy className="mr-2 h-4 w-4" /> Copiar imagen
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/40 text-primary"
          onClick={() => {
            setSlug(suggestSlug(report.title));
            setPublishOpen(true);
          }}
        >
          <Link2 className="mr-2 h-4 w-4" /> Crear enlace público
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Cada pregunta tiene su botón de imagen en la vista previa.
        </span>
      </div>

      {/* Enlaces públicos existentes */}
      {myShares.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50">
          <div className="border-b border-border/40 px-4 py-2 text-sm font-medium">Enlaces públicos de esta encuesta</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-right">Resp.</TableHead>
                <TableHead className="hidden md:table-cell">Actualizado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myShares.map((s) => {
                const url = publicReportUrl(s.slug);
                const fresh = freshCount(s);
                const pending = fresh - s.responses;
                return (
                  <TableRow key={s.slug}>
                    <TableCell className="max-w-[260px]">
                      <a href={url} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-primary hover:underline">
                        /informe/{s.slug}
                      </a>
                      {s.meta.options.showNames && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-warning">
                          <AlertTriangle className="h-3 w-3" /> lleva nombres
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {s.responses}
                      {pending > 0 && <span className="block text-[10px] text-warning">+{pending} nuevas</span>}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{formatDateTime(s.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <IconBtn title="Copiar enlace" onClick={() => navigator.clipboard.writeText(url).then(() => toast({ title: 'Enlace copiado' }))}>
                          <Copy className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          title="Mandar por WhatsApp"
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${s.title}\n${url}`)}`, '_blank', 'noopener')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Abrir" onClick={() => window.open(url, '_blank', 'noopener')}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Actualizar con los datos de ahora (mismas opciones)" busy={busy === `refresh:${s.slug}`} onClick={() => refreshShare(s)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Sustituir por lo que hay ahora en el editor" busy={busy === `over:${s.slug}`} onClick={() => overwriteShare(s)}>
                          <Settings2 className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Retirar el enlace" destructive onClick={() => setDeleteTarget(s)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Opciones */}
        <div className="space-y-5 rounded-lg border border-border/50 bg-card/50 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Field label="Título" htmlFor="rp-title">
            <Input id="rp-title" value={opts.title ?? ''} placeholder={entry.config.title || entry.label} onChange={(e) => set({ title: e.target.value })} className="bg-input border-border/50" />
          </Field>
          <Field label="Subtítulo" htmlFor="rp-sub">
            <Input id="rp-sub" value={opts.subtitle ?? ''} placeholder="Ej.: Resumen para el equipo de monitores" onChange={(e) => set({ subtitle: e.target.value })} className="bg-input border-border/50" />
          </Field>
          <Field label="Nota para quien lo lee" htmlFor="rp-note">
            <Textarea id="rp-note" rows={3} value={opts.note ?? ''} placeholder="Opcional. Sale arriba del todo." onChange={(e) => set({ note: e.target.value })} className="bg-input border-border/50" />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">Qué respuestas entran</p>
            <div className="grid grid-cols-2 gap-2">
              <SegSelect label="Perfil" value={opts.filter?.profileType} options={segs.profiles} format={profileLabel} onChange={(v) => setFilter({ profileType: v })} />
              <SegSelect label="Plataforma" value={opts.filter?.platform} options={segs.platforms} format={platformLabel} onChange={(v) => setFilter({ platform: v })} />
              <div className="col-span-2">
                <SegSelect label="Delegación" value={opts.filter?.delegation} options={segs.delegations} onChange={(v) => setFilter({ delegation: v })} />
              </div>
              <Field label="Desde" htmlFor="rp-from" small>
                <Input id="rp-from" type="date" value={msToDate(opts.filter?.from)} onChange={(e) => setFilter({ from: localInputToMs(e.target.value ? `${e.target.value}T00:00` : '') })} className="h-8 bg-input border-border/50 text-xs" />
              </Field>
              <Field label="Hasta" htmlFor="rp-to" small>
                <Input id="rp-to" type="date" value={msToDate(opts.filter?.to)} onChange={(e) => setFilter({ to: localInputToMs(e.target.value ? `${e.target.value}T23:59` : '') })} className="h-8 bg-input border-border/50 text-xs" />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Comentarios</p>
            <Select value={opts.comments} onValueChange={(v) => set({ comments: v as CommentMode })}>
              <SelectTrigger className="h-9 bg-input border-border/50 text-sm" aria-label="Qué comentarios entran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COMMENT_MODE_LABELS) as CommentMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {COMMENT_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-warning" fill="currentColor" />
              {favoriteIds.length} favoritos → salen en «Lo más destacado». Se marcan con la estrella aquí, en Análisis o en Individuales.
            </p>
            <ToggleRow id="rp-names" label="Firmar con el nombre" checked={opts.showNames} onChange={(v) => set({ showNames: v })} />
            {opts.showNames && (
              <p className="flex gap-1.5 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Un enlace público lo puede abrir cualquiera que lo reciba. Con nombres, mándalo solo a quien deba verlos.
              </p>
            )}
            <ToggleRow id="rp-meta" label="Perfil y delegación bajo cada comentario" checked={opts.showCommentMeta} onChange={(v) => set({ showCommentMeta: v })} />
            <ToggleRow id="rp-bd" label="Bloque «Quién ha respondido»" checked={opts.showBreakdown} onChange={(v) => set({ showBreakdown: v })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Preguntas</p>
              <span className="font-mono text-xs text-muted-foreground">
                {questions.length - excluded.size}/{questions.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {questions.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-start gap-2 text-xs leading-snug">
                  <Checkbox
                    checked={!excluded.has(q.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(excluded);
                      if (v) next.delete(q.id);
                      else next.add(q.id);
                      set({ excludedQuestions: [...next] });
                    }}
                    className="mt-0.5"
                  />
                  <span className={cn(excluded.has(q.id) && 'text-muted-foreground line-through')}>
                    {q.section && <span className="text-muted-foreground">{q.section} · </span>}
                    {q.label || q.id}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setOpts(DEFAULT_REPORT_OPTIONS)}>
            Restablecer opciones
          </Button>
        </div>

        {/* Vista previa: exactamente lo que verá quien lo reciba. */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Vista previa · así lo verá quien lo reciba</span>
            {report.totals.responses === 0 && <Badge variant="outline">Sin respuestas con este filtro</Badge>}
          </div>
          <div className="mx-auto max-w-[480px] overflow-hidden rounded-[1.6rem] border-4 border-secondary shadow-2xl">
            <ReportView
              report={report}
              favoriteIds={favoriteIds}
              onToggleFavorite={(c) => onToggleFavorite(c.id)}
              onExportCard={async (node, q) => {
                try {
                  await exportNodeAsImage(node, `${base}-${fileSafe(q.label).slice(0, 30)}.png`, report.title);
                } catch (e) {
                  toast({ title: 'No se pudo generar la imagen', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
                }
              }}
            />
          </div>
        </div>
      </div>

      <Offscreen>
        <ReportSummaryCard ref={summaryRef} report={report} />
      </Offscreen>
      <PrintPortal>
        <ReportView report={report} expandAll />
      </PrintPortal>

      {/* Publicar */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear enlace público</DialogTitle>
            <DialogDescription>
              Guarda una foto de este informe (ya agregado, sin las respuestas en bruto) en{' '}
              <span className="font-mono">surveyReports/&lt;dirección&gt;</span>. Lo abre cualquiera con el enlace, sin código. Puedes
              actualizarlo o retirarlo cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rp-slug">Dirección</Label>
            <div className="flex items-center gap-1 rounded-md border border-border/50 bg-input px-2">
              <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">/informe/</span>
              <input
                id="rp-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && doPublish()}
                className="h-9 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El final aleatorio impide que alguien la adivine. Si la acortas, que no sea obvia.
            </p>
            {opts.showNames && (
              <p className="flex gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> Este informe firma los comentarios con nombre.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {report.totals.responses} respuestas · {report.questions.length} preguntas · {favoriteIds.length} destacados
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={doPublish} disabled={busy === 'publish'}>
              {busy === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Publicar y copiar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar este enlace?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra <span className="font-mono">surveyReports/{deleteTarget?.slug}</span>. Quien tenga el enlace verá «Este informe ya no está
              disponible». Las respuestas de la encuesta no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && run(`del:${deleteTarget.slug}`, () => deleteReport(deleteTarget.slug), 'Enlace retirado')}
            >
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function msToDate(ms?: number) {
  if (ms == null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Field({ label, htmlFor, children, small }: { label: string; htmlFor: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className={small ? 'text-[10px] text-muted-foreground' : 'text-sm'}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SegSelect({
  label,
  value,
  options,
  format = (s) => s,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  format?: (s: string) => string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger className="h-8 bg-input border-border/50 text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {format(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  busy,
  destructive,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  busy?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={title}
      aria-label={title}
      disabled={busy}
      onClick={onClick}
      className={cn('h-7 w-7 p-0', destructive && 'text-destructive hover:text-destructive')}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </Button>
  );
}
