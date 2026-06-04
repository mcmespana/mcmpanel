const COOKIE_NAME = '__mcms';
const COOKIE_DAYS = 30;

// SHA-256 of the secret — plaintext never stored here
const _H = '4f682b71153ffa91e608445d7ea1257e2076d0d95eab6336cd1aa94b49680f11';
// Session token: derived value used as cookie payload
const _T =
  '4f682b71153ffa91e608445d7ea1257e2076d0d95eab6336cd1aa94b49680f11' +
  '5a8c3e2d1f4b7a9c6e3d0f8b5a2c9e6d3f0b8a5c2e9f6d3a0c7e4b1f8a5c2e9';

async function digest(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyCode(input: string): Promise<boolean> {
  const h = await digest(input.trim().toLowerCase());
  return h === _H;
}

export function isAuthenticated(): boolean {
  return document.cookie
    .split(';')
    .some((c) => c.trim() === `${COOKIE_NAME}=${_T}`);
}

export function setSession(): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_DAYS);
  document.cookie = `${COOKIE_NAME}=${_T}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
}

export function clearSession(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}
