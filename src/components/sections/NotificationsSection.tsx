import { useCallback, useEffect, useState } from 'react';
import {
  Send, Bell, Users, Target, Smartphone, Clock,
  CheckCircle, Plus, Trash2, BarChart3, AlertTriangle,
  Monitor, Apple, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'evento', label: 'Evento' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'cantoral', label: 'Cantoral' },
  { id: 'jubileo', label: 'Jubileo' },
  { id: 'urgente', label: 'Urgente' },
];

const PRIORITIES = [
  { id: 'default', label: 'Por defecto' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'Alta' },
];

const INTERNAL_ROUTES = [
  { id: '', label: 'Ninguna' },
  { id: '/(tabs)/cancionero', label: 'Cancionero' },
  { id: '/(tabs)/calendario', label: 'Calendario' },
  { id: '/(tabs)/actividades', label: 'Actividades' },
  { id: '/(tabs)/jubileo', label: 'Jubileo' },
  { id: '/(tabs)/wordle', label: 'Wordle' },
  { id: '/(tabs)/albums', label: 'Álbumes' },
];

const MAX_TITLE = 50;
const MAX_BODY = 200;
const MAX_ACTION_BUTTONS = 3;

interface FormState {
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon: string;
  imageUrl: string;
  internalRoute: string;
  actionButtons: ActionButton[];
  // Future filters
  recipientType: string;
  delegacion: string;
}

const emptyForm: FormState = {
  title: '',
  body: '',
  category: 'general',
  priority: 'default',
  icon: '',
  imageUrl: '',
  internalRoute: '',
  actionButtons: [],
  recipientType: '',
  delegacion: '',
};

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

  const updateForm = (field: keyof FormState, value: string | ActionButton[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addActionButton = () => {
    if (form.actionButtons.length >= MAX_ACTION_BUTTONS) return;
    setForm((prev) => ({
      ...prev,
      actionButtons: [...prev.actionButtons, { text: '', url: '' }],
    }));
  };

  const updateActionButton = (index: number, field: 'text' | 'url', value: string) => {
    setForm((prev) => {
      const updated = [...prev.actionButtons];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, actionButtons: updated };
    });
  };

  const removeActionButton = (index: number) => {
    setForm((prev) => ({
      ...prev,
      actionButtons: prev.actionButtons.filter((_, i) => i !== index),
    }));
  };

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
        internalRoute: form.internalRoute || undefined,
        actionButtons: form.actionButtons.filter((b) => b.text && b.url),
        recipientType: form.recipientType || undefined,
        delegacion: form.delegacion || undefined,
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Centro de Notificaciones
          </h1>
          <p className="text-muted-foreground mt-2">
            Envía notificaciones push a los usuarios de la aplicación MCM
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Bell className="w-4 h-4 text-primary" />
          <span>Expo Push API</span>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">URL de imagen</Label>
                      <Input
                        id="imageUrl"
                        placeholder="https://example.com/image.jpg"
                        value={form.imageUrl}
                        onChange={(e) => updateForm('imageUrl', e.target.value)}
                        className="bg-input border-border/50"
                      />
                    </div>
                  </div>

                  {/* Internal route */}
                  <div className="space-y-2">
                    <Label>Ruta interna (navegación en la app)</Label>
                    <Select value={form.internalRoute} onValueChange={(v) => updateForm('internalRoute', v)}>
                      <SelectTrigger className="bg-input border-border/50">
                        <SelectValue placeholder="Selecciona una ruta" />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERNAL_ROUTES.map((route) => (
                          <SelectItem key={route.id || '__none'} value={route.id || '__none'}>
                            {route.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Botones de acción</Label>
                      {form.actionButtons.length < MAX_ACTION_BUTTONS && (
                        <Button variant="outline" size="sm" onClick={addActionButton}>
                          <Plus className="w-3 h-3 mr-1" /> Añadir botón
                        </Button>
                      )}
                    </div>

                    {form.actionButtons.map((btn, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/30">
                        <Input
                          placeholder="Texto del botón"
                          value={btn.text}
                          onChange={(e) => updateActionButton(i, 'text', e.target.value)}
                          className="bg-input border-border/50 flex-1"
                        />
                        <Input
                          placeholder="URL de destino"
                          value={btn.url}
                          onChange={(e) => updateActionButton(i, 'url', e.target.value)}
                          className="bg-input border-border/50 flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeActionButton(i)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {form.actionButtons.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Puedes añadir hasta {MAX_ACTION_BUTTONS} botones de acción
                      </p>
                    )}
                  </div>

                  {/* Future: Recipient filters (prepared but disabled) */}
                  <div className="p-4 bg-muted/10 rounded-lg border border-dashed border-border/30 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Filtros de destinatarios (próximamente)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 pointer-events-none">
                      <div className="space-y-2">
                        <Label>Tipo de destinatario</Label>
                        <Select disabled>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Delegación local</Label>
                        <Select disabled>
                          <SelectTrigger className="bg-input border-border/50">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
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
                        Enviar Notificación
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
                          {form.actionButtons.filter((b) => b.text).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {form.actionButtons
                                .filter((b) => b.text)
                                .map((btn, i) => (
                                  <span key={i} className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    {btn.text}
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
                  {form.internalRoute && form.internalRoute !== '__none' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ruta:</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{form.internalRoute}</code>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Botones:</span>
                    <span>{form.actionButtons.filter((b) => b.text && b.url).length}</span>
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
