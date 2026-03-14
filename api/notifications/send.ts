import type { VercelRequest, VercelResponse } from '@vercel/node';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  sound?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages } = req.body as { messages: ExpoPushMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    const chunks = chunkArray(messages, CHUNK_SIZE);
    const allTickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const response = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Expo Push API error ${response.status}: ${text}`);
      }

      const result = await response.json() as { data: ExpoPushTicket[] };
      allTickets.push(...result.data);
    }

    res.json({ tickets: allTickets });
  } catch (error) {
    console.error('Expo Push proxy error:', error);
    res.status(500).json({ error: 'Failed to send via Expo Push API', details: String(error) });
  }
}
