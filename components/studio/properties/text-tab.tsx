'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow, ToggleRow } from './controls';
import { fontOptions } from '@/lib/mock-data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  CaseSensitive,
} from 'lucide-react';

export function TextTab() {
  const { currentProject, updateText } = useStore();
  if (!currentProject) return null;
  const t = currentProject.settings.text;

  return (
    <div className="space-y-5">
      {/* Font */}
      <ControlRow label="Fuente">
        <Select value={t.fontFamily} onValueChange={(v) => updateText({ fontFamily: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ControlRow>

      {/* Size & Weight */}
      <div className="grid grid-cols-2 gap-3">
        <SliderRow
          label="Tamaño"
          value={t.fontSize}
          min={16}
          max={200}
          unit="px"
          onChange={(v) => updateText({ fontSize: v })}
        />
        <ControlRow label="Peso">
          <Select
            value={String(t.fontWeight)}
            onValueChange={(v) => updateText({ fontWeight: Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlRow>
      </div>

      {/* Color */}
      <ControlRow label="Color de texto">
        <ColorInput value={t.color} onChange={(v) => updateText({ color: v })} />
      </ControlRow>

      {/* Outline */}
      <div className="space-y-3">
        <SliderRow
          label="Contorno"
          value={t.outlineWidth}
          min={0}
          max={10}
          step={0.5}
          unit="px"
          onChange={(v) => updateText({ outlineWidth: v })}
        />
        {t.outlineWidth > 0 && (
          <ControlRow label="Color de contorno">
            <ColorInput
              value={t.outlineColor}
              onChange={(v) => updateText({ outlineColor: v })}
            />
          </ControlRow>
        )}
      </div>

      {/* Shadow */}
      <div className="space-y-3">
        <ToggleRow
          label="Sombra"
          checked={t.shadow}
          onChange={(v) => updateText({ shadow: v })}
        />
        {t.shadow && (
          <>
            <SliderRow
              label="Desenfoque de sombra"
              value={t.shadowBlur}
              min={0}
              max={40}
              unit="px"
              onChange={(v) => updateText({ shadowBlur: v })}
            />
            <ControlRow label="Color de sombra">
              <ColorInput
                value={t.shadowColor}
                onChange={(v) => updateText({ shadowColor: v })}
              />
            </ControlRow>
          </>
        )}
      </div>

      {/* Glow */}
      <div className="space-y-3">
        <ToggleRow
          label="Brillo (Glow)"
          checked={t.glow}
          onChange={(v) => updateText({ glow: v })}
        />
        {t.glow && (
          <>
            <ControlRow label="Color de brillo">
              <ColorInput
                value={t.glowColor}
                onChange={(v) => updateText({ glowColor: v })}
              />
            </ControlRow>
            <SliderRow
              label="Intensidad de brillo"
              value={t.glowIntensity}
              min={0}
              max={60}
              onChange={(v) => updateText({ glowIntensity: v })}
            />
          </>
        )}
      </div>

      {/* Position */}
      <ControlRow label="Posición vertical">
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'top', icon: ArrowUp, label: 'Arriba' },
            { v: 'center', icon: AlignCenter, label: 'Centro' },
            { v: 'bottom', icon: ArrowDown, label: 'Abajo' },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <Button
                key={p.v}
                variant={t.position === p.v ? 'default' : 'outline'}
                size="sm"
                className="flex-col h-14 gap-1"
                onClick={() => updateText({ position: p.v as 'top' | 'center' | 'bottom' })}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{p.label}</span>
              </Button>
            );
          })}
        </div>
      </ControlRow>

      {/* Alignment */}
      <ControlRow label="Alineación">
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'left', icon: AlignLeft },
            { v: 'center', icon: AlignCenter },
            { v: 'right', icon: AlignRight },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.v}
                variant={t.align === a.v ? 'default' : 'outline'}
                size="sm"
                className="h-9"
                onClick={() => updateText({ align: a.v as 'left' | 'center' | 'right' })}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      </ControlRow>

      {/* Transform */}
      <ControlRow label="Mayúsculas / Minúsculas">
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'none', label: 'Normal' },
            { v: 'uppercase', label: 'MAYÚS' },
            { v: 'lowercase', label: 'minús' },
          ].map((tr) => (
            <Button
              key={tr.v}
              variant={t.transform === tr.v ? 'default' : 'outline'}
              size="sm"
              className={cn('h-9 text-xs', tr.v === 'uppercase' && 'uppercase', tr.v === 'lowercase' && 'lowercase')}
              onClick={() => updateText({ transform: tr.v as 'none' | 'uppercase' | 'lowercase' })}
            >
              {tr.v === 'none' && <CaseSensitive className="h-4 w-4 mr-1" />}
              {tr.label}
            </Button>
          ))}
        </div>
      </ControlRow>

      {/* Spacing */}
      <SliderRow
        label="Espaciado entre letras"
        value={t.letterSpacing}
        min={-5}
        max={20}
        step={0.5}
        unit="px"
        onChange={(v) => updateText({ letterSpacing: v })}
      />
      <SliderRow
        label="Interlineado"
        value={t.lineHeight}
        min={0.8}
        max={2}
        step={0.1}
        onChange={(v) => updateText({ lineHeight: v })}
      />
    </div>
  );
}
