'use client';

import { Smartphone, RotateCcw } from 'lucide-react';

export function MobileOrientationGate() {
  return (
    <div className="studio-mobile-portrait-gate fixed inset-0 z-[100] hidden flex-col items-center justify-center bg-background px-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Smartphone className="h-10 w-10 text-primary rotate-90" />
      </div>
      <h2 className="text-xl font-semibold">Gira el móvil</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        SonCeibe Studio está optimizado para editar en horizontal. Así tendrás más espacio para la vista previa, la letra, las fotos y la línea de tiempo.
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCcw className="h-4 w-4" />
        <span>Coloca el teléfono en horizontal para continuar</span>
      </div>
    </div>
  );
}
