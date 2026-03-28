/**
 * STEM Platform — Server-side unit tests
 * Tests: matching engine, invitation system, stem CRUD, flagging, BandLab
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { calculateMatchingScore, findCompatibleStems, filterStems } from "./lib/matchingEngine";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-1",
      name: "Test Artist",
      email: "test@stem.io",
      loginMethod: "manus",
      role: "user",
      artistName: "Test Artist",
      bio: null,
      bandlabUrl: null,
      spotifyUrl: null,
      websiteUrl: null,
      walletAddress: null,
      isVerified: true,
      invitedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
    ...overrides,
  };
}

function makeAdminCtx(): TrpcContext {
  return makeCtx({ user: { ...makeCtx().user!, role: "admin", id: 99, openId: "admin-user" } });
}

// ── Matching Engine ───────────────────────────────────────────────────────────

describe("calculateMatchingScore", () => {
  const baseMeta = {
    stemId: 1,
    bpm: 120,
    key: "C major",
    instrumentType: "drums",
    genreTags: ["Hip-Hop", "Trap"],
    energyLevel: 0.7,
    mfccVector: [0.5, 0.3, 0.2, 0.1, 0.4, 0.6, 0.3, 0.2, 0.1, 0.5, 0.4, 0.3, 0.2],
  };

  it("returns a score between 0 and 1", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2 });
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(1);
  });

  it("gives a perfect score for identical stems", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2 });
    expect(score.totalScore).toBeGreaterThan(0.9);
  });

  it("gives a high BPM score for identical BPM", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2, bpm: 120 });
    expect(score.bpmScore).toBeGreaterThan(0.9);
  });

  it("gives a lower BPM score for very different BPM (non-harmonic)", () => {
    // 120 vs 77 BPM — no harmonic relationship, ~36% difference
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2, bpm: 77 });
    expect(score.bpmScore).toBeLessThan(0.5);
  });

  it("gives a high key score for same key", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2, key: "C major" });
    expect(score.keyScore).toBeGreaterThan(0.9);
  });

  it("gives a reasonable key score for relative minor", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2, key: "A minor" });
    expect(score.keyScore).toBeGreaterThan(0.5);
  });

  it("gives a high genre score for overlapping tags", () => {
    const score = calculateMatchingScore(baseMeta, {
      ...baseMeta, stemId: 2, genreTags: ["Hip-Hop", "R&B"]
    });
    expect(score.genreScore).toBeGreaterThan(0.3);
  });

  it("gives a low genre score for no overlap", () => {
    // When there is no overlap, Jaccard = 0, but getGenreScore returns 0 for empty intersection
    const score = calculateMatchingScore(baseMeta, {
      ...baseMeta, stemId: 2, genreTags: ["Jazz", "Classical"]
    });
    // 0 intersection / 4 union = 0
    expect(score.genreScore).toBe(0);
  });

  it("handles missing optional fields gracefully", () => {
    const minimalMeta = { stemId: 1 };
    const score = calculateMatchingScore(minimalMeta, { stemId: 2 });
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(1);
  });

  it("returns all score breakdown fields", () => {
    const score = calculateMatchingScore(baseMeta, { ...baseMeta, stemId: 2 });
    expect(score).toHaveProperty("totalScore");
    expect(score).toHaveProperty("bpmScore");
    expect(score).toHaveProperty("keyScore");
    expect(score).toHaveProperty("timbreScore");
    expect(score).toHaveProperty("genreScore");
    expect(score).toHaveProperty("energyScore");
  });
});

describe("findCompatibleStems", () => {
  const target = {
    stemId: 1,
    bpm: 120,
    key: "C major",
    instrumentType: "bass",
    genreTags: ["Hip-Hop"],
    energyLevel: 0.6,
    mfccVector: [0.5, 0.3, 0.2, 0.1, 0.4, 0.6, 0.3, 0.2, 0.1, 0.5, 0.4, 0.3, 0.2],
  };

  const candidates = [
    { stemId: 2, bpm: 120, key: "C major", instrumentType: "drums", genreTags: ["Hip-Hop"], energyLevel: 0.7 },
    { stemId: 3, bpm: 180, key: "F# minor", instrumentType: "synth", genreTags: ["Jazz"], energyLevel: 0.2 },
    { stemId: 4, bpm: 122, key: "G major", instrumentType: "guitar", genreTags: ["Hip-Hop", "R&B"], energyLevel: 0.65 },
  ];

  it("returns results sorted by score descending", () => {
    const results = findCompatibleStems(target, candidates, 0, 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score.totalScore).toBeGreaterThanOrEqual(results[i].score.totalScore);
    }
  });

  it("filters out results below minScore", () => {
    const results = findCompatibleStems(target, candidates, 0.9, 10);
    results.forEach(r => expect(r.score.totalScore).toBeGreaterThanOrEqual(0.9));
  });

  it("respects the limit parameter", () => {
    const results = findCompatibleStems(target, candidates, 0, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array when no candidates pass threshold", () => {
    const results = findCompatibleStems(target, candidates, 1.0, 10);
    expect(results.length).toBe(0);
  });
});

describe("filterStems", () => {
  const stems = [
    { stemId: 1, bpm: 90, key: "A minor", instrumentType: "bass", genreTags: ["R&B"], energyLevel: 0.4 },
    { stemId: 2, bpm: 140, key: "C major", instrumentType: "drums", genreTags: ["Trap"], energyLevel: 0.9 },
    { stemId: 3, bpm: 120, key: "G major", instrumentType: "synth", genreTags: ["Electronic"], energyLevel: 0.6 },
  ];

  it("filters by BPM range", () => {
    const result = filterStems(stems, { bpmMin: 100, bpmMax: 150 });
    expect(result.every(s => (s.bpm ?? 0) >= 100 && (s.bpm ?? 0) <= 150)).toBe(true);
  });

  it("filters by key", () => {
    const result = filterStems(stems, { keys: ["C major"] });
    expect(result.every(s => s.key === "C major")).toBe(true);
  });

  it("filters by instrument type", () => {
    const result = filterStems(stems, { instrumentTypes: ["drums"] });
    expect(result.every(s => s.instrumentType === "drums")).toBe(true);
  });

  it("filters by genre tags", () => {
    const result = filterStems(stems, { genreTags: ["Trap"] });
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns all stems when no filters applied", () => {
    const result = filterStems(stems, {});
    expect(result.length).toBe(stems.length);
  });
});

// ── Auth / Logout ─────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const { COOKIE_NAME } = await import("../shared/const");
    const clearedCookies: { name: string; options: any }[] = [];
    const ctx = makeCtx({
      res: {
        clearCookie: (name: string, options: any) => clearedCookies.push({ name, options }),
      } as any,
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

// ── Invitations ───────────────────────────────────────────────────────────────

describe("invitations.validate", () => {
  it("returns invalid for a non-existent token", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: null }));
    const result = await caller.invitations.validate({ token: "nonexistent-token-xyz-123" });
    expect(result.valid).toBe(false);
  });
});

// ── Stems ─────────────────────────────────────────────────────────────────────

describe("stems.list", () => {
  it("returns an array (empty or populated)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.stems.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("stems.listPublic", () => {
  it("returns an array of public stems", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: null }));
    const result = await caller.stems.listPublic();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Metadata ─────────────────────────────────────────────────────────────────

describe("metadata.getById", () => {
  it("returns null/undefined for a non-existent stem", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: null }));
    const result = await caller.metadata.getById({ stemId: 999999 });
    expect(result == null).toBe(true);
  });
});

// ── Profile ───────────────────────────────────────────────────────────────────

describe("profile.get", () => {
  it("returns profile data for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.profile.get();
    // User may not exist in DB in test env, but should not throw
    expect(result).toBeDefined();
    expect(result).toHaveProperty("stats");
  });
});

// ── Flags ─────────────────────────────────────────────────────────────────────

describe("flags.getForStem", () => {
  it("returns an array for any stem ID", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: null }));
    const result = await caller.flags.getForStem({ stemId: 999999 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Collections ───────────────────────────────────────────────────────────────

describe("collections.list", () => {
  it("returns an array for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.collections.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── BandLab ───────────────────────────────────────────────────────────────────

describe("bandlab.list", () => {
  it("returns an array for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.bandlab.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Matching ─────────────────────────────────────────────────────────────────

describe("matching.findCompatible", () => {
  it("throws NOT_FOUND when stem metadata does not exist", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.matching.findCompatible({ stemId: 999999, minScore: 0.5, limit: 10 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
