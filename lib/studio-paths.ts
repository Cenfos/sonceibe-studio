export const STUDIO_BASE_PATH = '/studio';
export const SONCEIBE_HOME = 'https://sonceibe.es';
export const STUDIO_PUBLIC_ORIGIN = 'https://www.sonceibe.es';

export function studioPath(path = ''): string {
  if (path === STUDIO_BASE_PATH || path.startsWith(`${STUDIO_BASE_PATH}/`)) return path;
  return `${STUDIO_BASE_PATH}${path === '/' ? '' : path}`;
}

export function studioRequestOrigin(request: Request): string {
  // External rewrites may keep the upstream URL while forwarding the public host.
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  if (host === 'www.sonceibe.es' || host === 'sonceibe.es') return STUDIO_PUBLIC_ORIGIN;
  return new URL(request.url).origin;
}
