import { useEffect, useRef, useState } from 'react';
import { Upload, Download, FileJson, Cpu, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AlbumsSection } from './sections/AlbumsSection';
import { AppSection } from './sections/AppSection';
import { CalendarsSection } from './sections/CalendarsSection';
import { SongsSection } from './sections/SongsSection';
import { WordleSection } from './sections/WordleSection';
import { ActivitiesSection } from './sections/ActivitiesSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { useToast } from '@/hooks/use-toast';
import { getDB } from '@/lib/firebase';
import { onValue, ref, set } from 'firebase/database';
import { cn } from '@/lib/utils';

export type JSONData = {
  albums?: any;
  app?: any;
  calendars?: any;
  songs?: any;
  wordle?: any;
  jubileo?: any;
  activities?: any;
};

export type ActiveSection = 'albums' | 'app' | 'calendars' | 'songs' | 'wordle' | 'activities' | 'notifications';

const SECTION_LABELS: Record<ActiveSection, string> = {
  albums: 'Albums',
  app: 'App',
  calendars: 'Calendars',
  songs: 'Cantoral',
  wordle: 'Wordle',
  activities: 'Actividades',
  notifications: 'Notificaciones',
};

export function JSONManager() {
  const [jsonData, setJsonData] = useState<JSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('albums');
  const { toast } = useToast();
  const pendingUpdates = useRef<Record<string, any>>({});

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
        setJsonData(val && typeof val === 'object' ? val : {} as JSONData);
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

  const updateSectionData = (section: ActiveSection, newData: any) => {
    if (!jsonData) return;
    const updatedData = {
      ...jsonData,
      [section]: { ...newData, updatedAt: new Date().toISOString() }
    };
    setJsonData(updatedData);
    setDirty(true);
    pendingUpdates.current[section] = updatedData[section];
  };

  const writePending = async () => {
    const db = getDB();
    const entries = Object.entries(pendingUpdates.current);
    for (const [key, value] of entries) {
      if (key === 'wordle') {
        if (value && typeof value === 'object') {
          if (value['daily-words'] !== undefined) await set(ref(db, '/wordle/daily-words'), value['daily-words']);
          if (value['updatedAt'] !== undefined) await set(ref(db, '/wordle/updatedAt'), value['updatedAt']);
        }
        continue;
      }
      await set(ref(db, `/${key}`), (jsonData as any)[key]);
    }
  };

  const forceSave = async () => {
    if (!jsonData) return;
    try {
      setSaveStatus('saving');
      await writePending();
      setSaveStatus('saved');
      setDirty(false);
      pendingUpdates.current = {};
      toast({ title: 'Guardado en Firebase', description: 'Los cambios se han sincronizado.' });
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
      toast({ title: 'Error al guardar', description: 'No se pudo guardar en Firebase', variant: 'destructive' });
    }
  };

  // Auto-save every 10s when there are pending changes
  useEffect(() => {
    if (saveTimer.current) window.clearInterval(saveTimer.current);
    saveTimer.current = window.setInterval(() => {
      if (dirty && jsonData && Object.keys(pendingUpdates.current).length > 0) {
        setSaveStatus('saving');
        writePending()
          .then(() => {
            setSaveStatus('saved');
            setDirty(false);
            pendingUpdates.current = {};
          })
          .catch((e) => {
            console.error(e);
            setSaveStatus('error');
          });
      }
    }, 10000) as unknown as number;
    return () => { if (saveTimer.current) window.clearInterval(saveTimer.current); };
  }, [dirty, jsonData]);

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
        const handleActivitiesUpdate = (updatedData: any) => {
          const { jubileo, ...restActivities } = updatedData;
          if (jubileo !== undefined) {
            updateSectionData('jubileo', jubileo);
          }
          updateSectionData('activities', restActivities);
        };
        return <ActivitiesSection data={combinedData} onUpdate={handleActivitiesUpdate} />;
      }
      case 'notifications':
        return <NotificationsSection />;
      default:
        return <div className="p-8 text-center text-muted-foreground">Sección en desarrollo</div>;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          jsonData={jsonData}
          firebaseConnected={firebaseConnected}
          saveStatus={saveStatus}
          dirty={dirty}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border/40 bg-card/20 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
            {/* Left: trigger + section label */}
            <SidebarTrigger className="flex-shrink-0 text-muted-foreground hover:text-foreground" />

            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Section breadcrumb on mobile, full title on desktop */}
              <span className="hidden sm:block text-sm font-medium text-muted-foreground/70 select-none">
                MCM Panel
              </span>
              <span className="hidden sm:block text-muted-foreground/40 text-sm">/</span>
              <span className="text-sm font-semibold truncate">
                {SECTION_LABELS[activeSection]}
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

          <main className="flex-1 overflow-auto">
            {renderActiveSection()}
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
