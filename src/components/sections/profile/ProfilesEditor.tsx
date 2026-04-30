import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiSelect } from './MultiSelect';
import {
  ALBUM_TAG_LABELS,
  HOME_BUTTON_LABELS,
  KNOWN_ALBUM_TAGS,
  KNOWN_HOME_BUTTONS,
  KNOWN_MAS_ITEMS,
  KNOWN_NOTIFICATION_TOPICS,
  KNOWN_TABS,
  MAS_ITEM_LABELS,
  NOTIFICATION_TOPIC_LABELS,
  PROFILE_TYPES,
  TAB_LABELS,
} from '@/lib/profileCatalog';
import type { ProfileBase, ProfileConfigData, ProfileType } from '@/types/profileConfig';

interface ProfilesEditorProps {
  data: ProfileConfigData;
  calendars: Array<{ id: string; name: string }>;
  onChange: (next: ProfileConfigData) => void;
}

const DEFAULT_PROFILE: ProfileBase = {
  label: '',
  description: '',
  tabs: [],
  homeButtons: [],
  masItems: [],
  defaultCalendars: [],
  albumTags: [],
  notificationTopics: [],
};

export function ProfilesEditor({ data, calendars, onChange }: ProfilesEditorProps) {
  const tabOptions = useMemo(
    () => KNOWN_TABS.map((id) => ({ id, label: TAB_LABELS[id] ?? id })),
    [],
  );
  const homeOptions = useMemo(
    () => KNOWN_HOME_BUTTONS.map((id) => ({ id, label: HOME_BUTTON_LABELS[id] ?? id })),
    [],
  );
  const masOptions = useMemo(
    () => KNOWN_MAS_ITEMS.map((id) => ({ id, label: MAS_ITEM_LABELS[id] ?? id })),
    [],
  );
  const albumOptions = useMemo(
    () => KNOWN_ALBUM_TAGS.map((id) => ({ id, label: ALBUM_TAG_LABELS[id] ?? id })),
    [],
  );
  const topicOptions = useMemo(
    () =>
      KNOWN_NOTIFICATION_TOPICS.map((id) => ({
        id,
        label: NOTIFICATION_TOPIC_LABELS[id] ?? id,
      })),
    [],
  );
  const calendarOptions = useMemo(
    () => calendars.map((c) => ({ id: c.id, label: c.name || c.id })),
    [calendars],
  );

  const updateProfile = (type: ProfileType, patch: Partial<ProfileBase>) => {
    const current = data.profiles?.[type] ?? DEFAULT_PROFILE;
    onChange({
      ...data,
      profiles: {
        ...data.profiles,
        [type]: { ...DEFAULT_PROFILE, ...current, ...patch },
      },
    });
  };

  return (
    <Tabs defaultValue="familia" className="space-y-4">
      <TabsList>
        {PROFILE_TYPES.map((p) => (
          <TabsTrigger key={p} value={p} className="capitalize">
            {data.profiles?.[p]?.label || p}
          </TabsTrigger>
        ))}
      </TabsList>

      {PROFILE_TYPES.map((type) => {
        const profile = data.profiles?.[type] ?? DEFAULT_PROFILE;
        const tabsHasIndex = profile.tabs.includes('index');
        const tabsEmpty = profile.tabs.length === 0;

        return (
          <TabsContent key={type} value={type} className="space-y-4 mt-0">
            <Card className="p-4 sm:p-5 bg-card/50 border-border/50 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`label-${type}`}>Etiqueta</Label>
                  <Input
                    id={`label-${type}`}
                    value={profile.label}
                    onChange={(e) => updateProfile(type, { label: e.target.value })}
                    placeholder="Familia"
                  />
                </div>
                <div>
                  <Label htmlFor={`desc-${type}`}>Descripción</Label>
                  <Input
                    id={`desc-${type}`}
                    value={profile.description}
                    onChange={(e) => updateProfile(type, { description: e.target.value })}
                    placeholder="Padres, madres y familiares"
                  />
                </div>
              </div>

              {tabsEmpty && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  ⚠ Tabs vacío. La app caerá al fallback.
                </div>
              )}
              {!tabsEmpty && !tabsHasIndex && (
                <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
                  ⚠ El usuario no podrá volver a Inicio (tab <code>index</code> ausente).
                </div>
              )}

              <MultiSelect
                label="Tabs"
                description="Pestañas de la barra inferior."
                options={tabOptions}
                value={profile.tabs}
                onChange={(v) => updateProfile(type, { tabs: v })}
              />

              <MultiSelect
                label="Botones del Home"
                description="Grid de botones en pantalla principal."
                options={homeOptions}
                value={profile.homeButtons}
                onChange={(v) => updateProfile(type, { homeButtons: v })}
              />

              <MultiSelect
                label="Items del menú Más"
                options={masOptions}
                value={profile.masItems}
                onChange={(v) => updateProfile(type, { masItems: v })}
              />

              <MultiSelect
                label="Calendarios por defecto"
                description="Pre-seleccionados al instalar. Se completan con los extras de la delegación."
                options={calendarOptions}
                emptyHint="No hay calendarios definidos en /calendars."
                value={profile.defaultCalendars}
                onChange={(v) => updateProfile(type, { defaultCalendars: v })}
              />

              <MultiSelect
                label="Tags de álbumes visibles"
                description='"all" = ver todos. Si no, solo álbumes con intersección.'
                options={albumOptions}
                value={profile.albumTags}
                onChange={(v) => updateProfile(type, { albumTags: v })}
              />

              <MultiSelect
                label="Topics de notificaciones"
                description="Topics base. Las delegaciones añaden el suyo."
                options={topicOptions}
                value={profile.notificationTopics}
                onChange={(v) => updateProfile(type, { notificationTopics: v })}
              />
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
