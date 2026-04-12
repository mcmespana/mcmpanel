import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, ArrowLeft } from 'lucide-react';
import { AppsSubsection } from './activities/AppsSubsection';
import { CompartiendoSubsection } from './activities/CompartiendoSubsection';
import { ContactosSubsection } from './activities/ContactosSubsection';
import { GruposSubsection } from './activities/GruposSubsection';
import { HorarioSubsection } from './activities/HorarioSubsection';
import { MaterialesSubsection } from './activities/MaterialesSubsection';
import { ProfundizaSubsection } from './activities/ProfundizaSubsection';
import { VisitasSubsection } from './activities/VisitasSubsection';

export type ActivityId = string;
export type SubsectionId = 'apps' | 'compartiendo' | 'contactos' | 'grupos' | 'horario' | 'materiales' | 'profundiza' | 'visitas';

interface ActivitiesSectionProps {
  data: any;
  onUpdate: (data: any) => void;
}

const subsections = [
  { id: 'apps' as SubsectionId, title: 'Apps', description: 'Aplicaciones recomendadas' },
  { id: 'compartiendo' as SubsectionId, title: 'Compartiendo', description: 'Posts y contenido compartido' },
  { id: 'contactos' as SubsectionId, title: 'Contactos', description: 'Lista de contactos importantes' },
  { id: 'grupos' as SubsectionId, title: 'Grupos', description: 'Organización por grupos' },
  { id: 'horario' as SubsectionId, title: 'Horario', description: 'Programación de eventos' },
  { id: 'materiales' as SubsectionId, title: 'Materiales', description: 'Contenido y recursos' },
  { id: 'profundiza' as SubsectionId, title: 'Profundiza', description: 'Material de profundización' },
  { id: 'visitas' as SubsectionId, title: 'Visitas', description: 'Lugares y visitas programadas' },
];

export function ActivitiesSection({ data, onUpdate }: ActivitiesSectionProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityId | null>('jubileo');
  const [selectedSubsection, setSelectedSubsection] = useState<SubsectionId | null>(null);

  // Modal state
  const [isCreating, setIsCreating] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');

  const activities = Object.keys(data || {});
  const currentActivityData = selectedActivity ? data?.[selectedActivity] : null;

  const handleCreateActivity = () => {
    const activityName = newActivityName.trim();
    if (!activityName) return;

    // Optional: add validation to prevent spaces if needed
    const normalizedName = activityName.toLowerCase().replace(/\s+/g, '');

    const newActivityStructure = {
      apps: { data: [], updatedAt: new Date().toISOString() },
      compartiendo: { data: {}, updatedAt: new Date().toISOString() },
      contactos: { data: [], updatedAt: new Date().toISOString() },
      grupos: { data: {}, updatedAt: new Date().toISOString() },
      horario: { data: [], updatedAt: new Date().toISOString() },
      materiales: { data: [], updatedAt: new Date().toISOString() },
      profundiza: { data: { introduccion: '', paginas: [] }, updatedAt: new Date().toISOString() },
      visitas: { data: [], updatedAt: new Date().toISOString() },
    };

    onUpdate({
      ...data,
      [normalizedName]: newActivityStructure,
    });

    setSelectedActivity(normalizedName);
    setIsCreating(false);
    setNewActivityName('');
  };

  const handleSubsectionUpdate = (subsectionData: any) => {
    if (!selectedActivity) return;
    
    onUpdate({
      ...data,
      [selectedActivity]: {
        ...currentActivityData,
        [selectedSubsection!]: {
          ...subsectionData,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const renderSubsection = () => {
    if (!selectedSubsection || !currentActivityData) return null;

    const subsectionData = currentActivityData[selectedSubsection];

    switch (selectedSubsection) {
      case 'apps':
        return <AppsSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'compartiendo':
        return <CompartiendoSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'contactos':
        return <ContactosSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'grupos':
        return <GruposSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'horario':
        return <HorarioSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'materiales':
        return <MaterialesSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'profundiza':
        return <ProfundizaSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      case 'visitas':
        return <VisitasSubsection data={subsectionData} onUpdate={handleSubsectionUpdate} />;
      default:
        return null;
    }
  };

  if (selectedSubsection && selectedActivity) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSubsection(null)}
              className="gap-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {subsections.find(s => s.id === selectedSubsection)?.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {selectedActivity} - {subsections.find(s => s.id === selectedSubsection)?.description}
              </p>
            </div>
          </div>
        </div>
        {renderSubsection()}
      </div>
    );
  }

  if (selectedActivity) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedActivity(null)}
              className="gap-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Actividades</span>
            </Button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {selectedActivity}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Gestiona las subsecciones de esta actividad
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subsections.map((subsection) => {
            const subsectionData = currentActivityData?.[subsection.id];
            const hasData = subsectionData?.data && (
              Array.isArray(subsectionData.data) ? 
                subsectionData.data.length > 0 : 
                Object.keys(subsectionData.data).length > 0
            );

            return (
              <Card
                key={subsection.id}
                className="p-6 cursor-pointer transition-all hover:border-primary/30 hover:bg-card/80"
                onClick={() => setSelectedSubsection(subsection.id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{subsection.title}</h3>
                    <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-success' : 'bg-muted'}`} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subsection.description}
                  </p>
                  {subsectionData?.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Actualizado: {new Date(subsectionData.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Actividades
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona todas las actividades y sus contenidos
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2 flex-shrink-0 self-start sm:self-auto">
              <Plus className="w-4 h-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Actividad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="activityName">Nombre del nodo (sin espacios)</Label>
                <Input
                  id="activityName"
                  placeholder="ej: actividadnavidad"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateActivity();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateActivity}>
                  Crear
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activities.length === 0 ? (
        <Card className="p-12 text-center bg-card/50 border-border/50">
          <div className="space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">No hay actividades</h3>
            <p className="text-muted-foreground">
              Aún no has creado ninguna actividad. Haz clic en "Nueva Actividad" para empezar a organizar tu contenido.
            </p>
            <Button onClick={() => setIsCreating(true)} className="mt-4">
              Crear mi primera actividad
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activityId) => (
            <Card
              key={activityId}
              className="p-6 cursor-pointer transition-all hover:border-primary/30 hover:bg-card/80"
              onClick={() => setSelectedActivity(activityId)}
            >
              <div className="space-y-2">
                <h3 className="text-xl font-semibold capitalize">{activityId}</h3>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(data[activityId] || {}).length} subsecciones
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}