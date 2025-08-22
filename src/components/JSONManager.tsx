import { useState } from 'react';
import { Upload, Download, FileJson, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AlbumsSection } from './sections/AlbumsSection';
import { AppSection } from './sections/AppSection';
import { CalendarsSection } from './sections/CalendarsSection';
import { SongsSection } from './sections/SongsSection';
import { WordleSection } from './sections/WordleSection';
import { JubileoSection } from './sections/JubileoSection';
import { useToast } from '@/hooks/use-toast';

export type JSONData = {
  albums?: any;
  app?: any;
  calendars?: any;
  songs?: any;
  wordle?: any;
  jubileo?: any;
};

export type ActiveSection = 'albums' | 'app' | 'calendars' | 'songs' | 'wordle' | 'jubileo';

export function JSONManager() {
  const [jsonData, setJsonData] = useState<JSONData | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('albums');
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setJsonData(data);
        toast({
          title: "JSON cargado correctamente",
          description: "El archivo se ha importado exitosamente",
        });
      } catch (error) {
        toast({
          title: "Error al cargar JSON",
          description: "El archivo no es un JSON válido",
          variant: "destructive",
        });
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
    link.download = `json-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateSectionData = (section: ActiveSection, newData: any) => {
    if (!jsonData) return;

    const updatedData = {
      ...jsonData,
      [section]: {
        ...newData,
        updatedAt: new Date().toISOString()
      }
    };
    
    setJsonData(updatedData);
    toast({
      title: "Datos actualizados",
      description: `La sección ${section} se ha actualizado correctamente`,
    });
  };

  if (!jsonData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg p-8 bg-card/50 backdrop-blur-sm border-border/50 shadow-tech">
          <div className="text-center space-y-6">
            <div className="relative">
              <Cpu className="w-16 h-16 mx-auto text-primary animate-pulse-glow" />
              <div className="absolute inset-0 bg-gradient-primary rounded-full opacity-20 blur-xl" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                JSON Manager Pro
              </h1>
              <p className="text-muted-foreground">
                Sistema avanzado de gestión de configuraciones JSON
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Button size="lg" className="w-full tech-glow relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                  <Upload className="w-5 h-5 mr-2" />
                  Cargar archivo JSON
                </Button>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <FileJson className="w-4 h-4" />
                <span>Selecciona un archivo .json para comenzar</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'albums':
        return <AlbumsSection data={jsonData.albums} onUpdate={(data) => updateSectionData('albums', data)} />;
      case 'app':
        return <AppSection data={jsonData.app} onUpdate={(data) => updateSectionData('app', data)} />;
      case 'calendars':
        return <CalendarsSection data={jsonData.calendars} onUpdate={(data) => updateSectionData('calendars', data)} />;
      case 'songs':
        return <SongsSection data={jsonData.songs} onUpdate={(data) => updateSectionData('songs', data)} />;
      case 'wordle':
        return <WordleSection data={jsonData.wordle} onUpdate={(data) => updateSectionData('wordle', data)} />;
      case 'jubileo':
        return <JubileoSection data={jsonData.jubileo} onUpdate={(data) => updateSectionData('jubileo', data)} />;
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
        />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <SidebarTrigger className="text-foreground hover:text-primary" />
              <div className="flex items-center space-x-2">
                <Cpu className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">JSON Manager Pro</h1>
              </div>
            </div>
            
            <Button onClick={handleDownload} variant="outline" size="sm" className="tech-glow">
              <Download className="w-4 h-4 mr-2" />
              Descargar JSON
            </Button>
          </header>
          
          <main className="flex-1 overflow-auto">
            {renderActiveSection()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}