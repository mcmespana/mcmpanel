import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { KNOWN_TABS, SEMVER_REGEX, TAB_LABELS } from '@/lib/profileCatalog';
import type { GlobalConfig, ProfileConfigData } from '@/types/profileConfig';

interface SystemEditorProps {
  data: ProfileConfigData;
  onChange: (next: ProfileConfigData) => void;
}

const DEFAULT_GLOBAL: GlobalConfig = {
  defaultTab: 'index',
  showNotificationsIcon: true,
  showOnboarding: true,
  showChangeNameButton: false,
  maintenanceMode: false,
  maintenanceMessage: '',
  minAppVersion: '0.0.0',
};

export function SystemEditor({ data, onChange }: SystemEditorProps) {
  const global = { ...DEFAULT_GLOBAL, ...(data.global ?? {}) };

  const update = (patch: Partial<GlobalConfig>) => {
    onChange({ ...data, global: { ...global, ...patch } });
  };

  const semverValid = SEMVER_REGEX.test(global.minAppVersion);

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5 bg-card/50 border-border/50 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Flags globales</h3>
          <p className="text-xs text-muted-foreground">
            Afectan a todos los usuarios sin importar perfil ni delegación.
          </p>
        </div>

        <div>
          <Label htmlFor="defaultTab">Tab por defecto al abrir la app</Label>
          <Select
            value={global.defaultTab}
            onValueChange={(v) => update({ defaultTab: v })}
          >
            <SelectTrigger id="defaultTab"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KNOWN_TABS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TAB_LABELS[t] ?? t} <span className="text-muted-foreground ml-1">({t})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ToggleRow
          label="Mostrar campana de notificaciones en Home"
          checked={global.showNotificationsIcon}
          onChange={(v) => update({ showNotificationsIcon: v })}
        />
        <ToggleRow
          label="Forzar onboarding al primer arranque"
          checked={global.showOnboarding}
          onChange={(v) => update({ showOnboarding: v })}
        />
        <ToggleRow
          label="Botón de cambiar nombre (legacy)"
          checked={global.showChangeNameButton}
          onChange={(v) => update({ showChangeNameButton: v })}
        />
      </Card>

      <Card className={`p-4 sm:p-5 space-y-4 border ${global.maintenanceMode ? 'border-destructive/40 bg-destructive/5' : 'bg-card/50 border-border/50'}`}>
        <div className="flex items-start gap-3">
          {global.maintenanceMode && (
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold">Modo mantenimiento</h3>
            <p className="text-xs text-muted-foreground">
              Si está activo, TODA la app cliente muestra MaintenanceScreen.
            </p>
          </div>
          <Switch
            checked={global.maintenanceMode}
            onCheckedChange={(v) => {
              if (v && !confirm('¿Activar modo mantenimiento? Bloquea la app a todos los usuarios.')) {
                return;
              }
              update({ maintenanceMode: v });
            }}
          />
        </div>

        <div>
          <Label htmlFor="maintMsg">Mensaje (opcional)</Label>
          <Textarea
            id="maintMsg"
            value={global.maintenanceMessage ?? ''}
            onChange={(e) => update({ maintenanceMessage: e.target.value })}
            placeholder="Volvemos a las 18:00"
            rows={2}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-5 bg-card/50 border-border/50 space-y-3">
        <div>
          <h3 className="text-base font-semibold">Versión mínima soportada</h3>
          <p className="text-xs text-muted-foreground">
            Apps con versión inferior verán pantalla de actualización.{' '}
            <code>0.0.0</code> = sin bloqueo.
          </p>
        </div>
        <div>
          <Label htmlFor="minVer">minAppVersion</Label>
          <Input
            id="minVer"
            value={global.minAppVersion}
            onChange={(e) => update({ minAppVersion: e.target.value })}
            placeholder="1.0.5"
            className={!semverValid ? 'border-destructive' : ''}
          />
          {!semverValid && (
            <p className="text-xs text-destructive mt-1">
              ⚠ No es un semver válido. Formato: <code>1.0.5</code> o <code>1.0.5-beta</code>.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
