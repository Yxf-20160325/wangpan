/**
 * 会话令牌：HMAC-SHA256 签名的无状态 token。
 * 只依赖 Web Crypto，edge middleware 与 Node 运行时都能用。
 */
const SECRET = process.env.ADMIN_SECRET || 'netdisk-local-secret-2026';
export const SESSION_COOKIE = 'nd_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
      'verify',
    ]);
  }
  return keyPromise;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return toB64Url(new Uint8Array(sig));
}

export async function createToken(username: string, sessionId: string): Promise<string> {
  const payload = toB64Url(
    enc.encode(JSON.stringify({ u: username, sid: sessionId, exp: Date.now() + SESSION_TTL_MS })),
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<{ u: string; sid: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const key = await getKey();
    const sigBytes = fromB64Url(sig) as unknown as BufferSource;
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
    if (!ok) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4));
    const data = JSON.parse(decoded) as { u?: string; sid?: string; exp?: number };
    if (!data.u || !data.sid || !data.exp || Date.now() > data.exp) return null;
    return { u: data.u, sid: data.sid };
  } catch {
    return null;
  }
}
