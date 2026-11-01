'use client';

import { FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Menu, Pencil, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioAccount } from '@/lib/studio-user-context';
import { studioPath } from '@/lib/studio-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AccountMenu({ compact = false, mobileMenu = false, projectActions }: { compact?: boolean; mobileMenu?: boolean; projectActions?: ReactNode }) {
  const { account, setName } = useStudioAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!mobileMenu || !menuOpen) return;
    const back = (event: Event) => { event.preventDefault(); setMenuOpen(false); };
    window.addEventListener('sonceibe:mobile-back-overlay', back);
    return () => window.removeEventListener('sonceibe:mobile-back-overlay', back);
  }, [mobileMenu, menuOpen]);
  const [dialog, setDialog] = useState<'name' | 'password' | null>(null);
  const [name, setDraftName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const id = useId();
  const displayName = account.name || account.email || 'Mi cuenta';

  function clearSecrets() { setCurrentPassword(''); setPassword(''); setRepeat(''); }
  function open(value: 'name' | 'password') {
    setDraftName(account.name); clearSecrets(); setError(''); setMessage(''); setDialog(value);
  }
  function close() { if (!busy) { setDialog(null); clearSecrets(); setError(''); setMessage(''); } }
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch(studioPath('/api/studio-auth/logout'), { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.replace(studioPath('/access'));
    } catch { toast.error('No se pudo cerrar la sesión. Vuelve a intentarlo.'); setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (dialog === 'password' && password !== repeat) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      const response = await fetch(studioPath(`/api/studio-auth/${dialog === 'name' ? 'update-name' : 'change-password'}`), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dialog === 'name' ? { name: name.trim() } : { currentPassword, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) { setError(result.error || 'No se pudo guardar el cambio.'); return; }
      if (dialog === 'name') setName(result.name);
      clearSecrets(); setMessage(result.message);
    } catch { setError('No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }

  return <>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={mobileMenu ? 'icon' : 'sm'} disabled={busy} className={mobileMenu ? 'h-11 w-11 shrink-0' : 'max-w-[200px] gap-2'} aria-label={mobileMenu ? 'Menú del proyecto' : `Cuenta: ${displayName}`}>
          {mobileMenu ? <Menu className="h-5 w-5" /> : <>
          <UserRound className="h-4 w-4 shrink-0" />
          <span className={compact ? 'max-w-[90px] truncate text-xs' : 'max-w-[140px] truncate'}>{displayName}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
          </>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto">
        {projectActions}
        <DropdownMenuLabel className="space-y-1">
          <p className="break-words">{account.name || 'Mi cuenta'}</p>
          <p className="break-all text-xs font-normal text-muted-foreground">{account.email || 'Cuenta de Studio'}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => open('name')} className="min-h-[44px] gap-2"><Pencil className="h-4 w-4" />Cambiar nombre</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => open('password')} className="min-h-[44px] gap-2"><KeyRound className="h-4 w-4" />Cambiar contraseña</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} className="min-h-[44px] gap-2"><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={dialog !== null} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-md" onInteractOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{dialog === 'name' ? 'Cambiar nombre' : 'Cambiar contraseña'}</DialogTitle>
          <DialogDescription>{dialog === 'name' ? 'Este es el nombre que aparece en tu cuenta de Studio.' : 'Introduce tu contraseña actual y elige una nueva de al menos 8 caracteres.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {dialog === 'name' ? <div className="space-y-2"><label htmlFor={`${id}-name`}>Nombre de la cuenta</label><Input id={`${id}-name`} autoComplete="nickname" value={name} onChange={event => setDraftName(event.target.value)} required maxLength={80} disabled={busy} /></div> : <>
            <input type="text" autoComplete="username" value={account.email} readOnly hidden />
            <div className="space-y-2"><label htmlFor={`${id}-current`}>Contraseña actual</label><Input id={`${id}-current`} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required maxLength={128} disabled={busy} /></div>
            <div className="space-y-2"><label htmlFor={`${id}-new`}>Nueva contraseña</label><Input id={`${id}-new`} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} maxLength={128} disabled={busy} /></div>
            <div className="space-y-2"><label htmlFor={`${id}-repeat`}>Repite la nueva contraseña</label><Input id={`${id}-repeat`} type="password" autoComplete="new-password" value={repeat} onChange={event => setRepeat(event.target.value)} required minLength={8} maxLength={128} disabled={busy} /></div>
          </>}
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>Cerrar</Button>
            <Button type="submit" disabled={busy || (dialog === 'name' && !name.trim())}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
