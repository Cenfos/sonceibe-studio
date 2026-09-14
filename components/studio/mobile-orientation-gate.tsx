'use client';

import { Smartphone, RotateCcw } from 'lucide-react';

export function MobileOrientationGate() {
  return (
    <div className="studio-mobile-landscape-gate fixed inset-0 z-[100] hidden flex-col items-center justify-center bg-background px-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Smartphone className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Pon el móvil en vertical</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        La versión móvil de SonCeibe Studio está diseñada como un asistente sencillo en vertical.
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCcw className="h-4 w-4" />
        <span>Gira el teléfono a vertical para continuar</span>
      </div>
    </div>
  );
}
