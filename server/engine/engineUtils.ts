import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANCE_DECK } from '../../shared/memeContent.ts';
import {
  BankruptcyAnimationEvent,
  ChanceCardDef,
  GameLogEntry,
  PlayerState,
  PlayerStats,
  RoomState,
  SpeedDieFace,
  TauntEvent,
} from '../../shared/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCustomCards(): ChanceCardDef[] {
  try {
    const p = path.join(__dirname, '..', 'data', 'customCards.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(raw)) return raw;
    }
  } catch {
    // ignore invalid custom json
  }
  return [];
}

export const FULL_CHANCE_POOL: ChanceCardDef[] = [...CHANCE_DECK, ...loadCustomCards()];

export interface ServerRoom {
  state: RoomState;
  deck: ChanceCardDef[];
  bankruptcyStyleCounter: number;
  lastActivityAt: number;
  creditedMonopolies: Set<string>;
  pendingChance: { card: ChanceCardDef; playerId: string } | null;
  postDebtLandingCellId: number | null;
  activeTradeMortgagedIds: Set<number> | null;
  tradeDraftExtensionsThisTurn: number;
}

export interface RoomCallbacks {
  onStateChange: (roomCode: string, state: RoomState) => void;
  onTaunt: (roomCode: string, event: TauntEvent) => void;
  onBankruptcyAnim: (roomCode: string, event: BankruptcyAnimationEvent) => void;
}

export interface EngineHost {
  emitState(room: ServerRoom): void;
  addLog(
    room: ServerRoom,
    type: GameLogEntry['type'],
    text: string,
    cleanText: string,
    player?: PlayerState
  ): void;
  bumpStat(player: PlayerState, stat: keyof PlayerStats, delta?: number): void;
  checkAndCreditMonopolies(room: ServerRoom, player: PlayerState): void;
  setPhaseDeadline(room: ServerRoom, customSeconds?: number): void;
  finishPostRollOrAdvance(room: ServerRoom): void;
  chargePlayer(
    room: ServerRoom,
    debtor: PlayerState,
    creditorId: string | 'BANK',
    amount: number,
    reason: string,
    cleanReason: string,
    canUseShield: boolean,
    rentTaxPercent?: number
  ): void;
  executeBankruptcy(
    room: ServerRoom,
    loser: PlayerState,
    creditorId: string | 'BANK',
    reason: string,
    cleanReason: string
  ): void;
  checkVictory(room: ServerRoom): boolean;
}

export function randomId(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function randSpeedDie(): SpeedDieFace {
  const faces: SpeedDieFace[] = [1, 2, 3, 'BUS', 'BUS', 'M1'];
  return faces[Math.floor(Math.random() * faces.length)];
}

export function logAvatarBadge(avatar?: string): string {
  const a = (avatar || '').trim();
  if (!a || a.startsWith('data:') || a.startsWith('http') || a.length > 12) {
    return '😎';
  }
  return a;
}

