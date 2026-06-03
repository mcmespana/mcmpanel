import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ArrowLeft, Eye, EyeOff, Settings2, Zap, Archive, Code2, Save, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppsSubsection } from './activities/AppsSubsection';
import { CompartiendoSubsection } from './activities/CompartiendoSubsection';
import { ContactosSubsection } from './activities/ContactosSubsection';
import { GruposSubsection } from './activities/GruposSubsection';
import { HorarioSubsection } from './activities/HorarioSubsection';
import { MaterialesSubsection } from './activities/MaterialesSubsection';
import { ProfundizaSubsection } from './activities/ProfundizaSubsection';
import { VisitasSubsection } from './activities/VisitasSubsection';

export type ActivityId = string;
export type SubsectionId = 'apps' | 'compartiendo' | 'contactos' | 'grupos' | 'horario' | 'materiales' | 'profundiza' | 'visitas';
type EventStatus = 'active' | 'archived';

interface EventMeta {
  status?: EventStatus;
  title?: string;
  tintColor?: string;
  bannerText?: string;
  updatedAt?: string;
}

interface GlobalMeta {
  activeEventId?: string;
  updatedAt?: string;
}

interface ActivitiesSectionProps {
  data: any;
  onUpdate: (data: any) => void;
}

const subsections = [
  { id: 'apps' as SubsectionId, title: 'Apps', description: 'Aplicaciones recomendadas' },
  { id: 'compartiendo' as SubsectionId, title: 'Compartiendo', description: 'Posts y contenido compartido' },
  { id: 'contactos' as SubsectionId, title: 'Contactos', description: 'Lista de contactos importantes' },
  { id: 'grupos' as SubsectionId, title: 'Grupos', description: 'Organización por grupos' },
  { id: 'horario' as SubsectionId, title: 'Horario', description: 'Programación de eventos' },
  { id: 'materiales' as SubsectionId, title: 'Materiales', description: 'Contenido y recursos' },
  { id: 'profundiza' as SubsectionId, title: 'Profundiza', description: 'Material de profundización' },
  { id: 'visitas' as SubsectionId, title: 'Visitas', description: 'Lugares y visitas programadas' },
];

const NONE = '__none__';

export function ActivitiesSection({ data, onUpdate }: ActivitiesSectionProps) {
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityId | null>('visitapapa26');
  const [selectedSubsection, setSelectedSubsection] = useState<SubsectionId | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  // _meta at root level is reserved for global event config; exclude from activity list
  const globalMeta: GlobalMeta = data?._meta ?? {};
  const activities = Object.keys(data || {}).filter((k) => k !== '_meta');
  const currentActivityData = selectedActivity ? data?.[selectedActivity] : null;
  const eventMeta: EventMeta = currentActivityData?._meta ?? {};

  const handleGlobalMetaUpdate = (patch: Partial<GlobalMeta>) => {
    onUpdate({
      ...data,
      _meta: { ...globalMeta, ...patch, updatedAt: new Date().toISOString() },
    });
  };

  const handleEventMetaUpdate = (patch: Partial<EventMeta>) => {
    if (!selectedActivity) return;
    onUpdate({
      ...data,
      [selectedActivity]: {
        ...currentActivityData,
        _meta: { ...eventMeta, ...patch, updatedAt: new Date().toISOString() },
      },
    });
  };

  const handleCreateActivity = () => {
    const activityName = newActivityName.trim().replace(/\s+/g, '').toLowerCase();
    if (!activityName) return;

    const newActivityStructure = {
      apps: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      compartiendo: { data: {}, hidden: false, updatedAt: new Date().toISOString() },
      contactos: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      grupos: { data: {}, hidden: false, updatedAt: new Date().toISOString() },
      horario: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      materiales: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      profundiza: { data: { introduccion: '', paginas: [] }, hidden: false, updatedAt: new Date().toISOString() },
      visitas: { data: [], hidden: false, updatedAt: new Date().toISOString() },
    };

    onUpdate({ ...data, [activityName]: newActivityStructure });
    setSelectedActivity(activityName);
    setIsCreateDialogOpen(false);
    setNewActivityName('');
  };

  const handleToggleHidden = (subsectionId: SubsectionId) => {
    if (!selectedActivity || !currentActivityData) return;
    const subsectionData = currentActivityData[subsectionId];
    onUpdate({
      ...data,
      [selectedActivity]: {
        ...currentActivityData,
        [subsectionId]: {
          ...subsectionData,
          hidden: !subsectionData?.hidden,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const handleSubsectionUpdate = (subsectionData: any) => {
    if (!selectedActivity) return;
    onUpdate({
      ...data,
      [selectedActivity]: {
        ...currentActivityData,
        [selectedSubsection!]: { ...subsectionData, updatedAt: new Date().toISOString() },
      },
    });
  };

  const handleEnterRawMode = () => {
    if (!selectedSubsection || !currentActivityData) return;
    const subsectionData = currentActivityData[selectedSubsection];
    setRawJsonText(JSON.stringify(subsectionData?.data, null, 2));
    setRawJsonError(null);
    setRawJsonMode(true);
  };

  const handleCancelRawMode = () => {
    setRawJsonMode(false);
    setRawJsonError(null);
  };

  const handleSaveRawJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      const subsectionData = currentActivityData?.[selectedSubsection!];
      handleSubsectionUpdate({ ...subsectionData, data: parsed });
      setRawJsonMode(false);
      setRawJsonError(null);
      toast({ title: 'JSON guardado', description: 'Los datos se han actualizado correctamente.' });
    } catch (e) {
      setRawJsonError((e as Error).message);
    }
  };

  const renderSubsection = () => {
    if (!selectedSubsection || !currentActivityData) return null;
    const subsectionData = currentActivityData[selectedSubsection];
    switch (selectedSubsection) {
      case 'apps':        return <AppsSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'compartiendo': return <CompartiendoSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'contactos':  return <ContactosSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'grupos':     return <GruposSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'horario':    return <HorarioSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'materiales': return <MaterialesSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'profundiza': return <ProfundizaSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'visitas':    return <VisitasSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      default:           return null;
    }
  };

  // ── View: subsection detail ──────────────────────────────────────────────
  if (selectedSubsection && selectedActivity) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectedSubsection(null); setRawJsonMode(false); setRawJsonError(null); }}
              className="gap-2 self-start sm:self-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
                {subsections.find(s => s.id === selectedSubsection)?.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {selectedActivity} — {subsections.find(s => s.id === selectedSubsection)?.description}
              </p>
            </div>
          </div>
          <Button
            variant={rawJsonMode ? 'default' : 'outline'}
            size="sm"
            onClick={rawJsonMode ? handleCancelRawMode : handleEnterRawMode}
            className="gap-2 self-start sm:self-auto flex-shrink-0"
          >
            <Code2 className="w-4 h-4" />
            {rawJsonMode ? 'Cancelar JSON' : 'Ver / Editar JSON'}
          </Button>
        </div>

        {rawJsonMode ? (
          <div className="space-y-3">
            <Textarea
              value={rawJsonText}
              onChange={(e) => { setRawJsonText(e.target.value); setRawJsonError(null); }}
              className="font-mono text-xs min-h-[60vh] resize-y bg-muted/30"
              spellCheck={false}
            />
            {rawJsonError && (
              <p className="text-sm text-destructive font-mono bg-destructive/10 px-3 py-2 rounded-md">
                Error al parsear JSON: {rawJsonError}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSaveRawJson} className="gap-2 tech-glow">
                <Save className="w-4 h-4" />
                Guardar JSON
              </Button>
              <Button variant="outline" onClick={handleCancelRawMode} className="gap-2">
                <X className="w-4 h-4" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          renderSubsection()
        )}
      </div>
    );
  }

  // ── View: activity detail ────────────────────────────────────────────────
  if (selectedActivity) {
    const isGlobalActive = globalMeta.activeEventId === selectedActivity;
    const statusIsActive = eventMeta.status === 'active';

    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedActivity(null)}
            className="gap-2 self-start sm:self-auto flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Actividades
          </Button>
          <div className="min-w-0 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
              {eventMeta.title || selectedActivity}
            </h2>
            {isGlobalActive && (
              <Badge className="shrink-0 gap-1">
                <Zap className="w-3 h-3" />
                Evento activo
              </Badge>
            )}
            {eventMeta.status === 'archived' && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Archive className="w-3 h-3" />
                Archivado
              </Badge>
            )}
          </div>
        </div>

        {/* Event metadata card */}
        <Card className="p-4 sm:p-5 bg-card/50 border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Metadatos del evento</h3>
            {eventMeta.updatedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(eventMeta.updatedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs">Estado en la app</Label>
              <Select
                value={eventMeta.status ?? NONE}
                onValueChange={(v) =>
                  handleEventMetaUpdate({ status: v === NONE ? undefined : (v as EventStatus) })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin definir</SelectItem>
                  <SelectItem value="active">
                    <span className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-green-500" />
                      Activo (tab + banner)
                    </span>
                  </SelectItem>
                  <SelectItem value="archived">
                    <span className="flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5" />
                      Archivado (solo en Eventos pasados)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="event-title" className="text-xs">Título visible</Label>
              <Input
                id="event-title"
                className="h-8 text-sm"
                placeholder="Visita Papa León XIV"
                value={eventMeta.title ?? ''}
                onChange={(e) => handleEventMetaUpdate({ title: e.target.value })}
              />
            </div>

            {/* tintColor */}
            <div className="space-y-1">
              <Label htmlFor="event-tint" className="text-xs">Color del evento (tintColor)</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-8 w-10 rounded border border-border bg-card cursor-pointer p-0.5 shrink-0"
                  value={/^#[0-9a-fA-F]{6}$/.test(eventMeta.tintColor ?? '') ? eventMeta.tintColor! : '#000000'}
                  onChange={(e) => handleEventMetaUpdate({ tintColor: e.target.value })}
                />
                <Input
                  id="event-tint"
                  className="h-8 text-sm"
                  placeholder="#RRGGBB"
                  value={eventMeta.tintColor ?? ''}
                  onChange={(e) => handleEventMetaUpdate({ tintColor: e.target.value })}
                />
              </div>
            </div>

            {/* bannerText */}
            <div className="space-y-1">
              <Label htmlFor="event-banner" className="text-xs">Texto del banner</Label>
              <Input
                id="event-banner"
                className="h-8 text-sm"
                placeholder="¡Bienvenidos al evento!"
                value={eventMeta.bannerText ?? ''}
                onChange={(e) => handleEventMetaUpdate({ bannerText: e.target.value })}
              />
            </div>
          </div>

          {/* Shortcut: make this the global active event */}
          {!isGlobalActive && (
            <div className="pt-1 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs h-7"
                onClick={() => handleGlobalMetaUpdate({ activeEventId: selectedActivity })}
              >
                <Zap className="w-3.5 h-3.5" />
                Marcar como evento activo global
              </Button>
            </div>
          )}
        </Card>

        {/* Subsections grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subsections.map((subsection) => {
            const subsectionData = currentActivityData?.[subsection.id];
            const hasData = subsectionData?.data && (
              Array.isArray(subsectionData.data)
                ? subsectionData.data.length > 0
                : Object.keys(subsectionData.data).length > 0
            );

            return (
              <Card
                key={subsection.id}
                className={`p-6 cursor-pointer transition-all hover:border-primary/30 hover:bg-card/80 ${subsectionData?.hidden ? 'opacity-60' : ''}`}
                onClick={() => setSelectedSubsection(subsection.id)}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{subsection.title}</h3>
                      <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-success' : 'bg-muted'}`} />
                    </div>
                    <p className="text-sm text-muted-foreground">{subsection.description}</p>
                    {subsectionData?.updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Actualizado: {new Date(subsectionData.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between pt-4 border-t border-border/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {subsectionData?.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{subsectionData?.hidden ? 'Oculta' : 'Visible'}</span>
                    </div>
                    <Switch
                      checked={!subsectionData?.hidden}
                      onCheckedChange={() => handleToggleHidden(subsection.id)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── View: activities list ────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
            Actividades
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Gestiona todas las actividades y sus contenidos
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 tech-glow flex-shrink-0 self-start sm:self-auto">
              <Plus className="w-4 h-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Actividad</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder='Nombre del nodo (ej: "actividadnavidad")'
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateActivity()}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Sin espacios, se guardará en minúsculas.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateActivity}>Crear Actividad</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Global event config */}
      <Card className="p-4 sm:p-5 bg-card/50 border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Modo evento global</h3>
          {globalMeta.updatedAt && (
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(globalMeta.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs">Evento activo (tab dedicada + banner en la app)</Label>
          <Select
            value={globalMeta.activeEventId ?? NONE}
            onValueChange={(v) =>
              handleGlobalMetaUpdate({ activeEventId: v === NONE ? undefined : v })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Ninguno</SelectItem>
              {activities.map((id) => {
                const meta: EventMeta = data[id]?._meta ?? {};
                return (
                  <SelectItem key={id} value={id}>
                    {meta.title ? `${meta.title} (${id})` : id}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Activity cards */}
      {activities.length === 0 ? (
        <Card className="p-8 text-center bg-card/50 border-border/50">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">No hay actividades</h3>
              <p className="text-sm text-muted-foreground">
                Crea tu primera actividad para comenzar a gestionar el contenido.
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4 gap-2 tech-glow">
              <Plus className="w-4 h-4" />
              Crear mi primera actividad
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activityId) => {
            const meta: EventMeta = data[activityId]?._meta ?? {};
            const isGlobalActive = globalMeta.activeEventId === activityId;
            const subsectionCount = Object.keys(data[activityId] || {}).filter((k) => k !== '_meta').length;

            return (
              <Card
                key={activityId}
                className="p-6 cursor-pointer transition-all hover:border-primary/30 hover:bg-card/80"
                onClick={() => setSelectedActivity(activityId)}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-semibold">
                      {meta.title || activityId}
                    </h3>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isGlobalActive && (
                        <Badge className="text-[10px] px-1.5 py-0 gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          Activo
                        </Badge>
                      )}
                      {meta.status === 'archived' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                          <Archive className="w-2.5 h-2.5" />
                          Archivado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {meta.title && (
                    <p className="text-xs font-mono text-muted-foreground/60">{activityId}</p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {subsectionCount} subsecciones
                  </p>

                  {meta.tintColor && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="w-3 h-3 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: meta.tintColor }}
                      />
                      {meta.tintColor}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
