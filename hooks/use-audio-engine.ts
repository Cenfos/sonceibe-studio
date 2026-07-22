'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

export interface AudioEngine {
  audioEl: HTMLAudioElement | null;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  loadFile: (file: File) => Promise<void>;
  loadFromUrl: (url: string, name: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setMuted: (m: boolean) => void;
}

export function useAudioEngine(): AudioEngine {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Initialize audio element once
  useEffect(() => {
    const el = new Audio();
    el.preload = 'auto';
    audioRef.current = el;
    setAudioEl(el);

    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => setDuration(el.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onVolume = () => setMutedState(el.muted);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('durationchange', onLoaded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('volumechange', onVolume);

    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('durationchange', onLoaded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('volumechange', onVolume);
      el.pause();
      el.src = '';
    };
  }, []);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const decodeAudio = useCallback(async (file: File): Promise<AudioBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();
    return buffer;
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      if (!audioRef.current) return;
      // Revoke previous URL
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      audioRef.current.src = url;
      audioRef.current.load();
      try {
        const buffer = await decodeAudio(file);
        audioBufferRef.current = buffer;
        setAudioBuffer(buffer);
      } catch (err) {
        console.error('Failed to decode audio:', err);
      }
    },
    [decodeAudio, objectUrl]
  );

  const loadFromUrl = useCallback(
    async (url: string, _name: string) => {
      if (!audioRef.current) return;
      // If it's a blob URL from a previous file, try to fetch and decode
      if (url.startsWith('blob:')) {
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const file = new File([blob], _name, { type: blob.type || 'audio/mpeg' });
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          const newUrl = URL.createObjectURL(file);
          setObjectUrl(newUrl);
          audioRef.current.src = newUrl;
          audioRef.current.load();
          const buffer = await decodeAudio(file);
          audioBufferRef.current = buffer;
          setAudioBuffer(buffer);
        } catch (err) {
          console.error('Failed to decode audio from URL:', err);
          audioRef.current.src = url;
          audioRef.current.load();
        }
      } else {
        audioRef.current.src = url;
        audioRef.current.load();
      }
    },
    [decodeAudio, objectUrl]
  );

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setMuted = useCallback((m: boolean) => {
    if (audioRef.current) {
      audioRef.current.muted = m;
      setMutedState(m);
    }
  }, []);

  return {
    audioEl,
    audioBuffer,
    isPlaying,
    currentTime,
    duration,
    muted,
    loadFile,
    loadFromUrl,
    play,
    pause,
    stop,
    seek,
    setMuted,
  };
}
