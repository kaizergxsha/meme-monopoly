import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStats } from '../shared/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

export const EMPTY_PLAYER_STATS: PlayerStats = {
  cellsBought: 0,
  monopoliesCollected: 0,
  rouletteDeaths: 0,
  casinoWins: 0,
  wins: 0,
  bankruptcies: 0,
};

const STAT_COLUMN_MAP: Record<keyof PlayerStats, string> = {
  cellsBought: 'cells_bought',
  monopoliesCollected: 'monopolies_collected',
  rouletteDeaths: 'roulette_deaths',
  casinoWins: 'casino_wins',
  wins: 'wins',
  bankruptcies: 'bankruptcies',
};

const fallbackStats = new Map<string, PlayerStats>();

let db: DatabaseSync | null = null;

try {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(path.join(dataDir, 'meme_monopoly.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      player_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      cells_bought INTEGER DEFAULT 0,
      monopolies_collected INTEGER DEFAULT 0,
      roulette_deaths INTEGER DEFAULT 0,
      casino_wins INTEGER DEFAULT 0,
      bankruptcies INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      mode TEXT NOT NULL,
      winner_names TEXT NOT NULL,
      rounds INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    );
  `);

  for (const col of [
    'cells_bought',
    'monopolies_collected',
    'roulette_deaths',
    'casino_wins',
    'bankruptcies',
  ]) {
    try {
      db.exec(`ALTER TABLE profiles ADD COLUMN ${col} INTEGER DEFAULT 0`);
    } catch {
      // column already exists
    }
  }
} catch (err) {
  console.warn('[DB] SQLite fallback to memory mode:', err);
  db = null;
}

export function getPlayerStats(playerId: string): PlayerStats {
  if (!db) {
    return { ...(fallbackStats.get(playerId) ?? EMPTY_PLAYER_STATS) };
  }
  try {
    const row = db
      .prepare(
        `SELECT
           COALESCE(cells_bought, 0) as cellsBought,
           COALESCE(monopolies_collected, 0) as monopoliesCollected,
           COALESCE(roulette_deaths, 0) as rouletteDeaths,
           COALESCE(casino_wins, 0) as casinoWins,
           COALESCE(wins, 0) as wins,
           COALESCE(bankruptcies, 0) as bankruptcies
         FROM profiles
         WHERE player_id = ?`
      )
      .get(playerId) as Record<string, number> | undefined;
    if (!row) return { ...EMPTY_PLAYER_STATS };
    return {
      cellsBought: Number(row.cellsBought) || 0,
      monopoliesCollected: Number(row.monopoliesCollected) || 0,
      rouletteDeaths: Number(row.rouletteDeaths) || 0,
      casinoWins: Number(row.casinoWins) || 0,
      wins: Number(row.wins) || 0,
      bankruptcies: Number(row.bankruptcies) || 0,
    };
  } catch {
    return { ...(fallbackStats.get(playerId) ?? EMPTY_PLAYER_STATS) };
  }
}

export function upsertPlayerProfile(playerId: string, nickname: string, avatar: string) {
  if (!db) return;
  try {
    const stmt = db.prepare(`
      INSERT INTO profiles (player_id, nickname, avatar, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        updated_at = excluded.updated_at
    `);
    stmt.run(playerId, nickname, avatar, Date.now());
  } catch {
    // ignore
  }
}

export function incrementPlayerStat(
  player: { id: string; name: string; avatar: string },
  stat: keyof PlayerStats,
  delta = 1
): PlayerStats {
  const curFallback = fallbackStats.get(player.id) ?? { ...EMPTY_PLAYER_STATS };
  const nextFallback: PlayerStats = {
    ...curFallback,
    [stat]: (curFallback[stat] || 0) + delta,
  };
  fallbackStats.set(player.id, nextFallback);

  if (!db) return { ...nextFallback };

  try {
    upsertPlayerProfile(player.id, player.name, player.avatar);
    const col = STAT_COLUMN_MAP[stat];
    db.prepare(
      `UPDATE profiles
       SET ${col} = COALESCE(${col}, 0) + ?, updated_at = ?
       WHERE player_id = ?`
    ).run(delta, Date.now(), player.id);
    return getPlayerStats(player.id);
  } catch {
    return { ...nextFallback };
  }
}

export function recordMatchFinish(params: {
  roomCode: string;
  mode: string;
  players: { id: string; name: string; avatar: string; isBot: boolean; won: boolean }[];
  rounds: number;
  durationSec: number;
}) {
  for (const p of params.players) {
    if (p.won) {
      const cur = fallbackStats.get(p.id) ?? { ...EMPTY_PLAYER_STATS };
      fallbackStats.set(p.id, { ...cur, wins: (cur.wins || 0) + 1 });
    }
  }

  if (!db) return;
  try {
    const winners = params.players
      .filter((p) => p.won)
      .map((p) => p.name)
      .join(', ');
    db.prepare(`
      INSERT INTO match_history (room_code, mode, winner_names, rounds, duration_sec, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.roomCode, params.mode, winners || 'Никто', params.rounds, params.durationSec, Date.now());

    const updateStmt = db.prepare(`
      INSERT INTO profiles (player_id, nickname, avatar, games_played, wins, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        games_played = COALESCE(profiles.games_played, 0) + 1,
        wins = COALESCE(profiles.wins, 0) + excluded.wins,
        updated_at = excluded.updated_at
    `);
    for (const p of params.players) {
      updateStmt.run(p.id, p.name, p.avatar, p.won ? 1 : 0, Date.now());
    }
  } catch {
    // ignore
  }
}

export function getLeaderboard(limit = 10) {
  if (!db) return [];
  try {
    return db
      .prepare(
        `SELECT nickname, avatar, games_played as gamesPlayed, wins
         FROM profiles
         WHERE player_id NOT LIKE 'bot_%'
         ORDER BY wins DESC, games_played DESC
         LIMIT ?`
      )
      .all(limit);
  } catch {
    return [];
  }
}
