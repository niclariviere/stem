import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, createStem, getStemById, deleteStem, MINT_WINDOW_DAYS } from "../server/db";
import { users, stems } from "../drizzle/schema";

// Self-cleaning smoke test for the 7-day mint window (T3: deadline-on-creation).
// Run: pnpm tsx scripts/smoke-mint-window.ts

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  // Need a real user id (FK-ish on stems.userId).
  const [someUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!someUser) throw new Error("No users in DB to attach a test stem to");

  let stemId: number | undefined;
  try {
    // ---- T3: createStem sets mintDeadline = now + 7d ----
    const before = Date.now();
    stemId = await createStem({
      userId: someUser.id,
      fileName: "[[SMOKE]] mint-window test.wav",
    } as any);
    const row = await getStemById(stemId);
    check("createStem returns an id", !!stemId);
    check("mintDeadline is set on creation", !!row?.mintDeadline);

    if (row?.mintDeadline) {
      const deadline = new Date(row.mintDeadline as any).getTime();
      const expected = before + MINT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      // within 5 minutes of expected (clock + insert latency tolerance)
      const driftMin = Math.abs(deadline - expected) / 60000;
      check(`mintDeadline ≈ createdAt + ${MINT_WINDOW_DAYS}d (drift ${driftMin.toFixed(2)}min < 5)`, driftMin < 5);
    }
  } finally {
    if (stemId) await deleteStem(stemId);
    // belt-and-suspenders: nuke any stray smoke rows
    await db.delete(stems).where(eq(stems.fileName, "[[SMOKE]] mint-window test.wav"));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
