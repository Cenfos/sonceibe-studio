'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SonCeibe Studio runtime error:', error);
  }, [error]);

  const resetLocalProjectData = () => {
    try {
      localStorage.removeItem('sonceibe-projects-v1');
    } finally {
      window.location.reload();
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Se produjo un error</h1>
            <p className="text-sm text-muted-foreground">La aplicación no se ha cerrado por completo.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Prueba primero a continuar. Si un ajuste antiguo o inválido impide abrir el proyecto,
          puedes restablecer los datos locales y volver a empezar.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={reset} className="gap-2 flex-1">
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </Button>
          <Button variant="outline" onClick={resetLocalProjectData} className="gap-2 flex-1">
            <Trash2 className="h-4 w-4" />
            Restablecer datos locales
          </Button>
        </div>
      </div>
    </main>
  );
}
