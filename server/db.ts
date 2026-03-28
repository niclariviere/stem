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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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

export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(invitations).values(data);
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

// ============ STEMS ============

export async function createStem(data: InsertStem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stems).values(data);
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
  return db.select().from(stems).where(eq(stems.userId, userId)).orderBy(desc(stems.createdAt));
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

export async function createCollection(data: { userId: number; name: string; description?: string; isPublic?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stemCollections).values({
    userId: data.userId,
    name: data.name,
    description: data.description,
    isPublic: data.isPublic ?? false,
  });
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
