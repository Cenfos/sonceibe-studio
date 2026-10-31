'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'signup' | 'recover' | 'confirm' | 'update';
const titles: Record<Mode, string> = { login: 'Entra en tu Studio', signup: 'Crea tu cuenta', recover: 'Recupera tu contraseña', confirm: 'Confirma tu correo', update: 'Elige una nueva contraseña' };

export default function AccessForm({ initialToken, initialType, initialMode, destination }: { initialToken: string; initialType: string; initialMode: Mode; destination: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(initialToken);
  const tokenType = initialType;
  const next = destination;

  useEffect(() => {
    if (initialToken) window.history.replaceState(null, '', '/access');
  }, [initialToken]);

  function changeMode(value: Mode) {
    setMode(value); setError(''); setMessage(''); setPassword(''); setRepeat('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(''); setMessage('');
    if ((mode === 'signup' || mode === 'update') && password !== repeat) {
      setError('Las contraseñas no coinciden.'); return;
    }
    setLoading(true);
    const action = { login: 'login', signup: 'signup', recover: 'recover', confirm: 'confirm', update: 'update-password' }[mode];
    try {
      const response = await fetch(`/api/studio-auth/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password, token_hash: token, type: tokenType }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) { setError(data.error || 'No se pudo completar la solicitud.'); return; }
      setPassword(''); setRepeat('');
      if (mode === 'login' || (mode === 'confirm' && !data.recovery)) { window.location.replace(next); return; }
      if (mode === 'confirm') { setToken(''); setMode('update'); window.history.replaceState(null, '', '/access?mode=update'); return; }
      if (mode === 'update') { setMode('login'); window.history.replaceState(null, '', '/access'); }
      setMessage(data.message);
    } catch { setError('No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.'); }
    finally { setLoading(false); }
  }

  const needsPassword = mode === 'login' || mode === 'signup' || mode === 'update';
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center"><Music2 className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">SonCeibe Studio</p><h1 className="text-xl font-semibold">{titles[mode]}</h1></div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          {mode === 'signup' ? 'Tu espacio para crear. Elige el nombre que quieras y verifica tu correo para empezar.' :
           mode === 'recover' ? 'Te enviaremos un enlace a tu correo para elegir una nueva contraseña.' :
           mode === 'confirm' ? tokenType === 'recovery' ? 'Continúa para elegir tu nueva contraseña.' : 'Confirma tu dirección de correo para abrir Studio.' :
           mode === 'update' ? 'Usa al menos 8 caracteres para proteger tu cuenta.' : 'Accede con tu correo y tu contraseña.'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && <div className="space-y-2"><label htmlFor="name">Nombre</label><Input id="name" autoComplete="nickname" maxLength={80} required value={name} onChange={e => setName(e.target.value)} disabled={loading} /></div>}
          {['login', 'signup', 'recover'].includes(mode) && <div className="space-y-2"><label htmlFor="email">Correo electrónico</label><Input id="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} /></div>}
          {needsPassword && <div className="space-y-2"><label htmlFor="password">{mode === 'update' ? 'Nueva contraseña' : 'Contraseña'}</label><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} /></div>}
          {(mode === 'signup' || mode === 'update') && <div className="space-y-2"><label htmlFor="repeat">Repite la contraseña</label><Input id="repeat" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={repeat} onChange={e => setRepeat(e.target.value)} disabled={loading} /></div>}
          {error && <p role="alert" className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">{error}</p>}
          {message && <p role="status" className="text-sm rounded-lg border border-border bg-secondary/30 px-3 py-2">{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Un momento…' : { login: 'Entrar en Studio', signup: 'Crear cuenta', recover: 'Enviar enlace de recuperación', confirm: tokenType === 'recovery' ? 'Continuar' : 'Confirmar y entrar', update: 'Guardar nueva contraseña' }[mode]}</Button>
        </form>
        <div className="flex flex-col items-center gap-3 mt-5 text-sm">
          {mode === 'login' && <><button type="button" disabled={loading} className="text-primary hover:underline" onClick={() => changeMode('recover')}>He olvidado mi contraseña</button><button type="button" disabled={loading} className="hover:underline" onClick={() => changeMode('signup')}>¿Aún no tienes cuenta? Crear cuenta</button></>}
          {mode !== 'login' && <button type="button" disabled={loading} className="text-primary hover:underline" onClick={() => changeMode('login')}>Volver a entrar</button>}
          {mode === 'confirm' && <button type="button" disabled={loading} className="hover:underline" onClick={() => changeMode(tokenType === 'recovery' ? 'recover' : 'signup')}>Solicitar otro correo</button>}
        </div>
      </div>
    </main>
  );
}

