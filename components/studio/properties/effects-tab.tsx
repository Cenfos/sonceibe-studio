'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow, ToggleRow } from './controls';

export function EffectsTab() {
  const { currentProject, updateEffects } = useStore();
  if (!currentProject) return null;
  const fx = currentProject.settings.effects;

  return (
    <div className="space-y-5">
      {/* Ken Burns */}
      <div className="space-y-3">
        <ToggleRow
          label="Efecto Ken Burns"
          checked={fx.kenburns}
          onChange={(v) => updateEffects({ kenburns: v })}
        />
        {fx.kenburns && (
          <SliderRow
            label="Intensidad Ken Burns"
            value={fx.kenburnsIntensity}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => updateEffects({ kenburnsIntensity: v })}
          />
        )}
      </div>

      {/* Blur */}
      <SliderRow
        label="Desenfoque de fondo"
        value={fx.blur}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => updateEffects({ blur: v })}
      />

      {/* Overlay */}
      <div className="space-y-3">
        <SliderRow
          label="Superposición oscura"
          value={Math.round(fx.overlay * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => updateEffects({ overlay: v / 100 })}
        />
        <ControlRow label="Color de superposición">
          <ColorInput
            value={fx.overlayColor}
            onChange={(v) => updateEffects({ overlayColor: v })}
          />
        </ControlRow>
      </div>

      {/* Particles */}
      <div className="space-y-3">
        <ToggleRow
          label="Partículas"
          checked={fx.particles}
          onChange={(v) => updateEffects({ particles: v })}
        />
        {fx.particles && (
          <SliderRow
            label="Cantidad de partículas"
            value={fx.particlesCount}
            min={10}
            max={150}
            step={5}
            onChange={(v) => updateEffects({ particlesCount: v })}
          />
        )}
      </div>

      {/* Light leaks */}
      <ToggleRow
        label="Fugas de luz"
        checked={fx.lightleaks}
        onChange={(v) => updateEffects({ lightleaks: v })}
      />

      {/* Vignette */}
      <div className="space-y-3">
        <ToggleRow
          label="Viñeta"
          checked={fx.vignette}
          onChange={(v) => updateEffects({ vignette: v })}
        />
        {fx.vignette && (
          <SliderRow
            label="Intensidad de viñeta"
            value={fx.vignetteIntensity}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => updateEffects({ vignetteIntensity: v })}
          />
        )}
      </div>
    </div>
  );
}
