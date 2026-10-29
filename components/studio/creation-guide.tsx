'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { Button } from '@/components/ui/button';
import { VisualPresetPicker } from './properties/visual-preset-picker';

export function CreationGuide() {
  const { currentProject, updateExport, updateSettings, setExportOpen } = useStore();
  const audio = useAudioEngineContext();
  const [step, setStep] = useState(0);
  const [guided, setGuided] = useState(true);
  if (!currentProject) return null;
  const settings = currentProject.settings;
  const hasAudio = !!audio.audioBuffer;
  return <section aria-label="Creación guiada de vídeo" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-semibold">Tu vídeo, paso a paso</span>
      <Button size="sm" variant="ghost" onClick={() => setGuided(!guided)}>{guided ? 'Editar manualmente' : 'Abrir guía'}</Button>
    </div>
    {guided && <>
      <nav aria-label="Pasos para crear un vídeo" className="flex flex-wrap gap-1">
        {['Audio', 'Formato', 'Estilo', 'Exportar'].map((label, index) => <Button key={label} className="flex-1 basis-24" size="sm" variant={step === index ? 'default' : 'outline'} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}. {label}</Button>)}
      </nav>
      {step === 0 && <><p className="text-sm">{hasAudio ? `Audio listo: ${settings.audioName || 'Canción cargada'}` : 'Carga tu canción para empezar.'}</p><Button variant="outline" onClick={() => window.dispatchEvent(new Event('sonceibe:upload-audio'))}>{hasAudio ? 'Cambiar audio' : 'Elegir audio'}</Button></>}
      {step === 1 && <><p className="text-sm">Para un fragmento vertical, abre Reels en la barra superior. Para el vídeo completo, elige:</p><div className="flex flex-wrap gap-2">{(['portrait', 'landscape'] as const).map(orientation => <Button key={orientation} variant={settings.exportConfig.orientation === orientation ? 'default' : 'outline'} aria-pressed={settings.exportConfig.orientation === orientation} onClick={() => updateExport({ orientation, resolution: '1080p', fps: 30 })}>{orientation === 'portrait' ? 'Vertical · 9:16' : 'Horizontal · 16:9'}</Button>)}</div></>}
      {step === 2 && <><p className="text-xs text-muted-foreground">Puedes conservar tu diseño o aplicar una plantilla. Después podrás ajustar cada detalle en los controles de abajo.</p><VisualPresetPicker /></>}
      {step === 3 && <><p className="text-sm">Vídeo completo · {settings.audioDuration.toFixed(1)} s · {settings.exportConfig.orientation === 'portrait' ? 'Vertical 9:16' : 'Horizontal 16:9'}. Revisa la vista previa y confirma los detalles al exportar.</p><Button disabled={!hasAudio} onClick={() => { updateSettings({ editingTarget: 'full' }); setExportOpen(true); }}>Revisar y exportar vídeo</Button>{!hasAudio && <p className="text-xs text-muted-foreground">Carga el audio para exportar.</p>}</>}
      {step < 3 && <Button size="sm" disabled={step === 0 && !hasAudio} onClick={() => setStep(step + 1)}>Continuar</Button>}
    </>}
    <p className="text-xs text-muted-foreground">Edición manual siempre disponible debajo: texto, fondo, animación y efectos. Puedes saltar entre los pasos.</p>
  </section>;
}
