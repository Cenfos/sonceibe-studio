'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow, ToggleRow } from './controls';
import { fontOptions } from '@/lib/mock-data';
import { defaultTitleStyle } from '@/lib/types';
import { visualPresets } from '@/lib/visual-presets';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  CaseSensitive,
  Heading2,
  RotateCcw,
} from 'lucide-react';

export function TextTab() {
  const { currentProject, updateText, updateSettings } = useStore();
  if (!currentProject) return null;
  const settings = currentProject.settings;
  const t = settings.text;
  const activePreset = visualPresets.find((preset) => preset.id === settings.visualStyle);
  const titleBase = { ...defaultTitleStyle, ...(activePreset?.title ?? {}) };
  const titleStyle = { ...titleBase, ...(settings.titleStyle ?? {}) };

  const updateTitleStyle = (patch: Partial<typeof titleStyle>) => {
    updateSettings({ titleStyle: { ...titleStyle, ...patch } });
  };

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Heading2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold">Título de la canción</div>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                Se edita aparte de la letra y permanece visible durante todo el vídeo.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => updateSettings({ titleStyle: { ...titleBase } })}
            title="Restablecer el estilo de título recomendado"
          >
            <RotateCcw className="h-3 w-3" />
            Restablecer
          </Button>
        </div>

        <ControlRow label="Texto del título">
          <Input
            value={settings.title}
            onChange={(e) => updateSettings({ title: e.target.value })}
            placeholder="Título de la canción"
            className="h-9"
          />
        </ControlRow>

        <ControlRow label="Fuente del título">
          <Select value={titleStyle.fontFamily} onValueChange={(v) => updateTitleStyle({ fontFamily: v })}>
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

        <div className="grid grid-cols-2 gap-3">
          <SliderRow
            label="Tamaño título"
            value={titleStyle.fontSize}
            min={36}
            max={180}
            unit="px"
            onChange={(v) => updateTitleStyle({ fontSize: v })}
          />
          <ControlRow label="Peso título">
            <Select
              value={String(titleStyle.fontWeight)}
              onValueChange={(v) => updateTitleStyle({ fontWeight: Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <SelectItem key={w} value={String(w)}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ControlRow label="Forma">
            <Select
              value={titleStyle.fontStyle}
              onValueChange={(v) => updateTitleStyle({ fontStyle: v as 'normal' | 'italic' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="italic">Cursiva</SelectItem>
              </SelectContent>
            </Select>
          </ControlRow>
          <ToggleRow
            label="Título en MAYÚSCULAS"
            checked={titleStyle.uppercase}
            onChange={(v) => updateTitleStyle({ uppercase: v })}
          />
        </div>

        <SliderRow
          label="Bajar / subir título"
          value={titleStyle.topOffset}
          min={10}
          max={35}
          step={0.5}
          unit="%"
          onChange={(v) => updateTitleStyle({ topOffset: v })}
        />
        <p className="-mt-2 text-[10px] leading-4 text-muted-foreground">
          La altura se calcula respecto al lado corto, para que quede parecida en móvil 9:16 y PC 16:9.
        </p>

        <ControlRow label="Color del título">
          <ColorInput value={titleStyle.color} onChange={(v) => updateTitleStyle({ color: v })} />
        </ControlRow>

        <div className="space-y-3">
          <SliderRow
            label="Contorno título"
            value={titleStyle.outlineWidth}
            min={0}
            max={10}
            step={0.5}
            unit="px"
            onChange={(v) => updateTitleStyle({ outlineWidth: v })}
          />
          {titleStyle.outlineWidth > 0 && (
            <ControlRow label="Color contorno título">
              <ColorInput value={titleStyle.outlineColor} onChange={(v) => updateTitleStyle({ outlineColor: v })} />
            </ControlRow>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ToggleRow
            label="Sombra título"
            checked={titleStyle.shadow}
            onChange={(v) => updateTitleStyle({ shadow: v })}
          />
          <ToggleRow
            label="Brillo título"
            checked={titleStyle.glow}
            onChange={(v) => updateTitleStyle({ glow: v })}
          />
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <div className="mb-4 text-xs font-semibold">Letra de la canción</div>

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
      </div>

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

      <ControlRow label="Color de texto">
        <ColorInput value={t.color} onChange={(v) => updateText({ color: v })} />
      </ControlRow>

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
