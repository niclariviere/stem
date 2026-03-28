import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { calculateMatchingScore, findCompatibleStems, filterStems } from "./lib/matchingEngine";
import { ENV } from "./_core/env";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── INVITATIONS ──────────────────────────────────────────────────────────────
  invitations: router({
    /**
     * Generate a new invitation token (verified users only)
     */
    create: protectedProcedure
      .input(z.object({ origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.isVerified && user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only verified users can generate invitations" });
        }
        const token = nanoid(32);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await db.createInvitation({ token, createdBy: ctx.user.id, expiresAt });
        const inviteUrl = `${input.origin}/login?invite=${token}`;
        return { token, inviteUrl, expiresAt };
      }),

    /**
     * Validate an invitation token
     */
    validate: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const inv = await db.getInvitationByToken(input.token);
        if (!inv) return { valid: false, reason: "Token not found" };
        if (inv.usedBy) return { valid: false, reason: "Token already used" };
        if (inv.expiresAt && inv.expiresAt < new Date()) return { valid: false, reason: "Token expired" };
        return { valid: true };
      }),

    /**
     * Use an invitation token (called after OAuth login)
     */
    use: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const inv = await db.getInvitationByToken(input.token);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invitation token" });
        if (inv.usedBy) throw new TRPCError({ code: "BAD_REQUEST", message: "Token already used" });
        if (inv.expiresAt && inv.expiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Token expired" });
        await db.useInvitation(input.token, ctx.user.id);
        await db.verifyUser(ctx.user.id);
        return { success: true };
      }),

    /**
     * List invitations created by current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getInvitationsByUser(ctx.user.id);
    }),
  }),

  // ── PROFILE ───────────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const userStems = await db.getUserStems(ctx.user.id);
      const mintedStems = userStems.filter(s => s.isMinted);
      const notifications = await db.getUnreadNotifications(ctx.user.id);
      const collections = await db.getUserCollections(ctx.user.id);
      const bandlabProjects = await db.getUserBandlabProjects(ctx.user.id);
      return {
        user,
        stats: {
          stems: userStems.length,
          minted: mintedStems.length,
          matches: notifications.length,
          collections: collections.length,
        },
        notifications,
        bandlabProjects,
      };
    }),

    update: protectedProcedure
      .input(z.object({
        artistName: z.string().max(100).optional(),
        bio: z.string().max(1000).optional(),
        bandlabUrl: z.string().url().optional().or(z.literal("")),
        spotifyUrl: z.string().url().optional().or(z.literal("")),
        websiteUrl: z.string().url().optional().or(z.literal("")),
        walletAddress: z.string().length(42).optional().or(z.literal("")),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ── STEMS ─────────────────────────────────────────────────────────────────────
  stems: router({
    create: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        ipfsCid: z.string().optional(),
        ipfsUrl: z.string().optional(),
        stemUri: z.string().optional(),
        duration: z.number().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createStem({
          userId: ctx.user.id,
          fileName: input.fileName,
          ipfsCid: input.ipfsCid,
          ipfsUrl: input.ipfsUrl,
          stemUri: input.stemUri,
          duration: input.duration,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
        });
        const stemId = (result as any)?.insertId ?? 0;
        if (stemId) {
          await db.createOwnershipLicensing({ stemId, creatorId: ctx.user.id });
        }
        return { id: stemId };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserStems(ctx.user.id);
    }),

    listPublic: publicProcedure.query(async () => {
      return db.getAllPublicStems(50);
    }),

    getById: publicProcedure
      .input(z.object({ stemId: z.number() }))
      .query(async ({ input }) => {
        const stem = await db.getStemById(input.stemId);
        if (!stem) throw new TRPCError({ code: "NOT_FOUND" });
        const metadata = await db.getStemMetadata(input.stemId);
        const ownership = await db.getOwnershipLicensing(input.stemId);
        return { stem, metadata, ownership };
      }),

    delete: protectedProcedure
      .input(z.object({ stemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const stem = await db.getStemById(input.stemId);
        if (!stem || stem.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await db.deleteStem(input.stemId);
        return { success: true };
      }),

    updateNft: protectedProcedure
      .input(z.object({
        stemId: z.number(),
        nftTokenId: z.string(),
        nftTxHash: z.string(),
        nftContractAddress: z.string(),
        nftChain: z.string().default("base-sepolia"),
      }))
      .mutation(async ({ ctx, input }) => {
        const stem = await db.getStemById(input.stemId);
        if (!stem || stem.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateStemNft(input.stemId, { ...input, isMinted: true });
        return { success: true };
      }),
  }),

  // ── METADATA ─────────────────────────────────────────────────────────────────
  metadata: router({
    save: protectedProcedure
      .input(z.object({
        stemId: z.number(),
        bpm: z.number().optional(),
        key: z.string().optional(),
        instrumentType: z.string().optional(),
        genreTags: z.array(z.string()).optional(),
        energyLevel: z.number().min(0).max(1).optional(),
        mfccVector: z.array(z.number()).optional(),
        waveformData: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const stem = await db.getStemById(input.stemId);
        if (!stem || stem.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const existing = await db.getStemMetadata(input.stemId);
        if (existing) {
          await db.updateStemMetadata(input.stemId, input);
        } else {
          await db.createStemMetadata(input);
        }
        return { success: true };
      }),

    getById: publicProcedure
      .input(z.object({ stemId: z.number() }))
      .query(async ({ input }) => {
        return db.getStemMetadata(input.stemId);
      }),
  }),

  // ── MATCHING ─────────────────────────────────────────────────────────────────
  matching: router({
    findCompatible: protectedProcedure
      .input(z.object({
        stemId: z.number(),
        minScore: z.number().min(0).max(1).default(0.55),
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ ctx, input }) => {
        const targetMeta = await db.getStemMetadata(input.stemId);
        if (!targetMeta) throw new TRPCError({ code: "NOT_FOUND", message: "Stem metadata not found" });

        const allMeta = await db.getAllStemMetadata();
        const candidates = allMeta.filter(m => m.stemId !== input.stemId);
        const results = findCompatibleStems(targetMeta, candidates, input.minScore, input.limit);

        // Enrich with stem info
        const enriched = await Promise.all(results.map(async r => {
          const stem = await db.getStemById(r.stem.stemId!);
          const owner = stem ? await db.getUserById(stem.userId) : null;
          return { stem, metadata: r.stem, score: r.score, owner };
        }));

        return enriched.filter(r => r.stem != null);
      }),

    filter: publicProcedure
      .input(z.object({
        bpmMin: z.number().optional(),
        bpmMax: z.number().optional(),
        keys: z.array(z.string()).optional(),
        instrumentTypes: z.array(z.string()).optional(),
        genreTags: z.array(z.string()).optional(),
        energyMin: z.number().optional(),
        energyMax: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const allMeta = await db.getAllStemMetadata();
        return filterStems(allMeta, input);
      }),

    notifyArtist: protectedProcedure
      .input(z.object({
        toUserId: z.number(),
        stemId1: z.number(),
        stemId2: z.number(),
        score: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createMatchNotification({
          toUserId: input.toUserId,
          fromUserId: ctx.user.id,
          stemId1: input.stemId1,
          stemId2: input.stemId2,
          score: input.score,
        });
        return { success: true };
      }),

    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationRead(input.notificationId);
        return { success: true };
      }),
  }),

  // ── COLLECTIONS ──────────────────────────────────────────────────────────────
  collections: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        isPublic: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createCollection({ userId: ctx.user.id, ...input });
        return { id: (result as any)?.insertId ?? 0 };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserCollections(ctx.user.id);
    }),

    addStem: protectedProcedure
      .input(z.object({ collectionId: z.number(), stemId: z.number(), order: z.number().default(0) }))
      .mutation(async ({ ctx, input }) => {
        await db.addStemToCollection(input.collectionId, input.stemId, input.order);
        return { success: true };
      }),
  }),

  // ── BANDLAB ───────────────────────────────────────────────────────────────────
  bandlab: router({
    parseProject: protectedProcedure
      .input(z.object({ projectUrl: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        // Parse BandLab shared project URL for metadata
        // BandLab share URLs: https://www.bandlab.com/post/{id} or https://www.bandlab.com/{user}/sets/{id}
        const urlParts = input.projectUrl.split("/");
        const projectId = urlParts[urlParts.length - 1];

        // Extract metadata from URL pattern (no API key needed)
        const parsedData = {
          projectId,
          projectUrl: input.projectUrl,
          extractedAt: new Date().toISOString(),
          // In production: scrape the public share page for track listing
          tracks: [],
        };

        const result = await db.createBandlabProject({
          userId: ctx.user.id,
          projectUrl: input.projectUrl,
          projectName: `BandLab Project ${projectId}`,
          parsedData,
        });

        return { id: (result as any)?.insertId ?? 0, parsedData };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserBandlabProjects(ctx.user.id);
    }),
  }),

  // ── FLAGS ─────────────────────────────────────────────────────────────────────
  flags: router({
    report: protectedProcedure
      .input(z.object({
        stemId: z.number(),
        reason: z.enum(["copyright", "inappropriate", "spam", "other"]),
        details: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createStemFlag({
          stemId: input.stemId,
          reportedBy: ctx.user.id,
          reason: input.reason,
          details: input.details,
        });
        return { success: true };
      }),

    getForStem: publicProcedure
      .input(z.object({ stemId: z.number() }))
      .query(async ({ input }) => {
        return db.getStemFlags(input.stemId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
