'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ControlRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function ControlRow({ label, children, className }: ControlRowProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      {children}
    </div>
  );
}

interface ColorInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

function normalizeHexColor(value: string, fallback = '#000000'): string {
  const trimmed = value?.trim?.() ?? '';
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function ColorInput({ value, onChange, label }: ColorInputProps) {
  const safeValue = normalizeHexColor(value);

  return (
    <label
      className="flex items-center gap-3 rounded-md border border-border bg-background p-2 cursor-pointer hover:border-primary/50 transition-colors"
      title={label ? `Elegir ${label.toLowerCase()}` : 'Elegir color'}
    >
      <input
        type="color"
        value={safeValue}
        onChange={(e) => onChange(normalizeHexColor(e.target.value))}
        className="h-9 w-12 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        aria-label={label || 'Elegir color'}
      />
      <div className="min-w-0">
        <div className="text-xs font-medium">Pulsa para elegir color</div>
        <div className="text-[11px] font-mono text-muted-foreground uppercase">{safeValue}</div>
      </div>
    </label>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
        <span className="text-xs font-mono text-foreground tabular-nums">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full h-1.5 rounded-full bg-secondary appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-secondary'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}
