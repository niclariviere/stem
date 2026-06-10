/**
 * Artist-editable BPM/key helpers.
 *
 * BPM and key are *seeds*, not verdicts: the analyzer guesses, the artist confirms or
 * corrects. Half/double-time and metric reinterpretation (e.g. 3/4) make more than one
 * reading valid, so we never enforce — we record the artist's intended value as truth.
 *
 * MATCH-ENGINE CONTRACT (for when matching lands): treat a corrected value as ground
 * truth, but compare BPM *modulo octave* (x, 2x, ½x are neighbours) and key by Camelot-wheel
 * adjacency (relative major/minor). That way an artist's octave/key correction never creates
 * a false mismatch — see [[project_stem_thesis]] match-engine notes.
 */

// Sharp-based note names — must match the format detectKey() emits ("C major", "C# minor", …).
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** The 24 canonical keys (12 notes × major/minor), in the analyzer's format. */
export const MUSICAL_KEYS: string[] = NOTE_NAMES.flatMap(n => [`${n} major`, `${n} minor`]);

export const BPM_MIN = 20;
export const BPM_MAX = 300;

/** Keep an edited BPM a whole number inside a sane musical range. */
export function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return BPM_MIN;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)));
}

/** Half-time reading — the single most common BPM correction. */
export function halveBpm(n: number): number {
  return clampBpm(n / 2);
}

/** Double-time reading — the other half of the octave fix. */
export function doubleBpm(n: number): number {
  return clampBpm(n * 2);
}

/** Ensure the current key is selectable even if it predates / falls outside the canonical list. */
export function keyOptionsFor(current: string): string[] {
  return current && !MUSICAL_KEYS.includes(current) ? [current, ...MUSICAL_KEYS] : MUSICAL_KEYS;
}
