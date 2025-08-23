import { Database, HardDrive, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StorageModeIndicatorProps {
  mode: 'firebase' | 'localStorage' | 'offline';
  onDownloadBackup?: () => void;
  className?: string;
}

export function StorageModeIndicator({ mode, onDownloadBackup, className }: StorageModeIndicatorProps) {
  const getStorageInfo = () => {
    switch (mode) {
      case 'firebase':
        return {
          icon: Database,
          label: 'Firebase',
          description: 'Conectado a Firebase',
          variant: 'default' as const,
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          textColor: 'text-green-600',
        };
      case 'localStorage':
        return {
          icon: HardDrive,
          label: 'Local',
          description: 'Modo Local Storage',
          variant: 'secondary' as const,
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          textColor: 'text-yellow-600',
        };
      case 'offline':
        return {
          icon: AlertTriangle,
          label: 'Sin conexión',
          description: 'Modo offline',
          variant: 'destructive' as const,
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-600',
        };
    }
  };

  const { icon: Icon, label, description, variant, bgColor, borderColor, textColor } = getStorageInfo();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge 
        variant={variant}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border",
          bgColor,
          borderColor,
          textColor
        )}
      >
        <Icon className="w-3 h-3" />
        <span className="text-xs font-medium">{label}</span>
      </Badge>
      
      {mode === 'localStorage' && onDownloadBackup && (
        <Button
          onClick={onDownloadBackup}
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs tech-glow"
          title="Descargar copia de seguridad del localStorage"
        >
          <Download className="w-3 h-3 mr-1" />
          Backup
        </Button>
      )}
    </div>
  );
}