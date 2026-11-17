import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthAccount,
  DiceSkin,
  LeaderboardEntry,
  PlayerProfileData,
  PlayerStats,
  RecentMatchSummary,
} from '../shared/types.ts';
import { pickRandomGuestNickname } from '../shared/memeContent.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

interface FallbackProfileRecord {
  playerId: string;
  nickname: string;
  avatar: string;
  color: string;
  diceSkin: DiceSkin;
  gamesPlayed: number;
  createdAt: number;
  updatedAt: number;
  stats: PlayerStats;
}

interface FallbackUserRecord {
  email: string;
  passwordHash: string;
  playerId: string;
  createdAt: number;
}

interface FallbackSessionRecord {
  token: string;
  playerId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

const fallbackStats = new Map<string, PlayerStats>();
const fallbackProfiles = new Map<string, FallbackProfileRecord>();
const fallbackUsers = new Map<string, FallbackUserRecord>();
const fallbackSessions = new Map<string, FallbackSessionRecord>();
const fallbackMatches: RecentMatchSummary[] = [];

let db: DatabaseSync | null = null;
let pgPool: Pool | null = null;
let pgWriteChain: Promise<void> = Promise.resolve();
let dbInitialized = false;

function pgExec(sql: string, params: unknown[] = []): void {
  if (!pgPool) return;
  const pool = pgPool;
  pgWriteChain = pgWriteChain
    .then(() => pool.query(sql, params).then(() => undefined))
    .catch((err) => {
      console.error('[DB] PostgreSQL write error:', err);
    });
}

function initSqlite(): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new DatabaseSync(path.join(dataDir, 'meme_monopoly.sqlite'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        player_id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        avatar TEXT NOT NULL,
        color TEXT DEFAULT '#dc2626',
        dice_skin TEXT DEFAULT 'classic',
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        cells_bought INTEGER DEFAULT 0,
        monopolies_collected INTEGER DEFAULT 0,
        roulette_deaths INTEGER DEFAULT 0,
        casino_wins INTEGER DEFAULT 0,
        bankruptcies INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        player_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    for (const colDef of [
      'cells_bought INTEGER DEFAULT 0',
      'monopolies_collected INTEGER DEFAULT 0',
      'roulette_deaths INTEGER DEFAULT 0',
      'casino_wins INTEGER DEFAULT 0',
      'bankruptcies INTEGER DEFAULT 0',
      "color TEXT DEFAULT '#dc2626'",
      "dice_skin TEXT DEFAULT 'classic'",
      'created_at INTEGER DEFAULT 0',
    ]) {
      try {
        db.exec(`ALTER TABLE profiles ADD COLUMN ${colDef}`);
      } catch {
        // column already exists
      }
    }
    console.log('[DB] Using local SQLite:', path.join(dataDir, 'meme_monopoly.sqlite'));
  } catch (err) {
    console.warn('[DB] SQLite fallback to memory mode:', err);
    db = null;
  }
}

export async function initDb(): Promise<void> {
  if (dbInitialized) return;
  dbInitialized = true;

  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (databaseUrl) {
    try {
      const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
      const useSsl = process.env.DATABASE_SSL === 'false' ? false : !isLocal;
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 5,
      });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS profiles (
          player_id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL,
          avatar TEXT NOT NULL,
          color TEXT DEFAULT '#dc2626',
          dice_skin TEXT DEFAULT 'classic',
          games_played INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          cells_bought INTEGER DEFAULT 0,
          monopolies_collected INTEGER DEFAULT 0,
          roulette_deaths INTEGER DEFAULT 0,
          casino_wins INTEGER DEFAULT 0,
          bankruptcies INTEGER DEFAULT 0,
          created_at BIGINT DEFAULT 0,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS match_history (
          id SERIAL PRIMARY KEY,
          room_code TEXT NOT NULL,
          mode TEXT NOT NULL,
          winner_names TEXT NOT NULL,
          rounds INTEGER NOT NULL,
          duration_sec INTEGER NOT NULL,
          finished_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          player_id TEXT NOT NULL UNIQUE,
          created_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          email TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          expires_at BIGINT NOT NULL
        );
      `);

      const profilesRes = await pool.query('SELECT * FROM profiles');
      for (const row of profilesRes.rows) {
        const stats: PlayerStats = {
          cellsBought: Number(row.cells_bought) || 0,
          monopoliesCollected: Number(row.monopolies_collected) || 0,
          rouletteDeaths: Number(row.roulette_deaths) || 0,
          casinoWins: Number(row.casino_wins) || 0,
          wins: Number(row.wins) || 0,
          bankruptcies: Number(row.bankruptcies) || 0,
        };
        fallbackStats.set(String(row.player_id), stats);
        fallbackProfiles.set(String(row.player_id), {
          playerId: String(row.player_id),
          nickname: String(row.nickname || 'Гость'),
          avatar: String(row.avatar || '🐸'),
          color: String(row.color || '#dc2626'),
          diceSkin: (String(row.dice_skin || 'liquid_glass') as DiceSkin),
          gamesPlayed: Number(row.games_played) || 0,
          createdAt: Number(row.created_at) || Number(row.updated_at) || Date.now(),
          updatedAt: Number(row.updated_at) || Date.now(),
          stats,
        });
      }

      const usersRes = await pool.query('SELECT email, password_hash, player_id, created_at FROM users');
      for (const row of usersRes.rows) {
        fallbackUsers.set(String(row.email), {
          email: String(row.email),
          passwordHash: String(row.password_hash),
          playerId: String(row.player_id),
          createdAt: Number(row.created_at) || Date.now(),
        });
      }

      const now = Date.now();
      await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
      const sessionsRes = await pool.query(
        'SELECT token, player_id, email, created_at, expires_at FROM sessions WHERE expires_at > $1',
        [now]
      );
      for (const row of sessionsRes.rows) {
        fallbackSessions.set(String(row.token), {
          token: String(row.token),
          playerId: String(row.player_id),
          email: String(row.email),
          createdAt: Number(row.created_at) || now,
          expiresAt: Number(row.expires_at),
        });
      }

      const matchesRes = await pool.query(
        `SELECT id, room_code, mode, winner_names, rounds, duration_sec, finished_at
         FROM match_history
         ORDER BY id DESC
         LIMIT 50`
      );
      for (const row of matchesRes.rows) {
        fallbackMatches.push({
          id: Number(row.id),
          roomCode: String(row.room_code),
          mode: String(row.mode),
          winnerNames: String(row.winner_names),
          rounds: Number(row.rounds) || 0,
          durationSec: Number(row.duration_sec) || 0,
          finishedAt: Number(row.finished_at) || now,
        });
      }

      pgPool = pool;
      db = null;
      console.log(
        `[DB] Connected to PostgreSQL (profiles: ${fallbackProfiles.size}, users: ${fallbackUsers.size}, matches: ${fallbackMatches.length})`
      );
      return;
    } catch (err) {
      console.error('[DB] PostgreSQL connection failed, falling back to SQLite:', err);
      pgPool = null;
    }
  }

  initSqlite();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function sanitizeNickname(raw?: string): string {
  const cleaned = (raw || '').trim().slice(0, 24);
  return cleaned || pickRandomGuestNickname();
}

function sanitizeAvatar(raw?: string): string {
  const val = (raw || '').trim();
  if (!val) return '🐸';
  if (val.startsWith('data:image/')) {
    return val.length <= 500_000 ? val : '🐸';
  }
  return val.slice(0, 256);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function getPlayerStats(playerId: string): PlayerStats {
  if (!db) {
    const fp = fallbackProfiles.get(playerId);
    return { ...(fp?.stats ?? fallbackStats.get(playerId) ?? EMPTY_PLAYER_STATS) };
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

export function upsertPlayerProfile(
  playerId: string,
  nickname: string,
  avatar: string,
  color?: string,
  diceSkin?: DiceSkin
) {
  const now = Date.now();
  const cleanNick = sanitizeNickname(nickname);
  const cleanAvatar = sanitizeAvatar(avatar);

  if (!db) {
    const cur = fallbackProfiles.get(playerId);
    const finalColor = color || cur?.color || '#dc2626';
    const finalDiceSkin = diceSkin || cur?.diceSkin || 'liquid_glass';
    const finalCreatedAt = cur?.createdAt && cur.createdAt > 0 ? cur.createdAt : now;
    fallbackProfiles.set(playerId, {
      playerId,
      nickname: cleanNick,
      avatar: cleanAvatar,
      color: finalColor,
      diceSkin: finalDiceSkin,
      gamesPlayed: cur?.gamesPlayed || 0,
      createdAt: finalCreatedAt,
      updatedAt: now,
      stats: cur?.stats ?? { ...(fallbackStats.get(playerId) ?? EMPTY_PLAYER_STATS) },
    });
    pgExec(
      `INSERT INTO profiles (player_id, nickname, avatar, color, dice_skin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (player_id) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         avatar = EXCLUDED.avatar,
         color = EXCLUDED.color,
         dice_skin = EXCLUDED.dice_skin,
         updated_at = EXCLUDED.updated_at`,
      [playerId, cleanNick, cleanAvatar, finalColor, finalDiceSkin, finalCreatedAt, now]
    );
    return;
  }

  try {
    const existing = db
      .prepare('SELECT color, dice_skin as diceSkin, created_at as createdAt FROM profiles WHERE player_id = ?')
      .get(playerId) as { color?: string; diceSkin?: string; createdAt?: number } | undefined;

    const finalColor = color || existing?.color || '#dc2626';
    const finalDiceSkin = diceSkin || existing?.diceSkin || 'liquid_glass';
    const finalCreatedAt = existing?.createdAt && existing.createdAt > 0 ? existing.createdAt : now;

    const stmt = db.prepare(`
      INSERT INTO profiles (player_id, nickname, avatar, color, dice_skin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        color = excluded.color,
        dice_skin = excluded.dice_skin,
        updated_at = excluded.updated_at
    `);
    stmt.run(playerId, cleanNick, cleanAvatar, finalColor, finalDiceSkin, finalCreatedAt, now);
  } catch {
    // ignore
  }
}

export function getPlayerProfile(playerId: string): PlayerProfileData {
  const now = Date.now();
  if (!db) {
    const cur = fallbackProfiles.get(playerId);
    const stats = { ...(cur?.stats ?? fallbackStats.get(playerId) ?? EMPTY_PLAYER_STATS) };
    const isRegistered = Array.from(fallbackUsers.values()).some((u) => u.playerId === playerId);
    return {
      playerId,
      nickname: cur?.nickname || 'Гость',
      avatar: cur?.avatar || '🐸',
      color: cur?.color || '#dc2626',
      diceSkin: cur?.diceSkin || 'liquid_glass',
      gamesPlayed: cur?.gamesPlayed || 0,
      wins: stats.wins,
      createdAt: cur?.createdAt || now,
      updatedAt: cur?.updatedAt || now,
      isRegistered,
      stats,
    };
  }

  try {
    const row = db
      .prepare(
        `SELECT
           p.player_id as playerId,
           p.nickname as nickname,
           p.avatar as avatar,
           COALESCE(p.color, '#dc2626') as color,
           COALESCE(p.dice_skin, 'liquid_glass') as diceSkin,
           COALESCE(p.games_played, 0) as gamesPlayed,
           COALESCE(p.wins, 0) as wins,
           COALESCE(p.cells_bought, 0) as cellsBought,
           COALESCE(p.monopolies_collected, 0) as monopoliesCollected,
           COALESCE(p.roulette_deaths, 0) as rouletteDeaths,
           COALESCE(p.casino_wins, 0) as casinoWins,
           COALESCE(p.bankruptcies, 0) as bankruptcies,
           COALESCE(p.created_at, 0) as createdAt,
           COALESCE(p.updated_at, 0) as updatedAt,
           EXISTS(SELECT 1 FROM users u WHERE u.player_id = p.player_id) as isRegistered
         FROM profiles p
         WHERE p.player_id = ?`
      )
      .get(playerId) as Record<string, unknown> | undefined;

    if (!row) {
      const userRow = db
        .prepare('SELECT 1 as found FROM users WHERE player_id = ?')
        .get(playerId) as { found?: number } | undefined;
      return {
        playerId,
        nickname: 'Гость',
        avatar: '🐸',
        color: '#dc2626',
        diceSkin: 'liquid_glass',
        gamesPlayed: 0,
        wins: 0,
        createdAt: now,
        updatedAt: now,
        isRegistered: Boolean(userRow?.found),
        stats: { ...EMPTY_PLAYER_STATS },
      };
    }

    const wins = Number(row.wins) || 0;
    return {
      playerId: String(row.playerId),
      nickname: String(row.nickname || 'Гость'),
      avatar: String(row.avatar || '🐸'),
      color: String(row.color || '#dc2626'),
      diceSkin: (String(row.diceSkin || 'liquid_glass') as DiceSkin),
      gamesPlayed: Number(row.gamesPlayed) || 0,
      wins,
      createdAt: Number(row.createdAt) || Number(row.updatedAt) || now,
      updatedAt: Number(row.updatedAt) || now,
      isRegistered: Boolean(row.isRegistered),
      stats: {
        cellsBought: Number(row.cellsBought) || 0,
        monopoliesCollected: Number(row.monopoliesCollected) || 0,
        rouletteDeaths: Number(row.rouletteDeaths) || 0,
        casinoWins: Number(row.casinoWins) || 0,
        wins,
        bankruptcies: Number(row.bankruptcies) || 0,
      },
    };
  } catch {
    return {
      playerId,
      nickname: 'Гость',
      avatar: '🐸',
      color: '#dc2626',
      diceSkin: 'liquid_glass',
      gamesPlayed: 0,
      wins: 0,
      createdAt: now,
      updatedAt: now,
      isRegistered: false,
      stats: { ...EMPTY_PLAYER_STATS },
    };
  }
}

export function incrementPlayerStat(
  player: { id: string; name: string; avatar: string; color?: string; diceSkin?: DiceSkin },
  stat: keyof PlayerStats,
  delta = 1
): PlayerStats {
  const curFallback = fallbackStats.get(player.id) ?? { ...EMPTY_PLAYER_STATS };
  const nextFallback: PlayerStats = {
    ...curFallback,
    [stat]: (curFallback[stat] || 0) + delta,
  };
  fallbackStats.set(player.id, nextFallback);

  if (!db) {
    upsertPlayerProfile(player.id, player.name, player.avatar, player.color, player.diceSkin);
    const prof = fallbackProfiles.get(player.id);
    if (prof) prof.stats = { ...nextFallback };
    const col = STAT_COLUMN_MAP[stat];
    pgExec(
      `UPDATE profiles
       SET ${col} = COALESCE(${col}, 0) + $1, updated_at = $2
       WHERE player_id = $3`,
      [delta, Date.now(), player.id]
    );
    return { ...nextFallback };
  }

  try {
    upsertPlayerProfile(player.id, player.name, player.avatar, player.color, player.diceSkin);
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
  const now = Date.now();
  const winners = params.players
    .filter((p) => p.won)
    .map((p) => p.name)
    .join(', ');

  for (const p of params.players) {
    const cur = fallbackStats.get(p.id) ?? { ...EMPTY_PLAYER_STATS };
    const nextStats = p.won ? { ...cur, wins: (cur.wins || 0) + 1 } : cur;
    fallbackStats.set(p.id, nextStats);

    if (!db) {
      upsertPlayerProfile(p.id, p.name, p.avatar);
      const prof = fallbackProfiles.get(p.id);
      if (prof) {
        prof.gamesPlayed = (prof.gamesPlayed || 0) + 1;
        prof.stats = { ...nextStats };
      }
    }
  }

  if (!db) {
    fallbackMatches.unshift({
      id: (fallbackMatches[0]?.id ?? 0) + 1,
      roomCode: params.roomCode,
      mode: params.mode,
      winnerNames: winners || 'Никто',
      rounds: params.rounds,
      durationSec: params.durationSec,
      finishedAt: now,
    });
    if (fallbackMatches.length > 50) fallbackMatches.length = 50;
    pgExec(
      `INSERT INTO match_history (room_code, mode, winner_names, rounds, duration_sec, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [params.roomCode, params.mode, winners || 'Никто', params.rounds, params.durationSec, now]
    );
    for (const p of params.players) {
      pgExec(
        `INSERT INTO profiles (player_id, nickname, avatar, games_played, wins, created_at, updated_at)
         VALUES ($1, $2, $3, 1, $4, $5, $6)
         ON CONFLICT (player_id) DO UPDATE SET
           nickname = EXCLUDED.nickname,
           avatar = EXCLUDED.avatar,
           games_played = COALESCE(profiles.games_played, 0) + 1,
           wins = COALESCE(profiles.wins, 0) + EXCLUDED.wins,
           updated_at = EXCLUDED.updated_at`,
        [p.id, sanitizeNickname(p.name), sanitizeAvatar(p.avatar), p.won ? 1 : 0, now, now]
      );
    }
    return;
  }

  try {
    db.prepare(`
      INSERT INTO match_history (room_code, mode, winner_names, rounds, duration_sec, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.roomCode, params.mode, winners || 'Никто', params.rounds, params.durationSec, now);

    const updateStmt = db.prepare(`
      INSERT INTO profiles (player_id, nickname, avatar, games_played, wins, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        nickname = excluded.nickname,
        avatar = excluded.avatar,
        games_played = COALESCE(profiles.games_played, 0) + 1,
        wins = COALESCE(profiles.wins, 0) + excluded.wins,
        updated_at = excluded.updated_at
    `);
    for (const p of params.players) {
      updateStmt.run(p.id, sanitizeNickname(p.name), sanitizeAvatar(p.avatar), p.won ? 1 : 0, now, now);
    }
  } catch {
    // ignore
  }
}

export function getLeaderboard(limit = 10): LeaderboardEntry[] {
  if (!db) {
    return Array.from(fallbackProfiles.values())
      .filter((p) => !p.playerId.startsWith('bot_'))
      .sort((a, b) => (b.stats.wins - a.stats.wins) || (b.gamesPlayed - a.gamesPlayed))
      .slice(0, limit)
      .map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        avatar: p.avatar,
        gamesPlayed: p.gamesPlayed,
        wins: p.stats.wins,
      }));
  }
  try {
    return db
      .prepare(
        `SELECT player_id as playerId, nickname, avatar, COALESCE(games_played, 0) as gamesPlayed, COALESCE(wins, 0) as wins
         FROM profiles
         WHERE player_id NOT LIKE 'bot_%'
         ORDER BY wins DESC, games_played DESC
         LIMIT ?`
      )
      .all(limit) as unknown as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function getRecentMatches(limit = 8): RecentMatchSummary[] {
  if (!db) {
    return fallbackMatches.slice(0, limit);
  }
  try {
    return db
      .prepare(
        `SELECT
           id,
           room_code as roomCode,
           mode,
           winner_names as winnerNames,
           rounds,
           duration_sec as durationSec,
           finished_at as finishedAt
         FROM match_history
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(limit) as unknown as RecentMatchSummary[];
  } catch {
    return [];
  }
}

function createSessionRecord(playerId: string, email: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  if (!db) {
    fallbackSessions.set(token, { token, playerId, email, createdAt: now, expiresAt });
    pgExec(
      `INSERT INTO sessions (token, player_id, email, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, playerId, email, now, expiresAt]
    );
    return token;
  }

  db.prepare(
    `INSERT INTO sessions (token, player_id, email, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, playerId, email, now, expiresAt);
  return token;
}

export function registerUser(params: {
  email: string;
  password: string;
  nickname?: string;
  avatar?: string;
  color?: string;
  diceSkin?: DiceSkin;
  guestPlayerId?: string;
}): { ok: boolean; error?: string; token?: string; account?: AuthAccount } {
  const email = normalizeEmail(params.email || '');
  const password = params.password || '';

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Введите корректный адрес электронной почты' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'Пароль должен содержать минимум 4 символа' };
  }

  const passwordHash = hashPassword(password);
  const now = Date.now();
  const cleanNick = sanitizeNickname(params.nickname);
  const cleanAvatar = sanitizeAvatar(params.avatar);

  if (!db) {
    if (fallbackUsers.has(email)) {
      return { ok: false, error: 'Эта почта уже зарегистрирована' };
    }
    const guestId = params.guestPlayerId?.trim();
    const guestBusy =
      !guestId ||
      guestId.startsWith('bot_') ||
      Array.from(fallbackUsers.values()).some((u) => u.playerId === guestId);
    const playerId = guestBusy ? `u_${crypto.randomBytes(6).toString('hex')}` : guestId;

    fallbackUsers.set(email, { email, passwordHash, playerId, createdAt: now });
    pgExec(
      `INSERT INTO users (email, password_hash, player_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [email, passwordHash, playerId, now]
    );
    upsertPlayerProfile(playerId, cleanNick, cleanAvatar, params.color, params.diceSkin);
    const token = createSessionRecord(playerId, email);
    return {
      ok: true,
      token,
      account: {
        email,
        playerId,
        profile: getPlayerProfile(playerId),
      },
    };
  }

  try {
    const existingEmail = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email) as { id: number } | undefined;
    if (existingEmail) {
      return { ok: false, error: 'Эта почта уже зарегистрирована' };
    }

    let playerId = `u_${crypto.randomBytes(6).toString('hex')}`;
    const guestId = params.guestPlayerId?.trim();
    if (guestId && !guestId.startsWith('bot_')) {
      const boundUser = db
        .prepare('SELECT id FROM users WHERE player_id = ?')
        .get(guestId) as { id: number } | undefined;
      if (!boundUser) {
        playerId = guestId;
      }
    }

    db.prepare(
      `INSERT INTO users (email, password_hash, player_id, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(email, passwordHash, playerId, now);

    upsertPlayerProfile(playerId, cleanNick, cleanAvatar, params.color, params.diceSkin);
    const token = createSessionRecord(playerId, email);

    return {
      ok: true,
      token,
      account: {
        email,
        playerId,
        profile: getPlayerProfile(playerId),
      },
    };
  } catch (err) {
    console.error('[DB] registerUser error:', err);
    return { ok: false, error: 'Ошибка регистрации. Попробуйте снова.' };
  }
}

export function loginUser(params: {
  email: string;
  password: string;
}): { ok: boolean; error?: string; token?: string; account?: AuthAccount } {
  const email = normalizeEmail(params.email || '');
  const password = params.password || '';

  if (!EMAIL_REGEX.test(email) || !password) {
    return { ok: false, error: 'Укажите почту и пароль' };
  }

  if (!db) {
    const user = fallbackUsers.get(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { ok: false, error: 'Неверная почта или пароль' };
    }
    const token = createSessionRecord(user.playerId, user.email);
    return {
      ok: true,
      token,
      account: {
        email: user.email,
        playerId: user.playerId,
        profile: getPlayerProfile(user.playerId),
      },
    };
  }

  try {
    const user = db
      .prepare('SELECT email, password_hash as passwordHash, player_id as playerId FROM users WHERE email = ?')
      .get(email) as { email: string; passwordHash: string; playerId: string } | undefined;

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { ok: false, error: 'Неверная почта или пароль' };
    }

    const token = createSessionRecord(user.playerId, user.email);
    return {
      ok: true,
      token,
      account: {
        email: user.email,
        playerId: user.playerId,
        profile: getPlayerProfile(user.playerId),
      },
    };
  } catch (err) {
    console.error('[DB] loginUser error:', err);
    return { ok: false, error: 'Ошибка входа. Попробуйте снова.' };
  }
}

export function getSessionAccount(token: string): AuthAccount | null {
  const cleanToken = (token || '').trim();
  if (!cleanToken) return null;
  const now = Date.now();

  if (!db) {
    const sess = fallbackSessions.get(cleanToken);
    if (!sess) return null;
    if (sess.expiresAt <= now) {
      fallbackSessions.delete(cleanToken);
      pgExec('DELETE FROM sessions WHERE token = $1', [cleanToken]);
      return null;
    }
    return {
      email: sess.email,
      playerId: sess.playerId,
      profile: getPlayerProfile(sess.playerId),
    };
  }

  try {
    const sess = db
      .prepare('SELECT player_id as playerId, email, expires_at as expiresAt FROM sessions WHERE token = ?')
      .get(cleanToken) as { playerId: string; email: string; expiresAt: number } | undefined;
    if (!sess) return null;
    if (sess.expiresAt <= now) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(cleanToken);
      return null;
    }
    return {
      email: sess.email,
      playerId: sess.playerId,
      profile: getPlayerProfile(sess.playerId),
    };
  } catch {
    return null;
  }
}

export function logoutSession(token: string): void {
  const cleanToken = (token || '').trim();
  if (!cleanToken) return;
  if (!db) {
    fallbackSessions.delete(cleanToken);
    pgExec('DELETE FROM sessions WHERE token = $1', [cleanToken]);
    return;
  }
  try {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(cleanToken);
  } catch {
    // ignore
  }
}
