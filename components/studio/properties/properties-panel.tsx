'use client';

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
  const { activeTab } = useStore();

  if (activeTab === 'lyrics') {
    return (
      <aside
        className={cn(
          'studio-properties-panel w-72 shrink-0 border-l border-border bg-card/30 flex flex-col',
          mobileOpen && 'studio-mobile-open'
        )}
      >
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
      className={cn(
        'studio-properties-panel w-72 shrink-0 border-l border-border bg-card/30 flex flex-col',
        mobileOpen && 'studio-mobile-open'
      )}
    >
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
      <ScrollArea className="flex-1">
        <div className="p-4">
          <VisualPresetPicker />
          {activeTab === 'text' && <TextTab />}
          {activeTab === 'background' && <BackgroundTab />}
          {activeTab === 'animation' && <AnimationTab />}
          {activeTab === 'effects' && <EffectsTab />}
        </div>
      </ScrollArea>
    </aside>
  );
}
