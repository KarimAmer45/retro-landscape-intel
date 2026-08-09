interface Breakdown { currentAttention: number; }
interface RankedGame {
  rank: number; name: string; publisher: string; score: number; recommendation: "pursue" | "park" | "pass";
  reviewCount: number; positiveShare: number; concurrentUsers: number; signals: string[]; sourceUrl: string; breakdown: Breakdown;
  averagePlaytimeTwoWeeksMinutes: number;
}
interface DashboardData { generatedAt: string; sourceRetrievedAt: string; cohortSize: number; games: RankedGame[]; }

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};
/** Both chart bars share the 0-100 point axis; attention can contribute at most this many points. */
const ATTENTION_WEIGHT = 25;
const integer = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const preciseInteger = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character] as string);
}

/** Keeps a hostile data file from turning a row link into javascript: or data: markup. */
function safeUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:" ? escapeHtml(url.href) : "#";
  } catch {
    return "#";
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return sorted[middle] ?? 0;
}

function renderChart(games: RankedGame[]): void {
  $("#score-chart").innerHTML = games.slice(0, 10).map((game) => `
    <div class="chart-row" title="${escapeHtml(game.name)}: ${game.score.toFixed(1)} of 100 total, ${game.breakdown.currentAttention.toFixed(1)} of ${ATTENTION_WEIGHT} attention points">
      <span class="chart-label">${game.rank}. ${escapeHtml(game.name)}</span>
      <span class="chart-track"><i class="chart-total" style="width:${game.score}%"></i><i class="chart-attention" style="width:${game.breakdown.currentAttention}%"></i></span>
      <span class="chart-value">${game.score.toFixed(1)}</span>
    </div>`).join("");
}

function row(game: RankedGame): string {
  const signal = escapeHtml(game.signals.slice(0, 2).join(" · ") || "Retro tag");
  const publisher = escapeHtml(game.publisher || "Publisher not supplied");
  return `<tr>
    <td>${game.rank.toString().padStart(2, "0")}</td>
    <td class="title-cell"><a href="${safeUrl(game.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(game.name)}</a><small>${publisher}</small></td>
    <td><span class="call call-${game.recommendation}">${game.recommendation}</span></td>
    <td>${game.score.toFixed(1)}</td><td>${integer.format(game.reviewCount)}</td><td>${(game.positiveShare * 100).toFixed(1)}%</td><td>${integer.format(game.concurrentUsers)}</td>
    <td class="signal-cell">${signal}</td></tr>`;
}

function renderTable(games: RankedGame[]): void {
  $("#ranked-table").innerHTML = games.map(row).join("");
  $("#row-count").textContent = `${preciseInteger.format(games.length)} records shown`;
  $("#empty-state").hidden = games.length > 0;
}

async function main(): Promise<void> {
  const response = await fetch("/dashboard/data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard data returned HTTP ${response.status}`);
  const data = await response.json() as DashboardData;
  const games = data.games;
  const pursue = games.filter((game) => game.recommendation === "pursue");
  const totalReviews = games.reduce((sum, game) => sum + game.reviewCount, 0);
  const snapshot = new Date(data.sourceRetrievedAt);

  $("#snapshot-status").textContent = `SteamSpy snapshot · ${snapshot.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  $("#metric-cohort").textContent = preciseInteger.format(data.cohortSize);
  $("#metric-pursue").textContent = preciseInteger.format(pursue.length);
  $("#metric-median").textContent = median(games.map((game) => game.score)).toFixed(1);
  $("#metric-reviews").textContent = integer.format(totalReviews);
  $("#decision-copy").textContent = `${pursue.length} records clear the pursue threshold. Treat them as teardown candidates; source rights and release history before any commercial conclusion.`;
  if (games.every((game) => game.averagePlaytimeTwoWeeksMinutes === 0)) {
    $("#method-summary").textContent = "35% review evidence · 20% conservative quality · 25% current attention · 10% recent engagement (zero in this snapshot) · 10% revival adjacency.";
  }
  $("#top-actions").innerHTML = pursue.slice(0, 3).map((game, index) => `<li><span>0${index + 1}</span><span>${escapeHtml(game.name)}</span><strong>${game.score.toFixed(1)}</strong></li>`).join("");
  renderChart(games);
  renderTable(games);

  const search = $("#search") as HTMLInputElement;
  const callFilter = $("#call-filter") as HTMLSelectElement;
  const applyFilters = (): void => {
    const query = search.value.trim().toLowerCase();
    const call = callFilter.value;
    renderTable(games.filter((game) =>
      (call === "all" || game.recommendation === call) &&
      (!query || `${game.name} ${game.publisher}`.toLowerCase().includes(query))
    ));
  };
  search.addEventListener("input", applyFilters);
  callFilter.addEventListener("change", applyFilters);
}

main().catch((error: unknown) => {
  console.error(error);
  // $() throws on a missing node, which would replace the real failure with a lookup error.
  const setText = (selector: string, text: string): void => {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  };
  setText("#snapshot-status", "Snapshot unavailable");
  setText("#decision-copy", "The dashboard data could not be loaded. Run npm run refresh and reload.");
});
