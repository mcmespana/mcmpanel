import { Send, CalendarClock, History, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTION_META, SECTION_ORDER, sectionHasData, type SectionId } from '@/lib/sections';
import type { JSONData } from './JSONManager';

interface HomeDashboardProps {
  jsonData: JSONData;
  /** Navigate to a section. Optional second arg is a deep-link suffix (e.g. `?tab=history`). */
  onNavigate: (section: SectionId, suffix?: string) => void;
}

/**
 * Mobile-first landing screen with quick shortcuts to every section. The push
 * notification flow is front and center so an admin can fire a notification in
 * two taps straight from their phone.
 */
export function HomeDashboard({ jsonData, onNavigate }: HomeDashboardProps) {
  const hasData = (id: SectionId): boolean => sectionHasData(jsonData, id);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">MCM Panel</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">¿Qué quieres hacer?</h1>
        <p className="text-sm text-muted-foreground">
          Atajos rápidos para gestionar la app desde cualquier dispositivo.
        </p>
      </div>

      {/* Hero: send a push notification */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => onNavigate('notifications', '?tab=compose')}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-primary p-5 sm:p-6 text-left shadow-glow transition-transform active:scale-[0.99]"
        >
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Send className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg sm:text-xl font-bold text-white leading-tight">
                Enviar notificación push
              </p>
              <p className="text-sm text-white/80 mt-0.5">
                Llega a los usuarios de la app en segundos
              </p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/70 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        {/* Secondary notification shortcuts */}
        <div className="grid grid-cols-2 gap-3">
          <QuickButton
            icon={CalendarClock}
            label="Programadas"
            onClick={() => onNavigate('notifications', '?tab=scheduled')}
          />
          <QuickButton
            icon={History}
            label="Historial"
            onClick={() => onNavigate('notifications', '?tab=history')}
          />
        </div>
      </section>

      {/* All sections */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Todas las secciones
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SECTION_ORDER.map((id) => {
            const meta = SECTION_META[id];
            const Icon = meta.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-card/50 p-4 text-left transition-all hover:border-primary/40 hover:bg-card active:scale-[0.98]"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5" />
                  </div>
                  {id !== 'notifications' && (
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        hasData(id) ? 'bg-success/70' : 'bg-muted-foreground/25',
                      )}
                      title={hasData(id) ? 'Con contenido' : 'Sin contenido'}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{meta.title}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight line-clamp-2">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function QuickButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Send;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-3 text-sm font-medium text-foreground/90 transition-all hover:border-primary/40 hover:bg-card active:scale-[0.98]"
    >
      <Icon className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
