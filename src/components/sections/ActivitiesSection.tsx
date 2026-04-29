import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');

  const activities = Object.keys(data || {});
  const currentActivityData = selectedActivity ? data?.[selectedActivity] : null;

  const handleCreateActivity = () => {
    const activityName = newActivityName.trim().replace(/\s+/g, '').toLowerCase();
    if (!activityName) return;

    const newActivityStructure = {
      apps: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      compartiendo: { data: {}, hidden: false, updatedAt: new Date().toISOString() },
      contactos: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      grupos: { data: {}, hidden: false, updatedAt: new Date().toISOString() },
      horario: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      materiales: { data: [], hidden: false, updatedAt: new Date().toISOString() },
      profundiza: { data: { introduccion: '', paginas: [] }, hidden: false, updatedAt: new Date().toISOString() },
      visitas: { data: [], hidden: false, updatedAt: new Date().toISOString() },
    };

    onUpdate({
      ...data,
      [activityName]: newActivityStructure,
    });
    setSelectedActivity(activityName);
    setIsCreateDialogOpen(false);
    setNewActivityName('');
  };

  const handleToggleHidden = (subsectionId: SubsectionId, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedActivity || !currentActivityData) return;

    const subsectionData = currentActivityData[subsectionId];

    onUpdate({
      ...data,
      [selectedActivity]: {
        ...currentActivityData,
        [subsectionId]: {
          ...subsectionData,
          hidden: !subsectionData?.hidden,
          updatedAt: new Date().toISOString(),
        },
      },
    });
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedSubsection(null)}
            className="gap-2 self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
              {subsections.find(s => s.id === selectedSubsection)?.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {selectedActivity} - {subsections.find(s => s.id === selectedSubsection)?.description}
            </p>
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
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedActivity(null)}
              className="gap-2 self-start sm:self-auto flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Actividades
            </Button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
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
                className={`p-6 cursor-pointer transition-all hover:border-primary/30 hover:bg-card/80 ${subsectionData?.hidden ? 'opacity-60' : ''}`}
                onClick={() => setSelectedSubsection(subsection.id)}
              >
                <div className="space-y-4">
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

                  <div className="flex items-center justify-between pt-4 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {subsectionData?.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{subsectionData?.hidden ? 'Oculta' : 'Visible'}</span>
                    </div>
                    <Switch
                      checked={!subsectionData?.hidden}
                      onCheckedChange={() => handleToggleHidden(subsection.id, { stopPropagation: () => {} } as any)}
                    />
                  </div>
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
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
            Actividades
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            Gestiona todas las actividades y sus contenidos
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 tech-glow flex-shrink-0 self-start sm:self-auto">
              <Plus className="w-4 h-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Actividad</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder='Nombre del nodo (ej: "actividadnavidad")'
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateActivity()}
              />
              <p className="text-xs text-muted-foreground mt-2">
                El nombre no debe contener espacios y se guardará en minúsculas.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateActivity}>
                Crear Actividad
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activities.length === 0 ? (
        <Card className="p-8 text-center bg-card/50 border-border/50">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">No hay actividades</h3>
              <p className="text-sm text-muted-foreground">
                Crea tu primera actividad para comenzar a gestionar el contenido.
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4 gap-2 tech-glow">
              <Plus className="w-4 h-4" />
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