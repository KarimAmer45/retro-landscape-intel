import type { NormalizedGame, RankedGame, Recommendation, ScoreBreakdown } from "./model.js";

const REVIVAL_TERMS = [
  "arcade", "atari", "classic", "collection", "pixel", "remake", "remaster",
  "retro", "shoot 'em up", "bullet hell", "platformer"
];

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function logScale(value: number, cohortMaximum: number): number {
  if (value <= 0 || cohortMaximum <= 0) return 0;
  return Math.log1p(value) / Math.log1p(cohortMaximum);
}

export function wilsonLowerBound(positive: number, negative: number): number {
  const total = positive + negative;
  if (total === 0) return 0;
  const z = 1.96;
  const proportion = positive / total;
  const denominator = 1 + z ** 2 / total;
  const centre = proportion + z ** 2 / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + z ** 2 / (4 * total)) / total);
  return (centre - margin) / denominator;
}

function signalTerms(game: NormalizedGame): string[] {
  const haystack = [game.name, ...game.genres, ...game.tags].join(" ").toLowerCase();
  return REVIVAL_TERMS.filter((term) => haystack.includes(term));
}

function recommendation(score: number): Recommendation {
  if (score >= 70) return "pursue";
  if (score >= 50) return "park";
  return "pass";
}

export function rankGames(games: NormalizedGame[]): RankedGame[] {
  if (games.length === 0) return [];
  const maxReviews = Math.max(...games.map((game) => game.positiveReviews + game.negativeReviews));
  const maxCcu = Math.max(...games.map((game) => game.concurrentUsers));
  const maxPlaytime = Math.max(...games.map((game) => game.averagePlaytimeTwoWeeksMinutes));

  const scored = games.map((game) => {
    const reviewCount = game.positiveReviews + game.negativeReviews;
    const positiveShare = reviewCount === 0 ? 0 : game.positiveReviews / reviewCount;
    const signals = signalTerms(game);
    const breakdown: ScoreBreakdown = {
      reviewEvidence: round(35 * logScale(reviewCount, maxReviews), 2),
      reviewQuality: round(20 * wilsonLowerBound(game.positiveReviews, game.negativeReviews), 2),
      currentAttention: round(25 * logScale(game.concurrentUsers, maxCcu), 2),
      engagementDepth: round(10 * logScale(game.averagePlaytimeTwoWeeksMinutes, maxPlaytime), 2),
      revivalSignal: round(10 * Math.min(1, signals.length / 3), 2)
    };
    const score = round(Object.values(breakdown).reduce((sum, value) => sum + value, 0));

    return { ...game, rank: 0, score, recommendation: recommendation(score), reviewCount, positiveShare, breakdown, signals };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name))
    .map((game, index) => ({ ...game, rank: index + 1 }));
}
