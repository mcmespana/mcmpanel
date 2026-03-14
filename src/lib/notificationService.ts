const API_BASE = '/api/notifications';

export interface ActionButton {
  text: string;
  url: string;
}

export interface SendNotificationRequest {
  title: string;
  body: string;
  category: string;
  priority: 'default' | 'normal' | 'high';
  icon?: string;
  imageUrl?: string;
  internalRoute?: string;
  actionButtons?: ActionButton[];
  recipientType?: string;
  delegacion?: string;
}

export interface SendNotificationResponse {
  notificationId: string;
  status: string;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokensCleaned: number;
  sentAt: string;
  message?: string;
}

export interface NotificationStats {
  devices: {
    total: number;
    active24h: number;
    active7d: number;
    platforms: Record<string, number>;
  };
  notifications: {
    total: number;
    sent: number;
  };
}

export interface NotificationRecord {
  notificationId: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  icon: string | null;
  imageUrl: string | null;
  internalRoute: string | null;
  actionButtons: ActionButton[];
  recipientType: string | null;
  delegacion: string | null;
  status: string;
  createdAt: string;
  sentAt: string | null;
  totalTokens: number;
  sentCount: number;
  failedCount: number;
  invalidTokens: number;
}

export async function sendNotification(data: SendNotificationRequest): Promise<SendNotificationResponse> {
  const res = await fetch(`${API_BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const res = await fetch(`${API_BASE}/stats`);

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return res.json();
}
