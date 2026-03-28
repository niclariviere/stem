/**
 * STEM Smart Matching Engine
 * Scores stem compatibility based on BPM, Key, Timbre (MFCC), and Genre
 * Score range: 0.0 (incompatible) → 1.0 (perfect match)
 */

export interface StemMetadataInput {
  id?: number;
  stemId?: number;
  bpm?: number | null;
  key?: string | null;
  instrumentType?: string | null;
  genreTags?: string[] | null;
  energyLevel?: number | null;
  mfccVector?: number[] | null;
}

export interface MatchingScoreBreakdown {
  bpmScore: number;
  keyScore: number;
  timbreScore: number;
  genreScore: number;
  energyScore: number;
  totalScore: number;
}

// ── Circle of Fifths ──────────────────────────────────────────────────────────

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getKeyCompatibilityScore(keyA: string, keyB: string): number {
  if (!keyA || !keyB) return 0.5;
  if (keyA === keyB) return 1.0;

  const pitchA = NOTES.indexOf(keyA.split(" ")[0]);
  const pitchB = NOTES.indexOf(keyB.split(" ")[0]);
  if (pitchA === -1 || pitchB === -1) return 0.5;

  // Same pitch class regardless of mode
  if (pitchA === pitchB) return 0.9;

  const distance = Math.min(Math.abs(pitchA - pitchB), 12 - Math.abs(pitchA - pitchB));

  // Perfect fifth (7 semitones) or fourth (5 semitones)
  if (distance === 7 || distance === 5) return 0.8;
  // Minor third / major sixth (3 or 4 semitones)
  if (distance === 3 || distance === 4) return 0.65;
  // Major second / minor seventh (2 semitones)
  if (distance === 2) return 0.55;
  // Tritone (6 semitones) — most dissonant
  if (distance === 6) return 0.2;
  // 1 semitone
  return 0.4;
}

// ── BPM Compatibility ─────────────────────────────────────────────────────────

function getBPMScore(bpmA: number, bpmB: number): number {
  if (!bpmA || !bpmB) return 0.5;

  // Check harmonic relationships (half-time, double-time)
  const harmonicRatios = [0.5, 1, 1.5, 2, 3, 0.333];
  for (const ratio of harmonicRatios) {
    const harmonicBpm = bpmA * ratio;
    const diff = Math.abs(harmonicBpm - bpmB);
    const pct = (diff / Math.max(harmonicBpm, bpmB)) * 100;
    if (pct <= 5) return ratio === 1 ? 1.0 : 0.85;
    if (pct <= 10) return ratio === 1 ? 0.9 : 0.75;
  }

  // Direct percentage difference
  const maxBpm = Math.max(bpmA, bpmB);
  const pctDiff = (Math.abs(bpmA - bpmB) / maxBpm) * 100;
  if (pctDiff <= 5) return 0.95;
  if (pctDiff <= 10) return 0.8;
  if (pctDiff <= 15) return 0.65;
  if (pctDiff <= 20) return 0.5;
  return Math.max(0.1, 0.5 - (pctDiff - 20) / 100);
}

// ── Timbre / MFCC ─────────────────────────────────────────────────────────────

function getTimbreScore(mfccA: number[], mfccB: number[]): number {
  if (!mfccA?.length || !mfccB?.length) return 0.5;
  const len = Math.min(mfccA.length, mfccB.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot += mfccA[i] * mfccB[i];
    normA += mfccA[i] * mfccA[i];
    normB += mfccB[i] * mfccB[i];
  }
  if (normA === 0 || normB === 0) return 0.5;
  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, (cosine + 1) / 2));
}

// ── Genre / Tags ──────────────────────────────────────────────────────────────

function getGenreScore(tagsA: string[], tagsB: string[]): number {
  if (!tagsA?.length || !tagsB?.length) return 0.5;
  const setA = new Set(tagsA.map(t => t.toLowerCase()));
  const setB = new Set(tagsB.map(t => t.toLowerCase()));
  let intersection = 0;
  setA.forEach(t => { if (setB.has(t)) intersection++; });
  const combined = new Set<string>();
  setA.forEach(t => combined.add(t));
  setB.forEach(t => combined.add(t));
  const union = combined.size;
  return union === 0 ? 0.5 : intersection / union;
}

// ── Energy ────────────────────────────────────────────────────────────────────

function getEnergyScore(energyA: number, energyB: number): number {
  if (energyA == null || energyB == null) return 0.5;
  const diff = Math.abs(energyA - energyB);
  if (diff <= 0.1) return 1.0;
  if (diff <= 0.2) return 0.85;
  if (diff <= 0.3) return 0.7;
  if (diff <= 0.4) return 0.55;
  return 0.4;
}

// ── Main Scoring ──────────────────────────────────────────────────────────────

/**
 * Calculate compatibility score between two stems.
 * Weights: BPM 35%, Key 30%, Timbre 20%, Genre 10%, Energy 5%
 */
export function calculateMatchingScore(
  stemA: StemMetadataInput,
  stemB: StemMetadataInput
): MatchingScoreBreakdown {
  const bpmScore = getBPMScore(stemA.bpm ?? 0, stemB.bpm ?? 0);
  const keyScore = getKeyCompatibilityScore(stemA.key ?? "", stemB.key ?? "");
  const timbreScore = getTimbreScore(stemA.mfccVector ?? [], stemB.mfccVector ?? []);
  const genreScore = getGenreScore(stemA.genreTags ?? [], stemB.genreTags ?? []);
  const energyScore = getEnergyScore(stemA.energyLevel ?? 0.5, stemB.energyLevel ?? 0.5);

  const totalScore =
    bpmScore * 0.35 +
    keyScore * 0.30 +
    timbreScore * 0.20 +
    genreScore * 0.10 +
    energyScore * 0.05;

  return {
    bpmScore: Math.round(bpmScore * 100) / 100,
    keyScore: Math.round(keyScore * 100) / 100,
    timbreScore: Math.round(timbreScore * 100) / 100,
    genreScore: Math.round(genreScore * 100) / 100,
    energyScore: Math.round(energyScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
  };
}

/**
 * Find compatible stems from a pool, sorted by score descending.
 */
export function findCompatibleStems(
  target: StemMetadataInput,
  candidates: StemMetadataInput[],
  minScore = 0.55,
  limit = 10
): Array<{ stem: StemMetadataInput; score: MatchingScoreBreakdown }> {
  return candidates
    .filter(c => (c.stemId ?? c.id) !== (target.stemId ?? target.id))
    .map(c => ({ stem: c, score: calculateMatchingScore(target, c) }))
    .filter(r => r.score.totalScore >= minScore)
    .sort((a, b) => b.score.totalScore - a.score.totalScore)
    .slice(0, limit);
}

/**
 * Filter stems by musical criteria.
 */
export function filterStems(
  stems: StemMetadataInput[],
  filters: {
    bpmMin?: number;
    bpmMax?: number;
    keys?: string[];
    instrumentTypes?: string[];
    genreTags?: string[];
    energyMin?: number;
    energyMax?: number;
  }
): StemMetadataInput[] {
  return stems.filter(s => {
    if (filters.bpmMin != null && (s.bpm ?? 0) < filters.bpmMin) return false;
    if (filters.bpmMax != null && (s.bpm ?? 999) > filters.bpmMax) return false;
    if (filters.keys?.length && s.key && !filters.keys.includes(s.key)) return false;
    if (filters.instrumentTypes?.length && s.instrumentType && !filters.instrumentTypes.includes(s.instrumentType)) return false;
    if (filters.genreTags?.length && s.genreTags?.length) {
      const hasTag = filters.genreTags.some(t => s.genreTags!.includes(t));
      if (!hasTag) return false;
    }
    if (filters.energyMin != null && (s.energyLevel ?? 0) < filters.energyMin) return false;
    if (filters.energyMax != null && (s.energyLevel ?? 1) > filters.energyMax) return false;
    return true;
  });
}
