import { useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from './MultiSelect';
import {
  ALBUM_TAG_LABELS,
  HOME_BUTTON_LABELS,
  KNOWN_ALBUM_TAGS,
  KNOWN_HOME_BUTTONS,
  KNOWN_MAS_ITEMS,
  KNOWN_TABS,
  MAS_ITEM_LABELS,
  PROFILE_TYPES,
  TAB_LABELS,
} from '@/lib/profileCatalog';
import type {
  OverrideKey,
  ProfileBase,
  ProfileConfigData,
  ProfileType,
} from '@/types/profileConfig';

interface OverridesEditorProps {
  data: ProfileConfigData;
  calendars: Array<{ id: string; name: string }>;
  onChange: (next: ProfileConfigData) => void;
}

interface EditingOverride {
  profile: ProfileType;
  delegationId: string;
  isNew: boolean;
  override: Partial<ProfileBase>;
}

export function OverridesEditor({ data, calendars, onChange }: OverridesEditorProps) {
  const [editing, setEditing] = useState<EditingOverride | null>(null);
  const { toast } = useToast();

  const overrides = data.overrides ?? {};
  const delegationIds = Object.keys(data.delegations ?? {}).filter((d) => d !== '_default');

  const entries = Object.entries(overrides) as Array<[OverrideKey, Partial<ProfileBase>]>;

  const handleNew = () => {
    setEditing({
      profile: 'familia',
      delegationId: delegationIds[0] ?? '',
      isNew: true,
      override: {},
    });
  };

  const handleEdit = (key: OverrideKey, value: Partial<ProfileBase>) => {
    const [profile, delegationId] = key.split(':') as [ProfileType, string];
    setEditing({ profile, delegationId, isNew: false, override: { ...value } });
  };

  const handleDelete = (key: OverrideKey) => {
    if (!confirm(`¿Borrar override "${key}"?`)) return;
    const next = { ...overrides };
    delete next[key];
    onChange({ ...data, overrides: next });
  };

  const handleSave = (e: EditingOverride) => {
    if (!e.delegationId) {
      toast({ title: 'Selecciona una delegación', variant: 'destructive' });
      return;
    }
    const key: OverrideKey = `${e.profile}:${e.delegationId}`;
    if (e.isNew && overrides[key]) {
      toast({ title: 'Ya existe un override para esa combinación', variant: 'destructive' });
      return;
    }
    const cleaned: Partial<ProfileBase> = {};
    Object.entries(e.override).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length === 0) return;
      if (v === undefined || v === '') return;
      (cleaned as any)[k] = v;
    });
    if (Object.keys(cleaned).length === 0) {
      toast({ title: 'Override vacío', description: 'Marca al menos un campo.', variant: 'destructive' });
      return;
    }
    onChange({ ...data, overrides: { ...overrides, [key]: cleaned } });
    setEditing(null);
    toast({ title: 'Override guardado' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Overrides perfil:delegación</h3>
          <p className="text-xs text-muted-foreground">
            Granularidad máxima. Reemplazan tanto el perfil base como el override de delegación.
          </p>
        </div>
        <Button onClick={handleNew} size="sm" disabled={delegationIds.length === 0}>
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="p-6 text-center bg-card/30 border-border/50">
          <p className="text-sm text-muted-foreground">Sin overrides definidos.</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {entries.map(([key, value]) => {
            const [profile, delegationId] = key.split(':');
            const fields = Object.keys(value);
            return (
              <Card key={key} className="p-3 bg-card/50 border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {profile}
                      </span>
                      <span className="text-muted-foreground/60">→</span>
                      <span className="text-xs font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                        {delegationId}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reemplaza: <span className="font-mono">{fields.join(', ')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(key, value)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(key)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <OverrideDialog
          editing={editing}
          delegationIds={delegationIds}
          calendars={calendars}
          onChange={setEditing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface OverrideDialogProps {
  editing: EditingOverride;
  delegationIds: string[];
  calendars: Array<{ id: string; name: string }>;
  onChange: (e: EditingOverride) => void;
  onSave: (e: EditingOverride) => void;
  onCancel: () => void;
}

function OverrideDialog({
  editing,
  delegationIds,
  calendars,
  onChange,
  onSave,
  onCancel,
}: OverrideDialogProps) {
  const calendarOptions = calendars.map((c) => ({ id: c.id, label: c.name || c.id }));
  const tabOptions = KNOWN_TABS.map((id) => ({ id, label: TAB_LABELS[id] ?? id }));
  const homeOptions = KNOWN_HOME_BUTTONS.map((id) => ({ id, label: HOME_BUTTON_LABELS[id] ?? id }));
  const masOptions = KNOWN_MAS_ITEMS.map((id) => ({ id, label: MAS_ITEM_LABELS[id] ?? id }));
  const albumOptions = KNOWN_ALBUM_TAGS.map((id) => ({ id, label: ALBUM_TAG_LABELS[id] ?? id }));

  const setField = (k: keyof ProfileBase, v: string[] | undefined) => {
    const next = { ...editing.override };
    if (v === undefined || v.length === 0) delete (next as any)[k];
    else (next as any)[k] = v;
    onChange({ ...editing, override: next });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing.isNew ? 'Nuevo override' : 'Editar override'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Perfil</Label>
              <Select
                value={editing.profile}
                onValueChange={(v) => onChange({ ...editing, profile: v as ProfileType })}
                disabled={!editing.isNew}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROFILE_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delegación</Label>
              <Select
                value={editing.delegationId}
                onValueChange={(v) => onChange({ ...editing, delegationId: v })}
                disabled={!editing.isNew}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {delegationIds.map((id) => (
                    <SelectItem key={id} value={id}>{id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Marca solo los campos que quieras reemplazar.
          </p>

          <MultiSelect
            label="Tabs"
            options={tabOptions}
            value={editing.override.tabs ?? []}
            onChange={(v) => setField('tabs', v)}
          />
          <MultiSelect
            label="Home buttons"
            options={homeOptions}
            value={editing.override.homeButtons ?? []}
            onChange={(v) => setField('homeButtons', v)}
          />
          <MultiSelect
            label="Más items"
            options={masOptions}
            value={editing.override.masItems ?? []}
            onChange={(v) => setField('masItems', v)}
          />
          <MultiSelect
            label="Album tags"
            options={albumOptions}
            value={editing.override.albumTags ?? []}
            onChange={(v) => setField('albumTags', v)}
          />
          <MultiSelect
            label="Default calendars"
            options={calendarOptions}
            emptyHint="No hay calendarios."
            value={editing.override.defaultCalendars ?? []}
            onChange={(v) => setField('defaultCalendars', v)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(editing)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
