import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface JubileoSectionProps {
  data: any;
  onUpdate: (data: any) => void;
}

export function JubileoSection({ data, onUpdate }: JubileoSectionProps) {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Sección Jubileo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Esta sección está en desarrollo y se implementará próximamente
          </p>
        </div>
      </div>

      <Card className="p-12 text-center bg-card/50 border-border/50">
        <div className="space-y-4">
          <Construction className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
          <h3 className="text-xl font-semibold">En construcción</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            La sección Jubileo se desarrollará en futuros prompts según las especificaciones del usuario.
          </p>
        </div>
      </Card>
    </div>
  );
}