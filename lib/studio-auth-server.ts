import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const STUDIO_SESSION_COOKIE = 'sonceibe-studio-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  u: string;
  e: number;
};

function rawAccessCodes(): string {
  return process.env.STUDIO_ACCESS_CODES?.trim() ?? '';
}

export function isStudioAccessConfigured(): boolean {
  return rawAccessCodes().length > 0;
}

function parseAccessCodes(): Array<{ userId: string; code: string }> {
  const entries = rawAccessCodes()
    .split(/[;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries
    .map((entry, index) => {
      const separator = entry.indexOf('=');

      // Simple setup: a single bare code is treated as the owner's code.
      // This keeps the first-time Vercel configuration intentionally easy.
      if (separator === -1) {
        return {
          userId: index === 0 ? 'owner' : `user-${index + 1}`,
          code: entry,
        };
      }

      if (separator <= 0) return null;
      const userId = entry.slice(0, separator).trim();
      const code = entry.slice(separator + 1).trim();
      if (!userId || !code) return null;
      return { userId, code };
    })
    .filter((entry): entry is { userId: string; code: string } => Boolean(entry));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function userForAccessCode(candidate: string): string | null {
  const candidateDigest = digest(candidate.trim());

  for (const entry of parseAccessCodes()) {
    const storedDigest = digest(entry.code);
    if (timingSafeEqual(candidateDigest, storedDigest)) return entry.userId;
  }

  return null;
}

function sessionKey(): Buffer {
  return digest(`sonceibe-studio:${rawAccessCodes()}`);
}

function sign(value: string): string {
  return createHmac('sha256', sessionKey()).update(value).digest('base64url');
}

export function createStudioSession(userId: string): string {
  const payload: SessionPayload = {
    u: userId,
    e: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function readStudioSession(token: string | undefined): SessionPayload | null {
  if (!token || !isStudioAccessConfigured()) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.u || !payload.e || payload.e < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const studioSessionMaxAge = SESSION_TTL_SECONDS;
