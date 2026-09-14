'use client';

import {
  Type,
  Image,
  Sparkles,
  Wand2,
  FileText,
  Music,
  Film,
  Layers,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'background', label: 'Fondo', icon: Image },
  { id: 'animation', label: 'Animación', icon: Sparkles },
  { id: 'effects', label: 'Efectos', icon: Wand2 },
  { id: 'lyrics', label: 'Letra', icon: FileText },
] as const;

type StudioTabId = (typeof tabs)[number]['id'];

interface SidebarRailProps {
  onTabSelected?: (tab: StudioTabId) => void;
}

export function SidebarRail({ onTabSelected }: SidebarRailProps) {
  const { activeTab, setTab } = useStore();

  return (
    <aside className="studio-sidebar w-16 shrink-0 flex flex-col items-center py-3 gap-1 border-r border-border bg-card/30">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setTab(tab.id);
              onTabSelected?.(tab.id);
            }}
            className={cn(
              'studio-sidebar-tab group relative flex flex-col items-center justify-center gap-1 w-12 h-14 rounded-lg transition-all',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={tab.label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {active && (
              <span className="studio-active-indicator absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-primary" />
            )}
          </button>
        );
      })}

      <div className="studio-mobile-hide mt-auto flex flex-col items-center gap-3 text-muted-foreground/50">
        <Layers className="h-5 w-5" />
        <Music className="h-5 w-5" />
        <Film className="h-5 w-5" />
      </div>
    </aside>
  );
}
