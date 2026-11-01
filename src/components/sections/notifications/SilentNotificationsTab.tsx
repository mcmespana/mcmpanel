import { useMemo, useState } from 'react';
import { BellOff, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  createSilentNotification,
  deleteNotification,
  updateNotification,
  type NotificationRecord,
} from '@/lib/notificationService';
import {
  CATEGORIES, DETAIL, MAX_BODY, MAX_BODY_LONG, MAX_TITLE, ROUTE_GROUPS,
} from '@/lib/notificationOptions';

// Pestaña "Silenciosas": mete avisos en /notifications (la campana de la app)
// sin mandar push, y permite editar, desactivar o borrar cualquier registro del
// historial (también los que sí se enviaron por push).

interface FormState {
  title: string;
  body: string;
  bodyLong: string;
  category: string;
  route: string; // DETAIL o una ruta de ROUTE_GROUPS (o una personalizada ya guardada)
  date: string;  // datetime-local
}

const pad = (n: number) => String(n).padStart(2, '0');
// datetime-local no lleva zona horaria: se formatea a mano en hora local.
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = (): FormState => ({
  title: '', body: '', bodyLong: '', category: 'general', route: DETAIL, date: toLocalInput(new Date()),
});

function formFromRecord(n: NotificationRecord): FormState {
  return {
    title: n.title ?? '',
    body: n.body ?? '',
    bodyLong: n.bodyLong ?? '',
    category: n.category || 'general',
    route: n.internalRoute || DETAIL,
    date: toLocalInput(new Date(n.createdAt)),
  };
}

const KNOWN_ROUTES = new Set(ROUTE_GROUPS.flatMap((g) => g.routes.map((r) => r.id)));

function validate(form: FormState): string | null {
  if (!form.title.trim()) return 'El título es obligatorio';
  if (!form.body.trim()) return 'El mensaje es obligatorio';
  const when = new Date(form.date);
  if (!form.date || Number.isNaN(when.getTime())) return 'La fecha no es válida';
  return null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

function NotificationFields({
  form, onChange,
}: { form: FormState; onChange: (patch: Partial<FormState>) => void }) {
  const customRoute = form.route !== DETAIL && !KNOWN_ROUTES.has(form.route);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="silent-title">Título</Label>
          <span className="text-xs text-muted-foreground">{form.title.length}/{MAX_TITLE}</span>
        </div>
        <Input
          id="silent-title"
          value={form.title}
          maxLength={MAX_TITLE}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="silent-body">Mensaje</Label>
          <span className="text-xs text-muted-foreground">{form.body.length}/{MAX_BODY}</span>
        </div>
        <Textarea
          id="silent-body"
          rows={2}
          value={form.body}
          maxLength={MAX_BODY}
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="silent-long">Descripción detallada (opcional)</Label>
          <span className="text-xs text-muted-foreground">{form.bodyLong.length}/{MAX_BODY_LONG}</span>
        </div>
        <Textarea
          id="silent-long"
          rows={4}
          value={form.bodyLong}
          maxLength={MAX_BODY_LONG}
          onChange={(e) => onChange({ bodyLong: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={form.category} onValueChange={(v) => onChange({ category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Al tocarla</Label>
          <Select value={form.route} onValueChange={(v) => onChange({ route: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={DETAIL}>Abrirla en grande</SelectItem>
              {customRoute && <SelectItem value={form.route}>{form.route}</SelectItem>}
              {ROUTE_GROUPS.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectSeparator />
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="silent-date">Fecha (ordena la campana)</Label>
          <Input
            id="silent-date"
            type="datetime-local"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function SilentNotificationsTab({ history }: { history: NotificationRecord[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [onlySilent, setOnlySilent] = useState(false);
  const [editing, setEditing] = useState<NotificationRecord | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<NotificationRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () => (onlySilent ? history.filter((n) => n.status === 'silent') : history),
    [history, onlySilent],
  );

  const fail = (title: string, error: unknown) =>
    toast({
      title,
      description: error instanceof Error ? error.message : 'Error desconocido',
      variant: 'destructive',
    });

  const handleCreate = async () => {
    const error = validate(form);
    if (error) {
      toast({ title: 'Revisa el formulario', description: error, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createSilentNotification({
        title: form.title.trim(),
        body: form.body.trim(),
        bodyLong: form.bodyLong.trim() || undefined,
        category: form.category,
        internalRoute: form.route === DETAIL ? undefined : form.route,
        createdAt: new Date(form.date).toISOString(),
      });
      toast({ title: 'Guardada en la app', description: 'Aparece en la campana sin mandar push.' });
      setForm(emptyForm());
    } catch (e) {
      fail('No se pudo guardar', e);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (n: NotificationRecord) => {
    setEditing(n);
    setEditForm(formFromRecord(n));
  };

  const handleEdit = async () => {
    if (!editing) return;
    const error = validate(editForm);
    if (error) {
      toast({ title: 'Revisa el formulario', description: error, variant: 'destructive' });
      return;
    }
    setBusyId(editing.notificationId);
    try {
      await updateNotification(editing.notificationId, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        bodyLong: editForm.bodyLong.trim() || null,
        category: editForm.category,
        internalRoute: editForm.route === DETAIL ? null : editForm.route,
        createdAt: new Date(editForm.date).toISOString(),
      });
      toast({ title: 'Cambios guardados' });
      setEditing(null);
    } catch (e) {
      fail('No se pudo editar', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDisabled = async (n: NotificationRecord) => {
    setBusyId(n.notificationId);
    try {
      await updateNotification(n.notificationId, { disabled: !n.disabled });
      toast({ title: n.disabled ? 'Reactivada' : 'Desactivada' });
    } catch (e) {
      fail('No se pudo cambiar', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.notificationId);
    try {
      await deleteNotification(toDelete.notificationId);
      toast({ title: 'Borrada', description: 'Ya no aparece en el historial de la app.' });
      setToDelete(null);
    } catch (e) {
      fail('No se pudo borrar', e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BellOff className="w-5 h-5 mr-2 text-primary" />
            Nueva notificación silenciosa
          </CardTitle>
          <CardDescription>
            Se guarda en la campana de la app para todos los usuarios, pero no se manda ninguna push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationFields form={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Guardar en la app
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Lo que hay en la campana</CardTitle>
              <CardDescription>
                Edita, desactiva o borra cualquier registro, también los que se mandaron por push.
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={onlySilent ? 'outline' : 'secondary'} onClick={() => setOnlySilent(false)}>
                Todas ({history.length})
              </Button>
              <Button size="sm" variant={onlySilent ? 'secondary' : 'outline'} onClick={() => setOnlySilent(true)}>
                Solo silenciosas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay notificaciones</p>
          ) : (
            <div className="space-y-3">
              {rows.map((n) => (
                <div
                  key={n.notificationId}
                  className={`flex items-start justify-between gap-3 p-4 bg-muted/20 rounded-lg border border-border/30 ${
                    n.disabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{n.title}</div>
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.body}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{n.category}</Badge>
                      <Badge variant={n.status === 'silent' ? 'secondary' : 'default'} className="text-[10px]">
                        {n.status === 'silent' ? 'Silenciosa' : 'Push'}
                      </Badge>
                      {n.disabled && <Badge variant="destructive" className="text-[10px]">Desactivada</Badge>}
                      <span>{fmtDate(n.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                      disabled={busyId === n.notificationId} onClick={() => openEdit(n)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      title={n.disabled ? 'Reactivar' : 'Desactivar (ocultar sin borrar)'}
                      disabled={busyId === n.notificationId} onClick={() => handleToggleDisabled(n)}
                    >
                      {n.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Borrar" disabled={busyId === n.notificationId} onClick={() => setToDelete(n)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar notificación</DialogTitle>
            <DialogDescription>
              {editing?.status === 'silent'
                ? 'Los cambios se ven al momento en la campana.'
                : 'Ya se mandó por push: editarla solo cambia lo que se ve en la campana, no lo que llegó al móvil.'}
              {' '}Se conservan la audiencia y los botones.
            </DialogDescription>
          </DialogHeader>
          <NotificationFields form={editForm} onChange={(p) => setEditForm((prev) => ({ ...prev, ...p }))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={busyId !== null}>
              {busyId !== null && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{toDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece del historial de la app y del panel. No se puede deshacer
              (si solo quieres ocultarla, desactívala).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
