import { and, desc, eq, gte, lte, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  invitations, type InsertInvitation,
  stems, type InsertStem,
  stemMetadata, type InsertStemMetadata,
  ownershipLicensing,
  stemCollections,
  collectionStems,
  matchingScores,
  matchNotifications,
  bandlabProjects,
  stemFlags,
  mintQueue, type InsertMintQueueEntry,
  songs, type InsertSong,
  collaborationSplits, type InsertCollaborationSplit,
  authChallenges, type InsertAuthChallenge,
  waitlist,
  bugReports,
  newsfeedPosts,
  newsfeedReactions,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USERS ============

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByWalletAddress(wallet: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserFromMagicLink(data: {
  email: string;
  role: "user" | "admin";
  invitedBy: number | null;
  isVerified: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const email = data.email.toLowerCase();
  return db.insert(users).values({
    openId: email,           // magic-link users: openId = email
    email,
    loginMethod: "magic-link",
    role: data.role,
    invitedBy: data.invitedBy,
    isVerified: data.isVerified,
    lastSignedIn: new Date(),
  });
}

export async function createUserFromSiws(data: {
  walletAddress: string;
  role: "user" | "admin";
  invitedBy: number | null;
  isVerified: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(users).values({
    openId: data.walletAddress,   // SIWS users: openId = wallet address
    walletAddress: data.walletAddress,
    loginMethod: "siws",
    role: data.role,
    invitedBy: data.invitedBy,
    isVerified: data.isVerified,
    lastSignedIn: new Date(),
  });
}

export async function setUserWalletAddress(userId: number, walletAddress: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ walletAddress }).where(eq(users.id, userId));
}

export async function touchUserSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: {
  artistName?: string;
  bio?: string;
  bandlabUrl?: string;
  spotifyUrl?: string;
  websiteUrl?: string;
  walletAddress?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function verifyUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ isVerified: true }).where(eq(users.id, userId));
}

// ============ INVITATIONS ============

export async function createInvitation(data: InsertInvitation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(invitations).values(data);
  return result.insertId;
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getInvitationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).where(eq(invitations.createdBy, userId)).orderBy(desc(invitations.createdAt));
}

export async function useInvitation(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invitations).set({ usedBy: userId, usedAt: new Date() }).where(eq(invitations.token, token));
}

/**
 * Atomically mark an invitation used by looking up the invitee via email/wallet.
 * Used by the new auth flows where the user row is created in the same transaction.
 */
export async function useInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const invite = await getInvitationByToken(token);
  if (!invite) return;
  // Find the user we just created, either by email (magic-link) or wallet (siws).
  // Cheap heuristic: most recently created user becomes the invite consumer.
  const recent = await db.select().from(users).orderBy(desc(users.createdAt)).limit(1);
  const usedBy = recent[0]?.id ?? null;
  await db.update(invitations).set({ usedBy, usedAt: new Date() }).where(eq(invitations.token, token));
}

// ============ AUTH CHALLENGES ============

export async function createAuthChallenge(data: InsertAuthChallenge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(authChallenges).values(data);
}

export async function getAuthChallengeByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(authChallenges).where(eq(authChallenges.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function markAuthChallengeUsed(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(authChallenges).set({ usedAt: new Date() }).where(eq(authChallenges.id, id));
}

// ============ STEMS ============

// The 7-day upload→mint window. The deadline is a server fact set at creation so the client
// never has to compute it from createdAt. See [[project_stem_mint_countdown]] design.
export const MINT_WINDOW_DAYS = 7;

export async function createStem(data: InsertStem): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const mintDeadline =
    data.mintDeadline ?? new Date(Date.now() + MINT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [result] = await db.insert(stems).values({ ...data, mintDeadline });
  return result.insertId;
}

export async function getStemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stems).where(eq(stems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserStems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(stems).where(eq(stems.userId, userId)).orderBy(desc(stems.createdAt));
  if (rows.length === 0) return rows.map(s => ({ ...s, collectionId: null as number | null, collectionName: null as string | null }));
  const links = await db
    .select({
      stemId: collectionStems.stemId,
      collectionId: collectionStems.collectionId,
      name: stemCollections.name,
    })
    .from(collectionStems)
    .innerJoin(stemCollections, eq(collectionStems.collectionId, stemCollections.id))
    .where(inArray(collectionStems.stemId, rows.map(s => s.id)));
  const byStem = new Map<number, { collectionId: number; name: string }>();
  for (const l of links) if (!byStem.has(l.stemId)) byStem.set(l.stemId, { collectionId: l.collectionId, name: l.name });
  return rows.map(s => ({
    ...s,
    collectionId: (byStem.get(s.id)?.collectionId ?? null) as number | null,
    collectionName: (byStem.get(s.id)?.name ?? null) as string | null,
  }));
}

export async function getAllPublicStems(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stems).where(eq(stems.isFlagged, false)).orderBy(desc(stems.createdAt)).limit(limit);
}

export async function updateStemNft(stemId: number, data: {
  nftTokenId: string;
  nftTxHash: string;
  nftContractAddress: string;
  nftChain: string;
  isMinted: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(stems).set(data).where(eq(stems.id, stemId));
}

export async function deleteStem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(stems).where(eq(stems.id, id));
}

// ============ STEM METADATA ============

export async function createStemMetadata(data: InsertStemMetadata) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stemMetadata).values(data);
}

export async function getStemMetadata(stemId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stemMetadata).where(eq(stemMetadata.stemId, stemId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllStemMetadata() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stemMetadata);
}

export async function updateStemMetadata(stemId: number, data: Partial<InsertStemMetadata>) {
  const db = await getDb();
  if (!db) return;
  await db.update(stemMetadata).set(data).where(eq(stemMetadata.stemId, stemId));
}

// ============ OWNERSHIP ============

export async function createOwnershipLicensing(data: {
  stemId: number;
  creatorId: number;
  licenseType?: "cc0" | "cc-by" | "cc-by-nc" | "proprietary";
  royaltyPercentage?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ownershipLicensing).values({
    stemId: data.stemId,
    creatorId: data.creatorId,
    licenseType: data.licenseType ?? "cc-by",
    royaltyPercentage: data.royaltyPercentage ?? 0,
  });
}

export async function getOwnershipLicensing(stemId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ownershipLicensing).where(eq(ownershipLicensing.stemId, stemId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ WAITLIST ============

export async function addToWaitlist(email: string): Promise<{ alreadyOnList: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);
  if (existing.length > 0) return { alreadyOnList: true };
  await db.insert(waitlist).values({ email });
  return { alreadyOnList: false };
}

// ============ MATCHING SCORES ============

export async function cacheMatchingScore(data: {
  stemId1: number;
  stemId2: number;
  totalScore: number;
  bpmScore?: number;
  keyScore?: number;
  timbreScore?: number;
  genreScore?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(matchingScores).values(data);
}

export async function getMatchingScore(stemId1: number, stemId2: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(matchingScores).where(
    or(
      and(eq(matchingScores.stemId1, stemId1), eq(matchingScores.stemId2, stemId2)),
      and(eq(matchingScores.stemId1, stemId2), eq(matchingScores.stemId2, stemId1))
    )
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ MATCH NOTIFICATIONS ============

export async function createMatchNotification(data: {
  toUserId: number;
  fromUserId: number;
  stemId1: number;
  stemId2: number;
  score: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(matchNotifications).values(data);
}

export async function getUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(matchNotifications)
    .where(and(eq(matchNotifications.toUserId, userId), eq(matchNotifications.isRead, false)))
    .orderBy(desc(matchNotifications.createdAt));
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(matchNotifications).set({ isRead: true }).where(eq(matchNotifications.id, id));
}

// ============ COLLECTIONS ============

export async function createCollection(data: { userId: number; name: string; description?: string; isPublic?: boolean }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(stemCollections).values({
    userId: data.userId,
    name: data.name,
    description: data.description,
    isPublic: data.isPublic ?? false,
  });
  return result.insertId;
}

export async function getUserCollections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stemCollections).where(eq(stemCollections.userId, userId)).orderBy(desc(stemCollections.createdAt));
}

export async function addStemToCollection(collectionId: number, stemId: number, order = 0) {
  const db = await getDb();
  if (!db) return;
  await db.insert(collectionStems).values({ collectionId, stemId, order });
}

/**
 * Set a stem's collection (single-collection model used by the card dropdown):
 * clears any existing membership, then joins the given collection if non-null.
 */
export async function setStemCollection(stemId: number, collectionId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.delete(collectionStems).where(eq(collectionStems.stemId, stemId));
  if (collectionId != null) {
    await db.insert(collectionStems).values({ collectionId, stemId, order: 0 });
  }
}

// ============ BANDLAB PROJECTS ============

export async function createBandlabProject(data: { userId: number; projectUrl: string; projectName?: string; parsedData?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(bandlabProjects).values({
    userId: data.userId,
    projectUrl: data.projectUrl,
    projectName: data.projectName,
    parsedData: data.parsedData as any,
  });
}

export async function getUserBandlabProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bandlabProjects).where(eq(bandlabProjects.userId, userId)).orderBy(desc(bandlabProjects.importedAt));
}

// ============ STEM FLAGS ============

export async function createStemFlag(data: {
  stemId: number;
  reportedBy: number;
  reason: "copyright" | "inappropriate" | "spam" | "other";
  details?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stemFlags).values(data);
}

export async function getStemFlags(stemId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stemFlags).where(eq(stemFlags.stemId, stemId));
}

export async function getAllPendingFlags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stemFlags).where(eq(stemFlags.status, "pending")).orderBy(desc(stemFlags.createdAt));
}

// ============ SOLANA STEM MINT STATUS ============

export async function updateStemMintStatus(
  stemId: number,
  status: "none" | "pending" | "minted" | "failed",
  extra: {
    solanaTxSig?: string;
    solanaMerkleTree?: string;
    solanaLeafIndex?: number;
    solanaNetwork?: string;
    nftMetadataUri?: string;
    isMinted?: boolean;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { mintStatus: status };
  if (extra.solanaTxSig !== undefined) updateData.solanaTxSig = extra.solanaTxSig;
  if (extra.solanaMerkleTree !== undefined) updateData.solanaMerkleTree = extra.solanaMerkleTree;
  if (extra.solanaLeafIndex !== undefined) updateData.solanaLeafIndex = extra.solanaLeafIndex;
  if (extra.solanaNetwork !== undefined) updateData.solanaNetwork = extra.solanaNetwork;
  if (extra.nftMetadataUri !== undefined) updateData.nftMetadataUri = extra.nftMetadataUri;
  if (extra.isMinted !== undefined) updateData.isMinted = extra.isMinted;
  return db.update(stems).set(updateData as any).where(eq(stems.id, stemId));
}

// ============ MINT QUEUE ============

export async function createMintQueueEntry(data: {
  type: "stem" | "song";
  referenceId: number;
  requestedBy: number;
  artistWalletAddress: string;
  metadataUri?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(mintQueue).values({
    type: data.type,
    referenceId: data.referenceId,
    requestedBy: data.requestedBy,
    artistWalletAddress: data.artistWalletAddress,
    metadataUri: data.metadataUri,
    status: "pending",
    attempts: 0,
  });
  return result.insertId;
}

export async function getMintQueueEntryByStem(stemId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(mintQueue)
    .where(eq(mintQueue.referenceId, stemId))
    .orderBy(desc(mintQueue.createdAt))
    .limit(1);
  return results[0] ?? null;
}

export async function getUserMintQueue(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mintQueue)
    .where(eq(mintQueue.requestedBy, userId))
    .orderBy(desc(mintQueue.createdAt));
}

export async function getPendingMintQueue() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mintQueue)
    .where(eq(mintQueue.status, "pending"))
    .orderBy(mintQueue.createdAt);
}

export async function updateMintQueueEntry(
  id: number,
  data: {
    status?: "pending" | "processing" | "complete" | "failed";
    solanaTxSig?: string;
    errorMessage?: string;
    attempts?: number;
    processedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) return;
  return db.update(mintQueue).set(data as any).where(eq(mintQueue.id, id));
}

// ============ SONGS ============

export async function createSong(data: {
  title: string;
  createdBy: number;
  stemIds: number[];
  collaboratorIds: number[];
  stemCount: number;
  collaboratorCount: number;
  genres?: string[];
  coverImageUrl?: string;
  splitType?: "equal" | "custom";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(songs).values({
    title: data.title,
    createdBy: data.createdBy,
    stemIds: data.stemIds,
    collaboratorIds: data.collaboratorIds,
    stemCount: data.stemCount,
    collaboratorCount: data.collaboratorCount,
    genres: data.genres,
    coverImageUrl: data.coverImageUrl,
    splitType: data.splitType ?? "equal",
    mintStatus: "none",
  });
}

export async function getSongById(songId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  return results[0] ?? null;
}

export async function getUserSongs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(songs)
    .where(eq(songs.createdBy, userId))
    .orderBy(desc(songs.createdAt));
}

export async function updateSongMintStatus(
  songId: number,
  status: "none" | "pending" | "minted" | "failed",
  extra: {
    metadataUri?: string;
    solanaMintAddress?: string;
    solanaTxSig?: string;
    solanaNetwork?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { mintStatus: status };
  if (extra.metadataUri !== undefined) updateData.metadataUri = extra.metadataUri;
  if (extra.solanaMintAddress !== undefined) updateData.solanaMintAddress = extra.solanaMintAddress;
  if (extra.solanaTxSig !== undefined) updateData.solanaTxSig = extra.solanaTxSig;
  if (extra.solanaNetwork !== undefined) updateData.solanaNetwork = extra.solanaNetwork;
  return db.update(songs).set(updateData as any).where(eq(songs.id, songId));
}

// ============ COLLABORATION SPLITS ============

export async function createCollaborationSplit(data: {
  songId: number;
  userId: number;
  walletAddress: string;
  stemCount: number;
  splitBps: number;
  splitPercent: number;
  isCustom?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(collaborationSplits).values({
    songId: data.songId,
    userId: data.userId,
    walletAddress: data.walletAddress,
    stemCount: data.stemCount,
    splitBps: data.splitBps,
    splitPercent: data.splitPercent,
    isCustom: data.isCustom ?? false,
  });
}

export async function getSongSplits(songId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(collaborationSplits)
    .where(eq(collaborationSplits.songId, songId))
    .orderBy(desc(collaborationSplits.splitBps));
}

// ============ USER DIRECTORY ============

/**
 * Roster of all members for the user-list page. Deliberately excludes email
 * and other private fields — only display identity and join date.
 */
export async function listMembers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      artistName: users.artistName,
      bio: users.bio,
      role: users.role,
      isVerified: users.isVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

// ============ BUG REPORTS ============

export async function createBugReport(data: {
  reportedBy: number;
  description: string;
  severity: "critical" | "severe" | "irritating";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(bugReports).values(data);
}

export async function listBugReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bugReports).orderBy(desc(bugReports.createdAt));
}

export async function setBugStatus(
  id: number,
  status: "open" | "in_progress" | "resolved" | "wont_fix",
) {
  const db = await getDb();
  if (!db) return;
  await db.update(bugReports).set({ status }).where(eq(bugReports.id, id));
}

export async function setStemShowOnProfile(stemId: number, showOnProfile: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(stems).set({ showOnProfile }).where(eq(stems.id, stemId));
}

// ============ NEWSFEED ============

export async function createNewsfeedPost(data: {
  authorId: number;
  body?: string;
  attachments?: { type: "image" | "audio" | "video" | "link"; url: string; name?: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(newsfeedPosts).values({
    authorId: data.authorId,
    body: data.body,
    attachments: data.attachments,
  });
  return result.insertId;
}

export async function listNewsfeedPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Join author identity + reactions so the client can render in one pass.
  const posts = await db
    .select({
      id: newsfeedPosts.id,
      authorId: newsfeedPosts.authorId,
      authorName: users.artistName,
      authorFallback: users.name,
      body: newsfeedPosts.body,
      attachments: newsfeedPosts.attachments,
      createdAt: newsfeedPosts.createdAt,
    })
    .from(newsfeedPosts)
    .leftJoin(users, eq(newsfeedPosts.authorId, users.id))
    .orderBy(desc(newsfeedPosts.createdAt))
    .limit(limit);
  if (posts.length === 0) return [];
  const postIds = posts.map(p => p.id);
  const reactions = await db
    .select()
    .from(newsfeedReactions)
    .where(inArray(newsfeedReactions.postId, postIds));
  return posts.map(p => {
    const own = reactions.filter(r => r.postId === p.id);
    return {
      ...p,
      authorName: p.authorName ?? p.authorFallback ?? "Member",
      reactions: {
        up: own.filter(r => r.type === "up").length,
        down: own.filter(r => r.type === "down").length,
        heart: own.filter(r => r.type === "heart").length,
      },
      reactors: own.map(r => ({ userId: r.userId, type: r.type })),
    };
  });
}

export async function deleteNewsfeedPost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(newsfeedReactions).where(eq(newsfeedReactions.postId, id));
  await db.delete(newsfeedPosts).where(eq(newsfeedPosts.id, id));
}

/**
 * Set or toggle a user's reaction on a post. Passing the type they already
 * hold clears it; a different type replaces it. At most one row per (post,user).
 */
export async function setNewsfeedReaction(
  postId: number,
  userId: number,
  type: "up" | "down" | "heart",
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(newsfeedReactions)
    .where(and(eq(newsfeedReactions.postId, postId), eq(newsfeedReactions.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .delete(newsfeedReactions)
      .where(and(eq(newsfeedReactions.postId, postId), eq(newsfeedReactions.userId, userId)));
    if (existing[0].type === type) return; // same reaction → cleared
  }
  await db.insert(newsfeedReactions).values({ postId, userId, type });
}
