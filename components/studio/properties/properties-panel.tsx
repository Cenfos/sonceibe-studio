'use client';

import { useStore } from '@/lib/store';
import { TextTab } from './text-tab';
import { BackgroundTab } from './background-tab';
import { AnimationTab } from './animation-tab';
import { EffectsTab } from './effects-tab';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Type, Image, Sparkles, Wand2, FileText } from 'lucide-react';

const tabMeta = [
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'background', label: 'Fondo', icon: Image },
  { id: 'animation', label: 'Animación', icon: Sparkles },
  { id: 'effects', label: 'Efectos', icon: Wand2 },
] as const;

export function PropertiesPanel() {
  const { activeTab } = useStore();

  // Lyrics tab is handled in the center area, so properties panel shows nothing or a hint
  if (activeTab === 'lyrics') {
    return (
      <aside className="w-72 shrink-0 border-l border-border bg-card/30 flex flex-col">
        <div className="h-10 flex items-center px-4 border-b border-border">
          <span className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Editor de Letra
          </span>
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
    <aside className="w-72 shrink-0 border-l border-border bg-card/30 flex flex-col">
      <div className="h-10 flex items-center gap-2 px-4 border-b border-border">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{meta.label}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'text' && <TextTab />}
          {activeTab === 'background' && <BackgroundTab />}
          {activeTab === 'animation' && <AnimationTab />}
          {activeTab === 'effects' && <EffectsTab />}
        </div>
      </ScrollArea>
    </aside>
  );
}
