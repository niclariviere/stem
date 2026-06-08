import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import {
  getDb,
  createStem,
  getStemById,
  deleteStem,
  getUserStems,
  getAllPublicStems,
  getMatchableStemMetadata,
  createStemMetadata,
  MINT_WINDOW_DAYS,
} from "../server/db";
import { users, stems, stemMetadata } from "../drizzle/schema";

// Self-cleaning smoke test for the 7-day mint window.
//   T3: deadline-on-creation.   T4: expired-unminted hidden from public/match, visible to owner.
// Run: pnpm tsx scripts/smoke-mint-window.ts

const SMOKE = "[[SMOKE]] mint-window";
let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  const [someUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!someUser) throw new Error("No users in DB to attach a test stem to");
  const userId = someUser.id;

  const created: number[] = [];
  try {
    // ---- T3: createStem sets mintDeadline = now + 7d ----
    const before = Date.now();
    const freshId = await createStem({ userId, fileName: `${SMOKE} fresh.wav` } as any);
    created.push(freshId);
    const fresh = await getStemById(freshId);
    check("T3: mintDeadline set on creation", !!fresh?.mintDeadline);
    if (fresh?.mintDeadline) {
      const drift = Math.abs(new Date(fresh.mintDeadline as any).getTime() - (before + MINT_WINDOW_DAYS * 864e5)) / 6e4;
      check(`T3: mintDeadline ≈ createdAt + ${MINT_WINDOW_DAYS}d (drift ${drift.toFixed(2)}min < 5)`, drift < 5);
    }

    // ---- T4: an expired-unminted stem ----
    const expiredId = await createStem({ userId, fileName: `${SMOKE} expired.wav` } as any);
    created.push(expiredId);
    // back-date its deadline into the past; keep mintStatus 'none' (unminted)
    await db.update(stems).set({ mintDeadline: new Date(Date.now() - 864e5), mintStatus: "none" }).where(eq(stems.id, expiredId));
    await createStemMetadata({ stemId: expiredId, bpm: 120, key: "C", instrumentType: "guitar" } as any);

    // the fresh stem is in-window + unminted → still public (expired-only filter, not minted-only)
    await createStemMetadata({ stemId: freshId, bpm: 121, key: "C", instrumentType: "guitar" } as any);

    const publicIds = (await getAllPublicStems(100)).map((s) => s.id);
    const matchIds = (await getMatchableStemMetadata()).map((m) => m.stemId);
    const ownerIds = (await getUserStems(userId)).map((s) => s.id);

    check("T4: expired-unminted absent from public catalog", !publicIds.includes(expiredId));
    check("T4: expired-unminted absent from match input", !matchIds.includes(expiredId));
    check("T4: expired-unminted still visible to owner", ownerIds.includes(expiredId));
    check("T4: in-window unminted still public (expired-only, not minted-only)", publicIds.includes(freshId));
    check("T4: in-window unminted still in match input", matchIds.includes(freshId));
  } finally {
    if (created.length) await db.delete(stemMetadata).where(inArray(stemMetadata.stemId, created));
    for (const id of created) await deleteStem(id);
    await db.delete(stems).where(eq(stems.fileName, `${SMOKE} fresh.wav`));
    await db.delete(stems).where(eq(stems.fileName, `${SMOKE} expired.wav`));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
