import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_CELLS, INDUSTRIES, isBuyableCell } from '../shared/boardData.ts';
import {
  BOT_PROFILES,
  CHANCE_DECK,
  JACKPOT_QUOTES,
  MODE_INFO,
  TAUNTS,
  TOKEN_COLORS,
  TRADE_PROPOSAL_TEMPLATES,
} from '../shared/memeContent.ts';
import {
  areAllies,
  calculateLiquidationPotential,
  calculateRent,
  canBuildBranch,
  canMortgageCell,
  canSellBranch,
  checkTradeFairness,
  formatMoney,
  getAntiStallStatus,
  getGroupCellDefs,
  getMortgageValue,
  getTokenWalkDurationMs,
  getUnmortgageCost,
  isSpeedDieActive,
  isSpeedRulesMode,
  ownsFullMonopoly,
} from '../shared/rules.ts';
import {
  ActiveCardPopup,
  BankruptcyAnimationEvent,
  ChanceCardDef,
  DiceSkin,
  GameLogEntry,
  GameMode,
  PlayerState,
  PlayerStats,
  PublicRoomSummary,
  RoomSettings,
  RoomState,
  SpeedDieFace,
  TauntEvent,
  TradeOffer,
  TradeSide,
} from '../shared/types.ts';
import {
  getPlayerStats,
  incrementPlayerStat,
  recordMatchFinish,
  upsertPlayerProfile,
} from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCustomCards(): ChanceCardDef[] {
  try {
    const p = path.join(__dirname, 'data', 'customCards.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(raw)) return raw;
    }
  } catch {
    // ignore invalid custom json
  }
  return [];
}

const FULL_CHANCE_POOL: ChanceCardDef[] = [...CHANCE_DECK, ...loadCustomCards()];

export interface ServerRoom {
  state: RoomState;
  deck: ChanceCardDef[];
  bankruptcyStyleCounter: number;
  lastActivityAt: number;
  creditedMonopolies: Set<string>;
  pendingChance: { card: ChanceCardDef; playerId: string } | null;
  postDebtLandingCellId: number | null;
  activeTradeMortgagedIds: Set<number> | null;
}

export interface RoomCallbacks {
  onStateChange: (roomCode: string, state: RoomState) => void;
  onTaunt: (roomCode: string, event: TauntEvent) => void;
  onBankruptcyAnim: (roomCode: string, event: BankruptcyAnimationEvent) => void;
}

function randomId(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function randSpeedDie(): SpeedDieFace {
  const faces: SpeedDieFace[] = [1, 2, 3, 'BUS', 'BUS', 'M1'];
  return faces[Math.floor(Math.random() * faces.length)];
}

export class GameManager {
  public rooms = new Map<string, ServerRoom>();
  private callbacks: RoomCallbacks;

  constructor(callbacks: RoomCallbacks) {
    this.callbacks = callbacks;
  }

  private emitState(room: ServerRoom) {
    const now = Date.now();
    room.lastActivityAt = now;
    room.state.serverNow = now;
    this.callbacks.onStateChange(room.state.code, room.state);
  }

  private bumpStat(player: PlayerState, stat: keyof PlayerStats, delta = 1) {
    player.stats = incrementPlayerStat(player, stat, delta);
  }

  private checkAndCreditMonopolies(room: ServerRoom, player: PlayerState) {
    for (const gid of Object.keys(INDUSTRIES)) {
      const key = `${player.id}:${gid}`;
      if (!room.creditedMonopolies.has(key) && ownsFullMonopoly(room.state.cells, player.id, gid)) {
        room.creditedMonopolies.add(key);
        this.bumpStat(player, 'monopoliesCollected', 1);
      }
    }
  }

  public addLog(
    room: ServerRoom,
    type: GameLogEntry['type'],
    text: string,
    cleanText: string,
    player?: PlayerState
  ) {
    const entry: GameLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      playerId: player?.id,
      playerName: player?.name,
      playerColor: player?.color,
      text,
      cleanText,
    };
    room.state.logs.push(entry);
    if (room.state.logs.length > 60) {
      room.state.logs.splice(0, room.state.logs.length - 60);
    }
  }

  public getPublicRooms(): PublicRoomSummary[] {
    const list: PublicRoomSummary[] = [];
    for (const r of this.rooms.values()) {
      if (!r.state.settings.isPrivate && r.state.status !== 'FINISHED') {
        const host = r.state.players.find((p) => p.id === r.state.hostId);
        list.push({
          code: r.state.code,
          hostName: host?.name ?? 'Хост',
          mode: r.state.settings.mode,
          playerCount: r.state.players.length,
          maxPlayers: r.state.settings.maxPlayers,
          status: r.state.status,
          hasPassword: Boolean(r.state.settings.password),
          censored: r.state.settings.censored,
        });
      }
    }
    return list;
  }

  public createRoom(
    profile: {
      playerId: string;
      socketId: string;
      name: string;
      avatar: string;
      color: string;
      diceSkin: DiceSkin;
    },
    mode: GameMode = 'classic'
  ): ServerRoom {
    let code = randomId(6);
    while (this.rooms.has(code)) code = randomId(6);

    const defaults = MODE_INFO[mode].defaults;
    const settings: RoomSettings = {
      mode,
      maxPlayers: defaults.maxPlayers ?? 4,
      isPrivate: false,
      password: '',
      turnTimerSec: (defaults.turnTimerSec as 0 | 45 | 75 | 120) ?? 75,
      startingCash: defaults.startingCash ?? 15000,
      creditEnabled: defaults.creditEnabled ?? true,
      auctionsEnabled: defaults.auctionsEnabled ?? true,
      rentTaxEnabled: defaults.rentTaxEnabled ?? true,
      fairTradeLimit: true,
      censored: false,
      retroRules: defaults.retroRules ?? false,
      russianRoulette: defaults.russianRoulette ?? false,
      mortgageLimitRounds: defaults.mortgageLimitRounds ?? 15,
    };

    const host: PlayerState = this.createPlayerObj(
      { ...profile, color: this.resolvePlayerColor(profile.color, []) },
      false,
      0,
      settings
    );
    upsertPlayerProfile(host.id, host.name, host.avatar);
    host.stats = getPlayerStats(host.id);

    const state: RoomState = {
      code,
      hostId: host.id,
      status: 'LOBBY',
      settings,
      players: [host],
      cells: BOARD_CELLS.map((c) => ({
        id: c.id,
        ownerId: null,
        branches: 0,
        isMortgaged: false,
        mortgageRoundsLeft: null,
      })),
      currentPlayerIndex: 0,
      phase: 'PRE_ROLL',
      round: 1,
      startedAt: null,
      turnStartedAt: null,
      turnDeadlineAt: null,
      hasExtraTurn: false,
      mortgagedThisTurn: false,
      builtGroupsThisTurn: [],
      lastDice: null,
      speedTargetMode: 'NONE',
      validSpeedTargets: [],
      auction: null,
      activeTrade: null,
      portal: null,
      lastJackpotResult: null,
      pendingDebt: null,
      lastCardPopup: null,
      winnerIds: [],
      winnerTeam: null,
      logs: [],
    };

    const serverRoom: ServerRoom = {
      state,
      deck: shuffle(FULL_CHANCE_POOL),
      bankruptcyStyleCounter: 0,
      lastActivityAt: Date.now(),
      creditedMonopolies: new Set(),
      pendingChance: null,
      postDebtLandingCellId: null,
      activeTradeMortgagedIds: null,
    };

    this.addLog(
      serverRoom,
      'SYSTEM',
      `Комната #${code} создана! Зови кентов по ссылке.`,
      `Комната #${code} создана! Приглашайте друзей по ссылке.`
    );
    this.rooms.set(code, serverRoom);
    return serverRoom;
  }

  private pickRandomUnusedColor(existingPlayers: PlayerState[]): string {
    const used = new Set(existingPlayers.map((p) => p.color));
    const available = TOKEN_COLORS.filter((c) => !used.has(c.hex));
    const pool = available.length > 0 ? available : TOKEN_COLORS;
    return pool[Math.floor(Math.random() * pool.length)].hex;
  }

  private resolvePlayerColor(preferredColor: string, existingPlayers: PlayerState[]): string {
    const isValid = TOKEN_COLORS.some((c) => c.hex === preferredColor);
    const isTaken = existingPlayers.some((p) => p.color === preferredColor);
    if (isValid && !isTaken) return preferredColor;
    return this.pickRandomUnusedColor(existingPlayers);
  }

  private createPlayerObj(
    profile: {
      playerId: string;
      socketId: string | null;
      name: string;
      avatar: string;
      color: string;
      diceSkin: DiceSkin;
    },
    isBot: boolean,
    seatIndex: number,
    settings: RoomSettings
  ): PlayerState {
    return {
      id: profile.playerId,
      socketId: profile.socketId,
      name: profile.name.trim().slice(0, 24) || 'Анонимус',
      avatar: profile.avatar || '🐸',
      color: profile.color || this.pickRandomUnusedColor([]),
      diceSkin: profile.diceSkin || 'classic',
      isBot,
      isConnected: true,
      team: settings.mode === 'team2v2' ? ((seatIndex % 2) as 0 | 1) : undefined,
      cash: settings.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      skipTurns: 0,
      shields: 0,
      doublesStreak: 0,
      isBankrupt: false,
      extraTimeSec: 30,
      credit: null,
      creditCooldownUntilRound: 0,
      restarts: { branchLocked: 'NONE', usedCount: 0 },
      lastTauntAt: 0,
      stats: getPlayerStats(profile.playerId),
    };
  }

  public joinRoom(
    code: string,
    profile: {
      playerId: string;
      socketId: string;
      name: string;
      avatar: string;
      color: string;
      diceSkin: DiceSkin;
    },
    password?: string
  ): { ok: boolean; error?: string; room?: ServerRoom } {
    const cleanCode = code.trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return { ok: false, error: 'Комната не найдена' };

    // Переподключение существующего игрока по стабильному playerId
    const existing = room.state.players.find((p) => p.id === profile.playerId);
    if (existing) {
      existing.socketId = profile.socketId;
      existing.isConnected = true;
      if (room.state.status === 'LOBBY') {
        existing.name = profile.name.trim().slice(0, 24) || existing.name;
        existing.avatar = profile.avatar || existing.avatar;
        existing.diceSkin = profile.diceSkin || existing.diceSkin;
        if (!TOKEN_COLORS.some((c) => c.hex === existing.color)) {
          existing.color = this.resolvePlayerColor(
            profile.color,
            room.state.players.filter((p) => p.id !== existing.id)
          );
        }
      }
      existing.stats = getPlayerStats(existing.id);
      this.emitState(room);
      return { ok: true, room };
    }

    if (room.state.status !== 'LOBBY') {
      return { ok: false, error: 'Матч уже начался!' };
    }
    if (
      room.state.settings.password &&
      room.state.settings.password.trim() !== '' &&
      room.state.settings.password !== (password || '')
    ) {
      return { ok: false, error: 'Неверный пароль от комнаты' };
    }
    if (room.state.players.length >= room.state.settings.maxPlayers) {
      return { ok: false, error: 'Комната уже заполнена' };
    }

    const chosenColor = this.resolvePlayerColor(profile.color, room.state.players);

    const player = this.createPlayerObj(
      { ...profile, color: chosenColor },
      false,
      room.state.players.length,
      room.state.settings
    );
    upsertPlayerProfile(player.id, player.name, player.avatar);
    player.stats = getPlayerStats(player.id);
    room.state.players.push(player);
    this.recomputeTeams(room);

    this.addLog(
      room,
      'SYSTEM',
      `${player.avatar} ${player.name} залетел в хату!`,
      `${player.avatar} ${player.name} подключился к комнате!`
    );
    this.emitState(room);
    return { ok: true, room };
  }

  private recomputeTeams(room: ServerRoom) {
    if (room.state.settings.mode === 'team2v2') {
      room.state.players.forEach((p, idx) => {
        p.team = (idx % 2) as 0 | 1;
      });
    } else {
      room.state.players.forEach((p) => {
        p.team = undefined;
      });
    }
  }

  public updateProfileInLobby(
    room: ServerRoom,
    playerId: string,
    patch: { name?: string; avatar?: string; color?: string; diceSkin?: DiceSkin }
  ) {
    if (room.state.status !== 'LOBBY') return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    if (patch.name) player.name = patch.name.trim().slice(0, 24) || player.name;
    if (patch.avatar) player.avatar = patch.avatar;
    if (patch.diceSkin) player.diceSkin = patch.diceSkin;
    if (patch.color && TOKEN_COLORS.some((c) => c.hex === patch.color)) {
      const taken = room.state.players.some((p) => p.id !== playerId && p.color === patch.color);
      if (!taken) player.color = patch.color;
    }
    upsertPlayerProfile(player.id, player.name, player.avatar);
    this.emitState(room);
  }

  public updateSettings(room: ServerRoom, playerId: string, patch: Partial<RoomSettings>) {
    if (room.state.status !== 'LOBBY' || room.state.hostId !== playerId) return;

    if (patch.mode && patch.mode !== room.state.settings.mode) {
      const defaults = MODE_INFO[patch.mode].defaults;
      Object.assign(room.state.settings, defaults, { mode: patch.mode });
    }

    const { mode } = room.state.settings;
    Object.assign(room.state.settings, patch);

    // Фиксированные лимиты игроков по режимам ТЗ
    if (mode === 'team2v2') room.state.settings.maxPlayers = 4;
    else if (mode === 'rasklad') room.state.settings.maxPlayers = 3;
    else if (mode === 'duel_restart') room.state.settings.maxPlayers = 2;
    else {
      room.state.settings.maxPlayers = Math.max(2, Math.min(5, room.state.settings.maxPlayers));
    }

    // Если игроков больше нового лимита — убираем лишних ботов с конца
    while (room.state.players.length > room.state.settings.maxPlayers) {
      const botIdx = [...room.state.players].reverse().findIndex((p) => p.isBot);
      if (botIdx !== -1) {
        const realIdx = room.state.players.length - 1 - botIdx;
        room.state.players.splice(realIdx, 1);
      } else {
        room.state.players.pop();
      }
    }

    room.state.players.forEach((p) => {
      p.cash = room.state.settings.startingCash;
    });
    this.recomputeTeams(room);
    this.emitState(room);
  }

  public addBot(room: ServerRoom, hostId: string) {
    if (room.state.status !== 'LOBBY' || room.state.hostId !== hostId) return;
    if (room.state.players.length >= room.state.settings.maxPlayers) return;

    const usedNames = new Set(room.state.players.map((p) => p.name));
    const botMeta =
      BOT_PROFILES.find((b) => !usedNames.has(b.name)) ||
      BOT_PROFILES[room.state.players.length % BOT_PROFILES.length];
    const color = this.pickRandomUnusedColor(room.state.players);
    const botIdx = BOT_PROFILES.indexOf(botMeta);
    const baseBotId = `bot_persona_${botIdx >= 0 ? botIdx : room.state.players.length}`;
    const botId = room.state.players.some((p) => p.id === baseBotId)
      ? `bot_${randomId(8)}`
      : baseBotId;

    const bot = this.createPlayerObj(
      {
        playerId: botId,
        socketId: null,
        name: botMeta.name,
        avatar: botMeta.avatar,
        color,
        diceSkin: 'neon',
      },
      true,
      room.state.players.length,
      room.state.settings
    );
    upsertPlayerProfile(bot.id, bot.name, bot.avatar);
    bot.stats = getPlayerStats(bot.id);
    room.state.players.push(bot);
    this.recomputeTeams(room);
    this.addLog(room, 'SYSTEM', `Добавлен ${bot.avatar} ${bot.name}`, `Добавлен ${bot.avatar} ${bot.name}`);
    this.emitState(room);
  }

  public removePlayer(room: ServerRoom, hostId: string, targetId: string) {
    if (room.state.status !== 'LOBBY' || room.state.hostId !== hostId) return;
    if (targetId === hostId) return;
    room.state.players = room.state.players.filter((p) => p.id !== targetId);
    this.recomputeTeams(room);
    this.emitState(room);
  }

  public swapSeat(room: ServerRoom, playerId: string, targetIndex: number) {
    if (room.state.status !== 'LOBBY') return;
    const curIndex = room.state.players.findIndex((p) => p.id === playerId);
    if (curIndex === -1 || targetIndex < 0 || targetIndex >= room.state.players.length) return;
    const temp = room.state.players[curIndex];
    room.state.players[curIndex] = room.state.players[targetIndex];
    room.state.players[targetIndex] = temp;
    this.recomputeTeams(room);
    this.emitState(room);
  }

  public startGame(room: ServerRoom, hostId: string): { ok: boolean; error?: string } {
    if (room.state.hostId !== hostId) return { ok: false, error: 'Только хост запускает игру' };
    const count = room.state.players.length;
    const { mode } = room.state.settings;

    if (mode === 'team2v2' && count !== 4) {
      return { ok: false, error: 'Для режима 2×2 нужно ровно 4 игрока (можно добавить ботов)' };
    }
    if (mode === 'rasklad' && count !== 3) {
      return { ok: false, error: 'Для режима «Расклад» нужно ровно 3 игрока (можно добавить ботов)' };
    }
    if (mode === 'duel_restart' && count !== 2) {
      return { ok: false, error: 'Для «Дуэли с рестартами» нужно ровно 2 игрока' };
    }
    if (count < 2) {
      return { ok: false, error: 'Нужно минимум 2 игрока (или добавьте бота)' };
    }

    this.resetMatchBoard(room, false);
    room.state.status = 'PLAYING';

    if (mode === 'rasklad') {
      this.applyRaskladDistribution(room);
    }

    this.addLog(
      room,
      'SYSTEM',
      `🔥 КАТКА НАЧАЛАСЬ! Режим: ${MODE_INFO[mode].title}. Стартовый кэш: ${formatMoney(
        room.state.settings.startingCash
      )}.`,
      `🔥 Игра началась! Режим: ${MODE_INFO[mode].title}.`
    );

    this.beginTurn(room, 0, false);
    this.emitState(room);
    return { ok: true };
  }

  private resetMatchBoard(room: ServerRoom, keepPositions: boolean) {
    room.deck = shuffle(FULL_CHANCE_POOL);
    room.creditedMonopolies.clear();
    room.pendingChance = null;
    room.postDebtLandingCellId = null;
    room.activeTradeMortgagedIds = null;
    room.state.cells = BOARD_CELLS.map((c) => ({
      id: c.id,
      ownerId: null,
      branches: 0,
      isMortgaged: false,
      mortgageRoundsLeft: null,
    }));
    room.state.round = 1;
    room.state.startedAt = Date.now();
    room.state.hasExtraTurn = false;
    room.state.mortgagedThisTurn = false;
    room.state.builtGroupsThisTurn = [];
    room.state.lastDice = null;
    room.state.speedTargetMode = 'NONE';
    room.state.validSpeedTargets = [];
    room.state.auction = null;
    room.state.activeTrade = null;
    room.state.portal = null;
    room.state.lastJackpotResult = null;
    room.state.pendingDebt = null;
    room.state.lastCardPopup = null;
    room.state.winnerIds = [];
    room.state.winnerTeam = null;

    this.recomputeTeams(room);
    for (const p of room.state.players) {
      p.cash = room.state.settings.startingCash;
      if (!keepPositions) p.position = 0;
      p.inJail = false;
      p.jailTurns = 0;
      p.skipTurns = 0;
      p.shields = 0;
      p.doublesStreak = 0;
      p.isBankrupt = false;
      p.extraTimeSec = 30;
      p.credit = null;
      p.creditCooldownUntilRound = 0;
      if (!keepPositions) {
        p.restarts = { branchLocked: 'NONE', usedCount: 0 };
      }
    }
  }

  private applyRaskladDistribution(room: ServerRoom) {
    const players = room.state.players;
    if (players.length !== 3) return;

    const basket1Ids = shuffle(
      BOARD_CELLS.filter(
        (c) => c.groupId && INDUSTRIES[c.groupId]?.raskladBasket === 1
      ).map((c) => c.id)
    ); // 18 fields -> 6 each
    const basket2Ids = shuffle(
      BOARD_CELLS.filter(
        (c) => c.groupId && INDUSTRIES[c.groupId]?.raskladBasket === 2
      ).map((c) => c.id)
    ); // 6 fields -> 2 each
    const basket3Ids = shuffle(
      BOARD_CELLS.filter(
        (c) => c.groupId && INDUSTRIES[c.groupId]?.raskladBasket === 3
      ).map((c) => c.id)
    ); // 4 fields -> 1 each + 1 compensation

    for (let i = 0; i < 3; i++) {
      const pId = players[i].id;
      for (const id of basket1Ids.slice(i * 6, (i + 1) * 6)) {
        room.state.cells[id].ownerId = pId;
      }
      for (const id of basket2Ids.slice(i * 2, (i + 1) * 2)) {
        room.state.cells[id].ownerId = pId;
      }
      room.state.cells[basket3Ids[i]].ownerId = pId;
    }

    // 4-е поле из 3-й корзины отдаётся игроку с наименьшей стоимостью полученных активов
    let minVal = Infinity;
    let luckyPlayer = players[0];
    for (const p of players) {
      const val = room.state.cells
        .filter((c) => c.ownerId === p.id)
        .reduce((acc, c) => acc + (BOARD_CELLS[c.id]?.price ?? 0), 0);
      if (val < minVal) {
        minVal = val;
        luckyPlayer = p;
      }
    }
    const fourthId = basket3Ids[3];
    room.state.cells[fourthId].ownerId = luckyPlayer.id;

    for (const p of players) {
      this.checkAndCreditMonopolies(room, p);
    }

    this.addLog(
      room,
      'SYSTEM',
      `🃏 РАСКЛАД ЗАВЕРШЁН! Все 28 полей розданы по 3 корзинам. Бонусное 4-е топ-поле («${BOARD_CELLS[fourthId].name}») досталось ${luckyPlayer.name} для баланса!`,
      `🃏 Расклад завершён! Все 28 полей распределены. Поле «${BOARD_CELLS[fourthId].cleanName}» досталось ${luckyPlayer.name}.`
    );
  }

  public rematch(room: ServerRoom, playerId: string) {
    if (room.state.status !== 'FINISHED' || room.state.hostId !== playerId) return;
    room.state.status = 'LOBBY';
    this.resetMatchBoard(room, false);
    this.addLog(room, 'SYSTEM', '🔄 Комната готова к реваншу!', '🔄 Комната готова к новой игре!');
    this.emitState(room);
  }

  // ================== ХОДЫ, РАУНДЫ И ТАЙМЕРЫ ==================

  private setPhaseDeadline(room: ServerRoom, customSeconds?: number) {
    const now = Date.now();
    room.state.turnStartedAt = now;
    const sec = customSeconds ?? room.state.settings.turnTimerSec;
    room.state.turnDeadlineAt = sec > 0 ? now + sec * 1000 : null;
  }

  private beginTurn(room: ServerRoom, nextIdx: number, isExtraTurn: boolean) {
    if (this.checkVictory(room)) return;

    const count = room.state.players.length;
    let idx = nextIdx % count;
    let safety = 0;
    while (room.state.players[idx].isBankrupt && safety < count + 1) {
      idx = (idx + 1) % count;
      safety++;
    }

    const wrappedNewRound = !isExtraTurn && idx <= room.state.currentPlayerIndex && room.state.startedAt !== null && (nextIdx >= count || nextIdx === 0 && room.state.currentPlayerIndex > 0);
    if (wrappedNewRound) {
      this.onNewRound(room);
    }

    room.state.currentPlayerIndex = idx;
    room.state.hasExtraTurn = false;
    room.state.speedTargetMode = 'NONE';
    room.state.validSpeedTargets = [];
    room.state.portal = null;
    room.pendingChance = null;
    room.postDebtLandingCellId = null;

    const player = room.state.players[idx];
    room.state.builtGroupsThisTurn = [];
    room.state.mortgagedThisTurn = false;
    if (!isExtraTurn) {
      player.doublesStreak = 0;
    }

    // Проверка пропуска хода
    if (player.skipTurns > 0 && !isExtraTurn) {
      player.skipTurns -= 1;
      this.addLog(
        room,
        'SYSTEM',
        `🍺 ${player.name} пропускает ход (перерыв на пивас / рейдеры).`,
        `🍺 ${player.name} пропускает этот ход.`,
        player
      );
      this.beginTurn(room, idx + 1, false);
      return;
    }

    // Проверка просроченного кредита в начале хода игрока
    if (player.credit && room.state.round >= player.credit.dueRound) {
      const due = player.credit.paybackAmount;
      player.credit = null;
      player.creditCooldownUntilRound = room.state.round + 3;
      if (player.cash >= due) {
        player.cash -= due;
        this.addLog(
          room,
          'SYSTEM',
          `🏦 Банк автоматически списал кредит ${formatMoney(due)} у ${player.name}.`,
          `🏦 Погашен кредит ${formatMoney(due)} игрока ${player.name}.`,
          player
        );
      } else {
        room.state.pendingDebt = {
          debtorId: player.id,
          creditorId: 'BANK',
          amount: due,
          reason: 'Просроченный кредит коллекторам банка',
          cleanReason: 'Погашение банковского кредита',
        };
        room.state.phase = 'PENDING_DEBT';
        this.setPhaseDeadline(room);
        this.addLog(
          room,
          'SYSTEM',
          `🚨 Коллекторы стучат к ${player.name}! Нужно срочно отдать кредит ${formatMoney(due)}!`,
          `🚨 Срок кредита истёк! ${player.name} должен выплатить ${formatMoney(due)}.`,
          player
        );
        return;
      }
    }

    room.state.phase = 'PRE_ROLL';
    this.setPhaseDeadline(room);
  }

  private onNewRound(room: ServerRoom) {
    room.state.round += 1;
    const speedUnlock =
      room.state.settings.mode === 'duel_restart'
        ? 5
        : isSpeedRulesMode(room.state.settings)
        ? 7
        : null;

    if (speedUnlock && room.state.round === speedUnlock) {
      this.addLog(
        room,
        'SYSTEM',
        `⚡ РАУНД ${room.state.round}: Разблокирован 3-й БЫСТРЫЙ КУБИК (Триплы, Маршрутка, Мем-подлянка М1)!`,
        `⚡ Раунд ${room.state.round}: Активирован Быстрый кубик!`
      );
    }

    // Сгорание заложенных полей по лимиту раундов
    if (room.state.settings.mortgageLimitRounds > 0 && !room.state.settings.retroRules) {
      for (const c of room.state.cells) {
        if (c.isMortgaged && c.mortgageRoundsLeft !== null) {
          c.mortgageRoundsLeft -= 1;
          if (c.mortgageRoundsLeft <= 0) {
            const prevOwner = room.state.players.find((p) => p.id === c.ownerId);
            const def = BOARD_CELLS[c.id];
            c.ownerId = null;
            c.isMortgaged = false;
            c.mortgageRoundsLeft = null;
            c.branches = 0;
            this.addLog(
              room,
              'SYSTEM',
              `💀 Поле «${def.name}» у ${prevOwner?.name ?? 'игрока'} сгорело за неуплату залога и ушло банку!`,
              `💀 Поле «${def.cleanName}» вернулось банку из-за истечения срока залога!`
            );
          }
        }
      }
    }
  }

  // ================== МЕХАНИКА РЕСТАРТОВ 1×1 ==================

  public useDuelRestart(room: ServerRoom, playerId: string): { ok: boolean; error?: string } {
    if (room.state.status !== 'PLAYING' || room.state.settings.mode !== 'duel_restart') {
      return { ok: false, error: 'Рестарты доступны только в режиме Дуэли 1×1' };
    }
    const curPlayer = room.state.players[room.state.currentPlayerIndex];
    if (curPlayer?.id !== playerId || room.state.phase !== 'PRE_ROLL') {
      return { ok: false, error: 'Рестарт можно взять только в свой ход ДО броска кубиков' };
    }

    const r = room.state.round;
    const tracker = curPlayer.restarts;
    let fee = 0;

    if (r >= 1 && r <= 10) {
      if (tracker.branchLocked === 'LATE_11_20') {
        return { ok: false, error: 'Ранняя ветка рестартов заблокирована' };
      }
      if (tracker.usedCount >= 2) {
        return { ok: false, error: 'Лимит 2 рестартов для 1–10 раундов исчерпан' };
      }
      tracker.branchLocked = 'EARLY_1_10';
      tracker.usedCount += 1;
      fee = 1000;
    } else if (r >= 11 && r <= 20) {
      if (tracker.branchLocked === 'EARLY_1_10') {
        return { ok: false, error: 'Вы уже выбрали ветку 1–10 раундов — ветка 11–20 закрыта!' };
      }
      if (tracker.usedCount >= 1) {
        return { ok: false, error: 'Лимит 1 рестарта для 11–20 раундов исчерпан' };
      }
      tracker.branchLocked = 'LATE_11_20';
      tracker.usedCount += 1;
      fee = 2000;
    } else {
      return { ok: false, error: 'После 20-го раунда рестарты недоступны!' };
    }

    const opponent = room.state.players.find((p) => p.id !== playerId);
    if (!opponent) return { ok: false, error: 'Соперник не найден' };

    // Сбрасываем поля, колоду, таймер, раунд=1, но СОХРАНЯЕМ позиции фишек и счётчик рестартов!
    const savedRestarts = room.state.players.map((p) => ({ id: p.id, r: { ...p.restarts } }));
    this.resetMatchBoard(room, true);
    for (const item of savedRestarts) {
      const pl = room.state.players.find((p) => p.id === item.id);
      if (pl) pl.restarts = item.r;
    }

    curPlayer.cash -= fee;
    opponent.cash += fee;

    this.addLog(
      room,
      'SYSTEM',
      `🔄 РЕСТАРТ МАТЧА! ${curPlayer.name} заплатил ${formatMoney(fee)} сопернику ${opponent.name}. Поля сброшены, фишки на местах, ход переходит сопернику!`,
      `🔄 Рестарт матча! ${curPlayer.name} заплатил ${formatMoney(fee)} игроку ${opponent.name}. Ход передан сопернику!`
    );

    const oppIndex = room.state.players.findIndex((p) => p.id === opponent.id);
    room.state.currentPlayerIndex = oppIndex;
    room.state.phase = 'PRE_ROLL';
    this.setPhaseDeadline(room);
    this.emitState(room);
    return { ok: true };
  }

  // ================== БРОСОК КУБИКОВ И ДВИЖЕНИЕ ==================

  public payJailFine(room: ServerRoom, playerId: string) {
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId || room.state.phase !== 'PRE_ROLL' || !player.inJail) return;
    if (player.cash < 500) return;

    player.cash -= 500;
    player.inJail = false;
    player.jailTurns = 0;
    this.addLog(
      room,
      'SYSTEM',
      `🔓 ${player.name} дал взятку вертухаю 500k и вышел из обезьянника!`,
      `🔓 ${player.name} оплатил залог 500k и вышел на свободу!`,
      player
    );
    this.emitState(room);
  }

  public rollDice(room: ServerRoom, playerId: string) {
    if (room.state.status !== 'PLAYING' || room.state.phase !== 'PRE_ROLL') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const die1 = randDie();
    const die2 = randDie();

    // Логика в тюрьме (без 3-го кубика)
    if (player.inJail) {
      const isDouble = die1 === die2;
      room.state.lastDice = {
        die1,
        die2,
        speedDie: null,
        isDouble,
        isTriple: false,
        totalSteps: die1 + die2,
        rolledBy: player.id,
        timestamp: Date.now(),
      };

      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        room.state.hasExtraTurn = false;
        this.addLog(
          room,
          'DICE',
          `🎲 [${die1} : ${die2}] ДУБЛЬ! ${player.name} красиво сбегает с бутылки!`,
          `🎲 [${die1} : ${die2}] Дубль! ${player.name} выходит из камеры бесплатно!`,
          player
        );
        this.moveClockwiseAndResolve(room, player, die1 + die2);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
          player.inJail = false;
          player.jailTurns = 0;
          this.addLog(
            room,
            'DICE',
            `🎲 [${die1} : ${die2}] 3-я ходкa мимо! Принудительный выкуп 500k и выход.`,
            `🎲 [${die1} : ${die2}] 3-я попытка неудачна — принудительный штраф 500k и ход.`,
            player
          );
          if (player.cash >= 500) {
            player.cash -= 500;
            this.moveClockwiseAndResolve(room, player, die1 + die2);
          } else {
            const steps = die1 + die2;
            const oldPos = player.position;
            const newPos = (oldPos + steps) % 40;
            player.position = newPos;
            if (oldPos + steps >= 40) {
              this.awardStartSalary(room, player, newPos === 0);
            }
            if (player.cash >= 500) {
              player.cash -= 500;
              this.resolveCellLanding(room, player, newPos);
            } else {
              room.postDebtLandingCellId = newPos;
              this.chargePlayer(
                room,
                player,
                'BANK',
                500,
                'Принудительный выкуп из обезьянника',
                'Принудительный выход из камеры',
                false
              );
            }
          }
        } else {
          room.state.hasExtraTurn = false;
          this.addLog(
            room,
            'DICE',
            `🎲 [${die1} : ${die2}] Не дубль — ${player.name} продолжает чиллить в обезьяннике (${player.jailTurns}/3).`,
            `🎲 [${die1} : ${die2}] Не дубль — ${player.name} остаётся в камере (${player.jailTurns}/3).`,
            player
          );
          this.finishPostRollOrAdvance(room);
        }
      }
      this.emitState(room);
      return;
    }

    // Обычный бросок (с возможным 3-м кубиком Speed Die)
    const speedDie: SpeedDieFace | null = isSpeedDieActive(room.state) ? randSpeedDie() : null;
    const isTriple =
      speedDie !== null &&
      typeof speedDie === 'number' &&
      die1 === die2 &&
      die1 === speedDie;
    const isDouble = !isTriple && die1 === die2;
    const numericSpeed = typeof speedDie === 'number' ? speedDie : 0;
    const totalSteps = die1 + die2 + numericSpeed;

    room.state.lastDice = {
      die1,
      die2,
      speedDie,
      isDouble,
      isTriple,
      totalSteps,
      rolledBy: player.id,
      timestamp: Date.now(),
    };

    const speedLabel =
      speedDie === 'BUS'
        ? ' + 🚐 АВТОБУС'
        : speedDie === 'M1'
        ? ' + 😈 М1-ПОДЛЯНКА'
        : speedDie !== null
        ? ` + ⚡${speedDie}`
        : '';

    // 1) ТРИПЛ (1:1:1, 2:2:2, 3:3:3) -> выбор любой клетки
    if (isTriple) {
      player.doublesStreak = 0;
      room.state.hasExtraTurn = false;
      room.state.phase = 'CHOOSE_SPEED_TARGET';
      room.state.speedTargetMode = 'TRIPLE';
      room.state.validSpeedTargets = BOARD_CELLS.map((c) => c.id).filter(
        (id) => id !== player.position
      );
      this.setPhaseDeadline(room);
      this.addLog(
        room,
        'DICE',
        `🔥🎲 ТРИПЛ [${die1}:${die2}:${speedDie}]! ${player.name} выбирает ЛЮБУЮ клетку для телепорта!`,
        `🔥🎲 Трипл [${die1}:${die2}:${speedDie}]! ${player.name} выбирает любую клетку на поле!`,
        player
      );
      this.emitState(room);
      return;
    }

    // 2) Проверка дублей и 3 дублей подряд
    if (isDouble) {
      player.doublesStreak += 1;
      if (player.doublesStreak >= 3) {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        player.doublesStreak = 0;
        room.state.hasExtraTurn = false;
        this.addLog(
          room,
          'DICE',
          `🚨🎲 [${die1}:${die2}${speedLabel}] ТРИ ДУБЛЯ ПОДРЯД! Мусора приняли ${player.name} за спидхак — на бутылку!`,
          `🚨🎲 [${die1}:${die2}${speedLabel}] Три дубля подряд! ${player.name} отправляется в камеру!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        this.emitState(room);
        return;
      }
      room.state.hasExtraTurn = true;
    } else {
      player.doublesStreak = 0;
      room.state.hasExtraTurn = false;
    }

    // 3) Бонус «АВТОБУС» на быстром кубике
    if (speedDie === 'BUS') {
      const distToNextCorner = 10 - (player.position % 10);
      const maxSteps = Math.max(die1 + die2, distToNextCorner);
      const targets: number[] = [];
      for (let s = 1; s <= maxSteps; s++) {
        targets.push((player.position + s) % 40);
      }
      room.state.phase = 'CHOOSE_SPEED_TARGET';
      room.state.speedTargetMode = 'BUS';
      room.state.validSpeedTargets = targets;
      this.setPhaseDeadline(room);
      this.addLog(
        room,
        'DICE',
        `🚐🎲 [${die1}:${die2} + АВТОБУС] ${player.name} выбирает остановку вперёд (до ${maxSteps} клеток)!`,
        `🚐🎲 [${die1}:${die2} + Автобус] ${player.name} выбирает клетку для остановки!`,
        player
      );
      this.emitState(room);
      return;
    }

    // 4) Бонус «М1 / Мем-подлянка» на быстром кубике
    if (speedDie === 'M1') {
      const targetCellId = this.findM1Target(room, player);
      const steps = (targetCellId - player.position + 40) % 40 || 40;
      this.addLog(
        room,
        'DICE',
        `😈🎲 [${die1}:${die2} + М1] Мем-подлянка швыряет ${player.name} на «${BOARD_CELLS[targetCellId].name}»!`,
        `😈🎲 [${die1}:${die2} + М1] Перелёт ${player.name} на «${BOARD_CELLS[targetCellId].cleanName}»!`,
        player
      );
      this.moveClockwiseAndResolve(room, player, steps);
      this.emitState(room);
      return;
    }

    // 5) Стандартный ход по сумме кубиков
    this.addLog(
      room,
      'DICE',
      `🎲 [${die1} + ${die2}${speedLabel} = ${totalSteps}]${isDouble ? ' (ДУБЛЬ!)' : ''} — ход ${player.name}`,
      `🎲 [${die1} + ${die2}${speedLabel} = ${totalSteps}]${isDouble ? ' (Дубль!)' : ''} — ход ${player.name}`,
      player
    );
    this.moveClockwiseAndResolve(room, player, totalSteps);
    this.emitState(room);
  }

  private findM1Target(room: ServerRoom, player: PlayerState): number {
    // 1. Ближайшее свободное покупаемое поле
    for (let offset = 1; offset <= 39; offset++) {
      const cid = (player.position + offset) % 40;
      const def = BOARD_CELLS[cid];
      if (isBuyableCell(def) && room.state.cells[cid].ownerId === null) {
        return cid;
      }
    }
    // 2. Если все раскуплены — ближайшее незаложенное поле соперника (или тиммейта в 2×2!)
    for (let offset = 1; offset <= 39; offset++) {
      const cid = (player.position + offset) % 40;
      const c = room.state.cells[cid];
      if (c.ownerId && c.ownerId !== player.id && !c.isMortgaged) {
        return cid;
      }
    }
    return (player.position + 7) % 40;
  }

  public chooseSpeedTarget(room: ServerRoom, playerId: string, targetCellId: number) {
    if (room.state.phase !== 'CHOOSE_SPEED_TARGET') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;
    if (!room.state.validSpeedTargets.includes(targetCellId)) return;

    const mode = room.state.speedTargetMode;
    room.state.speedTargetMode = 'NONE';
    room.state.validSpeedTargets = [];

    if (mode === 'TRIPLE') {
      // Трипл — прямой телепорт без кругового бонуса за пролёт (но если выбрал сам Старт 0 — получит бонус Старта)
      player.position = targetCellId;
      if (targetCellId === 0) {
        this.awardStartSalary(room, player, true);
      }
      this.addLog(
        room,
        'DICE',
        `⚡ ${player.name} телепортировался с Трипла прямо на «${BOARD_CELLS[targetCellId].name}»!`,
        `⚡ ${player.name} переместился на «${BOARD_CELLS[targetCellId].cleanName}»!`,
        player
      );
      this.resolveCellLanding(room, player, targetCellId);
    } else {
      const steps = (targetCellId - player.position + 40) % 40;
      this.addLog(
        room,
        'DICE',
        `🚐 ${player.name} вышел из маршрутки на «${BOARD_CELLS[targetCellId].name}»!`,
        `🚐 ${player.name} доехал на автобусе до «${BOARD_CELLS[targetCellId].cleanName}»!`,
        player
      );
      this.moveClockwiseAndResolve(room, player, steps);
    }
    this.emitState(room);
  }

  private awardStartSalary(room: ServerRoom, player: PlayerState, landedExact: boolean) {
    const { startBonusDisabled } = getAntiStallStatus(room.state);
    if (startBonusDisabled) {
      this.addLog(
        room,
        'SYSTEM',
        `⏳ Завод закрыт (анти-затягивание): ${player.name} прошёл Старт без зарплаты!`,
        `⏳ Время бонусов вышло: ${player.name} прошёл Старт без выплаты.`,
        player
      );
      return;
    }
    const retro = room.state.settings.retroRules || room.state.settings.mode === 'retro';
    const bonus = landedExact && !retro ? 3000 : 2000;
    player.cash += bonus;
    this.addLog(
      room,
      'SYSTEM',
      `💸 Зарплата пришла! ${player.name} лутает +${formatMoney(bonus)} ${
        landedExact && !retro ? '(+2.000k за круг + 1.000k бонусом на Старте!)' : 'за круг'
      }.`,
      `💸 Аванс получен! ${player.name} получает +${formatMoney(bonus)}.`,
      player
    );
  }

  private moveClockwiseAndResolve(room: ServerRoom, player: PlayerState, steps: number) {
    const oldPos = player.position;
    const rawNew = oldPos + steps;
    const newPos = rawNew % 40;
    player.position = newPos;

    if (rawNew >= 40) {
      this.awardStartSalary(room, player, newPos === 0);
    }

    this.resolveCellLanding(room, player, newPos);
  }

  private resolveCellLanding(room: ServerRoom, player: PlayerState, cellId: number) {
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const retro = room.state.settings.retroRules || room.state.settings.mode === 'retro';

    if (def.type === 'START' || def.type === 'JAIL') {
      this.finishPostRollOrAdvance(room);
      return;
    }

    if (def.type === 'POLICE') {
      player.position = 10;
      player.inJail = true;
      player.jailTurns = 0;
      player.doublesStreak = 0;
      room.state.hasExtraTurn = false;
      this.addLog(
        room,
        'SYSTEM',
        `🚓 МУСОРА ПРИНЯЛИ! ${player.name} уезжает в обезьянник без бонуса Старта!`,
        `🚓 Патруль задержал ${player.name}! Отправка в камеру.`,
        player
      );
      this.finishPostRollOrAdvance(room);
      return;
    }

    if (def.type === 'JACKPOT') {
      if (retro) {
        this.addLog(
          room,
          'SYSTEM',
          `🌳 ${player.name} присел на лавочку в Ретро-Парке отдыха.`,
          `🌳 ${player.name} отдыхает в Парке.`,
          player
        );
        this.finishPostRollOrAdvance(room);
        return;
      }
      if (!room.state.settings.russianRoulette && player.cash < 1000) {
        this.addLog(
          room,
          'SYSTEM',
          `🎰 ${player.name} зашёл в «Ебучий Додеп», но в кармане нет даже 1.000k — выгнали взашей.`,
          `🎰 У ${player.name} недостаточно средств (1.000k) для ставки в Джекпоте.`,
          player
        );
        this.finishPostRollOrAdvance(room);
        return;
      }
      room.state.lastJackpotResult = null;
      room.state.phase = 'JACKPOT';
      this.setPhaseDeadline(room);
      return;
    }

    if (def.type === 'PORTAL') {
      if (retro) {
        player.cash += 1500;
        this.addLog(
          room,
          'SYSTEM',
          `🎁 Ретро-бонус! ${player.name} нашёл заначку +1.500k!`,
          `🎁 Ретро-бонус! ${player.name} получает +1.500k!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        return;
      }
      const pool = shuffle(
        BOARD_CELLS.map((c) => c.id).filter((id) => id !== cellId && id !== 30)
      );
      room.state.portal = {
        playerId: player.id,
        candidateCells: pool.slice(0, 3),
        extraDirectionsBought: 0,
      };
      room.state.phase = 'PORTAL';
      this.setPhaseDeadline(room);
      return;
    }

    if (def.type === 'TAX') {
      const amount = def.taxAmount ?? 1000;
      this.chargePlayer(
        room,
        player,
        'BANK',
        amount,
        def.name,
        def.cleanName,
        true
      );
      return;
    }

    if (def.type === 'CHANCE') {
      if (retro) {
        // В ретро-режиме прямые бонусы/штрафы без карточек Шанс
        const isBonus = cellId === 2 || cellId === 22;
        if (isBonus) {
          player.cash += 1000;
          this.addLog(
            room,
            'CHANCE',
            `💰 Ретро-премия: ${player.name} получает +1.000k!`,
            `💰 Ретро-премия: ${player.name} получает +1.000k!`,
            player
          );
          this.finishPostRollOrAdvance(room);
        } else {
          this.chargePlayer(room, player, 'BANK', 1000, 'Ретро-штраф', 'Ретро-штраф', false);
        }
        return;
      }
      this.prepareChancePhase(room, player, cellId);
      return;
    }

    // Покупаемые поля
    if (isBuyableCell(def)) {
      if (cell.ownerId === null) {
        room.state.phase = 'BUY_DECISION';
        this.setPhaseDeadline(room);
        return;
      }
      if (cell.ownerId === player.id || cell.isMortgaged) {
        this.finishPostRollOrAdvance(room);
        return;
      }

      const diceSum = room.state.lastDice?.totalSteps ?? 7;
      const rentInfo = calculateRent(room.state, player, cellId, diceSum);
      const owner = room.state.players.find((p) => p.id === cell.ownerId);

      if (rentInfo.isAllyFree) {
        this.addLog(
          room,
          'RENT',
          `🤝 ${player.name} заскочил на точку тиммейта ${owner?.name} («${def.name}») — для своих без аренды!`,
          `🤝 ${player.name} посетил поле союзника ${owner?.name} без оплаты ренты.`,
          player
        );
        this.finishPostRollOrAdvance(room);
        return;
      }

      if (rentInfo.totalRent > 0 && owner) {
        let rentSuffix = '';
        if (def.type === 'IT_UTILITY') {
          const ownedCount = [12, 28].filter((id) => {
            const c = room.state.cells[id];
            return c && c.ownerId === owner.id && !c.isMortgaged;
          }).length;
          const mult = ownedCount >= 2 ? 250 : 100;
          rentSuffix = ` (${diceSum} × $${mult})`;
        }
        this.chargePlayer(
          room,
          player,
          owner.id,
          rentInfo.totalRent,
          `Аренда за «${def.name}»${rentSuffix}`,
          `Аренда за «${def.cleanName}»${rentSuffix}`,
          true,
          rentInfo.taxPercent
        );
        return;
      }

      this.finishPostRollOrAdvance(room);
    }
  }

  private prepareChancePhase(room: ServerRoom, player: PlayerState, cellId: number) {
    if (room.deck.length === 0) {
      room.deck = shuffle(FULL_CHANCE_POOL);
    }
    const card = room.deck.pop()!;

    let tone: ActiveCardPopup['tone'] = 'special';
    let effectLabel = '';
    let cleanEffectLabel = '';

    switch (card.kind) {
      case 'BONUS': {
        const amt = card.amount ?? 1000;
        tone = 'good';
        effectLabel = `+${formatMoney(amt)} на баланс`;
        cleanEffectLabel = effectLabel;
        break;
      }
      case 'PENALTY': {
        const amt = card.amount ?? 1000;
        tone = 'bad';
        effectLabel =
          player.shields > 0 && amt <= 3000
            ? `Штраф ${formatMoney(amt)} (отразит Крыша 🛡️)`
            : `Штраф -${formatMoney(amt)}`;
        cleanEffectLabel =
          player.shields > 0 && amt <= 3000
            ? `Штраф ${formatMoney(amt)} (отразит Защита 🛡️)`
            : `Штраф -${formatMoney(amt)}`;
        break;
      }
      case 'BRANCH_TAX': {
        const totalBranches = room.state.cells
          .filter((c) => c.ownerId === player.id)
          .reduce((acc, c) => acc + c.branches, 0);
        const amt = Math.max(card.amount ?? 1000, totalBranches * (card.perBranchAmount ?? 250));
        tone = 'bad';
        effectLabel =
          player.shields > 0 && amt <= 3000
            ? `Налог ${formatMoney(amt)} (отразит Крыша 🛡️)`
            : `Налог за филиалы: -${formatMoney(amt)}`;
        cleanEffectLabel =
          player.shields > 0 && amt <= 3000
            ? `Налог ${formatMoney(amt)} (отразит Защита 🛡️)`
            : `Налог за филиалы: -${formatMoney(amt)}`;
        break;
      }
      case 'SHIELD': {
        tone = 'good';
        effectLabel = '+1 Крыша от братков 🛡️';
        cleanEffectLabel = '+1 Защита от штрафов 🛡️';
        break;
      }
      case 'COLLECT_ALL': {
        const perPlayer = card.amount ?? 300;
        let previewCollected = 0;
        for (const other of room.state.players) {
          if (other.id !== player.id && !other.isBankrupt) {
            previewCollected += Math.min(other.cash, perPlayer);
          }
        }
        tone = 'good';
        effectLabel = `Сбор со всех игроков: +${formatMoney(previewCollected)}`;
        cleanEffectLabel = effectLabel;
        break;
      }
      case 'GOTO_START': {
        const { startBonusDisabled } = getAntiStallStatus(room.state);
        const retro = room.state.settings.retroRules || room.state.settings.mode === 'retro';
        const exactSalary = retro ? 2000 : 3000;
        tone = 'move';
        effectLabel = startBonusDisabled
          ? 'Переезд на СТАРТ (без бонуса ⏳)'
          : `Переезд на СТАРТ (+${formatMoney(exactSalary)})`;
        cleanEffectLabel = effectLabel;
        break;
      }
      case 'GOTO_JAIL': {
        tone = 'move';
        effectLabel = 'Отправка в Обезьянник 🚓';
        cleanEffectLabel = 'Отправка в Тюрьму 🚓';
        break;
      }
      case 'SKIP_TURN': {
        tone = 'bad';
        effectLabel = 'Пропуск следующего хода 🍺';
        cleanEffectLabel = 'Пропуск следующего хода 🍺';
        break;
      }
    }

    const now = Date.now();
    const walkDurationMs =
      room.state.lastDice &&
      room.state.lastDice.rolledBy === player.id &&
      now - room.state.lastDice.timestamp < 1500
        ? getTokenWalkDurationMs(room.state.lastDice)
        : 250;

    room.pendingChance = { card, playerId: player.id };
    room.state.lastCardPopup = {
      card,
      playerId: player.id,
      cellId,
      timestamp: now,
      walkDurationMs,
      effectLabel,
      cleanEffectLabel,
      tone,
    };
    room.state.phase = 'CHANCE';
    room.state.turnStartedAt = now;
    room.state.turnDeadlineAt = now + walkDurationMs + 5500;
  }

  public acknowledgeChance(room: ServerRoom, playerId?: string) {
    if (room.state.status !== 'PLAYING' || room.state.phase !== 'CHANCE' || !room.pendingChance) {
      return;
    }
    if (playerId && playerId !== room.pendingChance.playerId) {
      return;
    }

    const { card, playerId: targetId } = room.pendingChance;
    room.pendingChance = null;

    const player = room.state.players.find((p) => p.id === targetId);
    if (!player || player.isBankrupt) {
      this.finishPostRollOrAdvance(room);
      this.emitState(room);
      return;
    }

    switch (card.kind) {
      case 'BONUS': {
        const amt = card.amount ?? 1000;
        player.cash += amt;
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» — ${player.name} получает +${formatMoney(amt)}!`,
          `${card.icon} Шанс: «${card.cleanTitle}» — ${player.name} получает +${formatMoney(amt)}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'PENALTY': {
        const amt = card.amount ?? 1000;
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» (-${formatMoney(amt)})`,
          `${card.icon} Шанс: «${card.cleanTitle}» (-${formatMoney(amt)})`,
          player
        );
        this.chargePlayer(room, player, 'BANK', amt, card.title, card.cleanTitle, true);
        break;
      }
      case 'BRANCH_TAX': {
        const totalBranches = room.state.cells
          .filter((c) => c.ownerId === player.id)
          .reduce((acc, c) => acc + c.branches, 0);
        const amt = Math.max(card.amount ?? 1000, totalBranches * (card.perBranchAmount ?? 250));
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» — насчитали ${formatMoney(amt)}!`,
          `${card.icon} Шанс: «${card.cleanTitle}» — начислено ${formatMoney(amt)}!`,
          player
        );
        this.chargePlayer(room, player, 'BANK', amt, card.title, card.cleanTitle, true);
        break;
      }
      case 'SHIELD': {
        player.shields += 1;
        this.addLog(
          room,
          'CHANCE',
          `🛡️ ${player.name} получил карточку «${card.title}»! Следующий штраф/аренда (до 3.000k) обнулится!`,
          `🛡️ ${player.name} получил защиту «${card.cleanTitle}»!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'COLLECT_ALL': {
        const perPlayer = card.amount ?? 300;
        let collected = 0;
        for (const other of room.state.players) {
          if (other.id !== player.id && !other.isBankrupt) {
            const take = Math.min(other.cash, perPlayer);
            other.cash -= take;
            collected += take;
          }
        }
        player.cash += collected;
        this.addLog(
          room,
          'CHANCE',
          `🍻 «${card.title}» — пацаны скинулись ${player.name} в сумме на +${formatMoney(collected)}!`,
          `🍻 «${card.cleanTitle}» — ${player.name} собрал +${formatMoney(collected)}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'GOTO_START': {
        player.position = 0;
        this.awardStartSalary(room, player, true);
        this.addLog(
          room,
          'CHANCE',
          `🏠 «${card.title}» — ${player.name} домчал на Старт!`,
          `🏠 «${card.cleanTitle}» — ${player.name} переместился на Старт!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'GOTO_JAIL': {
        player.position = 10;
        player.inJail = true;
        player.jailTurns = 0;
        player.doublesStreak = 0;
        room.state.hasExtraTurn = false;
        this.addLog(
          room,
          'CHANCE',
          `🚓 «${card.title}» — ${player.name} улетает в обезьянник!`,
          `🚓 «${card.cleanTitle}» — ${player.name} отправляется в камеру!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'SKIP_TURN': {
        player.skipTurns += 1;
        room.state.hasExtraTurn = false;
        this.addLog(
          room,
          'CHANCE',
          `🍺 «${card.title}» — ${player.name} пропустит следующий ход!`,
          `🍺 «${card.cleanTitle}» — ${player.name} пропустит следующий ход!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
    }

    this.emitState(room);
  }

  private chargePlayer(
    room: ServerRoom,
    debtor: PlayerState,
    creditorId: string | 'BANK',
    amount: number,
    reason: string,
    cleanReason: string,
    canUseShield: boolean,
    rentTaxPercent: number = 0
  ) {
    // Проверка карточки «Крыша от братков (Скам-иммунитет)» (до 3.000k)
    if (canUseShield && debtor.shields > 0 && amount <= 3000) {
      debtor.shields -= 1;
      this.addLog(
        room,
        'SYSTEM',
        `🛡️ СКАМ-ИММУНИТЕТ! Братки прикрыли ${debtor.name} и обнулили платёж ${formatMoney(amount)} (${reason})!`,
        `🛡️ Защита сработала! ${debtor.name} не платит ${formatMoney(amount)} (${cleanReason})!`,
        debtor
      );
      this.finishPostRollOrAdvance(room);
      return;
    }

    room.state.pendingDebt = {
      debtorId: debtor.id,
      creditorId,
      amount,
      reason,
      cleanReason,
    };
    room.state.phase = 'PENDING_DEBT';
    this.setPhaseDeadline(room);

    if (debtor.cash >= amount) {
      if (creditorId === 'BANK') {
        this.addLog(
          room,
          'RENT',
          `🧾 ${debtor.name} получил счёт от банка (${reason}) — к оплате ${formatMoney(amount)}.`,
          `🧾 ${debtor.name} получил счёт от банка (${cleanReason}) — к оплате ${formatMoney(amount)}.`,
          debtor
        );
      } else {
        const creditor = room.state.players.find((p) => p.id === creditorId);
        this.addLog(
          room,
          'RENT',
          `🧾 ${debtor.name} попал на поле игрока ${creditor?.name ?? ''} (${reason}) — к оплате ${formatMoney(amount)}.`,
          `🧾 ${debtor.name} попал на поле игрока ${creditor?.name ?? ''} (${cleanReason}) — к оплате ${formatMoney(amount)}.`,
          debtor
        );
      }
    } else {
      this.addLog(
        room,
        'RENT',
        `⚠️ У ${debtor.name} не хватает налички для оплаты ${formatMoney(amount)} (${reason})! Заложите поля или продайте филиалы.`,
        `⚠️ У ${debtor.name} не хватает средств для оплаты ${formatMoney(amount)} (${cleanReason})!`,
        debtor
      );
    }
  }

  private executePayment(
    room: ServerRoom,
    debtor: PlayerState,
    creditorId: string | 'BANK',
    amount: number,
    reason: string,
    cleanReason: string,
    rentTaxPercent: number = 0
  ) {
    debtor.cash -= amount;
    if (creditorId === 'BANK') {
      this.addLog(
        room,
        'RENT',
        `💸 ${debtor.name} отстегнул банку ${formatMoney(amount)} (${reason}).`,
        `💸 ${debtor.name} заплатил банку ${formatMoney(amount)} (${cleanReason}).`,
        debtor
      );
    } else {
      const creditor = room.state.players.find((p) => p.id === creditorId);
      if (creditor) {
        const tax = Math.floor((amount * rentTaxPercent) / 100);
        const net = Math.max(0, amount - tax);
        creditor.cash += net;
        const taxNote = tax > 0 ? ` (налог на аренду ${rentTaxPercent}% съел ${formatMoney(tax)})` : '';
        this.addLog(
          room,
          'RENT',
          `💰 ${debtor.name} забашлял ${formatMoney(amount)} игроку ${creditor.name} (${reason})${taxNote}.`,
          `💰 ${debtor.name} заплатил ${formatMoney(amount)} игроку ${creditor.name} (${cleanReason})${taxNote}.`,
          debtor
        );
      }
    }
  }

  public payPendingDebt(room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'PENDING_DEBT' || !room.state.pendingDebt) return;
    const debt = room.state.pendingDebt;
    if (debt.debtorId !== playerId) return;
    const debtor = room.state.players.find((p) => p.id === playerId);
    if (!debtor || debtor.cash < debt.amount) return;

    const { rentTaxPercent } =
      debt.creditorId !== 'BANK' ? getAntiStallStatus(room.state) : { rentTaxPercent: 0 };
    this.executePayment(
      room,
      debtor,
      debt.creditorId,
      debt.amount,
      debt.reason,
      debt.cleanReason,
      rentTaxPercent
    );
    room.state.pendingDebt = null;
    if (room.postDebtLandingCellId !== null) {
      const targetCell = room.postDebtLandingCellId;
      room.postDebtLandingCellId = null;
      this.resolveCellLanding(room, debtor, targetCell);
    } else if (debt.reason === 'Просроченный кредит коллекторам банка') {
      room.state.phase = 'PRE_ROLL';
      this.setPhaseDeadline(room);
    } else {
      this.finishPostRollOrAdvance(room);
    }
    this.emitState(room);
  }

  // ================== ПОКУПКА ПОЛЕЙ И АУКЦИОНЫ ==================

  public buyProperty(room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'BUY_DECISION') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const cellId = player.position;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    if (!def?.price || cell.ownerId !== null) return;
    if (player.cash < def.price) return;

    player.cash -= def.price;
    cell.ownerId = player.id;
    this.bumpStat(player, 'cellsBought', 1);
    this.checkAndCreditMonopolies(room, player);

    this.addLog(
      room,
      'BUY',
      `🏷️ ${player.name} прикупил «${def.name}» за ${formatMoney(def.price)}!`,
      `🏷️ ${player.name} купил «${def.cleanName}» за ${formatMoney(def.price)}!`,
      player
    );
    this.finishPostRollOrAdvance(room);
    this.emitState(room);
  }

  public declineProperty(room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'BUY_DECISION') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const cellId = player.position;
    const def = BOARD_CELLS[cellId];
    const retro = room.state.settings.retroRules || room.state.settings.mode === 'retro';

    if (!room.state.settings.auctionsEnabled || retro) {
      this.addLog(
        room,
        'BUY',
        `🙅‍♂️ ${player.name} прошёл мимо «${def.name}» (аукционы отключены).`,
        `🙅‍♂️ ${player.name} отказался от покупки «${def.cleanName}».`,
        player
      );
      this.finishPostRollOrAdvance(room);
      this.emitState(room);
      return;
    }

    const basePrice = def.price ?? 500;
    const startPrice = basePrice + 100;
    const n = room.state.players.length;
    const orderedPlayers: PlayerState[] = [];
    for (let offset = 1; offset <= n; offset++) {
      orderedPlayers.push(room.state.players[(room.state.currentPlayerIndex + offset) % n]);
    }
    const participants = orderedPlayers
      .filter((p) => !p.isBankrupt && p.cash >= startPrice)
      .map((p) => p.id);

    if (participants.length === 0) {
      this.addLog(
        room,
        'AUCTION',
        `😴 На «${def.name}» (от ${formatMoney(startPrice)}) ни у кого не хватило средств — лот снят.`,
        `😴 На «${def.cleanName}» (от ${formatMoney(startPrice)}) ни у кого не хватило средств — лот снят.`
      );
      this.finishPostRollOrAdvance(room);
      this.emitState(room);
      return;
    }

    const firstBidder = room.state.players.find((p) => p.id === participants[0]);
    room.state.auction = {
      cellId,
      isMortgagedAuction: false,
      sellerId: null,
      currentBid: basePrice,
      highestBidderId: null,
      currentBidderId: participants[0],
      activeParticipantIds: participants,
      passedIds: [],
      endsAt: Date.now() + 14000,
    };
    room.state.phase = 'AUCTION';
    this.addLog(
      room,
      'AUCTION',
      `🔨 АУКЦИОН! «${def.name}» выставлено на торги от ${formatMoney(startPrice)}! Первым торгуется ${firstBidder?.name ?? 'игрок'}.`,
      `🔨 Аукцион за «${def.cleanName}» от ${formatMoney(startPrice)}! Ход торгов: ${firstBidder?.name ?? 'игрок'}.`
    );
    this.emitState(room);
  }

  // Выставление собственного заложенного поля на аукцион (п. 4.1 ТЗ / обновление «Расклад»)
  public startMortgagedAuction(room: ServerRoom, playerId: string, cellId: number) {
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || cur.id !== playerId) return;
    if (room.state.phase !== 'PRE_ROLL') return;
    if (!room.state.settings.auctionsEnabled || room.state.settings.retroRules) return;

    const cell = room.state.cells[cellId];
    const def = BOARD_CELLS[cellId];
    if (!cell || !def?.price || cell.ownerId !== playerId || !cell.isMortgaged) return;

    const basePrice = def.price;
    const startBid = basePrice + 100;
    const n = room.state.players.length;
    const orderedPlayers: PlayerState[] = [];
    for (let offset = 1; offset <= n; offset++) {
      orderedPlayers.push(room.state.players[(room.state.currentPlayerIndex + offset) % n]);
    }
    const participants = orderedPlayers
      .filter((p) => !p.isBankrupt && p.id !== playerId && p.cash >= startBid)
      .map((p) => p.id);

    if (participants.length === 0) return;

    const firstBidder = room.state.players.find((p) => p.id === participants[0]);
    room.state.auction = {
      cellId,
      isMortgagedAuction: true,
      sellerId: playerId,
      currentBid: basePrice,
      highestBidderId: null,
      currentBidderId: participants[0],
      activeParticipantIds: participants,
      passedIds: [],
      endsAt: Date.now() + 14000,
    };
    room.state.phase = 'AUCTION';
    this.addLog(
      room,
      'AUCTION',
      `🔨 ЗАЛОГОВЫЙ АУКЦИОН! ${cur.name} выставил заложенное поле «${def.name}» от ${formatMoney(startBid)}! Первым торгуется ${firstBidder?.name ?? 'игрок'}.`,
      `🔨 ${cur.name} выставил заложенное поле «${def.cleanName}» на аукцион от ${formatMoney(startBid)}!`
    );
    this.emitState(room);
  }

  private advanceAuctionTurn(room: ServerRoom, afterPlayerId: string) {
    const auc = room.state.auction;
    if (!auc) return;

    for (const pid of auc.activeParticipantIds) {
      if (auc.passedIds.includes(pid) || pid === auc.highestBidderId) continue;
      const p = room.state.players.find((pl) => pl.id === pid);
      if (!p || p.isBankrupt || p.cash < auc.currentBid + 100) {
        auc.passedIds.push(pid);
      }
    }

    const remaining = auc.activeParticipantIds.filter((id) => !auc.passedIds.includes(id));
    if (remaining.length === 0 || (remaining.length === 1 && auc.highestBidderId === remaining[0])) {
      this.finalizeAuction(room);
      return;
    }

    const total = auc.activeParticipantIds.length;
    const startIdx = Math.max(0, auc.activeParticipantIds.indexOf(afterPlayerId));
    let nextId: string | null = null;
    for (let offset = 1; offset <= total; offset++) {
      const candidate = auc.activeParticipantIds[(startIdx + offset) % total];
      if (!auc.passedIds.includes(candidate) && candidate !== auc.highestBidderId) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      nextId = remaining.find((id) => id !== auc.highestBidderId) ?? remaining[0] ?? null;
    }

    if (!nextId || (nextId === auc.highestBidderId && remaining.length <= 1)) {
      this.finalizeAuction(room);
      return;
    }

    auc.currentBidderId = nextId;
    auc.endsAt = Date.now() + 12000;
    this.emitState(room);
  }

  public placeAuctionBid(room: ServerRoom, playerId: string, stepAmount: number = 100) {
    if (room.state.phase !== 'AUCTION' || !room.state.auction) return;
    const auc = room.state.auction;
    if (!auc.activeParticipantIds.includes(playerId) || auc.passedIds.includes(playerId)) return;
    if (auc.currentBidderId && auc.currentBidderId !== playerId) return;

    const player = room.state.players.find((p) => p.id === playerId);
    const step = Math.max(100, Math.round(stepAmount / 100) * 100);
    const nextBid = auc.currentBid + step;
    if (!player || player.cash < nextBid) return;

    auc.currentBid = nextBid;
    auc.highestBidderId = playerId;

    this.addLog(
      room,
      'AUCTION',
      `💸 ${player.name} поднимает ставку до ${formatMoney(nextBid)}!`,
      `💸 ${player.name} ставит ${formatMoney(nextBid)}!`,
      player
    );

    this.advanceAuctionTurn(room, playerId);
  }

  public passAuction(room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'AUCTION' || !room.state.auction) return;
    const auc = room.state.auction;
    if (!auc.activeParticipantIds.includes(playerId)) return;
    if (auc.currentBidderId && auc.currentBidderId !== playerId) return;

    if (!auc.passedIds.includes(playerId)) {
      auc.passedIds.push(playerId);
      const player = room.state.players.find((p) => p.id === playerId);
      const def = BOARD_CELLS[auc.cellId];
      if (player && def) {
        this.addLog(
          room,
          'AUCTION',
          `🏳️ ${player.name} пасует на торгах за «${def.name}».`,
          `🏳️ ${player.name} вышел из торгов за «${def.cleanName}».`,
          player
        );
      }
    }
    this.advanceAuctionTurn(room, playerId);
  }

  public finalizeAuction(room: ServerRoom) {
    const auc = room.state.auction;
    if (!auc) return;
    const def = BOARD_CELLS[auc.cellId];
    const cell = room.state.cells[auc.cellId];

    if (auc.highestBidderId) {
      const winner = room.state.players.find((p) => p.id === auc.highestBidderId);
      if (winner && winner.cash >= auc.currentBid) {
        winner.cash -= auc.currentBid;
        if (auc.isMortgagedAuction && auc.sellerId) {
          const seller = room.state.players.find((p) => p.id === auc.sellerId);
          const bankCut = def.price ? def.price - getMortgageValue(auc.cellId) : 0;
          const sellerProfit = Math.max(0, auc.currentBid - bankCut);
          if (seller) seller.cash += sellerProfit;
          cell.ownerId = winner.id;
          cell.isMortgaged = false;
          cell.mortgageRoundsLeft = null;
          this.bumpStat(winner, 'cellsBought', 1);
          this.checkAndCreditMonopolies(room, winner);
          this.addLog(
            room,
            'AUCTION',
            `🏆 ИТОГ АУКЦИОНА: ${winner.name} забрал «${def.name}» (выкуплено!) за ${formatMoney(
              auc.currentBid
            )}. Навар продавца: +${formatMoney(sellerProfit)}!`,
            `🏆 Итог аукциона: ${winner.name} выиграл «${def.cleanName}» за ${formatMoney(auc.currentBid)}.`,
            winner
          );
        } else {
          cell.ownerId = winner.id;
          this.bumpStat(winner, 'cellsBought', 1);
          this.checkAndCreditMonopolies(room, winner);
          this.addLog(
            room,
            'AUCTION',
            `🏆 ИТОГ АУКЦИОНА: ${winner.name} забрал «${def.name}» за ${formatMoney(auc.currentBid)}!`,
            `🏆 Итог аукциона: ${winner.name} купил «${def.cleanName}» за ${formatMoney(auc.currentBid)}!`,
            winner
          );
        }
      }
    } else {
      this.addLog(
        room,
        'AUCTION',
        `😴 На «${def.name}» никто не поставил ни копейки — лот снят.`,
        `😴 Торги за «${def.cleanName}» завершились без ставок.`
      );
    }

    room.state.auction = null;
    if (auc.isMortgagedAuction) {
      room.state.phase = 'PRE_ROLL';
      this.setPhaseDeadline(room);
    } else {
      this.finishPostRollOrAdvance(room);
    }
    this.emitState(room);
  }

  // ================== СТРОЙКА, ЗАЛОГ, ВЫКУП (НЕ СБРАСЫВАЮТ ТАЙМЕР ХОДА!) ==================

  public buildBranch(room: ServerRoom, playerId: string, cellId: number) {
    const check = canBuildBranch(room.state, playerId, cellId);
    if (!check.ok) return;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const player = room.state.players.find((p) => p.id === playerId)!;

    player.cash -= def.branchCost!;
    cell.branches += 1;
    if (def.groupId && !room.state.builtGroupsThisTurn.includes(def.groupId)) {
      room.state.builtGroupsThisTurn.push(def.groupId);
    }
    const label = cell.branches === 5 ? 'БОЛЬШУЮ ЗВЕЗДУ ★' : `${cell.branches}-й филиал`;

    this.addLog(
      room,
      'BUY',
      `🏗️ ${player.name} воткнул ${label} на «${def.name}» (-${formatMoney(def.branchCost!)})!`,
      `🏗️ ${player.name} построил ${label} на «${def.cleanName}»!`,
      player
    );
    // Таймер хода специально НЕ сбрасывается (п. 3.1 ТЗ)!
    this.emitState(room);
  }

  public sellBranch(room: ServerRoom, playerId: string, cellId: number) {
    const check = canSellBranch(room.state, playerId, cellId);
    if (!check.ok) return;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const player = room.state.players.find((p) => p.id === playerId)!;

    const refund = Math.floor((def.branchCost ?? 0) * 0.5);
    cell.branches -= 1;
    player.cash += refund;

    this.addLog(
      room,
      'BUY',
      `🏚️ ${player.name} снёс филиал на «${def.name}» за +${formatMoney(refund)}.`,
      `🏚️ ${player.name} продал филиал на «${def.cleanName}» за +${formatMoney(refund)}.`,
      player
    );
    this.emitState(room);
  }

  public mortgageProperty(room: ServerRoom, playerId: string, cellId: number) {
    const check = canMortgageCell(room.state, playerId, cellId);
    if (!check.ok) return;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const player = room.state.players.find((p) => p.id === playerId)!;

    const isForcedDebtCover =
      room.state.phase === 'PENDING_DEBT' &&
      room.state.pendingDebt?.debtorId === playerId &&
      player.cash < room.state.pendingDebt.amount;

    const gain = getMortgageValue(cellId);
    cell.isMortgaged = true;
    cell.mortgageRoundsLeft =
      room.state.settings.mortgageLimitRounds > 0 && !room.state.settings.retroRules
        ? room.state.settings.mortgageLimitRounds
        : null;
    player.cash += gain;
    if (!isForcedDebtCover) {
      room.state.mortgagedThisTurn = true;
    }

    this.addLog(
      room,
      'BUY',
      `🔒 ${player.name} сдал в ломбард «${def.name}» и получил +${formatMoney(gain)}.`,
      `🔒 ${player.name} заложил «${def.cleanName}» за +${formatMoney(gain)}.`,
      player
    );
    this.emitState(room);
  }

  public unmortgageProperty(room: ServerRoom, playerId: string, cellId: number) {
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const player = room.state.players.find((p) => p.id === playerId);
    if (!def || !cell || !player || cell.ownerId !== playerId || !cell.isMortgaged) return;

    const cost = getUnmortgageCost(cellId);
    if (player.cash < cost) return;

    player.cash -= cost;
    cell.isMortgaged = false;
    cell.mortgageRoundsLeft = null;

    this.addLog(
      room,
      'BUY',
      `🔓 ${player.name} выкупил из залога «${def.name}» за ${formatMoney(cost)}.`,
      `🔓 ${player.name} выкупил «${def.cleanName}» за ${formatMoney(cost)}.`,
      player
    );
    this.emitState(room);
  }

  // ================== ПОРТАЛ И ДЖЕКПОТ (ЕБУЧИЙ ДОДЕП) ==================

  public buyPortalDirection(room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'PORTAL' || !room.state.portal) return;
    const portal = room.state.portal;
    if (portal.playerId !== playerId || portal.candidateCells.length >= 8) return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.cash < 500) return;

    const available = shuffle(
      BOARD_CELLS.map((c) => c.id).filter(
        (id) => id !== 7 && id !== 30 && !portal.candidateCells.includes(id)
      )
    );
    if (available.length === 0) return;

    player.cash -= 500;
    portal.candidateCells.push(available[0]);
    portal.extraDirectionsBought += 1;
    this.emitState(room);
  }

  public activatePortal(room: ServerRoom, playerId: string, targetCellId?: number) {
    if (room.state.phase !== 'PORTAL' || !room.state.portal) return;
    const portal = room.state.portal;
    if (portal.playerId !== playerId || portal.candidateCells.length === 0) return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const chosenCell =
      typeof targetCellId === 'number' && portal.candidateCells.includes(targetCellId)
        ? targetCellId
        : portal.candidateCells[Math.floor(Math.random() * portal.candidateCells.length)];
    room.state.portal = null;
    player.position = chosenCell;

    this.addLog(
      room,
      'SYSTEM',
      `🌀 Квантовый пиздец выплюнул ${player.name} прямо на «${BOARD_CELLS[chosenCell].name}»!`,
      `🌀 Портал перенёс ${player.name} на «${BOARD_CELLS[chosenCell].cleanName}»!`,
      player
    );

    if (chosenCell === 0) {
      this.awardStartSalary(room, player, true);
    }
    this.resolveCellLanding(room, player, chosenCell);
    this.emitState(room);
  }

  public playJackpot(
    room: ServerRoom,
    playerId: string,
    payload: { skip?: boolean; mode?: 'DICE' | 'ROULETTE'; faces?: number[] }
  ) {
    if (room.state.phase !== 'JACKPOT') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    if (payload.skip) {
      this.addLog(
        room,
        'SYSTEM',
        `🧘 ${player.name} сдержал лудоманию и прошёл мимо «Ебучего Додепа».`,
        `🧘 ${player.name} отказался от ставки в Джекпоте.`,
        player
      );
      this.finishPostRollOrAdvance(room);
      this.emitState(room);
      return;
    }

    const quote = JACKPOT_QUOTES[Math.floor(Math.random() * JACKPOT_QUOTES.length)];
    const rolled = randDie();

    if (room.state.settings.russianRoulette) {
      // Режим «Русская рулетка» вместо казино: 6 патронников, в 1 из них пуля.
      // Игрок выбирает 1..5 патронников: чем больше выбрано, тем выше награда, но пуля убивает и освобождает все клетки.
      const chambers = Array.from(
        new Set((payload.faces || [1]).filter((f) => f >= 1 && f <= 6))
      ).slice(0, 5);
      if (chambers.length === 0) return;

      const rewardTable: Record<number, number> = {
        1: 1000,
        2: 2000,
        3: 3500,
        4: 5500,
        5: 10000,
      };
      const reward = rewardTable[chambers.length] ?? 1000;
      const bulletChamber = randDie(); // 1..6
      const hit = chambers.includes(bulletChamber);

      if (hit) {
        this.bumpStat(player, 'rouletteDeaths', 1);
        room.state.lastJackpotResult = {
          mode: 'ROULETTE',
          rolledFace: bulletChamber,
          chosenFaces: chambers,
          won: false,
          payoutDelta: 0,
          quote: quote.hard,
          cleanQuote: quote.clean,
        };
        this.addLog(
          room,
          'BANKRUPT',
          `💥 РУССКАЯ РУЛЕТКА [${chambers.join(',')}] (пуля в #${bulletChamber}): БАБАХ! ${player.name} погиб и освободил все клетки!`,
          `💥 Русская рулетка [${chambers.join(',')}] (пуля в #${bulletChamber}): ${player.name} выбыл и освободил все клетки!`,
          player
        );
        this.executeBankruptcy(
          room,
          player,
          'BANK',
          `Погиб в Русской рулетке (патронник #${bulletChamber})`,
          `Выбыл в Русской рулетке (патронник #${bulletChamber})`
        );
      } else {
        player.cash += reward;
        room.state.lastJackpotResult = {
          mode: 'ROULETTE',
          rolledFace: bulletChamber,
          chosenFaces: chambers,
          won: true,
          payoutDelta: reward,
          quote: quote.hard,
          cleanQuote: quote.clean,
        };
        this.addLog(
          room,
          'CHANCE',
          `🔫 РУССКАЯ РУЛЕТКА [${chambers.join(',')}] (пуля в #${bulletChamber}): Щелчок холостой! ${player.name} выжил и получил +${formatMoney(
            reward
          )}!`,
          `🔫 Русская рулетка [${chambers.join(',')}] (пуля в #${bulletChamber}): Холостой! ${player.name} получил +${formatMoney(
            reward
          )}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
      }
      this.emitState(room);
      return;
    }

    if (payload.mode === 'ROULETTE') {
      // Русская рулетка: 1..5 выживаешь и лутаешь +1.500k, на 6 — осечка в висок (-2.000k и пропуск хода)
      const survived = rolled !== 6;
      if (survived) {
        player.cash += 1500;
        room.state.lastJackpotResult = {
          mode: 'ROULETTE',
          rolledFace: rolled,
          won: true,
          payoutDelta: 1500,
          quote: quote.hard,
          cleanQuote: quote.clean,
        };
        this.addLog(
          room,
          'CHANCE',
          `🔫 РУССКАЯ РУЛЕТКА [${rolled}/6]: Щелчок пустой! ${player.name} выжил и поднял +1.500k!`,
          `🔫 Рулетка [${rolled}/6]: Удача! ${player.name} выигрывает +1.500k!`,
          player
        );
        this.finishPostRollOrAdvance(room);
      } else {
        this.bumpStat(player, 'rouletteDeaths', 1);
        player.skipTurns += 1;
        room.state.lastJackpotResult = {
          mode: 'ROULETTE',
          rolledFace: rolled,
          won: false,
          payoutDelta: -2000,
          quote: quote.hard,
          cleanQuote: quote.clean,
        };
        this.addLog(
          room,
          'CHANCE',
          `💥 РУССКАЯ РУЛЕТКА [6/6]: БАБАХ! ${player.name} словил маслину на -2.000k и пропуск хода!`,
          `💥 Рулетка [6/6]: Проигрыш -2.000k и пропуск хода для ${player.name}!`,
          player
        );
        this.chargePlayer(room, player, 'BANK', 2000, 'Русская рулетка в Додепе', 'Штраф рулетки', false);
      }
      this.emitState(room);
      return;
    }

    // Ставка 1.000k на 1, 2 или 3 грани кубика
    const faces = Array.from(
      new Set((payload.faces || [6]).filter((f) => f >= 1 && f <= 6))
    ).slice(0, 3);
    if (faces.length === 0 || player.cash < 1000) return;

    player.cash -= 1000;
    const won = faces.includes(rolled);
    const grossWin = faces.length === 1 ? 6000 : faces.length === 2 ? 3000 : 2000;

    if (won) {
      player.cash += grossWin;
      this.bumpStat(player, 'casinoWins', 1);
      const net = grossWin - 1000;
      room.state.lastJackpotResult = {
        mode: 'DICE',
        rolledFace: rolled,
        chosenFaces: faces,
        won: true,
        payoutDelta: net,
        quote: quote.hard,
        cleanQuote: quote.clean,
      };
      this.addLog(
        room,
        'CHANCE',
        `🎰 ЗАНОООС В ДОДЕПЕ! Выпало [${rolled}] (ставка на ${faces.join(',')}) — ${player.name} забирает +${formatMoney(
          net
        )} чистыми!`,
        `🎰 Джекпот! Выпало [${rolled}] — ${player.name} выиграл +${formatMoney(net)}!`,
        player
      );
    } else {
      room.state.lastJackpotResult = {
        mode: 'DICE',
        rolledFace: rolled,
        chosenFaces: faces,
        won: false,
        payoutDelta: -1000,
        quote: quote.hard,
        cleanQuote: quote.clean,
      };
      this.addLog(
        room,
        'CHANCE',
        `🎰 СЛИВ В ДОДЕПЕ! Выпало [${rolled}] мимо [${faces.join(',')}] — ${player.name} подарил казику 1.000k!`,
        `🎰 Мимо! Выпало [${rolled}] — ${player.name} потерял ставку 1.000k.`,
        player
      );
    }
    this.finishPostRollOrAdvance(room);
    this.emitState(room);
  }

  // ================== БЕСПЛАТНЫЙ КРЕДИТ И ДОГОВОРЫ ==================

  public takeCredit(room: ServerRoom, playerId: string): { ok: boolean; error?: string } {
    if (!room.state.settings.creditEnabled) return { ok: false, error: 'Кредиты отключены в комнате' };
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return { ok: false, error: 'Кредит берётся только в свой ход' };
    if (player.credit) return { ok: false, error: 'У вас уже есть активный кредит' };

    const minRound = isSpeedRulesMode(room.state.settings) ? 10 : 3;
    if (room.state.round < minRound) {
      return { ok: false, error: `Кредит доступен с ${minRound}-го раунда (сейчас ${room.state.round}-й)` };
    }
    if (room.state.round < player.creditCooldownUntilRound) {
      return {
        ok: false,
        error: `Кулдаун кредита до ${player.creditCooldownUntilRound}-го раунда`,
      };
    }

    const principal = 5000;
    const paybackAmount = 6000;
    const term = isSpeedRulesMode(room.state.settings) ? 6 : 8;

    player.cash += principal;
    player.credit = {
      principal,
      paybackAmount,
      dueRound: room.state.round + term,
    };

    this.addLog(
      room,
      'SYSTEM',
      `🏦 ${player.name} оформил кредит +${formatMoney(principal)} (вернуть ${formatMoney(
        paybackAmount
      )} к ${player.credit.dueRound} раунду).`,
      `🏦 ${player.name} взял кредит +${formatMoney(principal)} до ${player.credit.dueRound} раунда.`,
      player
    );
    this.emitState(room);
    return { ok: true };
  }

  public repayCredit(room: ServerRoom, playerId: string): { ok: boolean; error?: string } {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || !player.credit) return { ok: false, error: 'Нет активного кредита' };
    if (room.state.settings.retroRules || room.state.settings.mode === 'retro') {
      return { ok: false, error: 'В Ретро-режиме досрочный возврат кредита отключён!' };
    }
    if (player.cash < player.credit.paybackAmount) {
      return { ok: false, error: `Нужно ${formatMoney(player.credit.paybackAmount)}` };
    }

    const paid = player.credit.paybackAmount;
    player.cash -= paid;
    player.credit = null;
    player.creditCooldownUntilRound = room.state.round + 3;

    this.addLog(
      room,
      'SYSTEM',
      `🏦 ${player.name} досрочно закрыл кредит на ${formatMoney(paid)}!`,
      `🏦 ${player.name} досрочно погасил кредит ${formatMoney(paid)}.`,
      player
    );
    this.emitState(room);
    return { ok: true };
  }

  private groupHasAnyBranch(room: ServerRoom, cellId: number): boolean {
    const grp = BOARD_CELLS[cellId]?.groupId;
    if (!grp) return false;
    return getGroupCellDefs(grp).some((d) => (room.state.cells[d.id]?.branches ?? 0) > 0);
  }

  public proposeTrade(
    room: ServerRoom,
    fromId: string,
    toId: string,
    offer: TradeSide,
    request: TradeSide
  ): { ok: boolean; error?: string } {
    if (room.state.status !== 'PLAYING' || room.state.activeTrade) {
      return { ok: false, error: 'Сейчас уже висит другой договор' };
    }
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || cur.id !== fromId) {
      return { ok: false, error: 'Отправлять договор можно только в свой ход' };
    }
    const fromP = room.state.players.find((p) => p.id === fromId);
    const toP = room.state.players.find((p) => p.id === toId);
    if (!fromP || !toP || toP.isBankrupt || fromId === toId) {
      return { ok: false, error: 'Некорректный получатель сделки' };
    }

    const cleanOffer: TradeSide = {
      cash: Math.max(0, Math.round(offer.cash || 0)),
      propertyIds: Array.from(new Set(offer.propertyIds || [])),
      shields: Math.max(0, Math.min(fromP.shields, offer.shields || 0)),
    };
    const cleanReq: TradeSide = {
      cash: Math.max(0, Math.round(request.cash || 0)),
      propertyIds: Array.from(new Set(request.propertyIds || [])),
      shields: Math.max(0, Math.min(toP.shields, request.shields || 0)),
    };

    if (fromP.cash < cleanOffer.cash || toP.cash < cleanReq.cash) {
      return { ok: false, error: 'У одной из сторон не хватает налички' };
    }

    // Проверка владения и отсутствия филиалов на обмениваемых полях (и в их отраслях)
    for (const cid of cleanOffer.propertyIds) {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== fromId || c.branches > 0 || this.groupHasAnyBranch(room, cid)) {
        return { ok: false, error: 'Нельзя обменивать чужие поля или поля из отраслей с филиалами' };
      }
    }
    for (const cid of cleanReq.propertyIds) {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== toId || c.branches > 0 || this.groupHasAnyBranch(room, cid)) {
        return { ok: false, error: 'На запрашиваемом поле (или в его отрасли) построены филиалы' };
      }
    }

    const fairness = checkTradeFairness(room.state.cells, cleanOffer, cleanReq);
    if (fairness.offerValue === 0 && fairness.requestValue === 0) {
      return { ok: false, error: 'Пустой договор отправлять нельзя' };
    }
    if (room.state.settings.fairTradeLimit && !fairness.fair) {
      return {
        ok: false,
        error: `Анти-абуз фильтр ±50%: перекос сделки ${fairness.diffPercent}% (${formatMoney(
          fairness.offerValue
        )} vs ${formatMoney(fairness.requestValue)})`,
      };
    }

    const trade: TradeOffer = {
      id: `tr_${randomId(6)}`,
      fromPlayerId: fromId,
      toPlayerId: toId,
      offer: cleanOffer,
      request: cleanReq,
      createdAt: Date.now(),
      expiresAt: Date.now() + 35000,
    };
    room.state.activeTrade = trade;
    room.activeTradeMortgagedIds = new Set(
      [...cleanOffer.propertyIds, ...cleanReq.propertyIds].filter((cid) =>
        Boolean(room.state.cells[cid]?.isMortgaged)
      )
    );

    const tpl =
      TRADE_PROPOSAL_TEMPLATES[Math.floor(Math.random() * TRADE_PROPOSAL_TEMPLATES.length)];
    const hardMsg = tpl.hard.replace('{from}', fromP.name).replace('{to}', toP.name);
    const cleanMsg = tpl.clean.replace('{from}', fromP.name).replace('{to}', toP.name);

    this.addLog(room, 'TRADE', hardMsg, cleanMsg, fromP);
    this.emitState(room);
    return { ok: true };
  }

  public respondTrade(room: ServerRoom, playerId: string, accept: boolean) {
    const trade = room.state.activeTrade;
    if (!trade) return;
    if (playerId !== trade.toPlayerId && (accept || playerId !== trade.fromPlayerId)) return;

    const fromP = room.state.players.find((p) => p.id === trade.fromPlayerId);
    const toP = room.state.players.find((p) => p.id === trade.toPlayerId);
    const snapshotMortgaged = room.activeTradeMortgagedIds;
    room.state.activeTrade = null;
    room.activeTradeMortgagedIds = null;

    if (!accept || !fromP || !toP) {
      this.addLog(
        room,
        'TRADE',
        `❌ Договор между ${fromP?.name} и ${toP?.name} послан лесом!`,
        `❌ Предложение обмена отклонено.`
      );
      this.emitState(room);
      return;
    }

    // Повторная валидация перед передачей активов (защита от гонки стройки филиалов / залога / потери поля)
    const cashOrShieldsInvalid =
      fromP.isBankrupt ||
      toP.isBankrupt ||
      fromP.cash < trade.offer.cash ||
      toP.cash < trade.request.cash ||
      fromP.shields < trade.offer.shields ||
      toP.shields < trade.request.shields;

    const offerPropsInvalid = trade.offer.propertyIds.some((cid) => {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== fromP.id || c.branches > 0 || this.groupHasAnyBranch(room, cid)) {
        return true;
      }
      if (c.isMortgaged && !snapshotMortgaged?.has(cid)) {
        return true;
      }
      return false;
    });

    const reqPropsInvalid = trade.request.propertyIds.some((cid) => {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== toP.id || c.branches > 0 || this.groupHasAnyBranch(room, cid)) {
        return true;
      }
      if (c.isMortgaged && !snapshotMortgaged?.has(cid)) {
        return true;
      }
      return false;
    });

    if (cashOrShieldsInvalid || offerPropsInvalid || reqPropsInvalid) {
      this.addLog(
        room,
        'TRADE',
        `⚠️ Сделка между ${fromP.name} и ${toP.name} сорвалась: состав активов или филиалов изменился!`,
        `⚠️ Сделка между ${fromP.name} и ${toP.name} отменена: активы сторон изменились!`
      );
      this.emitState(room);
      return;
    }

    fromP.cash = fromP.cash - trade.offer.cash + trade.request.cash;
    toP.cash = toP.cash - trade.request.cash + trade.offer.cash;
    fromP.shields = fromP.shields - trade.offer.shields + trade.request.shields;
    toP.shields = toP.shields - trade.request.shields + trade.offer.shields;

    for (const cid of trade.offer.propertyIds) {
      room.state.cells[cid].ownerId = toP.id;
    }
    for (const cid of trade.request.propertyIds) {
      room.state.cells[cid].ownerId = fromP.id;
    }

    this.checkAndCreditMonopolies(room, fromP);
    this.checkAndCreditMonopolies(room, toP);

    this.addLog(
      room,
      'TRADE',
      `🤝 По рукам! ${fromP.name} и ${toP.name} ударили по рукам и провернули сделку!`,
      `🤝 Сделка заключена! ${fromP.name} и ${toP.name} пожали руки!`
    );
    this.emitState(room);
  }

  // ================== ЗАВЕРШЕНИЕ ХОДА, БАНКРОТСТВО, ПОБЕДА ==================

  private finishPostRollOrAdvance(room: ServerRoom) {
    if (room.state.status !== 'PLAYING') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (player && room.state.hasExtraTurn && !player.inJail && !player.isBankrupt) {
      this.addLog(
        room,
        'DICE',
        `🎲 Дубль! ${player.name} получает ещё один бросок.`,
        `🎲 Дубль! ${player.name} бросает ещё раз.`,
        player
      );
      this.beginTurn(room, room.state.currentPlayerIndex, true);
    } else {
      this.beginTurn(room, room.state.currentPlayerIndex + 1, false);
    }
  }

  public endTurn(room: ServerRoom, playerId: string) {
    if (room.state.status !== 'PLAYING' || room.state.phase !== 'POST_ROLL') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    this.finishPostRollOrAdvance(room);
    this.emitState(room);
  }

  public surrenderOrBankrupt(room: ServerRoom, playerId: string) {
    if (room.state.status !== 'PLAYING') return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.isBankrupt) return;

    const debt =
      room.state.pendingDebt?.debtorId === playerId ? room.state.pendingDebt : null;
    const creditorId = debt ? debt.creditorId : 'BANK';
    const reason = debt ? debt.reason : 'Добровольная капитуляция (ливнул с позором)';
    const cleanReason = debt ? debt.cleanReason : 'Добровольная сдача';

    this.executeBankruptcy(room, player, creditorId, reason, cleanReason);
    this.emitState(room);
  }

  private executeBankruptcy(
    room: ServerRoom,
    loser: PlayerState,
    creditorId: string | 'BANK',
    reason: string,
    cleanReason: string
  ) {
    loser.isBankrupt = true;
    loser.inJail = false;
    loser.credit = null;
    this.bumpStat(loser, 'bankruptcies', 1);

    const creditor =
      creditorId !== 'BANK'
        ? room.state.players.find((p) => p.id === creditorId && !p.isBankrupt)
        : undefined;

    // Продаём все филиалы за 50% и передаём активы кредитору или банку
    for (const c of room.state.cells) {
      if (c.ownerId === loser.id) {
        if (c.branches > 0) {
          const def = BOARD_CELLS[c.id];
          loser.cash += c.branches * Math.floor((def.branchCost ?? 0) * 0.5);
          c.branches = 0;
        }
        if (creditor) {
          c.ownerId = creditor.id;
        } else {
          c.ownerId = null;
          c.isMortgaged = false;
          c.mortgageRoundsLeft = null;
        }
      }
    }

    if (creditor) {
      this.checkAndCreditMonopolies(room, creditor);
    }

    if (creditor && loser.cash > 0) {
      creditor.cash += loser.cash;
    }
    loser.cash = 0;

    if (room.state.pendingDebt?.debtorId === loser.id) {
      room.state.pendingDebt = null;
    }
    if (room.pendingChance?.playerId === loser.id) {
      room.pendingChance = null;
    }
    if (room.state.players[room.state.currentPlayerIndex]?.id === loser.id) {
      room.postDebtLandingCellId = null;
    }
    if (room.state.activeTrade && (room.state.activeTrade.fromPlayerId === loser.id || room.state.activeTrade.toPlayerId === loser.id)) {
      room.state.activeTrade = null;
      room.activeTradeMortgagedIds = null;
    }

    const styles: ('eralash' | 'curb' | 'wasted')[] = ['wasted', 'curb', 'eralash'];
    const style = styles[room.bankruptcyStyleCounter % styles.length];
    room.bankruptcyStyleCounter += 1;

    const winnerLabel =
      creditor?.name ||
      room.state.players.find((p) => !p.isBankrupt)?.name ||
      'Банк-коллектор';

    this.callbacks.onBankruptcyAnim(room.state.code, {
      style,
      loserName: loser.name,
      loserAvatar: loser.avatar,
      winnerName: winnerLabel,
      reason,
      cleanReason,
      timestamp: Date.now(),
    });

    this.addLog(
      room,
      'BANKRUPT',
      `💀 ПОТРАЧЕНО! ${loser.avatar} ${loser.name} обанкротился (${reason})! Активы перешли: ${
        creditor ? creditor.name : 'Банку'
      }.`,
      `💀 Банкротство! ${loser.avatar} ${loser.name} выбывает из игры (${cleanReason}).`,
      loser
    );

    if (this.checkVictory(room)) return;

    if (room.state.players[room.state.currentPlayerIndex]?.id === loser.id) {
      this.beginTurn(room, room.state.currentPlayerIndex + 1, false);
    }
  }

  private checkVictory(room: ServerRoom): boolean {
    const alive = room.state.players.filter((p) => !p.isBankrupt);

    if (room.state.settings.mode === 'team2v2') {
      const teamsAlive = new Set(alive.map((p) => p.team));
      if (teamsAlive.size <= 1) {
        const winTeam = (alive[0]?.team ?? 0) as 0 | 1;
        const winners = room.state.players.filter((p) => p.team === winTeam);
        this.finishMatch(room, winners.map((w) => w.id), winTeam);
        return true;
      }
      return false;
    }

    if (alive.length <= 1) {
      const winnerIds = alive.map((p) => p.id);
      this.finishMatch(room, winnerIds, null);
      return true;
    }
    return false;
  }

  private finishMatch(room: ServerRoom, winnerIds: string[], winnerTeam: 0 | 1 | null) {
    room.state.status = 'FINISHED';
    room.state.phase = 'GAME_OVER';
    room.state.turnDeadlineAt = null;
    room.state.winnerIds = winnerIds;
    room.state.winnerTeam = winnerTeam;

    const winnerNames = room.state.players
      .filter((p) => winnerIds.includes(p.id))
      .map((p) => `${p.avatar} ${p.name}`)
      .join(' & ');

    this.addLog(
      room,
      'SYSTEM',
      `🏆 ПОБЕДА! Короли монополии: ${winnerNames}! Все остальные уехали на завод.`,
      `🏆 Игра окончена! Победитель: ${winnerNames}!`
    );

    const durationSec = room.state.startedAt
      ? Math.round((Date.now() - room.state.startedAt) / 1000)
      : 0;
    recordMatchFinish({
      roomCode: room.state.code,
      mode: room.state.settings.mode,
      players: room.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        won: winnerIds.includes(p.id),
      })),
      rounds: room.state.round,
      durationSec,
    });
    for (const p of room.state.players) {
      p.stats = getPlayerStats(p.id);
    }
  }

  // ================== ЧАТ И БЕСПЛАТНЫЕ НАСМЕШКИ ==================

  public sendChat(room: ServerRoom, playerId: string, message: string) {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    const cleanMsg = message.trim().slice(0, 240);
    if (!cleanMsg) return;
    this.addLog(room, 'CHAT', cleanMsg, cleanMsg, player);
    this.emitState(room);
  }

  public reactToLog(room: ServerRoom, playerId: string, logId: string, emoji: string) {
    const allowed = ['🤡', '💀', '🔥', '💸'];
    if (!allowed.includes(emoji)) return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    const entry = room.state.logs.find((l) => l.id === logId);
    if (!entry) return;
    if (!entry.reactions) entry.reactions = {};
    entry.reactions[emoji] = (entry.reactions[emoji] ?? 0) + 1;
    this.emitState(room);
  }

  public sendTaunt(room: ServerRoom, playerId: string, tauntId: string) {
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    const now = Date.now();
    if (now - player.lastTauntAt < 5000) return; // кулдаун 5 сек против спама

    const taunt = TAUNTS.find((t) => t.id === tauntId);
    if (!taunt) return;
    player.lastTauntAt = now;

    this.addLog(room, 'TAUNT', taunt.text, taunt.cleanText, player);
    this.callbacks.onTaunt(room.state.code, {
      id: `t_${now}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      tauntId: taunt.id,
      timestamp: now,
    });
    this.emitState(room);
  }

  // ================== СЕРВЕРНЫЙ ТИК ТАЙМЕРОВ (1 СЕК) ==================

  public tickTimers(now: number = Date.now()) {
    for (const [code, room] of this.rooms.entries()) {
      // Очистка старых брошенных комнат (старше 3 часов без активности)
      if (now - room.lastActivityAt > 3 * 3600 * 1000) {
        this.rooms.delete(code);
        continue;
      }
      if (room.state.status !== 'PLAYING') continue;

      // Истечение таймера предложения обмена
      if (room.state.activeTrade && now >= room.state.activeTrade.expiresAt) {
        room.state.activeTrade = null;
        room.activeTradeMortgagedIds = null;
        this.addLog(room, 'TRADE', '⌛ Время ответа на договор истекло.', '⌛ Время обмена истекло.');
        this.emitState(room);
      }

      // Авто-подтверждение карточки Шанса по истечении дедлайна (чтобы игра не зависла)
      if (
        room.state.phase === 'CHANCE' &&
        room.state.turnDeadlineAt &&
        now >= room.state.turnDeadlineAt
      ) {
        this.acknowledgeChance(room);
        continue;
      }

      // Истечение таймера ставки на аукционе -> текущий участник автоматически пасует
      if (room.state.phase === 'AUCTION' && room.state.auction && now >= room.state.auction.endsAt) {
        if (room.state.auction.currentBidderId) {
          this.passAuction(room, room.state.auction.currentBidderId);
        } else {
          this.finalizeAuction(room);
        }
        continue;
      }

      // Таймер хода активного игрока
      if (
        room.state.phase !== 'AUCTION' &&
        room.state.phase !== 'GAME_OVER' &&
        room.state.turnDeadlineAt &&
        now >= room.state.turnDeadlineAt
      ) {
        const cur = room.state.players[room.state.currentPlayerIndex];
        if (!cur) continue;

        // Авто-действие при истечении таймера хода
        if (room.state.phase === 'PRE_ROLL') {
          this.rollDice(room, cur.id);
        } else if (room.state.phase === 'CHOOSE_SPEED_TARGET') {
          const target = room.state.validSpeedTargets[0] ?? ((cur.position + 1) % 40);
          this.chooseSpeedTarget(room, cur.id, target);
        } else if (room.state.phase === 'BUY_DECISION') {
          this.declineProperty(room, cur.id);
        } else if (room.state.phase === 'PORTAL') {
          this.activatePortal(room, cur.id);
        } else if (room.state.phase === 'JACKPOT') {
          this.playJackpot(room, cur.id, { skip: true });
        } else if (room.state.phase === 'PENDING_DEBT') {
          // Если хватает денег — платит, иначе авто-ликвидация или банкротство
          const debt = room.state.pendingDebt;
          if (debt && calculateLiquidationPotential(cur, room.state.cells) >= debt.amount) {
            this.autoLiquidateForDebt(room, cur, debt.amount);
            this.payPendingDebt(room, cur.id);
          } else {
            this.surrenderOrBankrupt(room, cur.id);
          }
        } else if (room.state.phase === 'POST_ROLL') {
          this.finishPostRollOrAdvance(room);
          this.emitState(room);
        }
      }
    }
  }

  public autoLiquidateForDebt(room: ServerRoom, player: PlayerState, neededCash: number) {
    // 1. Сначала закладываем свободные поля без филиалов
    for (const c of room.state.cells) {
      if (player.cash >= neededCash) break;
      if (c.ownerId === player.id && !c.isMortgaged && canMortgageCell(room.state, player.id, c.id).ok) {
        this.mortgageProperty(room, player.id, c.id);
      }
    }
    // 2. Затем продаём филиалы
    let safety = 0;
    while (player.cash < neededCash && safety < 50) {
      safety++;
      const sellable = room.state.cells.find(
        (c) => c.ownerId === player.id && canSellBranch(room.state, player.id, c.id).ok
      );
      if (!sellable) break;
      this.sellBranch(room, player.id, sellable.id);
      // После продажи филиалов пробуем заложить освободившиеся поля
      for (const c of room.state.cells) {
        if (player.cash >= neededCash) break;
        if (c.ownerId === player.id && !c.isMortgaged && canMortgageCell(room.state, player.id, c.id).ok) {
          this.mortgageProperty(room, player.id, c.id);
        }
      }
    }
  }
}
