'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { emptyStyle } from '@/lib/reel';
import { useStore } from '@/lib/store';
import { TextTab } from './text-tab';
import { BackgroundTab } from './background-tab';
import { AnimationTab } from './animation-tab';
import { EffectsTab } from './effects-tab';
import { VisualPresetPicker } from './visual-preset-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Type, Image, Sparkles, Wand2, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const tabMeta = [
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'background', label: 'Fondo', icon: Image },
  { id: 'animation', label: 'Animación', icon: Sparkles },
  { id: 'effects', label: 'Efectos', icon: Wand2 },
] as const;

interface PropertiesPanelProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PropertiesPanel({ mobileOpen = false, onMobileClose }: PropertiesPanelProps) {
  const { activeTab, updateSettings } = useStore();
  const [width, setWidth] = useState(576);
  const [maxWidth, setMaxWidth] = useState(960);
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    const maximum = () => Math.max(288, window.innerWidth - 480);
    const updateMaximum = () => { setMaxWidth(maximum()); setWidth(current => Math.min(current, maximum())); };
    try { const saved = Number(localStorage.getItem('sonceibe-panel-width')); if (saved >= 288 && saved <= 1200) setWidth(Math.min(saved, maximum())); } catch {}
    updateMaximum();
    window.addEventListener('resize', updateMaximum);
    return () => window.removeEventListener('resize', updateMaximum);
  }, []);
  const resize = (value: number) => {
    const next = Math.round(Math.max(288, Math.min(value, window.innerWidth - 480)));
    setWidth(next);
    try { localStorage.setItem('sonceibe-panel-width', String(next)); } catch {}
  };
  const resizeHandle = <div role="separator" aria-label="Ajustar anchura del panel" aria-orientation="vertical" aria-valuemin={288} aria-valuemax={maxWidth} aria-valuenow={width} tabIndex={0}
    className="studio-panel-resizer absolute -left-1.5 inset-y-0 z-20 w-3 cursor-col-resize touch-none bg-transparent hover:bg-primary/25 focus:bg-primary/25"
    title="Arrastra para ajustar el panel. Flechas para ajustar; doble clic para ampliar."
    onDoubleClick={() => resize(width < 570 ? 576 : 288)}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); resize(width + (e.key === 'ArrowLeft' ? 32 : -32)); } }}
    onPointerDown={e => { e.currentTarget.focus(); drag.current = { x: e.clientX, width: e.currentTarget.parentElement?.getBoundingClientRect().width ?? width }; e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
    onPointerMove={e => { if (drag.current) resize(drag.current.width + drag.current.x - e.clientX); }}
    onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { drag.current = null; }}
  ><span className="absolute left-1 top-1/2 h-10 w-1 rounded bg-muted-foreground/40" /></div>;
  const panelStyle = { '--studio-panel-width': width + 'px' } as CSSProperties;

  if (activeTab === 'lyrics') {
    return (
      <aside
        style={panelStyle}
        className={cn(
          'studio-properties-panel studio-adjustable-panel relative shrink-0 border-l border-border bg-card/30 flex flex-col',
          mobileOpen && 'studio-mobile-open'
        )}
      >
        {resizeHandle}
        <div className="h-10 flex items-center justify-between px-4 border-b border-border">
          <span className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Editor de Letra
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="studio-mobile-panel-close hidden h-7 w-7"
            onClick={onMobileClose}
            aria-label="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            El editor de letra se muestra en el centro. Usa la barra lateral
            para volver a las propiedades.
          </p>
        </div>
      </aside>
    );
  }

  const meta = tabMeta.find((t) => t.id === activeTab) ?? tabMeta[0];
  const Icon = meta.icon;

  return (
    <aside
        style={panelStyle}
      className={cn(
        'studio-properties-panel studio-adjustable-panel relative shrink-0 border-l border-border bg-card/30 flex flex-col',
        mobileOpen && 'studio-mobile-open'
      )}
    >
      {resizeHandle}
      <div className="h-10 flex items-center justify-between gap-2 px-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">{meta.label}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="studio-mobile-panel-close hidden h-7 w-7 shrink-0"
          onClick={onMobileClose}
          aria-label="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea key={activeTab} className="flex-1 min-h-0">
        <div className="p-4">
          <Button variant="outline" size="sm" className="mb-3 w-full" onClick={() => updateSettings(emptyStyle())}>Sin estilo · fondo vacío</Button>
          <details className="mb-4 rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Estilos preparados · elegir o cambiar</summary><div className="pt-3"><VisualPresetPicker /></div></details>
          {activeTab === 'text' && <TextTab />}
          {activeTab === 'background' && <BackgroundTab />}
          {activeTab === 'animation' && <AnimationTab />}
          {activeTab === 'effects' && <EffectsTab />}
        </div>
      </ScrollArea>
    </aside>
  );
}
