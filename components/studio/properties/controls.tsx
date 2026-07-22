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

export function ColorInput({ value, onChange, label }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-9 w-9 rounded-md border border-border overflow-hidden shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        />
        <div className="absolute inset-0" style={{ backgroundColor: value }} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-mono"
      />
    </div>
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
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
