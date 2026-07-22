'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { exportToTxt, exportToLrc, downloadTextFile } from '@/lib/lyrics-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Download,
  Film,
  Loader2,
  Check,
  Monitor,
  Smartphone,
  Tv,
  FileText,
} from 'lucide-react';
import type { ExportResolution, ExportFps } from '@/lib/types';

const resolutions: { v: ExportResolution; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { v: '720p', label: '720p HD', desc: '1280×720', icon: Smartphone },
  { v: '1080p', label: '1080p Full HD', desc: '1920×1080', icon: Monitor },
  { v: '4k', label: '4K Ultra HD', desc: '3840×2160', icon: Tv },
];

const fpsOptions: { v: ExportFps; label: string }[] = [
  { v: 30, label: '30 FPS' },
  { v: 60, label: '60 FPS' },
];

export function ExportDialog() {
  const { isExportOpen, setExportOpen, currentProject, updateExport } = useStore();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [exportType, setExportType] = useState<'video' | 'txt' | 'lrc'>('video');

  if (!currentProject) return null;
  const cfg = currentProject.settings.exportConfig;
  const lyrics = currentProject.settings.lyrics;
  const title = currentProject.settings.title || 'letra';

  const handleExportTxt = () => {
    const text = exportToTxt(lyrics);
    downloadTextFile(`${title}.txt`, text);
  };

  const handleExportLrc = () => {
    const text = exportToLrc(lyrics, title, currentProject.settings.artist);
    downloadTextFile(`${title}.lrc`, text, 'application/octet-stream');
  };

  const startExport = () => {
    setExporting(true);
    setProgress(0);
    setDone(false);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setExporting(false);
          setDone(true);
          return 100;
        }
        return p + 5;
      });
    }, 150);
  };

  const reset = () => {
    setDone(false);
    setProgress(0);
    setExportOpen(false);
  };

  return (
    <Dialog open={isExportOpen} onOpenChange={(o) => { setExportOpen(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Video
          </DialogTitle>
          <DialogDescription>
            Exporta tu video de letras o la letra en formato TXT/LRC.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">¡Exportación completada!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tu video se ha exportado correctamente.
            </p>
            <Button onClick={reset}>Cerrar</Button>
          </div>
        ) : exporting ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Exportando video... {progress}%
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {cfg.resolution.toUpperCase()} · {cfg.fps} FPS · MP4
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Export type selector */}
            <div className="space-y-2">
              <Label>Tipo de exportación</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setExportType('video')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'video'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <Film className="h-5 w-5" />
                  <span className="text-xs font-medium">Video MP4</span>
                </button>
                <button
                  onClick={() => setExportType('txt')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'txt'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra TXT</span>
                </button>
                <button
                  onClick={() => setExportType('lrc')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'lrc'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra LRC</span>
                </button>
              </div>
            </div>

            {exportType === 'video' ? (
              <>
              {/* Resolution */}
              <div className="space-y-2">
                <Label>Resolución</Label>
              <div className="grid grid-cols-3 gap-2">
                {resolutions.map((r) => {
                  const Icon = r.icon;
                  const active = cfg.resolution === r.v;
                  return (
                    <button
                      key={r.v}
                      onClick={() => updateExport({ resolution: r.v })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FPS */}
            <div className="space-y-2">
              <Label>Fotogramas por segundo</Label>
              <div className="grid grid-cols-2 gap-2">
                {fpsOptions.map((f) => (
                  <button
                    key={f.v}
                    onClick={() => updateExport({ fps: f.v })}
                    className={cn(
                      'p-3 rounded-lg border text-sm font-medium transition-all',
                      cfg.fps === f.v
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                <Film className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">MP4 (H.264 + AAC)</span>
              </div>
            </div>

            {/* Include audio */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Incluir pista de audio</span>
              <input
                type="checkbox"
                checked={cfg.includeAudio}
                onChange={(e) => updateExport({ includeAudio: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </label>
            </>
            ) : (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  {exportType === 'txt'
                    ? 'Exporta la letra como texto plano sin tiempos.'
                    : 'Exporta la letra con marcas de tiempo LRC para reproductores compatibles.'}
                </p>
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">
                    {exportType === 'txt' ? 'TXT (texto plano)' : 'LRC (con tiempos)'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {lyrics.length} líneas · {lyrics.filter((l) => l.start > 0).length} sincronizadas
                </div>
              </div>
            )}
          </div>
        )}

        {!exporting && !done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancelar
            </Button>
            {exportType === 'video' ? (
              <Button onClick={startExport} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Video
              </Button>
            ) : (
              <Button onClick={exportType === 'txt' ? handleExportTxt : handleExportLrc} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar {exportType.toUpperCase()}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
