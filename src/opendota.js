import { config } from "./config.js";

let heroStatsCache = null;
let heroStatsFetchedAt = 0;
const HERO_CACHE_TTL_MS = 10 * 60 * 1000;
const STEAM_IMAGE_BASE_URL = "https://cdn.cloudflare.steamstatic.com";

function withApiKey(url) {
  if (config.openDotaApiKey) {
    url.searchParams.set("api_key", config.openDotaApiKey);
  }
  return url;
}

async function fetchJson(path, params = {}) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, `${config.openDotaBaseUrl}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(withApiKey(url), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenDota request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return response.json();
}

function percent(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function shortNumber(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSteamImageUrl(relativePath) {
  const cleanedPath = String(relativePath || "").trim().replace(/\?+$/, "");
  if (!cleanedPath) {
    return "";
  }
  return `${STEAM_IMAGE_BASE_URL}${cleanedPath}`;
}

function heroPublicWinRate(hero) {
  const brackets = [1, 2, 3, 4, 5, 6, 7, 8];
  let picks = 0;
  let wins = 0;

  for (const bracket of brackets) {
    picks += Number(hero[`${bracket}_pick`] || 0);
    wins += Number(hero[`${bracket}_win`] || 0);
  }

  return picks > 0 ? wins / picks : null;
}

function heroPublicPickCount(hero) {
  const brackets = [1, 2, 3, 4, 5, 6, 7, 8];
  return brackets.reduce((sum, bracket) => sum + Number(hero[`${bracket}_pick`] || 0), 0);
}

export async function getHeroStats() {
  const now = Date.now();
  if (heroStatsCache && now - heroStatsFetchedAt < HERO_CACHE_TTL_MS) {
    return heroStatsCache;
  }

  const stats = await fetchJson("/heroStats");
  heroStatsCache = stats;
  heroStatsFetchedAt = now;
  return stats;
}

export async function getHeroNameById(heroId) {
  const heroes = await getHeroStats();
  return heroes.find((hero) => hero.id === Number(heroId))?.localized_name || `Hero ${heroId}`;
}

export async function getHeroById(heroId) {
  const heroes = await getHeroStats();
  return heroes.find((hero) => hero.id === Number(heroId)) || null;
}

export async function findHero(query) {
  const heroes = await getHeroStats();
  const cleaned = String(query || "").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  if (/^\d+$/.test(cleaned)) {
    return heroes.find((hero) => hero.id === Number(cleaned)) || null;
  }

  const exact = heroes.find((hero) => hero.localized_name.toLowerCase() === cleaned);
  if (exact) {
    return exact;
  }

  const byName = heroes.find((hero) => hero.name.toLowerCase().includes(cleaned));
  if (byName) {
    return byName;
  }

  return heroes.find((hero) => hero.localized_name.toLowerCase().includes(cleaned)) || null;
}

export async function getHeroSummary(query) {
  const hero = await findHero(query);
  if (!hero) {
    return null;
  }

  const publicPickCount = heroPublicPickCount(hero);
  const publicWinRate = heroPublicWinRate(hero);
  const proWinRate = hero.pro_pick > 0 ? hero.pro_win / hero.pro_pick : null;

  return {
    hero,
    photoUrl: toSteamImageUrl(hero.img),
    summary: [
      `${hero.localized_name} (${hero.primary_attr?.toUpperCase() || "?"}, ${hero.attack_type || "Unknown"})`,
      `Roles: ${(hero.roles || []).join(", ") || "Unknown"}`,
      `Pro pick rate signal: ${shortNumber(hero.pro_pick)} picks`,
      `Pro ban rate signal: ${shortNumber(hero.pro_ban)} bans`,
      `Pro win rate: ${percent(proWinRate)}`,
      `Public pick count: ${shortNumber(publicPickCount)}`,
      `Public win rate: ${percent(publicWinRate)}`,
      `Turbo picks: ${shortNumber(hero.turbo_picks || 0)} | Turbo wins: ${shortNumber(hero.turbo_wins || 0)}`
    ].join("\n")
  };
}

export async function getMetaSummary(limit = 10) {
  const [heroes, liveGames] = await Promise.all([
    getHeroStats(),
    fetchJson("/live").catch(() => [])
  ]);
  const topPicked = [...heroes]
    .sort((a, b) => Number(b.pro_pick || 0) - Number(a.pro_pick || 0))
    .slice(0, limit);
  const topBanned = [...heroes]
    .sort((a, b) => Number(b.pro_ban || 0) - Number(a.pro_ban || 0))
    .slice(0, limit);

  const lines = [
    "Meta Snapshot",
    "",
    "Top Pro Picks",
    ...topPicked.map((hero, index) => `${index + 1}. ${hero.localized_name} - ${shortNumber(hero.pro_pick || 0)} picks`),
    "",
    "Top Pro Bans",
    ...topBanned.map((hero, index) => `${index + 1}. ${hero.localized_name} - ${shortNumber(hero.pro_ban || 0)} bans`)
  ];

  const currentDrafts = await getCurrentProDraftLines(liveGames);
  if (currentDrafts.length > 0) {
    lines.push("", "Current Pro Drafts", ...currentDrafts);
  }

  return lines.join("\n");
}

export async function getMatchSummary(matchId) {
  const match = await fetchJson(`/matches/${matchId}`);
  const radiantWon = Boolean(match.radiant_win);
  const durationMinutes = Math.floor(Number(match.duration || 0) / 60);
  const durationSeconds = Number(match.duration || 0) % 60;
  const players = Array.isArray(match.players) ? match.players : [];
  const radiantKills = Number(match.radiant_score || 0);
  const direKills = Number(match.dire_score || 0);

  const lines = [
    `Match ${match.match_id}`,
    `Winner: ${radiantWon ? "Radiant" : "Dire"}`,
    `Score: Radiant ${radiantKills} - ${direKills} Dire`,
    `Duration: ${durationMinutes}:${String(durationSeconds).padStart(2, "0")}`,
    `Game mode: ${match.game_mode ?? "Unknown"} | Lobby: ${match.lobby_type ?? "Unknown"}`
  ];

  if (players.length > 0) {
    const topNetWorth = [...players]
      .filter((player) => Number.isFinite(player.net_worth))
      .sort((a, b) => Number(b.net_worth) - Number(a.net_worth))
      .slice(0, 3)
      .map((player) => `${player.personaname || "Anonymous"} (${player.kills}/${player.deaths}/${player.assists}) - ${shortNumber(player.net_worth)}`);

    if (topNetWorth.length > 0) {
      lines.push("", "Top Net Worth", ...topNetWorth);
    }
  }

  return lines.join("\n");
}

export async function getPlayerSummary(accountId) {
  const [profile, winLoss, recentMatches] = await Promise.all([
    fetchJson(`/players/${accountId}`),
    fetchJson(`/players/${accountId}/wl`),
    fetchJson(`/players/${accountId}/recentMatches`)
  ]);

  const personaname = profile.profile?.personaname || "Unknown";
  const rankTier = profile.rank_tier || "Unranked";
  const wins = Number(winLoss.win || 0);
  const losses = Number(winLoss.lose || 0);
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : null;
  const recent = Array.isArray(recentMatches) ? recentMatches.slice(0, 5) : [];

  const lines = [
    `${personaname}`,
    `Account ID: ${accountId}`,
    `Rank tier: ${rankTier}`,
    `All-time record: ${wins}-${losses} (${percent(winRate)})`
  ];

  if (recent.length > 0) {
    lines.push("", "Recent Matches");
    for (const match of recent) {
      const didWin = Boolean(match.radiant_win) === (Number(match.player_slot) < 128);
      const heroName = await getHeroNameById(match.hero_id);
      lines.push(
        `${heroName} | ${match.kills}/${match.deaths}/${match.assists} | ${didWin ? "Win" : "Loss"}`
      );
    }
  }

  return lines.join("\n");
}

export async function getLinkedProfileCard(accountId) {
  const [player, winLoss] = await Promise.all([
    fetchJson(`/players/${accountId}`),
    fetchJson(`/players/${accountId}/wl`)
  ]);

  const profile = player.profile || {};
  const wins = Number(winLoss.win || 0);
  const losses = Number(winLoss.lose || 0);
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : null;

  return {
    photoUrl: profile.avatarfull || profile.avatarmedium || profile.avatar || "",
    summary: [
      `${profile.personaname || "Unknown player"}`,
      `Dota account ID: ${accountId}`,
      `Steam ID: ${profile.steamid || "Unknown"}`,
      `Rank tier: ${player.rank_tier || "Unranked"}`,
      `Record: ${wins}-${losses} (${percent(winRate)})`,
      `Steam profile: ${profile.profileurl || "Unavailable"}`
    ].join("\n")
  };
}

export async function getLiveSummary(limit = 5) {
  const liveGames = await fetchJson("/live");
  const games = Array.isArray(liveGames) ? liveGames.slice(0, limit) : [];

  if (games.length === 0) {
    return "No live games were returned right now.";
  }

  const lines = ["Live Games"];
  for (const game of games) {
    lines.push(
      `${game.match_id || "Unknown match"} | Radiant ${game.radiant_team?.team_name || "Unknown"} vs Dire ${game.dire_team?.team_name || "Unknown"}`
    );
  }

  return lines.join("\n");
}

export async function getPlayerLastMatchSummary(accountId) {
  const recentMatches = await fetchJson(`/players/${accountId}/recentMatches`);
  const match = safeArray(recentMatches)[0];

  if (!match) {
    return "No recent match was found for this player.";
  }

  const hero = await getHeroById(match.hero_id);
  const heroName = await getHeroNameById(match.hero_id);
  const didWin = Boolean(match.radiant_win) === (Number(match.player_slot) < 128);
  const lane = Number.isFinite(Number(match.lane_role)) ? Number(match.lane_role) : null;

  return {
    photoUrl: toSteamImageUrl(hero?.img),
    summary: [
      `Last Match: ${match.match_id}`,
      `Hero: ${heroName}`,
      `Result: ${didWin ? "Win" : "Loss"}`,
      `K/D/A: ${match.kills}/${match.deaths}/${match.assists}`,
      `GPM/XPM: ${match.gold_per_min ?? "?"}/${match.xp_per_min ?? "?"}`,
      `Last hits: ${match.last_hits ?? "?"} | Hero damage: ${match.hero_damage ?? "?"}`,
      `Lane role: ${lane ?? "Unknown"} | Duration: ${Math.floor(Number(match.duration || 0) / 60)}m`
    ].join("\n")
  };
}

async function getCurrentProDraftLines(liveGames) {
  const games = safeArray(liveGames).slice(0, 5);
  const lines = [];

  for (const game of games) {
    const radiantDraft = await extractDraftHeroes(game, "radiant");
    const direDraft = await extractDraftHeroes(game, "dire");
    const leagueName = game.league_name || game.leagueid || "Unknown league";
    const radiantName = game.radiant_team?.team_name || game.team_name_radiant || "Radiant";
    const direName = game.dire_team?.team_name || game.team_name_dire || "Dire";

    if (radiantDraft.length === 0 && direDraft.length === 0) {
      continue;
    }

    lines.push(`${leagueName}: ${radiantName} vs ${direName}`);
    lines.push(`Radiant: ${radiantDraft.join(", ") || "Draft unavailable"}`);
    lines.push(`Dire: ${direDraft.join(", ") || "Draft unavailable"}`);
    lines.push("---");
  }

  if (lines[lines.length - 1] === "---") {
    lines.pop();
  }

  return lines;
}

async function extractDraftHeroes(game, side) {
  const sideCode = side === "radiant" ? 0 : 1;
  const buckets = [
    ...safeArray(game.players),
    ...safeArray(game.scoreboard?.[side]?.players),
    ...safeArray(game[`${side}_players`])
  ];

  const heroIds = [];

  for (const player of buckets) {
    const teamValue = player.team ?? player.team_number;
    const isSideMatch =
      teamValue === sideCode ||
      String(teamValue).toLowerCase() === side ||
      (side === "radiant" && Number(player.player_slot) < 128) ||
      (side === "dire" && Number(player.player_slot) >= 128);

    if (!isSideMatch) {
      continue;
    }

    if (player.hero_id && !heroIds.includes(player.hero_id)) {
      heroIds.push(player.hero_id);
    }
  }

  const heroNames = [];
  for (const heroId of heroIds.slice(0, 5)) {
    heroNames.push(await getHeroNameById(heroId));
  }

  return heroNames;
}
