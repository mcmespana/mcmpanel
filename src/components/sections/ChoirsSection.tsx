import { useEffect, useMemo, useState } from 'react';
import {
  Users2,
  Search,
  Loader2,
  Trash2,
  Pencil,
  ArrowUpToLine,
  ListMusic,
  Radio,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';
import { cn } from '@/lib/utils';
import {
  closeChoirSession,
  deleteChoir,
  deleteChoirPlaylistCompletely,
  fetchPlaylistSongs,
  formatChoirDate,
  isSessionLive,
  parseChoirSessions,
  parseChoirs,
  removeChoirPlaylist,
  renameChoir,
  renameChoirPlaylist,
  setChoirPlaylistDate,
  toDateTimeLocal,
  type ChoirPlaylistEntry,
  type PanelChoir,
  type PanelChoirSession,
} from '@/lib/choirs';

/**
 * Sección **Coros**: el directorio del que cuelgan las playlists de la app.
 *
 * Cualquiera puede crear un coro desde la app (no hay login), así que el panel
 * es el único sitio donde se pueden borrar los que sobran, arreglar un nombre
 * mal escrito y —lo más útil— **retocar la fecha de una playlist**, porque es
 * lo que ordena el histórico y decide cuál se lleva todo el mundo cuando pulsa
 * «Importar la última».
 *
 * Escribe con `update()` sobre rutas concretas (ver `src/lib/choirs.ts`), no
 * por el guardado de nodo completo del JSONManager: la app está escribiendo
 * aquí en vivo mientras el admin mira.
 */
export function ChoirsSection() {
  const { toast } = useToast();

  const [choirsNode, setChoirsNode] = useState<unknown>(null);
  const [sessions, setSessions] = useState<Record<string, PanelChoirSession>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  /** Coro desplegado (solo uno a la vez: son pocos y muy anchos). */
  const [openChoir, setOpenChoir] = useState<string | null>(null);
  /** Edición en curso: `choirId` para el coro, `choirId:code` para playlists. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  /** Confirmaciones destructivas pendientes. */
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  /** Canciones cargadas bajo demanda por código de playlist. */
  const [songs, setSongs] = useState<Record<string, string[] | 'loading'>>({});

  // ─── Suscripciones Firebase ──────────────────────────────────────────────
  useEffect(() => {
    const db = getDB();
    const unsubChoirs = onValue(
      ref(db, 'choirs'),
      (snap) => {
        setChoirsNode(snap.val());
        setLoading(false);
        setError(false);
      },
      (err) => {
        console.error('Firebase choirs onValue error', err);
        setLoading(false);
        setError(true);
      },
    );
    return () => unsubChoirs();
  }, []);

  const choirs = useMemo(() => parseChoirs(choirsNode), [choirsNode]);
  const choirIds = useMemo(
    () => choirs.map((c) => c.id).join(','),
    [choirs],
  );

  // La sesión en vivo se escucha **coro a coro** (`choirSessions/<choirId>`),
  // no leyendo `/choirSessions` entero: la raíz de ese nodo no es enumerable en
  // `mcm-app/database.rules.json` (solo se accede conociendo la clave), así que
  // escucharla entera dejaría de funcionar el día que se endurezcan las reglas.
  // Son un puñado de coros: un listener por coro no es problema.
  useEffect(() => {
    const ids = choirIds ? choirIds.split(',') : [];
    if (ids.length === 0) {
      setSessions({});
      return;
    }
    const db = getDB();
    const unsubs = ids.map((id) =>
      onValue(
        ref(db, `choirSessions/${id}`),
        (snap) => {
          const parsed = parseChoirSessions(
            snap.exists() ? { [id]: snap.val() } : {},
          );
          setSessions((prev) => {
            const next = { ...prev };
            if (parsed[id]) next[id] = parsed[id];
            else delete next[id];
            return next;
          });
        },
        (err) => console.error('Firebase choirSessions onValue error', err),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [choirIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choirs;
    return choirs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.playlists.some(
          (p) => p.name.toLowerCase().includes(q) || p.code.includes(q),
        ),
    );
  }, [choirs, query]);

  const totalPlaylists = useMemo(
    () => choirs.reduce((n, c) => n + c.playlists.length, 0),
    [choirs],
  );

  // ─── Acciones ────────────────────────────────────────────────────────────

  /** Envuelve una escritura con spinner, toast de éxito y toast de error. */
  const run = async (key: string, ok: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      toast({ title: ok });
    } catch (e) {
      console.error(e);
      toast({
        title: 'No se pudo guardar',
        description:
          e instanceof Error ? e.message : 'Error al escribir en Firebase',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
      setEditing(null);
    }
  };

  const toggleSongs = async (code: string) => {
    if (songs[code]) {
      setSongs((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
      return;
    }
    setSongs((prev) => ({ ...prev, [code]: 'loading' }));
    try {
      const list = await fetchPlaylistSongs(code);
      setSongs((prev) => ({ ...prev, [code]: list }));
    } catch (e) {
      console.error(e);
      setSongs((prev) => ({ ...prev, [code]: [] }));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const renderPlaylist = (choir: PanelChoir, p: ChoirPlaylistEntry, index: number) => {
    const editKey = `${choir.id}:${p.code}`;
    const isEditing = editing === editKey;
    const loaded = songs[p.code];

    return (
      <div
        key={p.code}
        className="rounded-lg border border-border/40 bg-background/40 p-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          {index === 0 ? (
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
              La última
            </Badge>
          ) : null}

          {isEditing ? (
            <div className="flex flex-1 items-center gap-2 min-w-[240px]">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void run(editKey, 'Playlist renombrada', () =>
                      renameChoirPlaylist(choir.id, p.code, draft),
                    );
                  }
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={busy === editKey}
                onClick={() =>
                  void run(editKey, 'Playlist renombrada', () =>
                    renameChoirPlaylist(choir.id, p.code, draft),
                  )
                }
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground font-mono">
                #{p.code}
              </span>
            </>
          )}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {formatChoirDate(p.updatedAt)} · {p.songCount}{' '}
          {p.songCount === 1 ? 'canción' : 'canciones'}
          {p.by ? ` · ${p.by}` : ''}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                setEditing(editKey);
                setDraft(p.name);
              }}
            >
              <Pencil className="mr-1 h-3 w-3" /> Renombrar
            </Button>
          )}

          {/* La palanca de orden: subir la fecha la convierte en «la última». */}
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={index === 0 || busy === `${editKey}:top`}
            onClick={() =>
              void run(`${editKey}:top`, 'Ahora es la última del coro', () =>
                setChoirPlaylistDate(choir.id, p.code, Date.now()),
              )
            }
          >
            <ArrowUpToLine className="mr-1 h-3 w-3" /> Poner la primera
          </Button>

          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <input
              type="datetime-local"
              value={toDateTimeLocal(p.updatedAt || Date.now())}
              className="h-7 rounded-md border border-border/40 bg-background px-2 text-xs"
              onChange={(e) => {
                const ts = new Date(e.target.value).getTime();
                if (!Number.isFinite(ts)) return;
                void run(`${editKey}:date`, 'Fecha actualizada', () =>
                  setChoirPlaylistDate(choir.id, p.code, ts),
                );
              }}
            />
          </label>

          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => void toggleSongs(p.code)}
          >
            <ListMusic className="mr-1 h-3 w-3" />
            {loaded ? 'Ocultar canciones' : 'Ver canciones'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            onClick={() =>
              setConfirm({
                title: `Quitar «${p.name}» del coro`,
                description:
                  'Desaparece del histórico del coro. El contenido sigue en la nube, así que quien tenga el código #' +
                  p.code +
                  ' podrá seguir importándola.',
                action: () => removeChoirPlaylist(choir.id, p.code),
              })
            }
          >
            Quitar del coro
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            onClick={() =>
              setConfirm({
                title: `Borrar «${p.name}» del todo`,
                description:
                  'Se borra del coro Y de la nube. Nadie podrá importarla, ni con el código. No se puede deshacer.',
                action: () => deleteChoirPlaylistCompletely(choir.id, p.code),
              })
            }
          >
            <Trash2 className="mr-1 h-3 w-3" /> Borrar del todo
          </Button>
        </div>

        {loaded ? (
          <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            {loaded === 'loading' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </span>
            ) : loaded.length === 0 ? (
              'Esta playlist ya no tiene contenido en la nube (caducada o borrada).'
            ) : (
              <ol className="list-decimal pl-4 space-y-0.5">
                {loaded.map((f) => (
                  <li key={f} className="font-mono">
                    {f}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSession = (choir: PanelChoir, session: PanelChoirSession) => (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
      <Radio className="h-4 w-4 text-emerald-600" />
      <span className="text-sm font-medium">
        En vivo · dirige {session.leaderName || 'alguien sin nombre'}
      </span>
      <span className="text-xs text-muted-foreground">
        Empezó {formatChoirDate(session.startedAt)} · se cierra sola{' '}
        {formatChoirDate(session.expiresAt)} · {session.songCount} canciones
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 ml-auto"
        disabled={busy === `${choir.id}:session`}
        onClick={() =>
          void run(`${choir.id}:session`, 'Sesión cerrada', () =>
            closeChoirSession(session.key),
          )
        }
      >
        Cerrar sesión
      </Button>
    </div>
  );

  const renderChoir = (choir: PanelChoir) => {
    const isOpen = openChoir === choir.id;
    const isEditing = editing === choir.id;
    const session = sessions[choir.id];
    const live = isSessionLive(session);

    return (
      <Card key={choir.id} className="border-border/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users2 className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                    className="h-8 max-w-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void run(choir.id, 'Coro renombrado', () =>
                          renameChoir(choir.id, draft),
                        );
                      }
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={busy === choir.id}
                    onClick={() =>
                      void run(choir.id, 'Coro renombrado', () =>
                        renameChoir(choir.id, draft),
                      )
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditing(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{choir.name}</h3>
                  {live ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                      En vivo
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">
                    {choir.playlists.length}{' '}
                    {choir.playlists.length === 1 ? 'playlist' : 'playlists'}
                  </Badge>
                </div>
              )}

              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono">{choir.id}</span>
                {' · '}creado {formatChoirDate(choir.createdAt)}
                {choir.createdByName ? ` por ${choir.createdByName}` : ''}
                {choir.createdByDeviceId
                  ? ` (${choir.createdByDeviceId.slice(0, 12)}…)`
                  : ''}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setEditing(choir.id);
                    setDraft(choir.name);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Renombrar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setOpenChoir(isOpen ? null : choir.id)}
              >
                {isOpen ? 'Cerrar' : 'Ver playlists'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() =>
                  setConfirm({
                    title: `Borrar el coro «${choir.name}»`,
                    description: `Desaparece de la app con sus ${choir.playlists.length} playlists del histórico. El contenido de cada una sigue en la nube hasta que caduque, así que los enlaces por código siguen valiendo. No se puede deshacer.`,
                    action: () => deleteChoir(choir.id),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {live ? renderSession(choir, session) : null}

          {isOpen ? (
            <div className="mt-3 space-y-2">
              {choir.playlists.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Este coro todavía no tiene playlists.
                </p>
              ) : (
                choir.playlists.map((p, i) => renderPlaylist(choir, p, i))
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Coros</h2>
          <p className="text-sm text-muted-foreground">
            {choirs.length} {choirs.length === 1 ? 'coro' : 'coros'} ·{' '}
            {totalPlaylists}{' '}
            {totalPlaylists === 1 ? 'playlist' : 'playlists'} en total
          </p>
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar coro, playlist o código…"
            className="pl-8"
          />
        </div>
      </div>

      <p className="rounded-lg border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground">
        Los coros los crea la gente desde la app, sin login. Aquí se pueden
        borrar los que sobren, arreglar nombres y <strong>cambiar la fecha</strong>{' '}
        de una playlist: el histórico se ordena por esa fecha y la primera es la
        que se lleva todo el mundo al pulsar «Importar la última».
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando coros…
        </div>
      ) : error ? (
        <p className="py-16 text-center text-sm text-destructive">
          No se ha podido leer <code>/choirs</code> de Firebase.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {choirs.length === 0
            ? 'Todavía no hay ningún coro. Se crean desde la app, en «Tu selección».'
            : 'Ningún coro coincide con la búsqueda.'}
        </p>
      ) : (
        <div className={cn('space-y-3')}>{filtered.map(renderChoir)}</div>
      )}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const pending = confirm;
                setConfirm(null);
                if (pending) void run('confirm', 'Hecho', pending.action);
              }}
            >
              Sí, borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
