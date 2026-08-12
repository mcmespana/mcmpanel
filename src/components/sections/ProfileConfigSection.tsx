import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Database, Download, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfilesEditor } from './profile/ProfilesEditor';
import { DelegationsEditor } from './profile/DelegationsEditor';
import { OverridesEditor } from './profile/OverridesEditor';
import { SystemEditor } from './profile/SystemEditor';
import { SEED_PROFILE_CONFIG } from '@/lib/profileConfigSeed';
import { validateProfileConfig } from '@/lib/profileConfigValidation';
import { useToast } from '@/hooks/use-toast';
import type { ProfileConfigData, ProfileConfigDocument } from '@/types/profileConfig';

interface ProfileConfigSectionProps {
  data: ProfileConfigDocument | undefined;
  calendarsRoot: any;
  onUpdate: (next: ProfileConfigDocument) => void;
}

export function ProfileConfigSection({ data, calendarsRoot, onUpdate }: ProfileConfigSectionProps) {
  const { toast } = useToast();
  const calendars = useMemo(() => extractCalendars(calendarsRoot), [calendarsRoot]);
  const reminderShownRef = useRef(false);

  const [draft, setDraft] = useState<ProfileConfigData | null>(
    data?.data ? sanitizeData(data.data) : null,
  );

  // C4: hay ediciones en el borrador que NO se han guardado porque la
  // validación las bloqueó. Mientras esté a true, este componente es la única
  // copia de esos cambios: no hay nada en `pendingUpdates` del JSONManager.
  const [blockedEdits, setBlockedEdits] = useState(false);

  // Sync draft when external data changes (real-time from Firebase)
  useEffect(() => {
    // Con ediciones bloqueadas sin guardar, un refresco remoto se las llevaría
    // por delante justo mientras el admin intenta arreglar el error.
    if (blockedEdits) return;
    if (data?.data) setDraft(sanitizeData(data.data));
  }, [data?.updatedAt, blockedEdits]);

  const handleInit = () => {
    if (!confirm('¿Inicializar /profileConfig con el seed por defecto?')) return;
    const seedDoc: ProfileConfigDocument = {
      updatedAt: new Date().toISOString(),
      data: SEED_PROFILE_CONFIG,
    };
    setDraft(SEED_PROFILE_CONFIG);
    setBlockedEdits(false);
    onUpdate(seedDoc);
  };

  const handleDownload = () => {
    if (!draft) return;
    const json = JSON.stringify(draft, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profileConfig.json';
    a.click();
    URL.revokeObjectURL(url);
    reminderShownRef.current = false;
    toast({
      title: 'JSON descargado',
      description: 'Súbelo al repo para que las próximas builds de la app lo incluyan.',
    });
  };

  const handleChange = (next: ProfileConfigData) => {
    setDraft(next);

    // C4: si la configuración tiene errores, el cambio NO sale de aquí. Se
    // queda en el borrador local para que el admin pueda arreglarlo (los
    // editores siguen funcionando: escriben sobre `draft`), y en cuanto la
    // validación quede limpia, el `onUpdate` de esa edición lleva el borrador
    // ENTERO — o sea, también lo que se bloqueó por el camino.
    const { errors } = validateProfileConfig(next, calendars);
    if (errors.length > 0) {
      if (!blockedEdits) {
        toast({
          title: 'Cambios sin guardar',
          description:
            'Hay configuración que la app ignoraría en silencio. Arregla los problemas y se guardará todo junto.',
          variant: 'destructive',
        });
      }
      setBlockedEdits(true);
      return;
    }

    setBlockedEdits(false);
    onUpdate({
      updatedAt: new Date().toISOString(),
      data: next,
    });
    if (!reminderShownRef.current) {
      reminderShownRef.current = true;
      toast({
        title: '¡Recuerda sincronizar el JSON!',
        description: 'Descárgalo y súbelo al repo para que las futuras builds de la app tengan estos cambios.',
      });
    }
  };

  if (!draft) {
    return (
      <div className="p-6 sm:p-8">
        <Card className="p-8 max-w-xl mx-auto bg-card/50 border-border/50 text-center space-y-4">
          <Database className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <h2 className="text-xl font-semibold">profileConfig vacío</h2>
            <p className="text-sm text-muted-foreground mt-1">
              No hay configuración en <code>/profileConfig</code>. Inicializa con el seed
              por defecto y luego edita perfiles, delegaciones y flags globales.
            </p>
          </div>
          <Button onClick={handleInit}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Inicializar desde seed
          </Button>
        </Card>
      </div>
    );
  }

  // C4: misma función que usa la puerta de guardado de `handleChange`, para
  // que lo que se pinta y lo que se bloquea no puedan discrepar nunca.
  const { errors, warnings } = validateProfileConfig(draft, calendars);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Perfiles & Sistema
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <code>/profileConfig</code> · updatedAt:{' '}
            {data?.updatedAt
              ? new Date(data.updatedAt).toLocaleString('es-ES')
              : '—'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Descargar JSON
        </Button>
      </div>

      {errors.length > 0 && (
        <Card className="p-3 bg-destructive/5 border-destructive/40">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-destructive">
                {blockedEdits ? 'Guardado en pausa · ' : ''}
                {errors.length} {errors.length === 1 ? 'problema' : 'problemas'} que la app ignoraría en silencio:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {blockedEdits ? (
                <p className="text-destructive/90 pt-0.5">
                  Tus cambios <span className="font-semibold">no se están guardando</span> y se
                  perderán si recargas. En cuanto no quede ningún problema se guardará todo junto.
                </p>
              ) : (
                <p className="text-muted-foreground pt-0.5">
                  Esto ya está así en Firebase. Cualquier cambio que hagas quedará en pausa hasta
                  que se arregle.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="p-3 bg-warning/5 border-warning/40">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-warning-foreground">
                {warnings.length} avisos:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {warnings.slice(0, 8).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {warnings.length > 8 && <li>… y {warnings.length - 8} más</li>}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profiles">Perfiles</TabsTrigger>
          <TabsTrigger value="delegations">Delegaciones</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-0">
          <ProfilesEditor data={draft} calendars={calendars} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="delegations" className="mt-0">
          <DelegationsEditor data={draft} calendars={calendars} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="overrides" className="mt-0">
          <OverridesEditor data={draft} calendars={calendars} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="system" className="mt-0">
          <SystemEditor data={draft} onChange={handleChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Read /calendars node and return [{id, name}]. The schema is { data: [...], updatedAt }. */
function extractCalendars(root: any): Array<{ id: string; name: string }> {
  if (!root) return [];
  const arr = Array.isArray(root) ? root : root.data;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => c && typeof c === 'object' && c.id)
    .map((c) => ({ id: String(c.id), name: String(c.name ?? c.id) }));
}

/** Normalize data so editors don't crash on partial seeds. */
function sanitizeData(d: any): ProfileConfigData {
  const base: ProfileConfigData = {
    global: { ...SEED_PROFILE_CONFIG.global, ...(d.global ?? {}) },
    profiles: {
      familia: { ...SEED_PROFILE_CONFIG.profiles.familia, ...(d.profiles?.familia ?? {}) },
      monitor: { ...SEED_PROFILE_CONFIG.profiles.monitor, ...(d.profiles?.monitor ?? {}) },
      miembro: { ...SEED_PROFILE_CONFIG.profiles.miembro, ...(d.profiles?.miembro ?? {}) },
    },
    delegations: { _default: { label: 'General' }, ...(d.delegations ?? {}) },
    delegationList: Array.isArray(d.delegationList) ? d.delegationList : [],
    overrides: d.overrides ?? {},
  };
  // Ensure profile arrays are arrays
  (['tabs', 'homeButtons', 'masItems', 'defaultCalendars', 'albumTags', 'notificationTopics'] as const).forEach((k) => {
    (['familia', 'monitor', 'miembro'] as const).forEach((p) => {
      const v = (base.profiles[p] as any)[k];
      if (!Array.isArray(v)) (base.profiles[p] as any)[k] = [];
    });
  });
  return base;
}
