export type ProfileType = 'familia' | 'monitor' | 'miembro';

export interface ProfileBase {
  label: string;
  description: string;
  tabs: string[];
  homeButtons: string[];
  masItems: string[];
  defaultCalendars: string[];
  albumTags: string[];
  notificationTopics: string[];
}

export interface Delegation {
  label: string;
  notificationTopic?: string;
  extraCalendars?: string[];
  extraHomeButtons?: string[];
  extraMasItems?: string[];
  extraAlbumTags?: string[];
  extraTabs?: string[];
  override?: Partial<ProfileBase>;
}

export interface DelegationListItem {
  id: string;
  label: string;
}

export interface GlobalConfig {
  defaultTab: string;
  showNotificationsIcon: boolean;
  showOnboarding: boolean;
  showChangeNameButton: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  minAppVersion: string;
  appReviewMode?: boolean;
}

export type OverrideKey = `${ProfileType}:${string}`;

export interface AppReviewBackupEntry {
  tabs?: string[];
  homeButtons?: string[];
  masItems?: string[];
  extraTabs?: string[];
  extraHomeButtons?: string[];
  extraMasItems?: string[];
}

export interface AppReviewBackup {
  enabledAt: string;
  profiles: Partial<Record<ProfileType, AppReviewBackupEntry>>;
  overrides?: Record<string, AppReviewBackupEntry>;
  delegations?: Record<string, AppReviewBackupEntry & {
    override?: AppReviewBackupEntry;
  }>;
}

export interface ProfileConfigData {
  global: GlobalConfig;
  profiles: Record<ProfileType, ProfileBase>;
  delegations: Record<string, Delegation> & { _default: Delegation };
  delegationList: DelegationListItem[];
  overrides?: Partial<Record<OverrideKey, Partial<ProfileBase>>>;
  appReviewBackup?: AppReviewBackup;
}

export interface ProfileConfigDocument {
  updatedAt: string;
  data: ProfileConfigData;
}
