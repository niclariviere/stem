import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  getDb,
  listMembers,
  createBugReport,
  listBugReports,
  createNewsfeedPost,
  listNewsfeedPosts,
  setNewsfeedReaction,
  deleteNewsfeedPost,
} from "../server/db";
import { bugReports } from "../drizzle/schema";

const MARK = "[[SMOKE-TEST]]";
let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("No DB connection — is DATABASE_URL set?");

  // --- members ---
  const members = await listMembers();
  check(`listMembers returns rows (${members.length})`, members.length > 0);
  check("listMembers omits email", members.every((m: any) => !("email" in m)));
  const uid = (members.find((m: any) => m.role === "admin") ?? members[0]).id as number;
  console.log(`   using userId=${uid}`);

  // --- bug report ---
  await createBugReport({ reportedBy: uid, description: `${MARK} test bug`, severity: "critical" });
  const bugs = await listBugReports();
  const myBug = bugs.find((b: any) => b.description?.includes(MARK));
  check("createBugReport + listBugReports round-trips", !!myBug);
  check("bug severity stored", myBug?.severity === "critical");
  check("bug status defaults to open", myBug?.status === "open");

  // --- newsfeed post ---
  const postId = await createNewsfeedPost({
    authorId: uid,
    body: `${MARK} hello feed`,
    attachments: [{ type: "link", url: "https://example.com", name: "example" }],
  });
  check("createNewsfeedPost returns numeric id", typeof postId === "number" && postId > 0);

  let feed = await listNewsfeedPosts();
  let mine = feed.find((p: any) => p.id === postId);
  check("post appears in feed", !!mine);
  check("post carries authorName from join", !!mine?.authorName && mine.authorName !== "Member");
  check("attachment persisted as array", Array.isArray(mine?.attachments) && mine.attachments.length === 1);
  check("reactions start at zero", mine?.reactions.up === 0 && mine?.reactions.down === 0 && mine?.reactions.heart === 0);

  // --- reactions: set, toggle-off, switch ---
  await setNewsfeedReaction(postId, uid, "up");
  feed = await listNewsfeedPosts();
  mine = feed.find((p: any) => p.id === postId);
  check("react up → count 1", mine?.reactions.up === 1);
  check("reactor recorded", mine?.reactors.some((r: any) => r.userId === uid && r.type === "up"));

  await setNewsfeedReaction(postId, uid, "up"); // same → clears
  feed = await listNewsfeedPosts();
  mine = feed.find((p: any) => p.id === postId);
  check("re-react same → toggles off (up back to 0)", mine?.reactions.up === 0);

  await setNewsfeedReaction(postId, uid, "up");
  await setNewsfeedReaction(postId, uid, "heart"); // switch
  feed = await listNewsfeedPosts();
  mine = feed.find((p: any) => p.id === postId);
  check("switch reaction → up 0, heart 1", mine?.reactions.up === 0 && mine?.reactions.heart === 1);
  check("at most one reaction per user", mine?.reactors.filter((r: any) => r.userId === uid).length === 1);

  // --- delete cascades reactions ---
  await deleteNewsfeedPost(postId);
  feed = await listNewsfeedPosts();
  check("deleteNewsfeedPost removes post", !feed.some((p: any) => p.id === postId));

  // --- cleanup bug rows ---
  await db.delete(bugReports).where(eq(bugReports.description, `${MARK} test bug`));
  const after = await listBugReports();
  check("smoke bug rows cleaned up", !after.some((b: any) => b.description?.includes(MARK)));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error("SMOKE ERROR:", e);
  process.exit(1);
});
