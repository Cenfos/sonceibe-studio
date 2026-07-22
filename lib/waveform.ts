export function generateWaveformPeaks(
  audioBuffer: AudioBuffer,
  numPeaks = 2000
): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / numPeaks));
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  const maxPeak = peaks.length > 0 ? Math.max(...peaks) : 0;
  if (maxPeak > 0) {
    return peaks.map((p) => p / maxPeak);
  }
  return peaks;
}
