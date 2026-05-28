import type {
  AppReviewBackup,
  AppReviewBackupEntry,
  Delegation,
  ProfileBase,
  ProfileConfigData,
  ProfileType,
} from '@/types/profileConfig';

type OverrideValue = Partial<ProfileBase>;
type DelegationMap = Record<string, Delegation>;
type OverrideMap = Record<string, OverrideValue>;

export const APP_REVIEW_HIDDEN_TABS = ['cancionero', 'comunica'] as const;
export const APP_REVIEW_HIDDEN_HOME_BUTTONS = ['cancionero', 'comunica'] as const;
export const APP_REVIEW_HIDDEN_MAS_ITEMS = ['comunica', 'comunica-gestion'] as const;

const PROFILE_KEYS: ProfileType[] = ['familia', 'monitor', 'miembro'];

function stripList(list: string[] | undefined, hidden: readonly string[]): string[] | undefined {
  if (!Array.isArray(list)) return list;
  return list.filter((id) => !hidden.includes(id));
}

function snapshotEntry(src: {
  tabs?: string[];
  homeButtons?: string[];
  masItems?: string[];
  extraTabs?: string[];
  extraHomeButtons?: string[];
  extraMasItems?: string[];
}): AppReviewBackupEntry {
  const entry: AppReviewBackupEntry = {};
  if (Array.isArray(src.tabs)) entry.tabs = [...src.tabs];
  if (Array.isArray(src.homeButtons)) entry.homeButtons = [...src.homeButtons];
  if (Array.isArray(src.masItems)) entry.masItems = [...src.masItems];
  if (Array.isArray(src.extraTabs)) entry.extraTabs = [...src.extraTabs];
  if (Array.isArray(src.extraHomeButtons)) entry.extraHomeButtons = [...src.extraHomeButtons];
  if (Array.isArray(src.extraMasItems)) entry.extraMasItems = [...src.extraMasItems];
  return entry;
}

function entryHasContent(entry: AppReviewBackupEntry): boolean {
  return Object.keys(entry).length > 0;
}

export function enableAppReviewMode(data: ProfileConfigData): ProfileConfigData {
  const backup: AppReviewBackup = {
    enabledAt: new Date().toISOString(),
    profiles: {},
  };

  const nextProfiles = { ...data.profiles };
  for (const key of PROFILE_KEYS) {
    const profile = data.profiles?.[key];
    if (!profile) continue;
    backup.profiles[key] = snapshotEntry(profile);
    nextProfiles[key] = {
      ...profile,
      tabs: stripList(profile.tabs, APP_REVIEW_HIDDEN_TABS) ?? [],
      homeButtons: stripList(profile.homeButtons, APP_REVIEW_HIDDEN_HOME_BUTTONS) ?? [],
      masItems: stripList(profile.masItems, APP_REVIEW_HIDDEN_MAS_ITEMS) ?? [],
    };
  }

  const nextOverrides: OverrideMap = { ...(data.overrides as OverrideMap | undefined ?? {}) };
  const overridesBackup: Record<string, AppReviewBackupEntry> = {};
  for (const [k, ov] of Object.entries(nextOverrides)) {
    if (!ov) continue;
    const snap = snapshotEntry(ov);
    if (entryHasContent(snap)) overridesBackup[k] = snap;
    const updated: OverrideValue = { ...ov };
    if (Array.isArray(ov.tabs)) updated.tabs = stripList(ov.tabs, APP_REVIEW_HIDDEN_TABS);
    if (Array.isArray(ov.homeButtons)) updated.homeButtons = stripList(ov.homeButtons, APP_REVIEW_HIDDEN_HOME_BUTTONS);
    if (Array.isArray(ov.masItems)) updated.masItems = stripList(ov.masItems, APP_REVIEW_HIDDEN_MAS_ITEMS);
    nextOverrides[k] = updated;
  }
  if (Object.keys(overridesBackup).length > 0) backup.overrides = overridesBackup;

  const nextDelegations: DelegationMap = { ...(data.delegations as DelegationMap | undefined ?? {}) };
  const delegationsBackup: Record<string, AppReviewBackupEntry & { override?: AppReviewBackupEntry }> = {};
  for (const [k, d] of Object.entries(nextDelegations)) {
    if (!d || k === '_default') continue;
    const snap = snapshotEntry({
      extraTabs: d.extraTabs,
      extraHomeButtons: d.extraHomeButtons,
      extraMasItems: d.extraMasItems,
    });
    const overrideSnap = d.override ? snapshotEntry(d.override) : undefined;
    if (entryHasContent(snap) || (overrideSnap && entryHasContent(overrideSnap))) {
      delegationsBackup[k] = { ...snap, ...(overrideSnap && entryHasContent(overrideSnap) ? { override: overrideSnap } : {}) };
    }
    const nextD: Delegation = { ...d };
    if (Array.isArray(nextD.extraTabs)) nextD.extraTabs = stripList(nextD.extraTabs, APP_REVIEW_HIDDEN_TABS);
    if (Array.isArray(nextD.extraHomeButtons)) nextD.extraHomeButtons = stripList(nextD.extraHomeButtons, APP_REVIEW_HIDDEN_HOME_BUTTONS);
    if (Array.isArray(nextD.extraMasItems)) nextD.extraMasItems = stripList(nextD.extraMasItems, APP_REVIEW_HIDDEN_MAS_ITEMS);
    if (nextD.override && typeof nextD.override === 'object') {
      const ov: Partial<ProfileBase> = { ...nextD.override };
      if (Array.isArray(ov.tabs)) ov.tabs = stripList(ov.tabs, APP_REVIEW_HIDDEN_TABS);
      if (Array.isArray(ov.homeButtons)) ov.homeButtons = stripList(ov.homeButtons, APP_REVIEW_HIDDEN_HOME_BUTTONS);
      if (Array.isArray(ov.masItems)) ov.masItems = stripList(ov.masItems, APP_REVIEW_HIDDEN_MAS_ITEMS);
      nextD.override = ov;
    }
    nextDelegations[k] = nextD;
  }
  if (Object.keys(delegationsBackup).length > 0) backup.delegations = delegationsBackup;

  return {
    ...data,
    profiles: nextProfiles,
    overrides: nextOverrides,
    delegations: nextDelegations as ProfileConfigData['delegations'],
    global: { ...data.global, appReviewMode: true },
    appReviewBackup: backup,
  };
}

export function disableAppReviewMode(data: ProfileConfigData): ProfileConfigData {
  const backup = data.appReviewBackup;
  const next: ProfileConfigData = {
    ...data,
    global: { ...data.global, appReviewMode: false },
  };
  delete next.appReviewBackup;

  if (!backup) return next;

  const restoredProfiles = { ...next.profiles };
  for (const key of PROFILE_KEYS) {
    const b = backup.profiles?.[key];
    if (!b || !restoredProfiles[key]) continue;
    restoredProfiles[key] = {
      ...restoredProfiles[key],
      ...(b.tabs ? { tabs: b.tabs } : {}),
      ...(b.homeButtons ? { homeButtons: b.homeButtons } : {}),
      ...(b.masItems ? { masItems: b.masItems } : {}),
    };
  }
  next.profiles = restoredProfiles;

  if (backup.overrides) {
    const restoredOverrides: OverrideMap = { ...(next.overrides as OverrideMap | undefined ?? {}) };
    for (const [k, b] of Object.entries(backup.overrides)) {
      if (!restoredOverrides[k]) continue;
      restoredOverrides[k] = {
        ...restoredOverrides[k],
        ...(b.tabs ? { tabs: b.tabs } : {}),
        ...(b.homeButtons ? { homeButtons: b.homeButtons } : {}),
        ...(b.masItems ? { masItems: b.masItems } : {}),
      };
    }
    next.overrides = restoredOverrides;
  }

  if (backup.delegations) {
    const restoredDelegations: DelegationMap = { ...(next.delegations as DelegationMap | undefined ?? {}) };
    for (const [k, b] of Object.entries(backup.delegations)) {
      if (!restoredDelegations[k]) continue;
      const d: Delegation = { ...restoredDelegations[k] };
      if (b.extraTabs) d.extraTabs = b.extraTabs;
      if (b.extraHomeButtons) d.extraHomeButtons = b.extraHomeButtons;
      if (b.extraMasItems) d.extraMasItems = b.extraMasItems;
      if (b.override) {
        const ov = { ...(d.override ?? {}) };
        if (b.override.tabs) ov.tabs = b.override.tabs;
        if (b.override.homeButtons) ov.homeButtons = b.override.homeButtons;
        if (b.override.masItems) ov.masItems = b.override.masItems;
        d.override = ov;
      }
      restoredDelegations[k] = d;
    }
    next.delegations = restoredDelegations as ProfileConfigData['delegations'];
  }

  return next;
}

export function isAppReviewModeActive(data: ProfileConfigData | undefined | null): boolean {
  return !!data?.global?.appReviewMode;
}
