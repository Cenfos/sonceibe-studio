import { createDefaultProjectSettings } from '../lib/types';
import { saveSourceVideo, getSourceVideo } from '../lib/local-media-storage';
import { mixVideoAudio, openSourceVideo, releaseVideo, seekSourceVideo } from '../lib/source-video';
import { createPortableProjectBlob, readPortableProjectFile } from '../lib/project/download-current-project';
import { copyProject } from '../lib/project-history';
import { createProjectMp4 } from '../lib/video-exporter';

let fixture: Promise<File> | undefined;
export function sourceFixture() {
  return fixture ??= (async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ee1111'; ctx.fillRect(0, 0, 160, 90);
    const ac = new AudioContext(), oscillator = ac.createOscillator(), gain = ac.createGain(), dest = ac.createMediaStreamDestination();
    oscillator.frequency.value = 330; gain.gain.value = 0.15; oscillator.connect(gain).connect(dest); await ac.resume(); oscillator.start();
    const stream = canvas.captureStream(30); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const chunks: BlobPart[] = []; const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const done = new Promise<Blob>(resolve => { recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
    const start = performance.now(); recorder.start(100);
    const timer = setInterval(() => { ctx.fillStyle = performance.now() - start < 1600 ? '#ee1111' : '#11dd11'; ctx.fillRect(0, 0, 160, 90); }, 25);
    await new Promise(resolve => setTimeout(resolve, 3400)); recorder.stop(); const blob = await done;
    clearInterval(timer); oscillator.stop(); stream.getTracks().forEach(t => t.stop()); await ac.close();
    return new File([blob], 'movil.webm', { type: 'video/webm' });
  })();
}
function song() {
  const rate = 44100, length = rate * 4;
  const buffer = new AudioBuffer({ length, sampleRate: rate, numberOfChannels: 1 });
  const data = buffer.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.sin(i / rate * 880 * Math.PI * 2) * 0.12;
  return buffer;
}
async function songFile() { const { sliceAudioWav } = await import('../lib/reel'); const b = song(); return new File([sliceAudioWav(b, 0, b.duration)], 'cancion.wav', { type: 'audio/wav' }); }
async function spectrum(file: File) {
  const ac = new AudioContext();
  try { const b = await ac.decodeAudioData(await file.arrayBuffer()), data = b.getChannelData(0), n = Math.min(16384, data.length), offset = Math.min(4096, data.length - n);
    const amplitude = (frequency: number) => { let real = 0, imaginary = 0; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * frequency * i / b.sampleRate; real += data[i + offset] * Math.cos(a); imaginary += data[i + offset] * Math.sin(a); } return Math.hypot(real, imaginary) * 2 / n; };
    return { original: amplitude(330), song: amplitude(880), duration: b.duration };
  } finally { await ac.close(); }
}
export async function videoMixFixture() {
  const file = await sourceFixture(), bg = { ...createDefaultProjectSettings().background, type: 'video' as const, videoDuration: 3.4, videoStart: 0.5, videoEnd: 2.8 };
  const music = await songFile();
  return {
    original: await spectrum(await mixVideoAudio(bg, file, null)),
    replaced: await spectrum(await mixVideoAudio({ ...bg, videoMuted: true, songOffset: 0.5 }, file, music)),
    mixed: await spectrum(await mixVideoAudio({ ...bg, videoVolume: 0.5, songVolume: 0.5 }, file, music)),
    silent: await spectrum(await mixVideoAudio({ ...bg, videoMuted: true }, file, null)),
  };
}
export async function videoExportFixture() {
  const file = await sourceFixture(), sourceUrl = URL.createObjectURL(file);
  const settings = createDefaultProjectSettings(); settings.showTitle = false;
  settings.background = { ...settings.background, type: 'video', videoUrl: sourceUrl, videoDuration: 3.4, videoStart: 0.5, videoEnd: 2.8, overlay: 0 };
  settings.effects = { ...settings.effects, overlay: 0, vignette: false, particles: false, lightleaks: false };
  const wav = await mixVideoAudio({ ...settings.background, videoMuted: true }, file, await songFile());
  const audioUrl = URL.createObjectURL(wav), audio = new Audio(audioUrl);
  await new Promise<void>((resolve, reject) => { audio.oncanplay = () => resolve(); audio.onerror = reject; });
  try {
    const result = await createProjectMp4({ audioEl: audio, duration: 2.3, settings, target: 'pc', backgroundVideoUrl: sourceUrl, internalWidth: 320, internalHeight: 180 });
    const url = URL.createObjectURL(result.blob), video = await openSourceVideo(url);
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 9; const ctx = canvas.getContext('2d')!;
    const frames = [];
    for (const time of [0.3, 1.7]) { await seekSourceVideo(video, time); ctx.drawImage(video, 0, 0, 16, 9); frames.push(Array.from(ctx.getImageData(2, 2, 1, 1).data)); }
    const { Input, BlobSource, MP4 } = await import('mediabunny'); const input = new Input({ source: new BlobSource(result.blob), formats: [MP4] });
    const audioTracks = (await input.getAudioTracks()).length; input.dispose(); const duration = video.duration;
    releaseVideo(video); URL.revokeObjectURL(url);
    return { frames, duration, audioTracks, size: result.blob.size };
  } finally { audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(sourceUrl); URL.revokeObjectURL(audioUrl); }
}
export async function videoPersistenceFixture() {
  const file = await sourceFixture(), settings = createDefaultProjectSettings();
  const videoUrl = await saveSourceVideo('owner', 'video-fixture', file);
  settings.background = { ...settings.background, type: 'video', videoUrl, videoName: file.name, videoDuration: 3.4, videoStart: 0.5, videoEnd: 2.8, videoMuted: true, videoPlacement: { scale: 120, x: 30, y: 70, fit: 'cover' } };
  const project = { id: 'video-fixture', settings };
  const blob = await createPortableProjectBlob(project);
  const imported = await readPortableProjectFile(new File([blob], 'video.scs'));
  const restored = await getSourceVideo('owner', imported.project.id, imported.project.settings.background.videoUrl);
  const copy = await copyProject('owner', project, [project]);
  const copied = await getSourceVideo('owner', copy.id, copy.settings.background.videoUrl);
  return { sourceSize: file.size, restoredSize: restored?.size, copiedSize: copied?.size, sourceKey: videoUrl, copyKey: copy.settings.background.videoUrl, bg: imported.project.settings.background, audio: imported.audioFile };
}
export async function seedVideo() {
  const file = await sourceFixture(), settings = createDefaultProjectSettings();
  settings.title = 'Vídeo del móvil'; settings.showTitle = false;
  settings.background = { ...settings.background, type: 'video', videoUrl: await saveSourceVideo('owner', 'video-ui', file), videoName: file.name, videoDuration: 3.4, videoStart: 0.5, videoEnd: 2.8 };
  localStorage.setItem('sonceibe-projects-v2:owner', JSON.stringify([{ id: 'video-ui', settings }]));
}
