import { useState } from 'react';
import { Plus, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
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
  TAB_LABELS,
  slugify,
} from '@/lib/profileCatalog';
import type {
  Delegation,
  DelegationListItem,
  ProfileConfigData,
} from '@/types/profileConfig';

interface DelegationsEditorProps {
  data: ProfileConfigData;
  calendars: Array<{ id: string; name: string }>;
  onChange: (next: ProfileConfigData) => void;
}

interface EditingDelegation {
  id: string;
  isNew: boolean;
  delegation: Delegation;
}

/**
 * C1 del PLAN_INTEGRACIONES. `delegationList` era una segunda lista que había
 * que mantener a mano y que la app IGNORA: se la deriva sola de `delegations`
 * (ver mcm-app/contexts/ProfileConfigContext.tsx → deriveDelegationList). El
 * panel llegaba a ofrecer un interruptor "mostrar en el selector" que no hacía
 * nada en la app.
 *
 * Aquí se deriva con las MISMAS reglas que la app (todo menos `_default`, en
 * orden de inserción del objeto). El nodo se sigue escribiendo porque el
 * composer de notificaciones lo lee (`NotificationsSection.tsx`).
 */
function deriveDelegationList(
  delegations: ProfileConfigData['delegations'],
): DelegationListItem[] {
  return Object.entries(delegations ?? {})
    .filter(([id]) => id !== '_default')
    .map(([id, d]) => ({ id, label: d.label }));
}

const EMPTY_DELEGATION: Delegation = { label: '' };

export function DelegationsEditor({ data, calendars, onChange }: DelegationsEditorProps) {
  const [editing, setEditing] = useState<EditingDelegation | null>(null);
  const { toast } = useToast();

  const delegations = data.delegations ?? ({ _default: { label: 'General' } } as ProfileConfigData['delegations']);

  const allIds = Object.keys(delegations).sort((a, b) => {
    if (a === '_default') return -1;
    if (b === '_default') return 1;
    return a.localeCompare(b);
  });

  const handleEdit = (id: string) => {
    setEditing({
      id,
      isNew: false,
      delegation: { ...EMPTY_DELEGATION, ...delegations[id] },
    });
  };

  const handleNew = () => {
    setEditing({
      id: '',
      isNew: true,
      delegation: { ...EMPTY_DELEGATION },
    });
  };

  const handleSave = (e: EditingDelegation) => {
    const id = e.isNew ? slugify(e.id) : e.id;
    if (!id) {
      toast({ title: 'ID requerido', variant: 'destructive' });
      return;
    }
    if (e.isNew && delegations[id]) {
      toast({ title: 'Ya existe una delegación con ese ID', variant: 'destructive' });
      return;
    }

    // Sanitize delegation: drop empty arrays, slugify topic
    const clean: Delegation = { label: e.delegation.label || id };
    if (e.delegation.notificationTopic) {
      clean.notificationTopic = slugify(e.delegation.notificationTopic);
    }
    if (e.delegation.extraCalendars?.length) clean.extraCalendars = e.delegation.extraCalendars;
    if (e.delegation.extraTabs?.length) clean.extraTabs = e.delegation.extraTabs;
    if (e.delegation.extraHomeButtons?.length) clean.extraHomeButtons = e.delegation.extraHomeButtons;
    if (e.delegation.extraMasItems?.length) clean.extraMasItems = e.delegation.extraMasItems;
    if (e.delegation.extraAlbumTags?.length) clean.extraAlbumTags = e.delegation.extraAlbumTags;
    if (e.delegation.override && Object.keys(e.delegation.override).length > 0) {
      clean.override = e.delegation.override;
    }

    const nextDelegations = { ...delegations, [id]: clean } as ProfileConfigData['delegations'];

    onChange({
      ...data,
      delegations: nextDelegations,
      delegationList: deriveDelegationList(nextDelegations),
    });
    setEditing(null);
    toast({ title: 'Delegación guardada' });
  };

  const handleDelete = (id: string) => {
    if (id === '_default') {
      toast({ title: 'No se puede borrar _default', variant: 'destructive' });
      return;
    }
    if (!confirm(`¿Borrar delegación "${id}"? Se limpiarán también los overrides asociados.`)) {
      return;
    }
    const { [id]: _, ...rest } = delegations;
    const nextOverrides = { ...(data.overrides ?? {}) };
    Object.keys(nextOverrides).forEach((key) => {
      if (key.endsWith(`:${id}`)) delete nextOverrides[key as keyof typeof nextOverrides];
    });
    const nextDelegations = rest as ProfileConfigData['delegations'];
    onChange({
      ...data,
      delegations: nextDelegations,
      delegationList: deriveDelegationList(nextDelegations),
      overrides: nextOverrides,
    });
    toast({ title: 'Delegación eliminada' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Delegaciones</h3>
          <p className="text-xs text-muted-foreground">
            {allIds.length} delegaciones · todas seleccionables en el onboarding
          </p>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva
        </Button>
      </div>

      <div className="grid gap-2">
        {allIds.map((id) => {
          const d = delegations[id];
          const isDefault = id === '_default';
          const hasExtras =
            !!d.notificationTopic ||
            !!d.extraCalendars?.length ||
            !!d.extraTabs?.length ||
            !!d.extraHomeButtons?.length ||
            !!d.extraMasItems?.length ||
            !!d.extraAlbumTags?.length;
          const hasOverride = !!d.override && Object.keys(d.override).length > 0;
          const orphanCalendars = (d.extraCalendars ?? []).filter(
            (c) => !calendars.some((cal) => cal.id === c),
          );

          return (
            <Card key={id} className="p-3 bg-card/50 border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{d.label || id}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/70">{id}</span>
                    {isDefault && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 rounded">
                        default
                      </span>
                    )}
                    {hasExtras && (
                      <span className="text-[10px] bg-success/15 text-success px-1.5 rounded">
                        extras
                      </span>
                    )}
                    {hasOverride && (
                      <span className="text-[10px] bg-warning/15 text-warning-foreground px-1.5 rounded">
                        override
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {d.notificationTopic && (
                      <span>
                        topic: <span className="font-mono">{d.notificationTopic}</span>
                      </span>
                    )}
                    {!!d.extraCalendars?.length && (
                      <span>
                        +cal: <span className="font-mono">{d.extraCalendars.join(', ')}</span>
                      </span>
                    )}
                    {orphanCalendars.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="w-3 h-3" />
                        cal huérfanos: {orphanCalendars.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(id)}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  {!isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <DelegationDialog
          editing={editing}
          calendars={calendars}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          onChange={setEditing}
        />
      )}
    </div>
  );
}

interface DelegationDialogProps {
  editing: EditingDelegation;
  calendars: Array<{ id: string; name: string }>;
  onSave: (e: EditingDelegation) => void;
  onCancel: () => void;
  onChange: (e: EditingDelegation) => void;
}

function DelegationDialog({ editing, calendars, onSave, onCancel, onChange }: DelegationDialogProps) {
  const calendarOptions = calendars.map((c) => ({ id: c.id, label: c.name || c.id }));
  const tabOptions = KNOWN_TABS.map((id) => ({ id, label: TAB_LABELS[id] ?? id }));
  const homeOptions = KNOWN_HOME_BUTTONS.map((id) => ({ id, label: HOME_BUTTON_LABELS[id] ?? id }));
  const masOptions = KNOWN_MAS_ITEMS.map((id) => ({ id, label: MAS_ITEM_LABELS[id] ?? id }));
  const albumOptions = KNOWN_ALBUM_TAGS.map((id) => ({ id, label: ALBUM_TAG_LABELS[id] ?? id }));

  const setDelegation = (patch: Partial<Delegation>) => {
    onChange({ ...editing, delegation: { ...editing.delegation, ...patch } });
  };
  const setOverride = (patch: Partial<NonNullable<Delegation['override']>>) => {
    const nextOverride = { ...(editing.delegation.override ?? {}), ...patch };
    Object.keys(nextOverride).forEach((k) => {
      const v = (nextOverride as any)[k];
      if (Array.isArray(v) && v.length === 0) delete (nextOverride as any)[k];
      if (v === undefined || v === '') delete (nextOverride as any)[k];
    });
    setDelegation({ override: nextOverride });
  };

  const isDefault = editing.id === '_default';

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing.isNew ? 'Nueva delegación' : `Editar ${editing.id}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="del-id">ID (slug)</Label>
              <Input
                id="del-id"
                value={editing.id}
                onChange={(e) => onChange({ ...editing, id: e.target.value })}
                placeholder="mcm-sevilla"
                disabled={!editing.isNew}
              />
              {editing.isNew && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Se aplicará slugify al guardar.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="del-label">Etiqueta</Label>
              <Input
                id="del-label"
                value={editing.delegation.label}
                onChange={(e) => setDelegation({ label: e.target.value })}
                placeholder="MCM Sevilla"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="del-topic">Topic de notificaciones</Label>
            <Input
              id="del-topic"
              value={editing.delegation.notificationTopic ?? ''}
              onChange={(e) => setDelegation({ notificationTopic: e.target.value })}
              placeholder="sevilla"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Slug libre. Se concatena a los topics base del perfil. Auto-slugify al guardar.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-border/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aditivos (extraX) — se concatenan al perfil base
            </p>
            <MultiSelect
              label="Extra calendars"
              options={calendarOptions}
              emptyHint="No hay calendarios."
              value={editing.delegation.extraCalendars ?? []}
              onChange={(v) => setDelegation({ extraCalendars: v })}
            />
            <MultiSelect
              label="Extra tabs"
              options={tabOptions}
              value={editing.delegation.extraTabs ?? []}
              onChange={(v) => setDelegation({ extraTabs: v })}
            />
            <MultiSelect
              label="Extra home buttons"
              options={homeOptions}
              value={editing.delegation.extraHomeButtons ?? []}
              onChange={(v) => setDelegation({ extraHomeButtons: v })}
            />
            <MultiSelect
              label="Extra Más items"
              options={masOptions}
              value={editing.delegation.extraMasItems ?? []}
              onChange={(v) => setDelegation({ extraMasItems: v })}
            />
            <MultiSelect
              label="Extra album tags"
              options={albumOptions}
              value={editing.delegation.extraAlbumTags ?? []}
              onChange={(v) => setDelegation({ extraAlbumTags: v })}
            />
          </div>

          <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning-foreground">
              Override — reemplaza el campo entero del perfil base
            </p>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Marca el campo solo si quieres reemplazarlo. Vacío = no override.
            </p>
            <MultiSelect
              label="Tabs (override)"
              options={tabOptions}
              value={editing.delegation.override?.tabs ?? []}
              onChange={(v) => setOverride({ tabs: v })}
            />
            <MultiSelect
              label="Home buttons (override)"
              options={homeOptions}
              value={editing.delegation.override?.homeButtons ?? []}
              onChange={(v) => setOverride({ homeButtons: v })}
            />
            <MultiSelect
              label="Más items (override)"
              options={masOptions}
              value={editing.delegation.override?.masItems ?? []}
              onChange={(v) => setOverride({ masItems: v })}
            />
            <MultiSelect
              label="Album tags (override)"
              options={albumOptions}
              value={editing.delegation.override?.albumTags ?? []}
              onChange={(v) => setOverride({ albumTags: v })}
            />
            <MultiSelect
              label="Default calendars (override)"
              options={calendarOptions}
              emptyHint="No hay calendarios."
              value={editing.delegation.override?.defaultCalendars ?? []}
              onChange={(v) => setOverride({ defaultCalendars: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(editing)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
