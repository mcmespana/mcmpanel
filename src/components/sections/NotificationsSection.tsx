import { useCallback, useEffect, useState } from 'react';
import {
  Send, Bell, Users, Target, Smartphone, Clock,
  CheckCircle, BarChart3, AlertTriangle,
  Monitor, Apple, Loader2, RefreshCw, Megaphone,
} from 'lucide-react';
import { ImageUploadCropper } from '@/components/ui/ImageUploadCropper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import {
  sendNotification,
  getStats,
  type SendNotificationRequest,
  type NotificationRecord,
  type NotificationStats,
  type ActionButton,
} from '@/lib/notificationService';

const ALL = '__all';
const NONE = '__none';
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

// Rutas REALES de la MCM App (Expo Router). Las marcadas con ⚠️ dependen del
// perfil del usuario: si su perfil no tiene esa tab, la navegación puede no ir
// a ningún sitio. Para envíos universales usa Inicio, Calendario, Fotos o Más.
const INTERNAL_ROUTES = [
  { id: NONE, label: 'Ninguna' },
  { id: '/(tabs)/index', label: 'Inicio' },
  { id: '/(tabs)/calendario', label: 'Calendario' },
  { id: '/(tabs)/fotos', label: 'Fotos / Álbumes' },
  { id: '/(tabs)/mas', label: 'Más (eventos: Jubileo, Visita Papa…)' },
  { id: '/(tabs)/cancionero', label: 'Cancionero ⚠️ (según perfil)' },
  { id: '/(tabs)/contigo', label: 'Contigo ⚠️ (según perfil)' },
  { id: '/(tabs)/contigo/evangelio', label: 'Contigo · Evangelio del día ⚠️' },
  { id: '/(tabs)/contigo/oracion', label: 'Contigo · Oración ⚠️' },
  { id: '/(tabs)/contigo/revision', label: 'Contigo · Revisión ⚠️' },
  { id: '/(tabs)/contigo/bookmarks', label: 'Contigo · Favoritos ⚠️' },
  { id: '/(tabs)/visitapapa', label: 'Visita del Papa ⚠️ (si activo)' },
  { id: '/notifications', label: 'Centro de notificaciones' },
  { id: CUSTOM_ROUTE, label: 'Personalizada (deep link)…' },
];

// Segmentación por "topics". Un perfil aporta familias/monitores/miembros y la
// delegación aporta su topic mcm-*. Filtrar por ambos = AND (familias de Madrid).
const PROFILE_TOPICS = [
  { topic: 'familias', label: 'Familias' },
  { topic: 'monitores', label: 'Monitores' },
  { topic: 'miembros', label: 'Miembros' },
];

const DELEGATION_TOPICS = [
  { topic: 'mcm-espana', label: 'MCM España' },
  { topic: 'mcm-benicarlo-vinaros', label: 'Benicarló-Vinaròs' },
  { topic: 'mcm-burriana', label: 'Burriana' },
  { topic: 'mcm-caravaca', label: 'Caravaca' },
  { topic: 'mcm-castellon', label: 'Castellón' },
  { topic: 'mcm-espinardo', label: 'Espinardo' },
  { topic: 'mcm-granada', label: 'Granada' },
  { topic: 'mcm-lalcora', label: "L'Alcora" },
  { topic: 'mcm-madrid', label: 'Madrid' },
  { topic: 'mcm-nules', label: 'Nules' },
  { topic: 'mcm-onda', label: 'Onda' },
  { topic: 'mcm-quintanar', label: 'Quintanar' },
  { topic: 'mcm-vila-real', label: 'Vila-real' },
  { topic: 'mcm-villacanas', label: 'Villacañas' },
  { topic: 'mcm-zaragoza', label: 'Zaragoza' },
  { topic: 'internacional', label: 'Internacional' },
];

const MAX_TITLE = 50;
const MAX_BODY = 200;

interface FormState {
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon: string;
  imageUrl: string;
  routeChoice: string;   // dropdown: preset id, NONE, or CUSTOM_ROUTE
  customRoute: string;   // free-text deep link when routeChoice === CUSTOM_ROUTE
  // Single action button (canonical format expected by the app)
  buttonText: string;
  buttonUrl: string;
  buttonIsInternal: boolean;
  // Segmentation by topic (AND). ALL = no filter on that axis.
  profileTopic: string;
  delegationTopic: string;
}

const emptyForm: FormState = {
  title: '',
  body: '',
  category: 'general',
  priority: 'default',
  icon: '',
  imageUrl: '',
  routeChoice: NONE,
  customRoute: '',
  buttonText: '',
  buttonUrl: '',
  buttonIsInternal: false,
  profileTopic: ALL,
  delegationTopic: ALL,
};

function resolveRoute(form: FormState): string | undefined {
  if (form.routeChoice === NONE) return undefined;
  if (form.routeChoice === CUSTOM_ROUTE) return form.customRoute.trim() || undefined;
  return form.routeChoice;
}

function resolveTopics(form: FormState): string[] {
  const topics: string[] = [];
  if (form.profileTopic !== ALL) topics.push(form.profileTopic);
  if (form.delegationTopic !== ALL) topics.push(form.delegationTopic);
  return topics;
}

function resolveActionButton(form: FormState): ActionButton | undefined {
  if (!form.buttonText.trim() || !form.buttonUrl.trim()) return undefined;
  return {
    text: form.buttonText.trim(),
    url: form.buttonUrl.trim(),
    isInternal: form.buttonIsInternal,
  };
}

export function NotificationsSection() {
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const { toast } = useToast();

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

  const segmented = form.profileTopic !== ALL || form.delegationTopic !== ALL;

  const handleSend = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Campo requerido', description: 'El título es obligatorio', variant: 'destructive' });
      return;
    }
    if (!form.body.trim()) {
      toast({ title: 'Campo requerido', description: 'El cuerpo del mensaje es obligatorio', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const payload: SendNotificationRequest = {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        priority: form.priority,
        icon: form.icon || undefined,
        imageUrl: form.imageUrl || undefined,
        internalRoute: resolveRoute(form),
        actionButton: resolveActionButton(form),
        topics: segmented ? resolveTopics(form) : undefined,
      };

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

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="compose">Crear Notificación</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
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
                      <Label htmlFor="icon">URL del icono</Label>
                      <Input
                        id="icon"
                        placeholder="https://example.com/icon.png"
                        value={form.icon}
                        onChange={(e) => updateForm('icon', e.target.value)}
                        className="bg-input border-border/50"
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

                  {/* Internal route */}
                  <div className="space-y-2">
                    <Label>Ruta interna (al tocar la notificación)</Label>
                    <Select value={form.routeChoice} onValueChange={(v) => updateForm('routeChoice', v)}>
                      <SelectTrigger className="bg-input border-border/50">
                        <SelectValue placeholder="Selecciona una ruta" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNAL_ROUTES.map((route) => (
                          <SelectItem key={route.id} value={route.id}>
                            {route.label}
                          </SelectItem>
                        ))}
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
                      ⚠️ = la pantalla depende del perfil del usuario. Para todos, usa Inicio,
                      Calendario, Fotos o Más.
                    </p>
                  </div>

                  {/* Action button (single, canonical) */}
                  <div className="space-y-3 p-4 bg-muted/10 rounded-lg border border-border/30">
                    <Label className="text-sm font-medium">Botón de acción (opcional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input
                        placeholder="Texto del botón"
                        value={form.buttonText}
                        onChange={(e) => updateForm('buttonText', e.target.value)}
                        className="bg-input border-border/50"
                      />
                      <Input
                        placeholder={form.buttonIsInternal ? '/(tabs)/fotos' : 'https://…'}
                        value={form.buttonUrl}
                        onChange={(e) => updateForm('buttonUrl', e.target.value)}
                        className="bg-input border-border/50"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="btn-internal" className="text-xs text-muted-foreground font-normal">
                        La URL es una ruta interna de la app (no un enlace web)
                      </Label>
                      <Switch
                        id="btn-internal"
                        checked={form.buttonIsInternal}
                        onCheckedChange={(v) => updateForm('buttonIsInternal', v)}
                      />
                    </div>
                  </div>

                  {/* Recipient segmentation by topic */}
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Segmentación (opcional)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de perfil</Label>
                        <Select value={form.profileTopic} onValueChange={(v) => updateForm('profileTopic', v)}>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL}>Todos los perfiles</SelectItem>
                            {PROFILE_TOPICS.map((p) => (
                              <SelectItem key={p.topic} value={p.topic}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Delegación local</Label>
                        <Select value={form.delegationTopic} onValueChange={(v) => updateForm('delegationTopic', v)}>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL}>Todas las delegaciones</SelectItem>
                            {DELEGATION_TOPICS.map((d) => (
                              <SelectItem key={d.topic} value={d.topic}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {segmented
                        ? 'Solo recibirán los dispositivos que cumplan TODOS los filtros seleccionados (los que tengan los topics en su perfil).'
                        : 'Sin filtros: la notificación llega a TODOS los dispositivos.'}
                    </p>
                  </div>

                  {/* Send button */}
                  <Button
                    onClick={handleSend}
                    className="w-full tech-glow relative overflow-hidden group"
                    size="lg"
                    disabled={sending || !form.title.trim() || !form.body.trim()}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {segmented ? 'Enviar a segmento' : 'Enviar a todos'}
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
                          {form.buttonText.trim() && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded">
                                {form.buttonText}
                              </span>
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
                  {resolveRoute(form) && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground flex-shrink-0">Ruta:</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate">{resolveRoute(form)}</code>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Destinatarios:</span>
                    <span className="text-right flex items-center gap-1">
                      {segmented ? (
                        resolveTopics(form).map((t) => (
                          <code key={t} className="text-[10px] bg-muted px-1 py-0.5 rounded">{t}</code>
                        ))
                      ) : (
                        <span className="flex items-center gap-1"><Megaphone className="w-3 h-3" /> Todos</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Botón:</span>
                    <span>{resolveActionButton(form) ? 'Sí' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
                          {notif.topics && notif.topics.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {notif.topics.join(' · ')}
                            </Badge>
                          )}
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
