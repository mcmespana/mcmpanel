import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Upload, Download, FileJson, Cpu, Save, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import type { ProfileConfigDocument } from '@/types/profileConfig';
import { SEED_PROFILE_CONFIG } from '@/lib/profileConfigSeed';
import { disableAppReviewMode, enableAppReviewMode } from '@/lib/appReviewMode';
import { HomeDashboard } from './HomeDashboard';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref, set, update } from 'firebase/database';
import {
  activityFirebasePath,
  buildGranularActivityWrites,
} from '@/lib/activityWrites';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { SECTION_META, pathForSection, sectionForPath, type SectionId } from '@/lib/sections';

// Cada sección se carga en su propio chunk: el admin solo ve una a la vez, y
// el bundle inicial no necesita traer recharts, dnd-kit, etc. de todas ellas.
const AlbumsSection = lazy(() => import('./sections/AlbumsSection').then((m) => ({ default: m.AlbumsSection })));
const AppSection = lazy(() => import('./sections/AppSection').then((m) => ({ default: m.AppSection })));
const CalendarsSection = lazy(() => import('./sections/CalendarsSection').then((m) => ({ default: m.CalendarsSection })));
const SongsSection = lazy(() => import('./sections/SongsSection').then((m) => ({ default: m.SongsSection })));
const WordleSection = lazy(() => import('./sections/WordleSection').then((m) => ({ default: m.WordleSection })));
const ActivitiesSection = lazy(() => import('./sections/ActivitiesSection').then((m) => ({ default: m.ActivitiesSection })));
const NotificationsSection = lazy(() => import('./sections/NotificationsSection').then((m) => ({ default: m.NotificationsSection })));
const SurveysSection = lazy(() => import('./sections/SurveysSection').then((m) => ({ default: m.SurveysSection })));
const ChoirsSection = lazy(() => import('./sections/ChoirsSection').then((m) => ({ default: m.ChoirsSection })));
const UsersSection = lazy(() => import('./sections/UsersSection').then((m) => ({ default: m.UsersSection })));
const ProfileConfigSection = lazy(() => import('./sections/ProfileConfigSection').then((m) => ({ default: m.ProfileConfigSection })));

export type JSONData = {
  albums?: any;
  app?: any;
  calendars?: any;
  songs?: any;
  wordle?: any;
  jubileo?: any;
  activities?: any;
  profileConfig?: ProfileConfigDocument;
};

export type ActiveSection = SectionId;

export function JSONManager() {
  const [jsonData, setJsonData] = useState<JSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const { toast } = useToast();
  const pendingUpdates = useRef<Record<string, any>>({});
  // B4: rutas Firebase concretas que el admin editó dentro de Actividades/Jubileo
  // (p. ej. 'activities/visitapapa26/compartiendo'). Se escriben con update()
  // granular en vez de pisar todo /activities. Ver src/lib/activityWrites.ts.
  const pendingActivityPaths = useRef<Set<string>>(new Set());

  // The active section is derived from the URL so every section is linkable
  // (e.g. /notificaciones) and the browser back/forward buttons work.
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = sectionForPath(location.pathname);
  const goToSection = (section: ActiveSection, suffix = '') => {
    navigate(`${pathForSection(section)}${suffix}`);
  };

  // Track Firebase connection status via .info/connected
  useEffect(() => {
    const db = getDB();
    const connRef = ref(db, '.info/connected');
    const unsub = onValue(connRef, (snap) => {
      setFirebaseConnected(snap.val() === true);
    });
    return () => unsub();
  }, []);

  // Real-time subscription to database root
  useEffect(() => {
    const db = getDB();
    const rootRef = ref(db, '/');
    const unsub = onValue(
      rootRef,
      (snap) => {
        const val = snap.val();
        const remote = (val && typeof val === 'object' ? val : {}) as JSONData;
        // La raíz cambia constantemente por escrituras de la app (heartbeats de
        // /pushTokens, respuestas de encuestas…). No dejar que ese refresco
        // pise las secciones con ediciones locales aún sin guardar.
        const pending = pendingUpdates.current;
        setJsonData(
          Object.keys(pending).length > 0 ? { ...remote, ...pending } : remote,
        );
        setLoading(false);
      },
      (err) => {
        console.error('Firebase onValue error', err);
        setLoading(false);
        toast({
          title: 'Error conectando con Firebase',
          description: 'Revisa las credenciales y las reglas de la Realtime Database',
          variant: 'destructive',
        });
      }
    );
    return () => unsub();
  }, [toast]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setJsonData(data);
        setDirty(true);
        // Sin esto el import se ve en pantalla pero "Guardar" no escribe nada:
        // writePending() solo escribe las claves presentes en pendingUpdates.
        for (const key of Object.keys(data)) {
          pendingUpdates.current[key] = data[key];
        }
        toast({ title: "JSON cargado correctamente", description: "El archivo se ha importado exitosamente" });
      } catch {
        toast({ title: "Error al cargar JSON", description: "El archivo no es un JSON válido", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!jsonData) return;
    const dataStr = JSON.stringify(jsonData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mcm-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateSectionData = (section: keyof JSONData | 'jubileo', newData: any) => {
    if (!jsonData) return;
    // profileConfig already arrives shaped as { updatedAt, data } — don't double-wrap.
    const value = section === 'profileConfig'
      ? newData
      : { ...newData, updatedAt: new Date().toISOString() };
    const updatedData = { ...jsonData, [section]: value };
    setJsonData(updatedData);
    setDirty(true);
    pendingUpdates.current[section] = updatedData[section as keyof JSONData];
  };

  const appReviewActive = !!jsonData?.profileConfig?.data?.global?.appReviewMode;

  const handleToggleAppReview = (next: boolean) => {
    const currentData = jsonData?.profileConfig?.data ?? SEED_PROFILE_CONFIG;
    const updated = next ? enableAppReviewMode(currentData) : disableAppReviewMode(currentData);
    const doc: ProfileConfigDocument = {
      updatedAt: new Date().toISOString(),
      data: updated,
    };
    updateSectionData('profileConfig', doc);
    toast({
      title: next ? 'Modo revisión activado' : 'Modo revisión desactivado',
      description: next
        ? 'Cantoral y Comunica ocultos en todos los perfiles. Backup guardado.'
        : 'Tabs anteriores restauradas desde backup.',
    });
  };

  // Escribe un snapshot congelado de pendingUpdates/pendingActivityPaths (no
  // las refs en vivo): si el admin edita mientras este await está en curso,
  // esas ediciones nuevas deben sobrevivir al cleanup posterior en el caller.
  const writePending = async (
    updatesSnapshot: Record<string, any>,
    activityPathsSnapshot: Set<string>,
  ) => {
    const db = getDB();

    // B4: escrituras granulares de Actividades/Jubileo. En vez de `set()` del
    // nodo completo (que pisaría evaluacion/respuestas y compartiendo que
    // escribe la app), hacemos un único `update()` multi-path con SOLO las
    // subrutas que el admin editó. Los valores se resuelven del snapshot.
    const granularWrites = buildGranularActivityWrites(
      [...activityPathsSnapshot],
      updatesSnapshot['activities'],
      updatesSnapshot['jubileo'],
    );
    const wroteActivities = activityPathsSnapshot.size > 0;
    if (Object.keys(granularWrites).length > 0) {
      await update(ref(db, '/'), granularWrites);
    }

    const entries = Object.entries(updatesSnapshot);
    for (const [key, value] of entries) {
      // Actividades/Jubileo ya se escribieron granularmente arriba (si hubo
      // rutas). Evitamos el `set()` de nodo completo que reintroduciría el
      // clobber. Si NO hubo rutas (fallback), caemos al `set()` de siempre.
      if ((key === 'activities' || key === 'jubileo') && wroteActivities) {
        continue;
      }
      if (key === 'app') {
        // `/app` mezcla lo que edita el panel (`feedback`) con lo que escribe
        // la app (`evaluations/<deviceId>`) y lo que gestiona la seccion
        // Encuestas (`evaluationConfig`). Un `set()` de nodo completo los
        // borraba de un guardado, asi que escribimos SOLO las subrutas que son
        // de esta seccion. Mismo criterio que B4 con Actividades.
        if (value && typeof value === 'object') {
          const appWrites: Record<string, unknown> = {};
          if (value.feedback !== undefined) appWrites['app/feedback'] = value.feedback;
          if (value.updatedAt !== undefined) appWrites['app/updatedAt'] = value.updatedAt;
          if (Object.keys(appWrites).length > 0) await update(ref(db, '/'), appWrites);
        }
        continue;
      }
      if (key === 'wordle') {
        if (value && typeof value === 'object') {
          if (value['daily-words'] !== undefined) await set(ref(db, '/wordle/daily-words'), value['daily-words']);
          if (value['updatedAt'] !== undefined) await set(ref(db, '/wordle/updatedAt'), value['updatedAt']);
        }
        continue;
      }
      // Escribir SIEMPRE el valor del snapshot, no jsonData[key]: jsonData
      // puede haber sido refrescado por el listener de la raíz entre la
      // edición y el guardado, y perderíamos el cambio local.
      await set(ref(db, `/${key}`), value);
    }
  };

  // Congela el estado pendiente actual, lo escribe, y solo entonces borra ESAS
  // claves/rutas concretas de las refs en vivo. Si llegó una edición nueva
  // mientras el await estaba en curso, esa edición no estaba en el snapshot y
  // sobrevive intacta. Devuelve si ya no queda nada pendiente.
  const flushPending = async (): Promise<boolean> => {
    const updatesSnapshot = { ...pendingUpdates.current };
    if (Object.keys(updatesSnapshot).length === 0) return true;
    const activityPathsSnapshot = new Set(pendingActivityPaths.current);

    await writePending(updatesSnapshot, activityPathsSnapshot);

    for (const key of Object.keys(updatesSnapshot)) delete pendingUpdates.current[key];
    for (const path of activityPathsSnapshot) pendingActivityPaths.current.delete(path);

    return Object.keys(pendingUpdates.current).length === 0;
  };

  const forceSave = async () => {
    if (!jsonData) return;
    try {
      setSaveStatus('saving');
      const allFlushed = await flushPending();
      setSaveStatus('saved');
      setDirty(!allFlushed);
      toast({ title: 'Guardado en Firebase', description: 'Los cambios se han sincronizado.' });
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      toast({ title: 'Error al guardar', description: 'No se pudo guardar en Firebase', variant: 'destructive' });
    }
  };

  // Auto-save every 10s when there are pending changes. Se crea una sola vez
  // (no depende de `dirty`/`jsonData`, que cambian en cada snapshot de la raíz
  // — con heartbeats frecuentes de /pushTokens el intervalo nunca llegaba a
  // completar un ciclo) y comprueba el estado pendiente en vivo en cada tick.
  useEffect(() => {
    saveTimer.current = window.setInterval(() => {
      if (Object.keys(pendingUpdates.current).length === 0) return;
      setSaveStatus('saving');
      flushPending()
        .then((allFlushed) => {
          setSaveStatus('saved');
          setDirty(!allFlushed);
        })
        .catch((e) => {
          console.error(e);
          setSaveStatus('error');
        });
    }, 10000) as unknown as number;
    return () => { if (saveTimer.current) window.clearInterval(saveTimer.current); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Conectando con Firebase…</span>
        </div>
      </div>
    );
  }

  if (!jsonData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-card/50 backdrop-blur-sm border-border/50 shadow-tech">
          <div className="text-center space-y-6">
            <div className="relative inline-flex">
              <Cpu className="w-14 h-14 text-primary animate-pulse-glow" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">MCM Panel</h1>
              <p className="text-sm text-muted-foreground">Conecta a Firebase o importa un JSON</p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Button size="lg" className="w-full tech-glow">
                <Upload className="w-4 h-4 mr-2" />
                Cargar archivo JSON
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileJson className="w-3.5 h-3.5" />
              <span>Selecciona un archivo .json para comenzar</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomeDashboard jsonData={jsonData!} onNavigate={goToSection} />;
      case 'albums':
        return <AlbumsSection data={jsonData!.albums} onUpdate={(data) => updateSectionData('albums', data)} />;
      case 'app':
        return <AppSection data={jsonData!.app} onUpdate={(data) => updateSectionData('app', data)} />;
      case 'calendars':
        return <CalendarsSection data={jsonData!.calendars} onUpdate={(data) => updateSectionData('calendars', data)} />;
      case 'songs':
        return <SongsSection data={jsonData!.songs} onUpdate={(data) => updateSectionData('songs', data)} />;
      case 'wordle':
        return <WordleSection data={jsonData!.wordle} onUpdate={(data) => updateSectionData('wordle', data)} />;
      case 'activities': {
        const combinedData = {
          ...((jsonData!.activities && typeof jsonData!.activities === 'object') ? jsonData!.activities : {}),
          ...(jsonData!.jubileo ? { jubileo: jsonData!.jubileo } : {})
        };
        const handleActivitiesUpdate = (updatedData: any, editedPath?: string[]) => {
          const { jubileo, ...restActivities } = updatedData;
          if (editedPath && editedPath.length > 0) {
            // B4: registra la subruta editada para escribirla granularmente y
            // actualiza en memoria SOLO la sección tocada (así una edición de
            // Actividades no reescribe todo /jubileo, ni viceversa).
            pendingActivityPaths.current.add(activityFirebasePath(editedPath));
            if (editedPath[0] === 'jubileo') {
              updateSectionData('jubileo', jubileo);
            } else {
              updateSectionData('activities', restActivities);
            }
            return;
          }
          // Fallback sin ruta (no debería ocurrir): comportamiento antiguo.
          if (jubileo !== undefined) {
            updateSectionData('jubileo', jubileo);
          }
          updateSectionData('activities', restActivities);
        };
        return <ActivitiesSection data={combinedData} onUpdate={handleActivitiesUpdate} />;
      }
      case 'notifications':
        return <NotificationsSection />;
      case 'surveys':
        return <SurveysSection />;
      case 'choirs':
        return <ChoirsSection />;
      case 'users':
        return <UsersSection />;
      case 'profileConfig':
        return (
          <ProfileConfigSection
            data={jsonData!.profileConfig}
            calendarsRoot={jsonData!.calendars}
            onUpdate={(next) => updateSectionData('profileConfig', next)}
          />
        );
      default:
        return <div className="p-8 text-center text-muted-foreground">Sección en desarrollo</div>;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={goToSection}
          jsonData={jsonData}
          firebaseConnected={firebaseConnected}
          saveStatus={saveStatus}
          dirty={dirty}
          appReviewMode={appReviewActive}
          onToggleAppReviewMode={handleToggleAppReview}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border/40 bg-card/20 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
            {/* Left: trigger + section label */}
            <SidebarTrigger className="flex-shrink-0 text-muted-foreground hover:text-foreground" />

            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Section breadcrumb on mobile, full title on desktop */}
              <button
                type="button"
                onClick={() => goToSection('home')}
                className="hidden sm:block text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors select-none"
              >
                MCM Panel
              </button>
              <span className="hidden sm:block text-muted-foreground/40 text-sm">/</span>
              <span className="text-sm font-semibold truncate">
                {SECTION_META[activeSection].title}
              </span>
            </div>

            {/* Right: status indicators + actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Firebase + save status chip */}
              <StatusChip
                firebaseConnected={firebaseConnected}
                saveStatus={saveStatus}
                dirty={dirty}
              />

              <Button
                onClick={handleDownload}
                variant="ghost"
                size="sm"
                className="hidden sm:flex h-8 px-2 text-muted-foreground hover:text-foreground"
                title="Descargar JSON"
              >
                <Download className="w-4 h-4" />
                <span className="ml-1.5 hidden md:block text-xs">Exportar</span>
              </Button>

              <Button
                onClick={forceSave}
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs font-medium transition-all",
                  dirty
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
                disabled={!dirty && saveStatus !== 'error'}
              >
                <Save className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:block">
                  {saveStatus === 'saving' ? 'Guardando…' : 'Guardar'}
                </span>
              </Button>
            </div>
          </header>

          {appReviewActive && (
            <button
              type="button"
              onClick={() => handleToggleAppReview(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-warning/15 hover:bg-warning/25 border-b border-warning/40 transition-colors text-warning text-xs sm:text-sm font-semibold"
              title="Desactivar Modo revisión de app"
            >
              <ShieldAlert className="w-4 h-4 animate-pulse-subtle" />
              <span>Modo revisión ACTIVO · Cantoral y Comunica ocultos · toca para desactivar</span>
            </button>
          )}

          <main className="flex-1 overflow-auto">
            <Suspense fallback={<SectionLoadingFallback />}>
              {renderActiveSection()}
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/** Subtle real-time status pill in the header */
function StatusChip({
  firebaseConnected,
  saveStatus,
  dirty,
}: {
  firebaseConnected: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
}) {
  const showSaveIndicator = saveStatus === 'saving' || saveStatus === 'error' || (saveStatus === 'saved' && !dirty) || dirty;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/40 border border-border/30"
      title={
        !firebaseConnected
          ? 'Sin conexión a Firebase'
          : saveStatus === 'saving'
          ? 'Guardando cambios…'
          : saveStatus === 'error'
          ? 'Error al guardar'
          : dirty
          ? 'Cambios pendientes de guardar'
          : 'Todo sincronizado'
      }
    >
      {/* Connection dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors",
          firebaseConnected
            ? "bg-success animate-pulse-subtle"
            : "bg-destructive/80"
        )}
      />

      {/* Save status dot (only when relevant) */}
      {showSaveIndicator && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors",
            saveStatus === 'saving' ? "bg-primary animate-pulse-subtle" :
            saveStatus === 'error' ? "bg-destructive/80" :
            dirty ? "bg-warning/80 animate-pulse-subtle" :
            "bg-success"
          )}
        />
      )}

      {/* Text label — hidden on very small screens */}
      <span className="hidden sm:block text-xs text-muted-foreground/60 leading-none">
        {!firebaseConnected
          ? 'offline'
          : saveStatus === 'saving'
          ? 'guardando'
          : saveStatus === 'error'
          ? 'error'
          : dirty
          ? 'pendiente'
          : 'sync'}
      </span>
    </div>
  );
}

/** Shown briefly while a section's chunk downloads (React.lazy). */
function SectionLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full py-24">
      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}
