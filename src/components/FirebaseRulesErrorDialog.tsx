import { useEffect, useState } from 'react';
import { AlertOctagon, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  clearRulesFailures,
  formatFailuresForClipboard,
  subscribeRulesFailures,
  type RulesFailure,
} from '@/lib/firebaseRules';

/**
 * Modal que salta cuando la Realtime Database deniega algo por reglas.
 *
 * El panel escribe sin autenticarse, así que un despliegue de reglas o un
 * interruptor de `/_config` mal puesto lo deja mudo: secciones vacías y
 * guardados que no guardan, sin un solo mensaje. Esto lo hace evidente y da el
 * path exacto, que es lo único que hace falta para saber qué regla falta.
 *
 * Se monta una sola vez, en `JSONManager`, y escucha el registro compartido de
 * `lib/firebaseRules.ts`.
 */
export function FirebaseRulesErrorDialog() {
  const [failures, setFailures] = useState<RulesFailure[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeRulesFailures(setFailures), []);

  // Un fallo nuevo tras haber cerrado el modal lo vuelve a abrir: si el admin
  // sigue tocando cosas que están denegadas, tiene que enterarse cada vez.
  const open = failures.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatFailuresForClipboard(failures));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles (http, navegador raro): el detalle sigue
      // estando a la vista y se puede seleccionar a mano.
    }
  };

  const handleClose = () => {
    clearRulesFailures();
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-5 w-5 shrink-0" />
            ERROR DE REGLAS DE FIREBASE
          </DialogTitle>
          <DialogDescription>
            La Realtime Database ha denegado {failures.length}{' '}
            {failures.length === 1 ? 'operación' : 'operaciones'}. Lo que
            dependa de estos nodos no se está leyendo ni guardando, aunque el
            panel se vea normal.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {failures.map((failure) => (
            <div
              key={`${failure.op}:${failure.path}`}
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <div className="flex items-center gap-2 font-mono">
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold uppercase text-destructive">
                  {failure.op}
                </span>
                <span className="break-all">{failure.path}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sección: {failure.section} ·{' '}
                {failure.at.toLocaleTimeString('es-ES')}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {failure.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Qué mirar</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              En la consola de Firebase, que{' '}
              <code className="font-mono">/_config/legacyPanelWrites</code> y{' '}
              <code className="font-mono">/_config/legacyNotificationsOpen</code>{' '}
              existan y valgan <code className="font-mono">true</code>. Si el
              nodo no existe, el panel se queda sin permisos de golpe.
            </li>
            <li>
              Que el path de arriba aparezca en{' '}
              <code className="font-mono">mcm-app/database.rules.json</code>. Lo
              que no está listado queda denegado por defecto.
            </li>
            <li>
              <code className="font-mono">/users</code> y{' '}
              <code className="font-mono">/pushTokens</code> están cerrados a
              propósito y no tienen interruptor: necesitan auth real en el panel.
              Usuarios y el contador de destinatarios no funcionan hasta
              entonces.
            </li>
          </ol>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? 'Copiado' : 'Copiar detalle'}
          </Button>
          <Button variant="destructive" onClick={handleClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
