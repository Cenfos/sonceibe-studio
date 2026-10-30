 'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioEngine } from './use-audio-engine';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getSourceVideo } from '@/lib/local-media-storage';
import { mixVideoAudio, openSourceVideo, releaseVideo, sourceVideoUrls, videoRange } from '@/lib/source-video';

export function useProjectMedia() {
  const engine = useAudioEngine();
  const { currentProject } = useStore(); const userId = useStudioUserId();
  const [song, setSong] = useState<File | null>(null);
  const [footage, setFootage] = useState<{ projectId: string; key: string; file: File; video: HTMLVideoElement } | null>(null);
  const [mediaBusy, setBusy] = useState(false), [mediaError, setError] = useState('');
  const engineRef = useRef(engine); engineRef.current = engine;
  const bg = currentProject?.settings.background;
  const videoActive = bg?.type === 'video' && !!bg.videoUrl;
  const videoKey = bg?.videoUrl || '';
  const activeVideo = footage?.projectId === currentProject?.id && footage?.key === videoKey ? footage : null;
  const loadFile = useCallback(async (file: File) => { setSong(file); }, []);
  const loadFromUrl = useCallback(async (url: string, name: string) => {
    const response = await fetch(url); if (!response.ok) throw new Error('No se pudo leer la canción');
    const blob = await response.blob(); setSong(new File([blob], name, { type: blob.type }));
  }, []);
  const clear = useCallback(() => { setSong(null); engineRef.current.clear(); }, []);

  useEffect(() => {
    if (!videoActive || !currentProject) { setFootage(null); return; }
    let cancelled = false, video: HTMLVideoElement | null = null, url = '';
    setFootage(null); setBusy(true); setError(''); engineRef.current.pause();
    void (async () => {
      const file = await getSourceVideo(userId, currentProject.id, videoKey);
      if (!file) throw new Error('No encuentro el vídeo original. Vuelve a cargarlo o abre una copia .scs completa.');
      url = URL.createObjectURL(file); video = await openSourceVideo(url);
      if (cancelled) return;
      sourceVideoUrls.set(videoKey, url);
      setFootage({ projectId: currentProject.id, key: videoKey, file, video });
    })().catch(error => { if (!cancelled) { engineRef.current.clear(); setError(error.message); setBusy(false); } }).finally(() => {
      if (cancelled) { if (video) releaseVideo(video); if (url) URL.revokeObjectURL(url); }
    });
    return () => { cancelled = true; sourceVideoUrls.delete(videoKey); if (video) releaseVideo(video); if (url) URL.revokeObjectURL(url); };
  }, [currentProject?.id, userId, videoActive, videoKey]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const engine = engineRef.current;
    engine.pause(); setError('');
    if (videoActive && !activeVideo) return;
    if (!videoActive && !song) { engine.clear(); setBusy(false); return; }
    setBusy(true);
    void (async () => {
      if (videoActive) await new Promise(resolve => setTimeout(resolve, 180));
      if (cancelled) return;
      // A video project uses one mixed soundtrack as the clock for preview and export.
      const file = videoActive && activeVideo && bg ? await mixVideoAudio(bg, activeVideo.file, song, controller.signal) : song!;
      if (!cancelled) await engine.loadFile(file);
    })().catch(error => { if (!cancelled) { engine.clear(); setError(error.message || 'No se pudo preparar el sonido'); } })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [song, activeVideo, videoActive, bg?.videoStart, bg?.videoEnd, bg?.videoDuration, bg?.videoMuted, bg?.videoVolume, bg?.songVolume, bg?.songOffset]);

  useEffect(() => {
    const video = activeVideo?.video, audio = engine.audioEl;
    if (!video || !audio || !videoActive || !bg) return;
    const start = videoRange(bg).start;
    let frame = 0;
    const sync = () => {
      const target = Math.min(video.duration - 0.001, start + audio.currentTime);
      if (!video.seeking && Math.abs(video.currentTime - target) > (audio.paused ? 0.015 : 0.12)) video.currentTime = target;
    };
    const play = () => { sync(); void video.play().catch(() => {}); };
    const pause = () => { video.pause(); sync(); };
    const loop = () => { sync(); if (!audio.paused && video.paused) void video.play().catch(() => {}); frame = requestAnimationFrame(loop); };
    audio.addEventListener('play', play); audio.addEventListener('pause', pause); audio.addEventListener('seeking', sync); audio.addEventListener('ended', pause);
    sync(); frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); video.pause(); audio.removeEventListener('play', play); audio.removeEventListener('pause', pause); audio.removeEventListener('seeking', sync); audio.removeEventListener('ended', pause); };
  }, [activeVideo, engine.audioEl, videoActive, bg?.videoStart]);
  return { ...engine, loadFile, loadFromUrl, clear, videoEl: videoActive ? activeVideo?.video ?? null : null, mediaBusy, mediaError };
}
