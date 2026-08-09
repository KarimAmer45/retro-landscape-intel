import { z } from "zod";

export const recommendationSchema = z.enum(["pursue", "park", "pass"]);

export const normalizedGameSchema = z.object({
  source: z.literal("steamspy"),
  sourceId: z.string().min(1),
  name: z.string().min(1),
  developer: z.string(),
  publisher: z.string(),
  ownersLow: z.number().int().nonnegative(),
  ownersHigh: z.number().int().nonnegative(),
  positiveReviews: z.number().int().nonnegative(),
  negativeReviews: z.number().int().nonnegative(),
  averagePlaytimeForeverMinutes: z.number().nonnegative(),
  averagePlaytimeTwoWeeksMinutes: z.number().nonnegative(),
  concurrentUsers: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  discountPercent: z.number().min(0).max(100),
  genres: z.array(z.string()),
  tags: z.array(z.string()),
  sourceUrl: z.url(),
  retrievedAt: z.iso.datetime()
});

export const storeSchema = z.object({
  schemaVersion: z.literal(1),
  query: z.object({
    source: z.literal("steamspy"),
    tag: z.string(),
    maxRecords: z.number().int().positive()
  }),
  ingestion: z.object({
    /** Objects returned by the source endpoint. */
    received: z.number().int().nonnegative(),
    /** Objects that passed schema validation; `received` minus `rejected`. */
    accepted: z.number().int().nonnegative(),
    /** Objects that failed schema validation. */
    rejected: z.number().int().nonnegative(),
    /** Accepted records kept after the record cap; equals `games.length`. */
    retained: z.number().int().nonnegative().default(0)
  }).default({ received: 0, accepted: 0, rejected: 0, retained: 0 }),
  retrievedAt: z.iso.datetime(),
  games: z.array(normalizedGameSchema)
});

export type NormalizedGame = z.infer<typeof normalizedGameSchema>;
export type GameStore = z.infer<typeof storeSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;

export interface ScoreBreakdown {
  reviewEvidence: number;
  reviewQuality: number;
  currentAttention: number;
  engagementDepth: number;
  revivalSignal: number;
}

export interface RankedGame extends NormalizedGame {
  rank: number;
  score: number;
  recommendation: Recommendation;
  reviewCount: number;
  positiveShare: number;
  breakdown: ScoreBreakdown;
  signals: string[];
}
