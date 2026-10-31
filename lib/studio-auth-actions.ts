import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, authClient, isStudioAccessConfigured, setAuthCookies } from './studio-auth-server';
import { STUDIO_PUBLIC_ORIGIN } from './studio-paths';

const headers = { 'Cache-Control': 'private, no-store' };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });
type ProviderFailure = { status?: number; code?: string };
function diagnostic(action: string, failure: ProviderFailure, fallback = 'unknown') {
  const reference = crypto.randomUUID().slice(0, 8);
  // Deliberately exclude email, password, user IDs, tokens and provider messages.
  console.warn('studio_auth_failure', JSON.stringify({ action, code: failure.code || fallback, status: failure.status, reference }));
  return reference;
}
export async function handleAuth(request: Request, action: string) {
  if (!['login', 'signup', 'recover', 'confirm', 'complete-session', 'update-password', 'update-name', 'change-password', 'logout'].includes(action)) return reply({ error: 'Acción desconocida.' }, 404);
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || '');
    sameOrigin = parsed.origin === origin && (parsed.host === host || origin === STUDIO_PUBLIC_ORIGIN) && ['http:', 'https:'].includes(parsed.protocol);
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
    if (action === 'update-name' || action === 'change-password') {
      const cookieStore = await cookies();
      const access = cookieStore.get(ACCESS_COOKIE)?.value;
      if (!access) return reply({ error: 'Tu sesión ha caducado. Recarga Studio para volver a comprobarla.' }, 401);
      const verified = await client.auth.getUser(access);
      const user = verified.data.user;
      if (verified.error || !user?.email_confirmed_at) return reply({ error: 'Tu sesión ha caducado. Recarga Studio para volver a comprobarla.' }, 401);
      if (action === 'change-password') {
        const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        if (!currentPassword || currentPassword.length > 128) return reply({ error: 'Introduce tu contraseña actual.' }, 400);
        if (password.length < 8 || password.length > 128) return reply({ error: 'La nueva contraseña debe tener entre 8 y 128 caracteres.' }, 400);
        if (password === currentPassword) return reply({ error: 'Elige una contraseña distinta de la actual.' }, 400);
        // Reauthenticate using the verified account's email, never a client-supplied identity.
        const reauthenticated = await client.auth.signInWithPassword({ email: user.email!, password: currentPassword });
        if (reauthenticated.error || reauthenticated.data.user?.id !== user.id || !reauthenticated.data.session) {
          if (reauthenticated.error?.status === 429) return providerError(reauthenticated.error, action);
          return reply({ error: 'La contraseña actual no es correcta. No se ha cambiado tu contraseña.' }, 400);
        }
        const updated = await client.auth.updateUser({ password });
        if (updated.error) return providerError(updated.error, action);
        const response = reply({ ok: true, message: 'Contraseña actualizada. Tu sesión sigue abierta.' });
        setAuthCookies(response, reauthenticated.data.session);
        return response;
      }
      if (!name || name.length > 80) return reply({ error: 'El nombre debe tener entre 1 y 80 caracteres.' }, 400);
      const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
      if (!refresh) return reply({ error: 'Tu sesión ha caducado. Recarga Studio para volver a comprobarla.' }, 401);
      const scoped = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (scoped.error || !scoped.data.session || scoped.data.user?.id !== user.id) return reply({ error: 'No se pudo comprobar tu sesión. Recarga Studio.' }, 401);
      const updated = await client.auth.updateUser({ data: { name } });
      if (updated.error) return providerError(updated.error, action);
      const response = reply({ ok: true, name, message: 'Nombre actualizado.' });
      setAuthCookies(response, scoped.data.session);
      return response;
    }
    if (action === 'complete-session') {
      if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16384 ||
          typeof body.refresh_token !== 'string' || !body.refresh_token || body.refresh_token.length > 4096) {
        return reply({ error: 'El enlace está incompleto. Solicita un nuevo correo.' }, 400);
      }
      // Standard Supabase email links return tokens in a browser-only fragment.
      // Validate them with the provider before creating any server cookies.
      const { data, error } = await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
      if (error || !data.session) {
        const reference = diagnostic(action, error || {}, 'invalid_email_session');
        return reply({ error: `El enlace ha caducado o ya no es válido. Solicita uno nuevo. Referencia: ${reference}.` }, 401);
      }
      const verified = await client.auth.getUser(data.session.access_token);
      if (verified.error || !verified.data.user?.email_confirmed_at) return reply({ error: 'No se pudo confirmar la cuenta. Solicita un nuevo enlace.' }, 401);
      const response = reply({ ok: true, recovery: body.type === 'recovery' });
      setAuthCookies(response, data.session);
      return response;
    }
    if (['login', 'signup', 'recover'].includes(action) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return reply({ error: 'Introduce un correo válido.' }, 400);
    if (['signup', 'update-password'].includes(action) && (password.length < 8 || password.length > 128)) return reply({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' }, 400);
    if (action === 'signup' && (!name || name.length > 80)) return reply({ error: 'El nombre debe tener entre 1 y 80 caracteres.' }, 400);
    if (action === 'signup') {
      const { error } = await client.auth.signUp({ email, password, options: { data: { name } } });
      if (error) return providerError(error, action);
      return reply({ ok: true, message: 'Revisa tu correo para confirmar tu cuenta. Si ya tienes cuenta, puedes entrar o recuperar tu contraseña.' });
    }
    if (action === 'recover') {
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error?.status === 429) return providerError(error, action);
      if (error && error.status !== 400) return providerError(error, action);
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
      if (error) return providerError(error, action);
      await client.auth.admin.signOut(access, 'global');
      const response = reply({ ok: true, message: 'Contraseña actualizada. Ya puedes entrar con tu nueva contraseña.' });
      setAuthCookies(response, null);
      return response;
    }
    if (!password || password.length > 128) return reply({ error: 'Introduce tu contraseña.' }, 400);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user?.email_confirmed_at) {
      if (error?.status === 429) return providerError(error, action);
      const reference = diagnostic(action, error || {}, !data.session ? 'missing_session' : 'email_unconfirmed');
      const message = error?.code === 'email_not_confirmed'
        ? 'Debes confirmar tu correo antes de entrar.'
        : 'No se pudo entrar. Comprueba tu correo y la última contraseña que elegiste.';
      return reply({ error: `${message} Referencia: ${reference}.` }, 401);
    }
    const response = reply({ ok: true, userId: data.user.id });
    setAuthCookies(response, data.session);
    return response;
  } catch {
    return reply({ error: 'No se pudo completar la solicitud. Vuelve a intentarlo.' }, 400);
  }
}
function providerError(failure: ProviderFailure, action: string) {
  const reference = diagnostic(action, failure);
  const message = failure.status === 429 ? 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' : 'No se pudo completar la solicitud. Comprueba los datos o inténtalo más tarde.';
  return reply({ error: `${message} Referencia: ${reference}.` }, failure.status === 429 ? 429 : 400);
}

