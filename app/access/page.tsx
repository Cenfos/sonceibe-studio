'use client';

import { FormEvent, useState } from 'react';
import { LockKeyhole, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AccessPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/studio-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || 'No se pudo validar el código de acceso.');
        return;
      }
      window.location.replace('/');
    } catch {
      setError('No se pudo conectar con el servicio de acceso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <Music2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">SonCeibe Studio</h1>
            <p className="text-sm text-muted-foreground">Acceso privado</p>
          </div>
        </div>

        <div className="rounded-xl bg-secondary/30 border border-border p-4 mb-5 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <LockKeyhole className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Introduce uno de los códigos de acceso autorizados para abrir el editor.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="studio-code" className="text-sm font-medium">Código de acceso</label>
            <Input
              id="studio-code"
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Introduce tu código"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!code.trim() || loading}>
            {loading ? 'Comprobando…' : 'Entrar en Studio'}
          </Button>
        </form>
      </div>
    </main>
  );
}
