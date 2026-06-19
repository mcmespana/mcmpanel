import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Send, Bell, Users, Target, Smartphone, Clock,
  CheckCircle, Trash2, BarChart3, AlertTriangle,
  Monitor, Apple, Loader2, RefreshCw, Megaphone,
  CalendarClock, XCircle, Ban, Plus, X, MousePointerClick,
} from 'lucide-react';
import { ImageUploadCropper } from '@/components/ui/ImageUploadCropper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import {
  sendNotification,
  scheduleNotification,
  cancelScheduledNotification,
  getStats,
  type SendNotificationRequest,
  type NotificationRecord,
  type NotificationStats,
  type ScheduledNotification,
  type ActionButton,
} from '@/lib/notificationService';
import {
  type AudienceFilter,
  type AudienceMatch,
  type SegmentTokenRecord,
  audienceHasAxis,
  tokenMatchesAudience,
  summarizeAudience,
} from '@/lib/audience';
import type { ProfileType, DelegationListItem } from '@/types/profileConfig';

// Default tap behaviour: send NO internalRoute so the app opens THIS notification
// expanded ("en grande") inside the notification center, matching data.id against
// its /notifications/<id> entry in Firebase.
const DETAIL = '__detail';
const CUSTOM_ROUTE = '__custom';

// Vocabulario alineado con la MCM App (types/notifications.ts).
const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'cancionero', label: 'Cancionero' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'celebraciones', label: 'Celebraciones' },
  { id: 'urgente', label: 'Urgente' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
];

const PRIORITIES = [
  { id: 'default', label: 'Por defecto' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'Alta' },
];

// Rutas REALES de la MCM App (Expo Router) agrupadas para el desplegable.
// Las del grupo "según perfil" (⚠️) dependen del perfil del usuario: si su
// perfil no tiene esa tab, la navegación puede no ir a ningún sitio. Para
// envíos universales usa Inicio, Calendario, Fotos o Más.
//
// El desplegable se compone en este orden, de más cómodo a más avanzado:
//   1. DETAIL  → abrir la notificación en grande (recomendado, sin ruta)
//   2. Secciones para todos
//   3. Secciones según perfil
//   4. Ruta personalizada (deep link)
const ROUTE_GROUPS: { label: string; routes: { id: string; label: string }[] }[] = [
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

// ─── Segmentación de destinatarios ─────────────────────────────────────────--
// Los perfiles se filtran por token.profileType (no por topic). Las delegaciones
// se pueblan en vivo desde /profileConfig/data/delegationList y filtran por
// token.delegationId. Los eventos filtran por el topic opt-in "event-<id>".

const PROFILE_OPTIONS: { id: ProfileType; label: string }[] = [
  { id: 'familia', label: 'Familias' },
  { id: 'monitor', label: 'Monitores' },
  { id: 'miembro', label: 'Miembros' },
];

// Eventos conocidos a los que el usuario puede suscribirse (topic "event-<id>").
// Lista manual ampliable; el <id> coincide con el slug del evento en la app
// (nodo Firebase: "jubileo", o activities/<nombre>). Además se permite teclear
// un id personalizado para eventos nuevos sin tocar el código.
const EVENT_OPTIONS: { id: string; label: string }[] = [
  { id: 'jubileo', label: 'Jubileo 2025' },
];
const EVENT_NONE = '__none';
const EVENT_CUSTOM = '__custom';

const MAX_TITLE = 50;
const MAX_BODY = 200;
const MAX_BODY_LONG = 2000;
// Mirrors MAX_ACTION_BUTTONS in the app (utils/notificationRoutes.ts).
const MAX_ACTION_BUTTONS = 3;
// The chip in the notification card truncates around here; keep it short.
const MAX_BUTTON_TEXT = 20;

// White-list of valid internal routes (used to validate "Interno" buttons).
const INTERNAL_ROUTE_IDS = new Set(
  ROUTE_GROUPS.flatMap((group) => group.routes.map((route) => route.id)),
);

// One row of the action-button repeater in the form.
interface ActionButtonForm {
  text: string;
  url: string;
  isInternal: boolean;
}

const emptyActionButton: ActionButtonForm = { text: '', url: '', isInternal: false };

interface FormState {
  title: string;
  body: string;
  // Extended description (in-app detail modal only). Sent only when the
  // "Añadir descripción detallada" toggle is on and the textarea is non-empty.
  bodyLong: string;
  bodyLongEnabled: boolean;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon: string;
  imageUrl: string;
  routeChoice: string;   // dropdown: DETAIL, a preset route id, or CUSTOM_ROUTE
  customRoute: string;   // free-text deep link when routeChoice === CUSTOM_ROUTE
  // Up to MAX_ACTION_BUTTONS in-app action buttons (canonical `actionButtons`).
  actionButtons: ActionButtonForm[];
  // ─── Audiencia (4 ejes combinables) ───
  // Cómo combinar los ejes entre sí: 'all' = AND (por defecto), 'any' = OR.
  audienceMatch: AudienceMatch;
  audTodos: boolean;          // eje "todos" (topic general)
  audPerfiles: ProfileType[]; // eje perfil
  audDelegaciones: string[];  // eje delegación (delegationId)
  audEventId: string;         // eje evento ('' = inactivo)
}

const emptyForm: FormState = {
  title: '',
  body: '',
  bodyLong: '',
  bodyLongEnabled: false,
  category: 'general',
  priority: 'default',
  icon: '',
  imageUrl: '',
  routeChoice: DETAIL,
  customRoute: '',
  actionButtons: [],
  // Por defecto: a todos los onboarded (topic general), combinando con AND.
  audienceMatch: 'all',
  audTodos: true,
  audPerfiles: [],
  audDelegaciones: [],
  audEventId: '',
};

// Resolves the internalRoute sent in the Expo payload (data.internalRoute).
// DETAIL → undefined: with no internalRoute the app opens THIS notification
// expanded in its detail view (it matches data.id against /notifications/<id>).
function resolveRoute(form: FormState): string | undefined {
  if (form.routeChoice === DETAIL) return undefined;
  if (form.routeChoice === CUSTOM_ROUTE) return form.customRoute.trim() || undefined;
  return form.routeChoice;
}

// Human-readable description of what happens when the user taps the push.
function describeTapAction(form: FormState): string {
  const route = resolveRoute(form);
  if (!route) return 'Abre la notificación en grande';
  return route;
}

// Builds the canonical AudienceFilter from the form's individual axis fields.
function resolveAudience(form: FormState): AudienceFilter {
  return {
    match: form.audienceMatch,
    todos: form.audTodos,
    perfiles: form.audPerfiles,
    delegaciones: form.audDelegaciones,
    eventId: form.audEventId.trim() || null,
  };
}

// Rows with no url are ignored. Returns the cleaned list (capped to the max) to
// send as `data.actionButtons`. Firebase RTDB rejects `undefined`, so every
// field is always a concrete value.
function resolveActionButtons(form: FormState): ActionButton[] {
  return form.actionButtons
    .filter((btn) => btn.url.trim())
    .slice(0, MAX_ACTION_BUTTONS)
    .map((btn) => ({
      text: btn.text.trim() || 'Ver',
      url: btn.url.trim(),
      isInternal: btn.isInternal,
    }));
}

// Returns the extended description to send, or undefined when it adds nothing
// (toggle off, empty, or identical to `body` — the app falls back to `body`).
function resolveBodyLong(form: FormState): string | undefined {
  if (!form.bodyLongEnabled) return undefined;
  const long = form.bodyLong.trim();
  if (!long || long === form.body.trim()) return undefined;
  return long;
}

// Validates a single non-empty button row. Returns an error message or null.
function validateActionButton(btn: ActionButtonForm, index: number): string | null {
  const text = btn.text.trim();
  const url = btn.url.trim();
  if (!text && !url) return null; // empty row, ignored on send
  const label = `Botón ${index + 1}`;
  if (!text) return `${label}: falta el texto.`;
  if (!url) return `${label}: falta la URL o ruta.`;
  if (btn.isInternal) {
    if (!INTERNAL_ROUTE_IDS.has(url)) {
      return `${label}: "${url}" no es una ruta interna válida. Elige una de la lista o usa una URL externa.`;
    }
  } else if (!/^https:\/\//i.test(url)) {
    return `${label}: la URL externa debe empezar por https://`;
  }
  return null;
}

// <input type="datetime-local"> gives a value WITHOUT timezone (e.g.
// "2026-06-03T18:30"), interpreted in the admin's local time. `new Date(value)`
// parses it in local time, so .toISOString() yields the correct UTC instant.
function localInputToISO(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// Builds a local "YYYY-MM-DDTHH:mm" string (what datetime-local expects).
// toISOString would shift to UTC, so format the local parts by hand.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Default suggested value for the picker: now + 1 hour, on the minute.
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return toLocalInputValue(d);
}

// Earliest selectable value: right now (so a send 5 minutes out is allowed).
function minScheduleValue(): string {
  return toLocalInputValue(new Date());
}

const SCHEDULE_STATUS: Record<ScheduledNotification['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: 'Programada', variant: 'secondary' },
  processing: { label: 'Enviando', variant: 'default' },
  sent: { label: 'Enviada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
  failed: { label: 'Fallida', variant: 'destructive' },
};

export function NotificationsSection() {
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  // Scheduling
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
  // Segmentation: live snapshot of /pushTokens (for the recipient preview count)
  // and the delegation list (from /profileConfig) that populates the multiselect.
  const [tokens, setTokens] = useState<SegmentTokenRecord[]>([]);
  const [delegations, setDelegations] = useState<DelegationListItem[]>([]);
  const { toast } = useToast();

  // Active tab is mirrored in the URL (?tab=compose) so the home dashboard can
  // deep-link straight to composing, scheduled or history.
  const [searchParams, setSearchParams] = useSearchParams();
  const TABS = ['dashboard', 'compose', 'scheduled', 'history'] as const;
  const tabParam = searchParams.get('tab');
  const activeTab = (TABS as readonly string[]).includes(tabParam ?? '') ? tabParam! : 'compose';
  const handleTabChange = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', value);
        return next;
      },
      { replace: true },
    );
  };

  // Load notification history from Firebase
  useEffect(() => {
    const db = getDB();
    const notifRef = ref(db, '/notifications');
    const unsub = onValue(notifRef, (snap) => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        const records = Object.values(val) as NotificationRecord[];
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setHistory(records);
      } else {
        setHistory([]);
      }
    });
    return () => unsub();
  }, []);

  // Load the scheduled-notifications queue (real-time)
  useEffect(() => {
    const db = getDB();
    const schedRef = ref(db, '/scheduledNotifications');
    const unsub = onValue(schedRef, (snap) => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        const records = Object.values(val) as ScheduledNotification[];
        records.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
        setScheduled(records);
      } else {
        setScheduled([]);
      }
    });
    return () => unsub();
  }, []);

  // Live snapshot of all push tokens, for the recipient preview count.
  useEffect(() => {
    const db = getDB();
    const tokensRef = ref(db, '/pushTokens');
    const unsub = onValue(tokensRef, (snap) => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        setTokens(Object.values(val) as SegmentTokenRecord[]);
      } else {
        setTokens([]);
      }
    });
    return () => unsub();
  }, []);

  // Delegation list that feeds the multiselect (id + label), from profileConfig.
  useEffect(() => {
    const db = getDB();
    const delRef = ref(db, '/profileConfig/data/delegationList');
    const unsub = onValue(delRef, (snap) => {
      const val = snap.val();
      setDelegations(Array.isArray(val) ? (val as DelegationListItem[]) : []);
    });
    return () => unsub();
  }, []);

  // Load stats from Firebase directly
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const db = getDB();
      const data = await getStats(db);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const updateForm = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addActionButton = () => {
    setForm((prev) =>
      prev.actionButtons.length >= MAX_ACTION_BUTTONS
        ? prev
        : { ...prev, actionButtons: [...prev.actionButtons, { ...emptyActionButton }] },
    );
  };

  const removeActionButton = (index: number) => {
    setForm((prev) => ({
      ...prev,
      actionButtons: prev.actionButtons.filter((_, i) => i !== index),
    }));
  };

  const updateActionButton = (
    index: number,
    field: keyof ActionButtonForm,
    value: string | boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      actionButtons: prev.actionButtons.map((btn, i) =>
        i === index ? { ...btn, [field]: value } : btn,
      ),
    }));
  };

  // ─── Audiencia derivada + preview de recuento (en vivo) ───────────────────
  const audience = useMemo(() => resolveAudience(form), [form]);
  const segmented = audienceHasAxis(audience);

  // Map id→label de delegaciones, para el resumen legible.
  const delegationLabel = useCallback(
    (id: string) => delegations.find((d) => d.id === id)?.label ?? id,
    [delegations],
  );
  const eventLabel = useCallback(
    (id: string) => EVENT_OPTIONS.find((e) => e.id === id)?.label ?? id,
    [],
  );

  // Recalcula a partir del snapshot de /pushTokens cada vez que cambia el filtro.
  const recipients = useMemo(() => {
    const onlyValid = tokens.filter(
      (t) => typeof t?.token === 'string' && t.token.startsWith('ExponentPushToken['),
    );
    const matched = onlyValid.filter((t) => tokenMatchesAudience(t, audience));
    const nullProfile = matched.filter((t) => !t.profileType).length;
    return { total: onlyValid.length, count: matched.length, nullProfile };
  }, [tokens, audience]);

  const audienceSummary = useMemo(
    () => summarizeAudience(segmented ? audience : null, { delegationLabel, eventLabel }),
    [audience, segmented, delegationLabel, eventLabel],
  );

  const togglePerfil = (perfil: ProfileType) => {
    setForm((prev) => ({
      ...prev,
      audPerfiles: prev.audPerfiles.includes(perfil)
        ? prev.audPerfiles.filter((p) => p !== perfil)
        : [...prev.audPerfiles, perfil],
    }));
  };

  const toggleDelegacion = (id: string) => {
    setForm((prev) => ({
      ...prev,
      audDelegaciones: prev.audDelegaciones.includes(id)
        ? prev.audDelegaciones.filter((d) => d !== id)
        : [...prev.audDelegaciones, id],
    }));
  };

  // Estado del selector de evento: id real, "ninguno", o "personalizado".
  const eventSelectValue = form.audEventId
    ? EVENT_OPTIONS.some((e) => e.id === form.audEventId)
      ? form.audEventId
      : EVENT_CUSTOM
    : EVENT_NONE;
  const [eventCustomMode, setEventCustomMode] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Campo requerido', description: 'El título es obligatorio', variant: 'destructive' });
      return;
    }
    if (!form.body.trim()) {
      toast({ title: 'Campo requerido', description: 'El cuerpo del mensaje es obligatorio', variant: 'destructive' });
      return;
    }

    // Validate every non-empty action-button row before building the payload.
    for (let i = 0; i < form.actionButtons.length; i++) {
      const error = validateActionButton(form.actionButtons[i], i);
      if (error) {
        toast({ title: 'Botón inválido', description: error, variant: 'destructive' });
        return;
      }
    }

    const actionButtons = resolveActionButtons(form);
    const payload: SendNotificationRequest = {
      title: form.title.trim(),
      body: form.body.trim(),
      bodyLong: resolveBodyLong(form),
      category: form.category,
      priority: form.priority,
      icon: form.icon || undefined,
      imageUrl: form.imageUrl || undefined,
      internalRoute: resolveRoute(form),
      actionButtons: actionButtons.length ? actionButtons : undefined,
      audience: segmented ? audience : undefined,
    };

    // ─── Scheduled send ───────────────────────────────────────────────
    if (scheduleMode) {
      const iso = localInputToISO(scheduledFor);
      if (!iso) {
        toast({ title: 'Fecha inválida', description: 'Selecciona una fecha y hora válidas', variant: 'destructive' });
        return;
      }
      if (new Date(iso).getTime() < Date.now() + 30_000) {
        toast({ title: 'Fecha en el pasado', description: 'Programa la notificación al menos un minuto en el futuro', variant: 'destructive' });
        return;
      }

      setSending(true);
      try {
        const result = await scheduleNotification({ ...payload, scheduledFor: iso });
        const when = new Date(result.scheduledFor).toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        toast({ title: 'Notificación programada', description: `Se enviará el ${when}.` });
        setForm({ ...emptyForm });
        setScheduleMode(false);
        setScheduledFor('');
      } catch (error) {
        toast({
          title: 'Error al programar',
          description: error instanceof Error ? error.message : 'Error desconocido',
          variant: 'destructive',
        });
      } finally {
        setSending(false);
      }
      return;
    }

    // ─── Immediate send ───────────────────────────────────────────────
    setSending(true);
    try {
      const result = await sendNotification(payload);

      toast({
        title: 'Notificación enviada',
        description: `Enviada a ${result.sentCount}/${result.totalTokens} dispositivos${
          result.invalidTokensCleaned > 0 ? `. ${result.invalidTokensCleaned} tokens inválidos eliminados.` : ''
        }`,
      });

      setForm({ ...emptyForm });
      loadStats();
    } catch (error) {
      toast({
        title: 'Error al enviar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      await cancelScheduledNotification(id);
      toast({ title: 'Programación cancelada', description: 'La notificación no se enviará.' });
    } catch (error) {
      toast({
        title: 'No se pudo cancelar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const pendingCount = scheduled.filter((s) => s.status === 'scheduled').length;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
            Centro de Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Envía notificaciones push a los usuarios de la aplicación MCM
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground flex-shrink-0">
          <Bell className="w-4 h-4 text-primary" />
          <span>Expo Push API</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="dashboard" className="h-9 whitespace-normal text-xs sm:text-sm">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="compose" className="h-9 whitespace-normal text-xs sm:text-sm">
            <span className="sm:hidden">Crear</span>
            <span className="hidden sm:inline">Crear Notificación</span>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="relative h-9 whitespace-normal text-xs sm:text-sm">
            Programadas
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="h-9 whitespace-normal text-xs sm:text-sm">
            Historial
          </TabsTrigger>
        </TabsList>

        {/* ─── Dashboard Tab ───────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Estadísticas</h2>
            <Button variant="outline" size="sm" onClick={loadStats} disabled={statsLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {statsLoading && !stats ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Cargando estadísticas...
            </div>
          ) : stats ? (
            <>
              {/* Device stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total dispositivos</p>
                        <p className="text-2xl font-bold text-primary">{stats.devices.total}</p>
                      </div>
                      <Smartphone className="w-8 h-8 text-primary/50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Activos 24h</p>
                        <p className="text-2xl font-bold text-green-500">{stats.devices.active24h}</p>
                      </div>
                      <Users className="w-8 h-8 text-green-500/50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Activos 7 días</p>
                        <p className="text-2xl font-bold text-accent">{stats.devices.active7d}</p>
                      </div>
                      <Target className="w-8 h-8 text-accent/50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Notificaciones enviadas</p>
                        <p className="text-2xl font-bold text-blue-500">{stats.notifications.sent}</p>
                      </div>
                      <Send className="w-8 h-8 text-blue-500/50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Platform breakdown */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                    Desglose por plataforma
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg">
                      <Apple className="w-6 h-6 text-gray-400" />
                      <div>
                        <p className="text-sm text-muted-foreground">iOS</p>
                        <p className="text-xl font-bold">{stats.devices.platforms.ios || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg">
                      <Smartphone className="w-6 h-6 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Android</p>
                        <p className="text-xl font-bold">{stats.devices.platforms.android || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg">
                      <Monitor className="w-6 h-6 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Web</p>
                        <p className="text-xl font-bold">{stats.devices.platforms.web || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Desconocido</p>
                        <p className="text-xl font-bold">{stats.devices.platforms.unknown || 0}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-yellow-500" />
                <p className="font-medium">No se pudieron cargar las estadísticas</p>
                <p className="text-sm mt-1">
                  Verifica la conexión con Firebase
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Compose Tab ─────────────────────────────────────────────── */}
        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Send className="w-5 h-5 mr-2 text-primary" />
                    Componer Notificación
                  </CardTitle>
                  <CardDescription>
                    Configura el contenido y opciones de tu notificación push
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      placeholder="Ej: Nueva canción disponible"
                      value={form.title}
                      onChange={(e) => updateForm('title', e.target.value.slice(0, MAX_TITLE))}
                      className="bg-input border-border/50"
                      maxLength={MAX_TITLE}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {form.title.length}/{MAX_TITLE}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <Label htmlFor="body">Cuerpo del mensaje *</Label>
                    <Textarea
                      id="body"
                      placeholder="Escribe el contenido de tu notificación..."
                      value={form.body}
                      onChange={(e) => updateForm('body', e.target.value.slice(0, MAX_BODY))}
                      className="bg-input border-border/50 min-h-[100px]"
                      maxLength={MAX_BODY}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {form.body.length}/{MAX_BODY}
                    </div>
                  </div>

                  {/* Extended description (bodyLong) */}
                  <div className="space-y-3 p-4 bg-muted/10 rounded-lg border border-border/30">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bodylong-enabled" className="text-sm font-medium">
                        Añadir descripción detallada
                      </Label>
                      <Switch
                        id="bodylong-enabled"
                        checked={form.bodyLongEnabled}
                        onCheckedChange={(v) => updateForm('bodyLongEnabled', v)}
                      />
                    </div>
                    {form.bodyLongEnabled ? (
                      <div className="space-y-2">
                        <Textarea
                          id="bodyLong"
                          placeholder="Texto largo con detalles, horarios, etc. Respeta saltos de línea."
                          value={form.bodyLong}
                          onChange={(e) => updateForm('bodyLong', e.target.value.slice(0, MAX_BODY_LONG))}
                          className="bg-input border-border/50 min-h-[120px]"
                          maxLength={MAX_BODY_LONG}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Solo se ve al abrir la notificación en la app (texto plano).</span>
                          <span>{form.bodyLong.length}/{MAX_BODY_LONG}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Si lo dejas desactivado, al abrir la notificación se mostrará el cuerpo de arriba.
                      </p>
                    )}
                  </div>

                  {/* Category + Priority */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <Select value={form.category} onValueChange={(v) => updateForm('category', v)}>
                        <SelectTrigger className="bg-input border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Prioridad</Label>
                      <Select value={form.priority} onValueChange={(v) => updateForm('priority', v)}>
                        <SelectTrigger className="bg-input border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Icon + Image URL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Icono de notificación</Label>
                      <ImageUploadCropper
                        value={form.icon}
                        onChange={(url) => updateForm('icon', url)}
                        storagePath="notificaciones/iconos"
                        aspectRatio={1}
                        maxWidth={256}
                        maxHeight={256}
                        quality={0.9}
                      />
                      <Input
                        id="icon"
                        placeholder="O pega una URL directamente…"
                        value={form.icon}
                        onChange={(e) => updateForm('icon', e.target.value)}
                        className="bg-input border-border/50 text-xs"
                      />
                      <p className="text-xs text-muted-foreground">Miniatura en el centro de notificaciones de la app.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Imagen de notificación</Label>
                      <ImageUploadCropper
                        value={form.imageUrl}
                        onChange={(url) => updateForm('imageUrl', url)}
                        storagePath="notificaciones"
                        aspectRatio={2 / 1}
                        maxWidth={1024}
                        maxHeight={512}
                        quality={0.75}
                      />
                      <Input
                        id="imageUrl"
                        placeholder="O pega una URL directamente…"
                        value={form.imageUrl}
                        onChange={(e) => updateForm('imageUrl', e.target.value)}
                        className="bg-input border-border/50 text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se ve en la notificación en Android. En iOS solo dentro de la app.
                      </p>
                    </div>
                  </div>

                  {/* Internal route / tap action */}
                  <div className="space-y-2">
                    <Label>Al tocar la notificación</Label>
                    <Select value={form.routeChoice} onValueChange={(v) => updateForm('routeChoice', v)}>
                      <SelectTrigger className="bg-input border-border/50">
                        <SelectValue placeholder="Elige qué pasa al tocarla" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Recommended default: open this notification expanded */}
                        <SelectItem value={DETAIL}>🔔 Abrir la notificación en grande</SelectItem>
                        {ROUTE_GROUPS.map((group) => (
                          <SelectGroup key={group.label}>
                            <SelectSeparator />
                            <SelectLabel className="text-muted-foreground">{group.label}</SelectLabel>
                            {group.routes.map((route) => (
                              <SelectItem key={route.id} value={route.id}>
                                {route.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-muted-foreground">Avanzado</SelectLabel>
                          <SelectItem value={CUSTOM_ROUTE}>Ruta personalizada (deep link)…</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {form.routeChoice === CUSTOM_ROUTE && (
                      <Input
                        placeholder="Ej: /(tabs)/mas"
                        value={form.customRoute}
                        onChange={(e) => updateForm('customRoute', e.target.value)}
                        className="bg-input border-border/50 font-mono text-xs"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {form.routeChoice === DETAIL
                        ? 'Recomendado: al tocarla se abre esta misma notificación desplegada en el centro de notificaciones.'
                        : '⚠️ = la pantalla depende del perfil del usuario. Para todos, usa Inicio, Calendario, Fotos o Más.'}
                    </p>
                  </div>

                  {/* Action buttons (dynamic list, up to MAX_ACTION_BUTTONS) */}
                  <div className="space-y-3 p-4 bg-muted/10 rounded-lg border border-border/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center">
                        <MousePointerClick className="w-4 h-4 mr-2" />
                        Botones de acción (opcional)
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {form.actionButtons.length}/{MAX_ACTION_BUTTONS}
                      </span>
                    </div>

                    {form.actionButtons.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sin botones: la notificación no muestra ninguna acción extra.
                      </p>
                    )}

                    {form.actionButtons.map((btn, index) => (
                      <div
                        key={index}
                        className="space-y-2 p-3 bg-background/40 rounded-md border border-border/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Botón {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => removeActionButton(index)}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input
                            placeholder="Texto del botón"
                            value={btn.text}
                            maxLength={MAX_BUTTON_TEXT}
                            onChange={(e) =>
                              updateActionButton(index, 'text', e.target.value.slice(0, MAX_BUTTON_TEXT))
                            }
                            className="bg-input border-border/50"
                          />
                          <Input
                            placeholder={btn.isInternal ? '/(tabs)/fotos' : 'https://…'}
                            value={btn.url}
                            onChange={(e) => updateActionButton(index, 'url', e.target.value)}
                            className="bg-input border-border/50 font-mono text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={`btn-internal-${index}`}
                            className="text-xs text-muted-foreground font-normal"
                          >
                            Ruta interna de la app (no un enlace web)
                          </Label>
                          <Switch
                            id={`btn-internal-${index}`}
                            checked={btn.isInternal}
                            onCheckedChange={(v) => updateActionButton(index, 'isInternal', v)}
                          />
                        </div>
                      </div>
                    ))}

                    {form.actionButtons.length < MAX_ACTION_BUTTONS && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={addActionButton}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir botón
                      </Button>
                    )}
                  </div>

                  {/* Recipient segmentation (4 combinable axes + AND/OR) */}
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-muted-foreground flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Destinatarios
                      </p>
                      {/* Live recipient count */}
                      <Badge
                        variant={recipients.count === 0 ? 'destructive' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        <Megaphone className="w-3 h-3" />
                        ≈ {recipients.count} dispositivo{recipients.count === 1 ? '' : 's'}
                      </Badge>
                    </div>

                    {/* AND/OR match toggle (only matters with 2+ active axes) */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md bg-background/40 border border-border/30 p-2.5">
                      <Label className="text-xs text-muted-foreground font-normal">
                        Coincidir
                      </Label>
                      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateForm('audienceMatch', 'all')}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            form.audienceMatch === 'all'
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Todas (Y)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateForm('audienceMatch', 'any')}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            form.audienceMatch === 'any'
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Cualquiera (O)
                        </button>
                      </div>
                    </div>

                    {/* Eje: Todos */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={form.audTodos}
                        onCheckedChange={(v) => updateForm('audTodos', v === true)}
                        className="mt-0.5"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">Todos los onboarded</span>
                        <span className="block text-xs text-muted-foreground">
                          Dispositivos con el topic «general» (avisos transversales).
                        </span>
                      </span>
                    </label>

                    {/* Eje: Perfil */}
                    <div className="space-y-2">
                      <Label className="text-xs">Por perfil</Label>
                      <div className="flex flex-wrap gap-2">
                        {PROFILE_OPTIONS.map((p) => {
                          const active = form.audPerfiles.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePerfil(p.id)}
                              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                active
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background/40 border-border/50 text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Eje: Delegación */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Por delegación</Label>
                        {form.audDelegaciones.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, audDelegaciones: [] }))}
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Limpiar ({form.audDelegaciones.length})
                          </button>
                        )}
                      </div>
                      {delegations.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No hay delegaciones configuradas (en Perfiles → delegationList).
                        </p>
                      ) : (
                        <ScrollArea className="h-32 rounded-md border border-border/30 bg-background/40 p-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {delegations.map((d) => {
                              const active = form.audDelegaciones.includes(d.id);
                              return (
                                <label
                                  key={d.id}
                                  className="flex items-center gap-2 cursor-pointer text-sm px-1 py-0.5 rounded hover:bg-muted/30"
                                >
                                  <Checkbox
                                    checked={active}
                                    onCheckedChange={() => toggleDelegacion(d.id)}
                                  />
                                  <span className="truncate">{d.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>

                    {/* Eje: Evento (topic event-<id>, suscripción opt-in) */}
                    <div className="space-y-2">
                      <Label className="text-xs">Por evento (suscritos)</Label>
                      <Select
                        value={eventSelectValue}
                        onValueChange={(v) => {
                          if (v === EVENT_NONE) {
                            setEventCustomMode(false);
                            updateForm('audEventId', '');
                          } else if (v === EVENT_CUSTOM) {
                            setEventCustomMode(true);
                            updateForm('audEventId', '');
                          } else {
                            setEventCustomMode(false);
                            updateForm('audEventId', v);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-input border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EVENT_NONE}>Sin filtro de evento</SelectItem>
                          {EVENT_OPTIONS.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                          ))}
                          <SelectSeparator />
                          <SelectItem value={EVENT_CUSTOM}>Otro evento (id manual)…</SelectItem>
                        </SelectContent>
                      </Select>
                      {(eventCustomMode || eventSelectValue === EVENT_CUSTOM) && (
                        <Input
                          placeholder="id del evento (p. ej. evento2027)"
                          value={form.audEventId}
                          onChange={(e) => updateForm('audEventId', e.target.value.trim())}
                          className="bg-input border-border/50 font-mono text-xs"
                        />
                      )}
                      {form.audEventId && (
                        <p className="text-[11px] text-muted-foreground">
                          Topic: <code className="bg-muted px-1 rounded">event-{form.audEventId}</code>
                        </p>
                      )}
                    </div>

                    {/* Resumen + avisos */}
                    <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/30">
                      <p>
                        {segmented ? (
                          <>Llega a <strong>{audienceSummary}</strong> · ≈ {recipients.count} de {recipients.total} dispositivos.</>
                        ) : (
                          <>Sin filtros: la notificación llega a <strong>TODOS</strong> los dispositivos ({recipients.total}).</>
                        )}
                      </p>
                      {recipients.count === 0 && (
                        <p className="text-destructive">
                          Ningún dispositivo cumple el filtro: revisa los ejes o el modo Y/O.
                        </p>
                      )}
                      {recipients.nullProfile > 0 && (
                        <p className="text-yellow-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          {recipients.nullProfile} sin perfil (saltaron el onboarding) entran en el recuento.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="schedule-mode" className="text-sm font-medium flex items-center">
                        <CalendarClock className="w-4 h-4 mr-2" />
                        Programar envío
                      </Label>
                      <Switch
                        id="schedule-mode"
                        checked={scheduleMode}
                        onCheckedChange={(v) => {
                          setScheduleMode(v);
                          if (v && !scheduledFor) setScheduledFor(defaultScheduleValue());
                        }}
                      />
                    </div>
                    {scheduleMode && (
                      <div className="space-y-2">
                        <Input
                          type="datetime-local"
                          value={scheduledFor}
                          min={minScheduleValue()}
                          onChange={(e) => setScheduledFor(e.target.value)}
                          className="bg-input border-border/50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Se enviará automáticamente a la fecha y hora indicadas (tu hora local).
                          Puedes verla y cancelarla en la pestaña «Programadas».
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Send button */}
                  <Button
                    onClick={handleSend}
                    className="w-full tech-glow relative overflow-hidden group"
                    size="lg"
                    disabled={
                      sending ||
                      !form.title.trim() ||
                      !form.body.trim() ||
                      (scheduleMode && !scheduledFor) ||
                      (segmented && recipients.count === 0)
                    }
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {scheduleMode ? 'Programando...' : 'Enviando...'}
                      </>
                    ) : scheduleMode ? (
                      <>
                        <CalendarClock className="w-4 h-4 mr-2" />
                        {segmented ? `Programar para ≈ ${recipients.count}` : 'Programar para todos'}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {segmented ? `Enviar a ≈ ${recipients.count} dispositivos` : 'Enviar a todos'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Preview sidebar */}
            <div className="space-y-6">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-sm">
                    <Smartphone className="w-4 h-4 mr-2 text-primary" />
                    Vista previa móvil
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 rounded-2xl p-4">
                    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                          {form.icon ? (
                            <img
                              src={form.icon}
                              alt=""
                              className="w-6 h-6 rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Bell className="w-4 h-4 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm truncate">
                            {form.title || 'Título de la notificación'}
                          </div>
                          <div className="text-gray-300 text-xs mt-1 line-clamp-3">
                            {form.body || 'El cuerpo del mensaje aparecerá aquí...'}
                          </div>
                          {form.imageUrl && (
                            <div className="mt-2 w-full h-20 bg-gray-700 rounded overflow-hidden">
                              <img
                                src={form.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const container = (e.target as HTMLImageElement).parentElement;
                                  if (container) {
                                    container.innerHTML = '<div class="flex items-center justify-center h-full"><span class="text-gray-500 text-xs">Imagen</span></div>';
                                  }
                                }}
                              />
                            </div>
                          )}
                          {form.actionButtons.some((b) => b.text.trim() || b.url.trim()) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {form.actionButtons
                                .filter((b) => b.text.trim() || b.url.trim())
                                .slice(0, MAX_ACTION_BUTTONS)
                                .map((b, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded"
                                  >
                                    {b.text.trim() || 'Ver'}
                                  </span>
                                ))}
                            </div>
                          )}
                          <div className="text-gray-400 text-xs mt-2">ahora</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data preview */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-sm">
                    <Target className="w-4 h-4 mr-2 text-primary" />
                    Datos del envío
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoría:</span>
                    <Badge variant="secondary">{form.category}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prioridad:</span>
                    <Badge variant={form.priority === 'high' ? 'destructive' : 'secondary'}>
                      {form.priority}
                    </Badge>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Al tocar:</span>
                    {resolveRoute(form) ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate">{describeTapAction(form)}</code>
                    ) : (
                      <span className="text-right flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Abre la notificación
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Destinatarios:</span>
                    <span className="text-right">
                      {segmented ? (
                        <span className="text-xs">{audienceSummary}</span>
                      ) : (
                        <span className="flex items-center justify-end gap-1"><Megaphone className="w-3 h-3" /> Todos</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Alcance:</span>
                    <Badge variant={recipients.count === 0 && segmented ? 'destructive' : 'secondary'}>
                      ≈ {segmented ? recipients.count : recipients.total} dispositivos
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Botones:</span>
                    <span>
                      {resolveActionButtons(form).length > 0
                        ? `${resolveActionButtons(form).length} de ${MAX_ACTION_BUTTONS}`
                        : 'Ninguno'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desc. detallada:</span>
                    <span>{resolveBodyLong(form) ? 'Sí' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── Scheduled Tab ───────────────────────────────────────────── */}
        <TabsContent value="scheduled" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarClock className="w-5 h-5 mr-2 text-primary" />
                Notificaciones programadas
              </CardTitle>
              <CardDescription>
                Se envían automáticamente a su hora. Puedes cancelar las pendientes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduled.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay notificaciones programadas</p>
                  <p className="text-sm mt-1">
                    Crea una notificación y activa «Programar envío».
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduled.map((item) => {
                    const meta = SCHEDULE_STATUS[item.status] ?? { label: item.status, variant: 'outline' as const };
                    const when = new Date(item.scheduledFor).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-4 bg-muted/20 rounded-lg border border-border/30"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="font-medium truncate">{item.title}</div>
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.body}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                            {item.audience || (item.topics && item.topics.length > 0) ? (
                              <Badge variant="outline" className="text-[10px]">
                                {item.audience
                                  ? summarizeAudience(item.audience, { delegationLabel, eventLabel })
                                  : item.topics!.join(' · ')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                                <Megaphone className="w-3 h-3" /> Todos
                              </Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {when}
                            </span>
                            {item.status === 'failed' && item.error && (
                              <span className="text-destructive truncate max-w-[200px]" title={item.error}>
                                {item.error}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge variant={meta.variant} className="flex items-center">
                            {item.status === 'processing' ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : item.status === 'sent' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : item.status === 'cancelled' ? (
                              <Ban className="w-3 h-3 mr-1" />
                            ) : item.status === 'failed' ? (
                              <XCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <CalendarClock className="w-3 h-3 mr-1" />
                            )}
                            {meta.label}
                          </Badge>
                          {item.status === 'scheduled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={() => handleCancelScheduled(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── History Tab ─────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-primary" />
                Historial de Notificaciones
              </CardTitle>
              <CardDescription>
                Todas las notificaciones enviadas desde el panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay notificaciones enviadas aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((notif) => (
                    <div
                      key={notif.notificationId}
                      className="flex items-start justify-between p-4 bg-muted/20 rounded-lg border border-border/30"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="font-medium truncate">{notif.title}</div>
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notif.body}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{notif.category}</Badge>
                          {notif.audience ? (
                            <Badge variant="outline" className="text-[10px]">
                              {summarizeAudience(notif.audience, { delegationLabel, eventLabel })}
                            </Badge>
                          ) : notif.topics && notif.topics.length > 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              {notif.topics.join(' · ')}
                            </Badge>
                          ) : null}
                          {notif.sentAt && (
                            <span>
                              {new Date(notif.sentAt).toLocaleString('es-ES', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )}
                          <span>
                            {notif.sentCount}/{notif.totalTokens} enviados
                          </span>
                          {notif.invalidTokens > 0 && (
                            <span className="text-yellow-500">
                              {notif.invalidTokens} tokens limpiados
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={notif.status === 'completed' ? 'default' : 'secondary'}
                        className="flex-shrink-0"
                      >
                        {notif.status === 'completed' ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Enviado
                          </>
                        ) : notif.status === 'sending' ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Enviando
                          </>
                        ) : (
                          notif.status
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
