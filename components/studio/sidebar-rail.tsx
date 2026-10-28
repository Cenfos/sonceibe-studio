'use client';

import {
  Type,
  Image,
  Sparkles,
  Wand2,
  FileText,
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
    <nav aria-label="Herramientas del editor" className="studio-tools grid grid-cols-5 shrink-0 gap-1 border-b border-border bg-card/30 p-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setTab(tab.id);
              onTabSelected?.(tab.id);
            }}
            className={cn(
              'studio-sidebar-tab group relative flex flex-col items-center justify-center gap-1 min-w-0 h-14 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={tab.label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {active && (
              <span className="studio-active-indicator absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}

    </nav>
  );
}
