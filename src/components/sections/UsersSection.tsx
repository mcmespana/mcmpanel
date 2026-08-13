import { useEffect, useMemo, useState } from 'react';
import {
  UserCog,
  Search,
  ShieldCheck,
  Loader2,
  Users as UsersIcon,
  Copy,
  Code2,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import { recordIfPermissionDenied } from '@/lib/firebaseRules';
import {
  parseUsers,
  setUserAdmin,
  initialsFor,
  formatUserDate,
  PROVIDER_META,
  type PanelUser,
} from '@/lib/users';

export function UsersSection() {
  const { toast } = useToast();

  const [usersNode, setUsersNode] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState('');
  const [onlyAdmins, setOnlyAdmins] = useState(false);
  /** uids currently being written, to show a spinner and avoid double clicks. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [inspect, setInspect] = useState<PanelUser | null>(null);

  // ─── Suscripción Firebase ────────────────────────────────────────────────
  useEffect(() => {
    const db = getDB();
    const unsub = onValue(
      ref(db, 'users'),
      (snap) => {
        setUsersNode(snap.val());
        setLoading(false);
        setError(false);
      },
      (err) => {
        // `/users` no tiene interruptor en las reglas y no lo va a tener: ahí
        // está el diario de Contigo de cada persona. Esta sección no funciona
        // hasta que el panel tenga auth real. El modal lo explica.
        recordIfPermissionDenied(err, 'read', 'users', 'Usuarios');
        setLoading(false);
        setError(true);
      },
    );
    return () => unsub();
  }, []);

  const users = useMemo(() => parseUsers(usersNode), [usersNode]);
  const adminCount = useMemo(() => users.filter((u) => u.isAdmin).length, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => {
      if (onlyAdmins && !u.isAdmin) return false;
      if (!q) return true;
      return (
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.profileType && u.profileType.toLowerCase().includes(q)) ||
        (u.delegationId && u.delegationId.toLowerCase().includes(q)) ||
        u.uid.toLowerCase().includes(q)
      );
    });
    // Admins first, then alphabetically by email / name.
    return list.sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      const ka = (a.email || a.name || a.uid).toLowerCase();
      const kb = (b.email || b.name || b.uid).toLowerCase();
      return ka.localeCompare(kb);
    });
  }, [users, query, onlyAdmins]);

  const handleToggle = async (user: PanelUser, next: boolean) => {
    setBusy((prev) => new Set(prev).add(user.uid));
    try {
      await setUserAdmin(user.uid, next);
      toast({
        title: next ? 'Administrador añadido' : 'Administrador quitado',
        description: `${user.email || user.name || user.uid} ${next ? 'ya es' : 'ya no es'} administrador.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'No se pudo guardar',
        description: e instanceof Error ? e.message : 'Error al escribir en Firebase',
        variant: 'destructive',
      });
    } finally {
      setBusy((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(user.uid);
        return nextSet;
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <UserCog className="h-7 w-7 text-primary" />
            Usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Marca con un clic qué usuarios son administradores de la app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            {adminCount} admin{adminCount === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <UsersIcon className="h-3.5 w-3.5" />
            {users.length} usuario{users.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      {/* Buscador + filtro */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por correo, nombre o UID…"
            className="h-10 bg-input pl-9 pr-9 border-border/50"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOnlyAdmins((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
            onlyAdmins
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/50 bg-input text-muted-foreground hover:text-foreground',
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          Solo admins
        </button>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando usuarios…
        </div>
      ) : error ? (
        <Card className="bg-card/50 border-destructive/40">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium text-destructive">No se pudo leer el nodo «users»</p>
            <p className="mt-1 text-sm">
              Revisa las reglas de la Realtime Database para permitir la lectura de <code>/users</code>.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center text-muted-foreground">
            <UsersIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">
              {users.length === 0 ? 'Todavía no hay usuarios' : 'Ningún usuario coincide'}
            </p>
            <p className="mt-1 text-sm">
              {users.length === 0
                ? 'Aparecerán aquí cuando se registren cuentas en la app.'
                : 'Prueba con otro término o quita el filtro.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <UserRow
              key={user.uid}
              user={user}
              busy={busy.has(user.uid)}
              onToggle={(next) => handleToggle(user, next)}
              onInspect={() => setInspect(user)}
            />
          ))}
        </div>
      )}

      <UserInspectDialog user={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}

function UserRow({
  user,
  busy,
  onToggle,
  onInspect,
}: {
  user: PanelUser;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onInspect: () => void;
}) {
  return (
    <Card
      className={cn(
        'border-border/50 transition-colors',
        user.isAdmin ? 'bg-primary/[0.04] border-primary/30' : 'bg-card/50',
      )}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          {user.photoURL && <AvatarImage src={user.photoURL} alt={user.name || user.email || user.uid} />}
          <AvatarFallback className="bg-muted text-xs font-medium">{initialsFor(user)}</AvatarFallback>
        </Avatar>

        <button type="button" onClick={onInspect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{user.name || user.email || 'Sin nombre'}</span>
            {user.isAdmin && (
              <Badge variant="outline" className="h-5 gap-1 border-primary/30 bg-primary/10 px-1.5 text-[10px] text-primary">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {user.email && <span className="truncate">{user.email}</span>}
            {user.providers.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className={cn('h-4 px-1.5 text-[10px] font-normal', PROVIDER_META[p].className)}
              >
                {PROVIDER_META[p].label}
              </Badge>
            ))}
            {user.profileType && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal capitalize">
                {user.profileType}
              </Badge>
            )}
            {user.delegationId && (
              <span className="hidden capitalize sm:inline">· {user.delegationId}</span>
            )}
            {user.lastLogin !== null && (
              <span className="hidden sm:inline">· últ. acceso {formatUserDate(user.lastLogin)}</span>
            )}
          </div>
        </button>

        <div className="flex flex-shrink-0 items-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={user.isAdmin}
            disabled={busy}
            onCheckedChange={onToggle}
            aria-label={user.isAdmin ? 'Quitar administrador' : 'Hacer administrador'}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UserInspectDialog({ user, onClose }: { user: PanelUser | null; onClose: () => void }) {
  const { toast } = useToast();

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: 'Copiado', description: `${label} copiado al portapapeles.` }),
      () => toast({ title: 'No se pudo copiar', variant: 'destructive' }),
    );
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                {user.name || user.email || 'Usuario'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <InspectRow label="UID" value={user.uid} onCopy={() => copy(user.uid, 'UID')} />
              {user.email && (
                <InspectRow label="Correo" value={user.email} onCopy={() => copy(user.email!, 'Correo')} />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Proveedores</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {user.providers.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    user.providers.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className={cn('h-5 px-1.5 text-[10px]', PROVIDER_META[p].className)}
                      >
                        {PROVIDER_META[p].label}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {user.profileType && <InspectRow label="Perfil" value={user.profileType} />}
              {user.delegationId && <InspectRow label="Delegación" value={user.delegationId} />}
              <InspectRow label="Alta" value={formatUserDate(user.createdAt)} />
              <InspectRow label="Último acceso" value={formatUserDate(user.lastLogin)} />
              <div>
                <p className="mb-1 text-muted-foreground">Datos en bruto</p>
                <pre className="max-h-64 overflow-auto rounded-md border border-border/50 bg-muted/40 p-3 text-xs">
                  {JSON.stringify(user.raw, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InspectRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-xs">{value}</span>
        {onCopy && (
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
