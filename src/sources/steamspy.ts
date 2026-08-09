import type { NormalizedGame } from "../model.js";
import { steamSpyGameSchema, steamSpyPayloadSchema, type SteamSpyGame } from "./types.js";

export interface SteamSpyClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface FetchTagOptions {
  tag: string;
  maxRecords: number;
}

export interface FetchTagResult {
  /** Validated records retained after the review-count sort and the `maxRecords` cap. */
  games: NormalizedGame[];
  /** Objects returned by the endpoint. */
  receivedCount: number;
  /** Objects that passed schema validation, before the `maxRecords` cap. */
  acceptedCount: number;
  /** Objects that failed schema validation. */
  rejectedCount: number;
  retrievedAt: string;
}

const DEFAULT_BASE_URL = "https://steamspy.com/api.php";

/** Marks a response the caller must not retry, such as a 4xx other than 429. */
class NonRetryableError extends Error {}

function parseOwners(value: string): [number, number] {
  const matches = value.match(/[\d,]+/g) ?? [];
  const numbers = matches.map((entry) => Number(entry.replaceAll(",", "")));
  return [numbers[0] ?? 0, numbers[1] ?? numbers[0] ?? 0];
}

function splitCsv(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function normalize(game: SteamSpyGame, queryTag: string, retrievedAt: string): NormalizedGame {
  const [ownersLow, ownersHigh] = parseOwners(game.owners);
  const tags = new Set([queryTag, ...Object.keys(game.tags)]);

  return {
    source: "steamspy",
    sourceId: String(game.appid),
    name: game.name.trim(),
    developer: game.developer.trim(),
    publisher: game.publisher.trim(),
    ownersLow,
    ownersHigh,
    positiveReviews: Math.round(game.positive),
    negativeReviews: Math.round(game.negative),
    averagePlaytimeForeverMinutes: game.average_forever,
    averagePlaytimeTwoWeeksMinutes: game.average_2weeks,
    concurrentUsers: Math.round(game.ccu),
    priceCents: Math.round(game.price),
    discountPercent: Math.min(100, game.discount),
    genres: splitCsv(game.genre),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
    sourceUrl: `https://steamspy.com/app/${game.appid}`,
    retrievedAt
  };
}

function retryDelay(attempt: number): number {
  return Math.min(8_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 150);
}

export class SteamSpyClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: SteamSpyClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async fetchTag(options: FetchTagOptions): Promise<FetchTagResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("request", "tag");
    url.searchParams.set("tag", options.tag);
    const payload = await this.fetchJsonWithBackoff(url);
    const rawItems = Object.values(steamSpyPayloadSchema.parse(payload));
    const retrievedAt = new Date().toISOString();
    const games: NormalizedGame[] = [];
    let rejectedCount = 0;

    for (const rawItem of rawItems) {
      const parsed = steamSpyGameSchema.safeParse(rawItem);
      if (!parsed.success) {
        rejectedCount += 1;
        continue;
      }
      games.push(normalize(parsed.data, options.tag, retrievedAt));
    }

    games.sort((a, b) => (b.positiveReviews + b.negativeReviews) - (a.positiveReviews + a.negativeReviews));

    return {
      games: games.slice(0, options.maxRecords),
      receivedCount: rawItems.length,
      acceptedCount: games.length,
      rejectedCount,
      retrievedAt
    };
  }

  private async fetchJsonWithBackoff(url: URL): Promise<unknown> {
    let lastError: unknown;
    let attemptsMade = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      attemptsMade = attempt + 1;

      try {
        const response = await this.fetchImpl(url, {
          headers: { "accept": "application/json", "user-agent": "retro-landscape-intel/1.0" },
          signal: controller.signal
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable) throw new NonRetryableError(`SteamSpy returned HTTP ${response.status}.`);
          throw new Error(`SteamSpy temporarily returned HTTP ${response.status}.`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if (error instanceof NonRetryableError || attempt === this.maxRetries) break;
        await this.sleep(retryDelay(attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    const plural = attemptsMade === 1 ? "attempt" : "attempts";
    throw new Error(`SteamSpy request failed after ${attemptsMade} ${plural}: ${detail}`);
  }
}
