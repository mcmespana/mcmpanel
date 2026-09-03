import { useState } from 'react';
import { Save, Edit3, Plus, Trash2, Calendar, ExternalLink, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { calendarColorOptions } from '@/lib/brandTokens';

interface CalendarConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  defaultSelected: boolean;
}

interface CalendarsSectionProps {
  data: any;
  onUpdate: (data: any) => void;
}

// Los colores que se ofrecen para un calendario son los que la APP pinta, así
// que salen del espejo de tokens de marca, no de una paleta del panel.
// Ver `src/lib/brandTokens.ts` y `design.md` §3.
const pastelColors = calendarColorOptions.map((c) => c.hex);

export function CalendarsSection({ data, onUpdate }: CalendarsSectionProps) {
  const [calendars, setCalendars] = useState<CalendarConfig[]>(data?.data || []);
  const [editingCalendar, setEditingCalendar] = useState<CalendarConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const saveChanges = () => {
    onUpdate({
      data: calendars,
      updatedAt: new Date().toISOString()
    });
  };

  const handleCreateCalendar = () => {
    const newCalendar: CalendarConfig = {
      id: '',
      name: '',
      url: '',
      color: pastelColors[0],
      defaultSelected: false
    };
    setEditingCalendar(newCalendar);
    setIsCreating(true);
  };

  const handleSaveCalendar = (calendar: CalendarConfig) => {
    if (isCreating) {
      setCalendars([...calendars, calendar]);
    } else {
      setCalendars(calendars.map(c => c.id === calendar.id ? calendar : c));
    }
    setEditingCalendar(null);
    setIsCreating(false);
  };

  const handleDeleteCalendar = (id: string) => {
    setCalendars(calendars.filter(c => c.id !== id));
    toast({
      title: "Calendario eliminado",
      description: "El calendario se ha eliminado correctamente",
    });
  };

  const handleToggleDefault = (id: string, defaultSelected: boolean) => {
    setCalendars(calendars.map(c => 
      c.id === id ? { ...c, defaultSelected } : c
    ));
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Configuración de Calendarios
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Última actualización: {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('es-ES') : 'No disponible'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={handleCreateCalendar} className="tech-glow" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Calendario
          </Button>
          <Button onClick={saveChanges} variant="outline" size="sm" className="tech-glow">
            <Save className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Guardar</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {calendars.length === 0 ? (
          <Card className="p-8 text-center bg-card/50 border-border/50">
            <p className="text-muted-foreground">No hay calendarios configurados</p>
          </Card>
        ) : (
          calendars.map((calendar) => (
            <Card key={calendar.id} className="p-3 sm:p-4 bg-card/50 border-border/50 hover:bg-card/70 transition-colors">
              <div className="flex items-center gap-3">
                {/* Color dot + icon */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>

                {/* Name + ID — flex-1 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm leading-tight">{calendar.name}</span>
                    {calendar.defaultSelected && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded leading-none">
                        Por defecto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-muted-foreground font-mono truncate">ID: {calendar.id}</p>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={calendar.defaultSelected}
                        onCheckedChange={(checked) => handleToggleDefault(calendar.id, checked as boolean)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs text-muted-foreground">Predeterminado</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {calendar.url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={calendar.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingCalendar(calendar)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteCalendar(calendar.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {editingCalendar && (
        <Dialog open={!!editingCalendar} onOpenChange={() => setEditingCalendar(null)}>
          <DialogContent className="max-w-md">
            <CalendarEditor
              calendar={editingCalendar}
              onSave={handleSaveCalendar}
              onCancel={() => setEditingCalendar(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface CalendarEditorProps {
  calendar: CalendarConfig | null;
  onSave: (calendar: CalendarConfig) => void;
  onCancel: () => void;
}

function CalendarEditor({ calendar, onSave, onCancel }: CalendarEditorProps) {
  const [formData, setFormData] = useState<CalendarConfig>(
    calendar || {
      id: '',
      name: '',
      url: '',
      color: pastelColors[0],
      defaultSelected: false
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: keyof CalendarConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>{calendar?.id ? 'Editar Calendario' : 'Nuevo Calendario'}</span>
        </DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="id">ID del Calendario</Label>
          <Input
            id="id"
            value={formData.id}
            onChange={(e) => handleChange('id', e.target.value)}
            placeholder="mcm-europa"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="MCM Europa"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="url">URL del Calendario</Label>
          <Input
            id="url"
            value={formData.url}
            onChange={(e) => handleChange('url', e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/..."
            required
          />
        </div>
        
        <div>
          <Label className="flex items-center space-x-2 mb-3">
            <Palette className="w-4 h-4" />
            <span>Color</span>
          </Label>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
            {pastelColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange('color', color)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  formData.color === color 
                    ? 'border-primary scale-110' 
                    : 'border-white/20 hover:border-white/40'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="defaultSelected"
            checked={formData.defaultSelected}
            onCheckedChange={(checked) => handleChange('defaultSelected', checked)}
          />
          <Label htmlFor="defaultSelected">Seleccionado por defecto</Label>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="tech-glow">
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </div>
      </form>
    </>
  );
}