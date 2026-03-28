/**
 * Client-side audio analysis
 * Extracts BPM, musical key, MFCC vectors, energy, and waveform data
 * All processing happens in the browser — no server required
 */

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  energyLevel: number;
  mfccVector: number[];
  waveformData: number[];
  duration: number;
  instrumentType: string;
}

// ── Waveform ──────────────────────────────────────────────────────────────────

export function extractWaveform(channelData: Float32Array, samples = 200): number[] {
  const blockSize = Math.floor(channelData.length / samples);
  const waveform: number[] = [];
  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[i * blockSize + j] ?? 0);
    }
    waveform.push(sum / blockSize);
  }
  const max = Math.max(...waveform, 0.001);
  return waveform.map(v => v / max);
}

// ── RMS Energy ────────────────────────────────────────────────────────────────

export function calculateRMS(channelData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  return Math.sqrt(sum / channelData.length);
}

// ── BPM Detection via onset detection ────────────────────────────────────────

export function detectBPM(channelData: Float32Array, sampleRate: number): number {
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const frameSize = Math.floor(sampleRate * 0.05); // 50ms frames
  const onsets: number[] = [];

  let prevEnergy = 0;
  for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += channelData[i + j] ** 2;
    }
    energy /= frameSize;
    if (energy > prevEnergy * 1.5 && energy > 0.001) {
      onsets.push(i / sampleRate);
    }
    prevEnergy = energy;
  }

  if (onsets.length < 4) return 120; // Default fallback

  // Calculate intervals between onsets
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const interval = onsets[i] - onsets[i - 1];
    if (interval > 0.2 && interval < 2.0) {
      intervals.push(interval);
    }
  }

  if (intervals.length === 0) return 120;

  // Find most common interval via histogram
  const histogram: Record<number, number> = {};
  intervals.forEach(interval => {
    const bpm = Math.round(60 / interval);
    const key = Math.round(bpm / 5) * 5; // Quantize to nearest 5 BPM
    histogram[key] = (histogram[key] ?? 0) + 1;
  });

  let bestBpm = 120;
  let bestCount = 0;
  Object.entries(histogram).forEach(([bpm, count]) => {
    if (count > bestCount) {
      bestCount = count;
      bestBpm = parseInt(bpm);
    }
  });

  return Math.max(60, Math.min(200, bestBpm));
}

// ── Musical Key Detection via Chroma ─────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function computeChroma(channelData: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const frameSize = Math.min(4096, channelData.length);
  const numFrames = Math.floor(channelData.length / frameSize);

  for (let f = 0; f < numFrames; f++) {
    const frame = channelData.slice(f * frameSize, (f + 1) * frameSize);
    // Simple magnitude spectrum approximation
    for (let i = 0; i < frameSize; i++) {
      const freq = (i * sampleRate) / frameSize;
      if (freq < 20 || freq > 5000) continue;
      const noteNum = Math.round(12 * Math.log2(freq / 440) + 69) % 12;
      const noteIdx = ((noteNum % 12) + 12) % 12;
      chroma[noteIdx] += Math.abs(frame[i]);
    }
  }

  const max = Math.max(...chroma, 0.001);
  return chroma.map(v => v / max);
}

function correlate(chroma: number[], profile: number[]): number {
  const n = 12;
  const meanChroma = chroma.reduce((a, b) => a + b, 0) / n;
  const meanProfile = profile.reduce((a, b) => a + b, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const a = chroma[i] - meanChroma;
    const b = profile[i] - meanProfile;
    num += a * b;
    denA += a * a;
    denB += b * b;
  }
  return denA === 0 || denB === 0 ? 0 : num / Math.sqrt(denA * denB);
}

export function detectKey(channelData: Float32Array, sampleRate: number): string {
  const chroma = computeChroma(channelData, sampleRate);
  let bestScore = -Infinity;
  let bestKey = "C major";

  for (let i = 0; i < 12; i++) {
    const rotated = [...chroma.slice(i), ...chroma.slice(0, i)];
    const majorScore = correlate(rotated, MAJOR_PROFILE);
    const minorScore = correlate(rotated, MINOR_PROFILE);
    if (majorScore > bestScore) { bestScore = majorScore; bestKey = `${NOTE_NAMES[i]} major`; }
    if (minorScore > bestScore) { bestScore = minorScore; bestKey = `${NOTE_NAMES[i]} minor`; }
  }

  return bestKey;
}

// ── MFCC (simplified) ─────────────────────────────────────────────────────────

export function computeMFCC(channelData: Float32Array, sampleRate: number, numCoeffs = 13): number[] {
  const frameSize = 2048;
  const numFrames = Math.floor(channelData.length / frameSize);
  const mfcc = new Array(numCoeffs).fill(0);

  for (let f = 0; f < Math.min(numFrames, 100); f++) {
    const frame = channelData.slice(f * frameSize, (f + 1) * frameSize);
    // Mel filterbank approximation
    for (let c = 0; c < numCoeffs; c++) {
      let sum = 0;
      const startBin = Math.floor((c * frameSize) / (numCoeffs * 2));
      const endBin = Math.floor(((c + 1) * frameSize) / (numCoeffs * 2));
      for (let i = startBin; i < endBin; i++) {
        sum += Math.abs(frame[i] ?? 0);
      }
      mfcc[c] += sum / Math.max(endBin - startBin, 1);
    }
  }

  const scale = Math.max(...mfcc.map(Math.abs), 0.001);
  return mfcc.map(v => v / scale);
}

// ── Instrument Type Heuristic ─────────────────────────────────────────────────

export function guessInstrumentType(rms: number, bpm: number, mfcc: number[]): string {
  const spectralCentroid = mfcc[1] ?? 0;
  if (spectralCentroid > 0.7) return "synth";
  if (rms > 0.3 && bpm > 130) return "drums";
  if (rms > 0.2 && spectralCentroid < 0.3) return "bass";
  if (spectralCentroid > 0.4 && spectralCentroid < 0.7) return "guitar";
  if (spectralCentroid > 0.5) return "keys";
  return "other";
}

// ── Main Analysis ─────────────────────────────────────────────────────────────

export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const waveformData = extractWaveform(channelData);
  const energyLevel = Math.min(1, calculateRMS(channelData) * 10);
  const bpm = detectBPM(channelData, sampleRate);
  const key = detectKey(channelData, sampleRate);
  const mfccVector = computeMFCC(channelData, sampleRate);
  const instrumentType = guessInstrumentType(energyLevel, bpm, mfccVector);

  return { bpm, key, energyLevel, mfccVector, waveformData, duration, instrumentType };
}
