import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Pencil,
  Copy,
  Trash2,
  BarChart3,
  Eye,
  Play,
  Square,
  ChevronLeft,
  Download,
  Loader2,
  MessageSquare,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import { slugify } from '@/lib/profileCatalog';
import { SurveyEditor } from './surveys/SurveyEditor';
import { ResponsesIndividual } from './surveys/ResponsesIndividual';
import { ResponsesAnalysis } from './surveys/ResponsesAnalysis';
import {
  parseSurveysNode,
  parseAppEvaluation,
  parseEventEvaluations,
  effectiveStatus,
  isSurveyOpen,
  setSurveyStatus,
  deleteGenericSurvey,
  writeSurveyConfig,
  buildIndex,
  writeIndex,
  questionsForAnalysis,
  exportResponsesCSV,
  exportResponsesXLS,
  formatDate,
  formatDateTime,
  STATUS_META,
  SURVEY_CLASS_LABELS,
  type SurveyConfig,
  type SurveyEntry,
  type SurveyStatus,
} from '@/lib/surveys';

const ALL = '__all';

export function SurveysSection() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [surveysNode, setSurveysNode] = useState<unknown>(null);
  const [appConfigNode, setAppConfigNode] = useState<unknown>(null);
  const [appResponsesNode, setAppResponsesNode] = useState<unknown>(null);
  const [activitiesNode, setActivitiesNode] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  // Filtros del listado
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [classFilter, setClassFilter] = useState<string>(ALL);

  // Borrado
  const [deleteTarget, setDeleteTarget] = useState<SurveyEntry | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // ─── Suscripciones Firebase ──────────────────────────────────────────────
  useEffect(() => {
    const db = getDB();
    const subs = [
      onValue(ref(db, 'surveys'), (s) => {
        setSurveysNode(s.val());
        setLoading(false);
      }),
      onValue(ref(db, 'app/evaluationConfig'), (s) => setAppConfigNode(s.val())),
      onValue(ref(db, 'app/evaluations'), (s) => setAppResponsesNode(s.val())),
      onValue(ref(db, 'activities'), (s) => setActivitiesNode(s.val())),
    ];
    return () => subs.forEach((u) => u());
  }, []);

  const { generics } = useMemo(() => parseSurveysNode(surveysNode), [surveysNode]);
  const appEntry = useMemo(
    () => parseAppEvaluation(appConfigNode, appResponsesNode),
    [appConfigNode, appResponsesNode],
  );
  const eventEntries = useMemo(() => parseEventEvaluations(activitiesNode), [activitiesNode]);

  const allEntries = useMemo(
    () => [appEntry, ...eventEntries, ...generics],
    [appEntry, eventEntries, generics],
  );

  const filteredEntries = useMemo(
    () =>
      allEntries.filter((e) => {
        if (classFilter !== ALL && e.surveyClass !== classFilter) return false;
        if (statusFilter !== ALL && effectiveStatus(e.config) !== statusFilter) return false;
        return true;
      }),
    [allEntries, classFilter, statusFilter],
  );

  // ─── Routing por URL ─────────────────────────────────────────────────────
  const view = searchParams.get('view') ?? 'list';
  const activeKey = searchParams.get('key');
  const activeEntry = activeKey ? allEntries.find((e) => e.key === activeKey) ?? null : null;

  const goList = () => setSearchParams({}, { replace: false });
  const goEdit = (key: string) => setSearchParams({ view: 'edit', key });
  const goNew = () => setSearchParams({ view: 'new' });
  const goResponses = (key: string) => setSearchParams({ view: 'responses', key });

  // ─── Acciones ────────────────────────────────────────────────────────────
  const recomputeIndex = async (override?: { id: string; config: SurveyConfig }) => {
    const list = generics.map((g) =>
      override && g.id === override.id ? { id: g.id, config: override.config } : { id: g.id, config: g.config },
    );
    if (override && !generics.some((g) => g.id === override.id)) {
      list.push({ id: override.id, config: override.config });
    }
    await writeIndex(buildIndex(list));
  };

  const handleToggleStatus = async (entry: SurveyEntry) => {
    const open = isSurveyOpen(entry.config);
    const nextStatus: SurveyStatus = open ? 'closed' : 'open';
    setBusyKey(entry.key);
    try {
      await setSurveyStatus(entry.configPath, entry.config, nextStatus);
      if (entry.surveyClass === 'generic') {
        await recomputeIndex({ id: entry.id, config: { ...entry.config, status: nextStatus } });
      }
      toast({
        title: nextStatus === 'open' ? 'Encuesta abierta' : 'Encuesta cerrada',
        description: `«${entry.label}» ahora está ${nextStatus === 'open' ? 'abierta' : 'cerrada'}.`,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleDuplicate = async (entry: SurveyEntry) => {
    const existing = generics.map((g) => g.id);
    let id = slugify(`${entry.id || entry.config.title || 'encuesta'}-copia`);
    let n = 2;
    while (existing.includes(id)) id = slugify(`${entry.id}-copia-${n++}`);
    const config: SurveyConfig = {
      ...entry.config,
      id,
      title: `${entry.config.title ?? 'Encuesta'} (copia)`,
      status: 'draft',
    };
    setBusyKey(entry.key);
    try {
      await writeSurveyConfig(`surveys/${id}`, config);
      // No entra en el índice (status draft), pero recomputamos por consistencia.
      await recomputeIndex({ id, config });
      toast({ title: 'Duplicada', description: 'Se creó una copia en borrador.' });
      goEdit(`generic:${id}`);
    } catch (e) {
      toast({
        title: 'Error al duplicar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyKey(deleteTarget.key);
    try {
      await deleteGenericSurvey(deleteTarget.id);
      await recomputeIndex();
      toast({ title: 'Encuesta borrada', description: `Se eliminó «${deleteTarget.label}».` });
    } catch (e) {
      toast({
        title: 'Error al borrar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusyKey(null);
      setDeleteTarget(null);
    }
  };

  // ─── Render: editor / nuevo ──────────────────────────────────────────────
  if (view === 'new' || (view === 'edit' && activeEntry)) {
    const isNew = view === 'new';
    const entry: SurveyEntry =
      isNew || !activeEntry
        ? {
            key: 'generic:new',
            surveyClass: 'generic',
            id: '',
            label: 'Nueva encuesta',
            config: { status: 'draft', accentColor: '#31AADF', emoji: '📋', questions: [] },
            responses: [],
            configPath: 'surveys/',
          }
        : activeEntry;
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <SurveyEditor
          entry={entry}
          isNew={isNew}
          existingGenericIds={generics.map((g) => g.id)}
          allGenerics={generics}
          onSaved={(key) => goResponses(key)}
          onCancel={goList}
        />
      </div>
    );
  }

  // ─── Render: respuestas ──────────────────────────────────────────────────
  if (view === 'responses' && activeEntry) {
    return (
      <ResponsesView entry={activeEntry} onBack={goList} onEdit={() => goEdit(activeEntry.key)} />
    );
  }

  // ─── Render: listado ─────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ClipboardList className="h-7 w-7 text-primary" />
            Encuestas y Evaluaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea encuestas, gestiona su ciclo de vida y analiza las respuestas.
          </p>
        </div>
        <Button onClick={goNew} className="tech-glow">
          <Plus className="mr-2 h-4 w-4" />
          Nueva encuesta
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-9 bg-input border-border/50 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los tipos</SelectItem>
              <SelectItem value="event">Evaluación de evento</SelectItem>
              <SelectItem value="app">Evaluación de la app</SelectItem>
              <SelectItem value="generic">Encuesta genérica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 bg-input border-border/50 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="scheduled">Programada</SelectItem>
              <SelectItem value="open">Abierta</SelectItem>
              <SelectItem value="closed">Cerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando encuestas…
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">No hay encuestas que coincidan</p>
            <p className="mt-1 text-sm">Crea una nueva o ajusta los filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Encuesta</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Resp.</TableHead>
                <TableHead className="hidden lg:table-cell">Ventana</TableHead>
                <TableHead className="hidden lg:table-cell">Actividad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const status = effectiveStatus(entry.config);
                const meta = STATUS_META[status];
                const open = isSurveyOpen(entry.config);
                const isGeneric = entry.surveyClass === 'generic';
                const busy = busyKey === entry.key;
                return (
                  <TableRow key={entry.key} className="border-border/40">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => goResponses(entry.key)}
                        className="text-left font-medium hover:text-primary"
                      >
                        <span className="mr-1.5">{entry.config.emoji}</span>
                        {entry.label}
                      </button>
                      {entry.surveyClass !== 'generic' && (
                        <p className="text-[11px] text-muted-foreground sm:hidden">
                          {SURVEY_CLASS_LABELS[entry.surveyClass]}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {SURVEY_CLASS_LABELS[entry.surveyClass]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('border text-[11px]', meta.className)}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{entry.responses.length}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {entry.config.opensAt || entry.config.closesAt
                        ? `${formatDate(entry.config.opensAt)} – ${formatDate(entry.config.closesAt)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDateTime(entry.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleToggleStatus(entry)}
                          disabled={busy}
                          title={open ? 'Cerrar' : 'Abrir'}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : open ? (
                            <Square className="h-4 w-4 text-destructive" />
                          ) : (
                            <Play className="h-4 w-4 text-success" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              ⋯
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => goResponses(entry.key)}>
                              <BarChart3 className="mr-2 h-4 w-4" /> Ver respuestas
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => goEdit(entry.key)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(entry)}>
                              <Copy className="mr-2 h-4 w-4" /> Duplicar
                            </DropdownMenuItem>
                            {isGeneric && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(entry)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Borrar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta encuesta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleteTarget?.label}»
              {deleteTarget && deleteTarget.responses.length > 0 ? (
                <>
                  {' '}
                  junto con sus <strong>{deleteTarget.responses.length} respuestas</strong>. Para
                  «apagarla» sin perder datos, ciérrala en vez de borrarla.
                </>
              ) : (
                '. Esta acción no se puede deshacer.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Vista de respuestas (individual + análisis + export) ───────────────────────

function ResponsesView({
  entry,
  onBack,
  onEdit,
}: {
  entry: SurveyEntry;
  onBack: () => void;
  onEdit: () => void;
}) {
  const questions = useMemo(() => questionsForAnalysis(entry), [entry]);
  const status = effectiveStatus(entry.config);
  const meta = STATUS_META[status];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 -ml-2 text-muted-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Listado
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span>{entry.config.emoji}</span>
            <span className="truncate">{entry.label}</span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className={cn('border text-[11px]', meta.className)}>
              {meta.label}
            </Badge>
            <span>{SURVEY_CLASS_LABELS[entry.surveyClass]}</span>
            <span>·</span>
            <span>{entry.responses.length} respuestas</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={entry.responses.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportResponsesCSV(entry, questions)}>
                CSV (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportResponsesXLS(entry, questions)}>
                Excel (.xls)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="analysis">
            <BarChart3 className="mr-2 h-4 w-4" /> Análisis
          </TabsTrigger>
          <TabsTrigger value="individual">
            <MessageSquare className="mr-2 h-4 w-4" /> Individuales
          </TabsTrigger>
        </TabsList>
        <TabsContent value="analysis">
          {questions.length === 0 ? (
            <EmptyQuestions />
          ) : (
            <ResponsesAnalysis responses={entry.responses} questions={questions} />
          )}
        </TabsContent>
        <TabsContent value="individual">
          {questions.length === 0 ? (
            <EmptyQuestions />
          ) : (
            <ResponsesIndividual responses={entry.responses} questions={questions} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyQuestions() {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="py-12 text-center text-muted-foreground">
        <ListChecks className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p>Esta encuesta no tiene preguntas configuradas ni respuestas todavía.</p>
      </CardContent>
    </Card>
  );
}
