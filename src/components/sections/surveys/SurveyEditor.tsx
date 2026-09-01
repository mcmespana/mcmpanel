import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Rocket,
  FileText,
  ListChecks,
  Settings2,
  Eye,
  EyeOff,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { slugify } from '@/lib/profileCatalog';
import { QuestionsEditor } from './QuestionsEditor';
import { WizardPreview } from './WizardPreview';
import { LaunchDialog } from './LaunchDialog';
import {
  buildIndex,
  writeIndex,
  writeSurveyConfig,
  validateQuestions,
  effectiveStatus,
  msToLocalInput,
  localInputToMs,
  DELEGATION_OPTIONS,
  PROFILE_TYPE_OPTIONS,
  TOPIC_OPTIONS,
  PLACEMENT_LABELS,
  SURVEY_CLASS_LABELS,
  type PlacementType,
  type ProfileType,
  type SurveyAudience,
  type SurveyConfig,
  type SurveyEntry,
  type SurveyStatus,
} from '@/lib/surveys';
import { DEFAULT_SURVEY_ACCENT } from '@/lib/brandTokens';

interface SurveyEditorProps {
  entry: SurveyEntry;
  isNew: boolean;
  existingGenericIds: string[];
  allGenerics: SurveyEntry[];
  onSaved: (savedKey: string) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 0, label: 'Contenido', icon: FileText },
  { id: 1, label: 'Preguntas', icon: ListChecks },
  { id: 2, label: 'Publicación', icon: Settings2 },
];

const STATUS_OPTIONS: { value: SurveyStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'open', label: 'Abierta' },
  { value: 'closed', label: 'Cerrada' },
];

const PLACEMENT_TYPES: PlacementType[] = ['link-only', 'home-banner', 'event-banner', 'app-settings'];

export function SurveyEditor({
  entry,
  isNew,
  existingGenericIds,
  allGenerics,
  onSaved,
  onCancel,
}: SurveyEditorProps) {
  const { toast } = useToast();
  const isGeneric = entry.surveyClass === 'generic';

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<SurveyConfig>(() => ({
    status: effectiveStatus(entry.config),
    ...entry.config,
  }));
  const [genericId, setGenericId] = useState(isNew ? '' : entry.id);
  const [saving, setSaving] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);

  // ids de preguntas que ya tienen respuestas → no editables.
  const lockedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of entry.responses) {
      if (r.answers) Object.keys(r.answers).forEach((k) => ids.add(k));
    }
    return ids;
  }, [entry.responses]);

  const patch = (p: Partial<SurveyConfig>) => setConfig((prev) => ({ ...prev, ...p }));

  const questionErrors = validateQuestions(config.questions ?? []);
  const hasResponses = entry.responses.length > 0;

  const resolvedId = isNew ? slugify(genericId || config.title || '') : entry.id;
  const idTaken = isNew && resolvedId.length > 0 && existingGenericIds.includes(resolvedId);

  const canSave =
    questionErrors.length === 0 &&
    !!config.title?.trim() &&
    (!isGeneric || (resolvedId.length > 0 && !idTaken));

  const buildConfigToSave = (): SurveyConfig => {
    const out: SurveyConfig = { ...config };
    // Limpia campos solo-genéricas en evaluaciones fijas.
    if (!isGeneric) {
      delete out.anonymous;
      delete out.placement;
      delete out.audience;
    } else {
      out.id = resolvedId;
    }
    return out;
  };

  const doSave = async (): Promise<SurveyEntry | null> => {
    if (!canSave) {
      toast({
        title: 'Revisa los campos',
        description: idTaken
          ? `Ya existe una encuesta con el id "${resolvedId}".`
          : questionErrors[0] || 'Falta el título.',
        variant: 'destructive',
      });
      return null;
    }
    setSaving(true);
    try {
      const toSave = buildConfigToSave();
      const configPath = isGeneric ? `surveys/${resolvedId}` : entry.configPath;
      await writeSurveyConfig(configPath, toSave);

      if (isGeneric) {
        // Recomputa el índice de banners con el estado nuevo.
        const merged = allGenerics.some((g) => g.id === resolvedId)
          ? allGenerics.map((g) => (g.id === resolvedId ? { id: g.id, config: toSave } : { id: g.id, config: g.config }))
          : [...allGenerics.map((g) => ({ id: g.id, config: g.config })), { id: resolvedId, config: toSave }];
        await writeIndex(buildIndex(merged));
      }

      const savedEntry: SurveyEntry = {
        ...entry,
        id: resolvedId,
        key: isGeneric ? `generic:${resolvedId}` : entry.key,
        label: toSave.title || resolvedId,
        config: toSave,
        configPath,
      };
      return savedEntry;
    } catch (e) {
      toast({
        title: 'Error al guardar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const saved = await doSave();
    if (saved) {
      toast({ title: 'Guardado', description: 'La encuesta se ha sincronizado con Firebase.' });
      onSaved(saved.key);
    }
  };

  const handleSaveAndLaunch = async () => {
    const saved = await doSave();
    if (saved) {
      // Reusa el entry guardado para el diálogo de lanzamiento.
      setLaunchEntry(saved);
      setLaunchOpen(true);
    }
  };

  const [launchEntry, setLaunchEntry] = useState<SurveyEntry>(entry);

  return (
    <div className="space-y-6">
      {/* Cabecera + stepper */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="mb-1 -ml-2 text-muted-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver al listado
          </Button>
          <h1 className="text-2xl font-bold">
            {isNew ? 'Nueva encuesta' : config.title || 'Editar encuesta'}
          </h1>
          <p className="text-sm text-muted-foreground">{SURVEY_CLASS_LABELS[entry.surveyClass]}</p>
        </div>
        <div className="flex items-center gap-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                step === s.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {hasResponses && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Esta encuesta ya tiene {entry.responses.length} respuestas. Cambiar ids u opciones de
            preguntas mezclará esquemas — si necesitas reestructurarla, considera crear una nueva.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {step === 0 && <ContentStep config={config} patch={patch} isGeneric={isGeneric} isNew={isNew} genericId={genericId} setGenericId={setGenericId} resolvedId={resolvedId} idTaken={idTaken} />}
          {step === 1 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Preguntas</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionsEditor
                  questions={config.questions ?? []}
                  onChange={(questions) => patch({ questions })}
                  lockedIds={lockedIds}
                />
                {questionErrors.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-destructive">
                    {questionErrors.map((e, i) => (
                      <div key={i}>• {e}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {step === 2 && (
            <PublishStep config={config} patch={patch} isGeneric={isGeneric} />
          )}

          {/* Navegación inferior */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <div className="flex items-center gap-2">
              {step < 2 ? (
                <Button onClick={() => setStep((s) => Math.min(2, s + 1))}>
                  Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleSave} disabled={saving || !canSave}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar
                  </Button>
                  {isGeneric && (
                    <Button onClick={handleSaveAndLaunch} disabled={saving || !canSave} className="tech-glow">
                      <Rocket className="mr-2 h-4 w-4" />
                      Guardar y lanzar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vista previa en vivo */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <WizardPreview config={config} />
        </div>
      </div>

      {isGeneric && (
        <LaunchDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          entry={launchEntry}
          allGenerics={allGenerics}
          onLaunched={() => onSaved(launchEntry.key)}
        />
      )}
    </div>
  );
}

// ─── Paso 1: Contenido ─────────────────────────────────────────────────────────

function ContentStep({
  config,
  patch,
  isGeneric,
  isNew,
  genericId,
  setGenericId,
  resolvedId,
  idTaken,
}: {
  config: SurveyConfig;
  patch: (p: Partial<SurveyConfig>) => void;
  isGeneric: boolean;
  isNew: boolean;
  genericId: string;
  setGenericId: (v: string) => void;
  resolvedId: string;
  idTaken: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Contenido y textos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Título *</Label>
          <Input
            value={config.title ?? ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Ej: Encuesta a monitores 2026"
            className="bg-input border-border/50"
          />
        </div>

        {isGeneric && isNew && (
          <div className="space-y-2">
            <Label>Identificador (slug)</Label>
            <Input
              value={genericId}
              onChange={(e) => setGenericId(slugify(e.target.value))}
              placeholder="Se genera del título si lo dejas vacío"
              className="bg-input border-border/50 font-mono text-sm"
            />
            <p className={cn('text-xs', idTaken ? 'text-destructive' : 'text-muted-foreground')}>
              {idTaken
                ? `Ya existe "surveys/${resolvedId}". Elige otro.`
                : `Se guardará en surveys/${resolvedId || '…'} — no se puede cambiar luego.`}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Introducción</Label>
          <Textarea
            value={config.intro ?? ''}
            onChange={(e) => patch({ intro: e.target.value })}
            placeholder="Nos ayudas a preparar el curso. 2 minutos 🙏"
            className="bg-input border-border/50 min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Emoji</Label>
            <Input
              value={config.emoji ?? ''}
              onChange={(e) => patch({ emoji: e.target.value })}
              placeholder="📋"
              className="bg-input border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Color de acento</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.accentColor || DEFAULT_SURVEY_ACCENT}
                onChange={(e) => patch({ accentColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-border/50 bg-input"
              />
              <Input
                value={config.accentColor ?? ''}
                onChange={(e) => patch({ accentColor: e.target.value })}
                placeholder="#31AADF"
                className="bg-input border-border/50 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Título de agradecimiento</Label>
            <Input
              value={config.thanksTitle ?? ''}
              onChange={(e) => patch({ thanksTitle: e.target.value })}
              placeholder="¡Gracias!"
              className="bg-input border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Texto de agradecimiento</Label>
            <Input
              value={config.thanksBody ?? ''}
              onChange={(e) => patch({ thanksBody: e.target.value })}
              placeholder="Tu opinión nos ayuda."
              className="bg-input border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Título encuesta cerrada</Label>
            <Input
              value={config.closedTitle ?? ''}
              onChange={(e) => patch({ closedTitle: e.target.value })}
              placeholder="Encuesta cerrada"
              className="bg-input border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Texto encuesta cerrada</Label>
            <Input
              value={config.closedBody ?? ''}
              onChange={(e) => patch({ closedBody: e.target.value })}
              placeholder="Ya no admite respuestas."
              className="bg-input border-border/50"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Paso 3: Publicación ─────────────────────────────────────────────────────

function PublishStep({
  config,
  patch,
  isGeneric,
}: {
  config: SurveyConfig;
  patch: (p: Partial<SurveyConfig>) => void;
  isGeneric: boolean;
}) {
  const placementType = config.placement?.type ?? 'link-only';
  const audience = config.audience ?? {};

  const setAudience = (a: SurveyAudience) => {
    const cleaned: SurveyAudience = {};
    if (a.profileTypes?.length) cleaned.profileTypes = a.profileTypes;
    if (a.topics?.length) cleaned.topics = a.topics;
    if (a.delegationIds?.length) cleaned.delegationIds = a.delegationIds;
    patch({ audience: Object.keys(cleaned).length ? cleaned : undefined });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Estado y ventana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={config.status ?? 'draft'}
              onValueChange={(v) => patch({ status: v as SurveyStatus })}
            >
              <SelectTrigger className="bg-input border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              «Programada» + fecha de apertura deja la encuesta lista para abrirse sola.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Se abre el (opcional)</Label>
              <Input
                type="datetime-local"
                value={msToLocalInput(config.opensAt)}
                onChange={(e) => patch({ opensAt: localInputToMs(e.target.value) })}
                className="bg-input border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Se cierra el (opcional)</Label>
              <Input
                type="datetime-local"
                value={msToLocalInput(config.closesAt)}
                onChange={(e) => patch({ closesAt: localInputToMs(e.target.value) })}
                className="bg-input border-border/50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isGeneric && (
        <>
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Colocación (banner)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dónde aparece</Label>
                <Select
                  value={placementType}
                  onValueChange={(v) =>
                    patch({
                      placement: { ...config.placement, type: v as PlacementType },
                    })
                  }
                >
                  <SelectTrigger className="bg-input border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PLACEMENT_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {placementType === 'event-banner' && (
                <div className="space-y-2">
                  <Label>id del evento</Label>
                  <Input
                    value={config.placement?.eventId ?? ''}
                    onChange={(e) =>
                      patch({ placement: { ...config.placement!, eventId: e.target.value || undefined } })
                    }
                    placeholder="Ej: visitapapa26"
                    className="bg-input border-border/50 font-mono text-sm"
                  />
                </div>
              )}
              {placementType !== 'link-only' && (
                <div className="space-y-2">
                  <Label>Texto del botón (CTA)</Label>
                  <Input
                    value={config.placement?.ctaLabel ?? ''}
                    onChange={(e) =>
                      patch({ placement: { ...config.placement!, ctaLabel: e.target.value || undefined } })
                    }
                    placeholder="Responder"
                    className="bg-input border-border/50"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                El banner solo aparece si la encuesta está abierta, el usuario entra en la audiencia y
                no la ha respondido. El índice de banners se actualiza al guardar.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Audiencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MultiToggle
                label="Tipos de perfil"
                options={PROFILE_TYPE_OPTIONS}
                selected={audience.profileTypes ?? []}
                onChange={(profileTypes) =>
                  setAudience({ ...audience, profileTypes: profileTypes as ProfileType[] })
                }
              />
              <MultiToggle
                label="Topics"
                options={TOPIC_OPTIONS}
                selected={audience.topics ?? []}
                onChange={(topics) => setAudience({ ...audience, topics })}
              />
              <MultiToggle
                label="Delegaciones"
                options={DELEGATION_OPTIONS}
                selected={audience.delegationIds ?? []}
                onChange={(delegationIds) => setAudience({ ...audience, delegationIds })}
              />
              <p className="text-xs text-muted-foreground">
                Vacío = se ofrece a todos. Dentro de cada grupo es OR; entre grupos definidos es AND.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-2">
                {config.anonymous ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label>Respuestas anónimas</Label>
                  <p className="text-xs text-muted-foreground">
                    Si se activa, no se guardan nombre, perfil ni delegación con la respuesta.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.anonymous ?? false}
                onChange={(e) => patch({ anonymous: e.target.checked || undefined })}
                className="h-5 w-5 cursor-pointer accent-primary"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MultiToggle({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-muted/50',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
