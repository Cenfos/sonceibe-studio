import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, authClient, isStudioAccessConfigured, setAuthCookies } from './studio-auth-server';

const headers = { 'Cache-Control': 'private, no-store' };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });
export async function handleAuth(request: Request, action: string) {
  if (!['login', 'signup', 'recover', 'confirm', 'update-password', 'logout'].includes(action)) return reply({ error: 'Acción desconocida.' }, 404);
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || '');
    sameOrigin = parsed.origin === origin && parsed.host === host && ['http:', 'https:'].includes(parsed.protocol);
  } catch { /* Missing and malformed origins fail closed. */ }
  if (!sameOrigin) return reply({ error: 'Origen no permitido.' }, 403);
  if (!isStudioAccessConfigured()) return reply({ error: 'El registro todavía no está disponible. Vuelve a intentarlo más tarde.' }, 503);
  try {
    const client = authClient();
    if (action === 'logout') {
      const access = (await cookies()).get(ACCESS_COOKIE)?.value;
      if (access) await client.auth.admin.signOut(access, 'local');
      const response = reply({ ok: true });
      setAuthCookies(response, null);
      return response;
    }
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (['login', 'signup', 'recover'].includes(action) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return reply({ error: 'Introduce un correo válido.' }, 400);
    if (['signup', 'update-password'].includes(action) && (password.length < 8 || password.length > 128)) return reply({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' }, 400);
    if (action === 'signup' && (!name || name.length > 80)) return reply({ error: 'El nombre debe tener entre 1 y 80 caracteres.' }, 400);
    if (action === 'signup') {
      const { error } = await client.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return providerError(error.status);
      return reply({ ok: true, message: 'Revisa tu correo para confirmar tu cuenta. Si ya tienes cuenta, puedes entrar o recuperar tu contraseña.' });
    }
    if (action === 'recover') {
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error?.status === 429) return providerError(429);
      if (error && error.status !== 400) return providerError(error.status);
      return reply({ ok: true, message: 'Si existe una cuenta con ese correo, recibirás un enlace para elegir una nueva contraseña.' });
    }
    if (action === 'confirm') {
      if (!['email', 'recovery'].includes(body.type) || typeof body.token_hash !== 'string' || !body.token_hash) return reply({ error: 'El enlace no es válido.' }, 400);
      const { data, error } = await client.auth.verifyOtp({ token_hash: body.token_hash, type: body.type });
      if (error || !data.session || !data.user?.email_confirmed_at) return reply({ error: 'El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo.' }, 400);
      const response = reply({ ok: true, recovery: body.type === 'recovery' });
      setAuthCookies(response, data.session);
      return response;
    }
    if (action === 'update-password') {
      const access = (await cookies()).get(ACCESS_COOKIE)?.value;
      if (!access) return reply({ error: 'Solicita un nuevo enlace de recuperación.' }, 401);
      const { data } = await client.auth.getUser(access);
      if (!data.user?.email_confirmed_at) return reply({ error: 'Solicita un nuevo enlace de recuperación.' }, 401);
      // Authorization is the user's token; never a service-role key.
      const refresh = (await cookies()).get(REFRESH_COOKIE)?.value;
      if (!refresh) return reply({ error: 'Solicita un nuevo enlace de recuperación.' }, 401);
      const { error: sessionError } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (sessionError) return reply({ error: 'Solicita un nuevo enlace de recuperación.' }, 401);
      const { error } = await client.auth.updateUser({ password });
      if (error) return providerError(error.status);
      await client.auth.admin.signOut(access, 'global');
      const response = reply({ ok: true, message: 'Contraseña actualizada. Ya puedes entrar con tu nueva contraseña.' });
      setAuthCookies(response, null);
      return response;
    }
    if (!password || password.length > 128) return reply({ error: 'Introduce tu contraseña.' }, 400);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user?.email_confirmed_at) {
      if (error?.status === 429) return providerError(429);
      return reply({ error: 'No se pudo entrar. Comprueba tu correo, tu contraseña y que hayas confirmado la cuenta.' }, 401);
    }
    const response = reply({ ok: true, userId: data.user.id });
    setAuthCookies(response, data.session);
    return response;
  } catch {
    return reply({ error: 'No se pudo completar la solicitud. Vuelve a intentarlo.' }, 400);
  }
}
function providerError(status?: number) {
  return reply({ error: status === 429 ? 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' : 'No se pudo completar la solicitud. Comprueba los datos o inténtalo más tarde.' }, status === 429 ? 429 : 400);
}

