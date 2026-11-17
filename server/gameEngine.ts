import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_CELLS, INDUSTRIES, isBuyableCell } from '../shared/boardData.ts';
import {
  BOT_PROFILES,
  CHANCE_DECK,
  JACKPOT_QUOTES,
  MODE_INFO,
  TAUNT_COOLDOWN_MS,
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
  canUnmortgageCell,
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
  KickVoteState,
  PlayerState,
  PlayerStats,
  PoliceArrestReason,
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

import {
  buyProperty as buyPropertyHandler,
  declineProperty as declinePropertyHandler,
  finalizeAuction as finalizeAuctionHandler,
  passAuction as passAuctionHandler,
  placeAuctionBid as placeAuctionBidHandler,
  startMortgagedAuction as startMortgagedAuctionHandler,
} from './engine/auctionHandlers.ts';
import {
  EngineHost,
  FULL_CHANCE_POOL,
  logAvatarBadge,
  pickRandom,
  randDie,
  randomId,
  randSpeedDie,
  RoomCallbacks,
  ServerRoom,
  shuffle,
} from './engine/engineUtils.ts';
import {
  castKickVote as castKickVoteHandler,
  evaluateKickVoteProgress as evaluateKickVoteProgressHandler,
  resolveKickVote as resolveKickVoteHandler,
  startKickVote as startKickVoteHandler,
} from './engine/kickVoteHandlers.ts';
import {
  extendTurnForTradeDraft as extendTurnForTradeDraftHandler,
  proposeTrade as proposeTradeHandler,
  respondTrade as respondTradeHandler,
} from './engine/tradeHandlers.ts';
export type { RoomCallbacks, ServerRoom };

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
        const humans = r.state.players.filter((p) => !p.isBot);
        list.push({
          code: r.state.code,
          hostName: host?.name ?? 'Хост',
          mode: r.state.settings.mode,
          playerCount: r.state.players.length,
          maxPlayers: r.state.settings.maxPlayers,
          status: r.state.status,
          hasPassword: Boolean(r.state.settings.password),
          censored: r.state.settings.censored,
          playerIds: humans.map((p) => p.id),
          playerNames: humans.map((p) => p.name),
          hasDisconnectedHumans: humans.some((p) => !p.isConnected),
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
    upsertPlayerProfile(host.id, host.name, host.avatar, host.color, host.diceSkin);
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
      extraTurnsLeft: 0,
      mortgagedThisTurn: false,
      builtGroupsThisTurn: [],
      tradesProposedThisTurn: 0,
      lastDice: null,
      speedTargetMode: 'NONE',
      validSpeedTargets: [],
      auction: null,
      activeTrade: null,
      activeKickVote: null,
      portal: null,
      lastJackpotResult: null,
      pendingDebt: null,
      lastCardPopup: null,
      lastTransfer: null,
      lastPoliceArrestAt: null,
      lastPoliceArrest: null,
      lastTauntAt: 0,
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
      tradeDraftExtensionsThisTurn: 0,
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

  private resolvePlayerColor(_preferredColor: string, existingPlayers: PlayerState[]): string {
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
      diceSkin: profile.diceSkin || 'liquid_glass',
      isBot,
      isConnected: true,
      team: settings.mode === 'team2v2' ? ((seatIndex % 2) as 0 | 1) : undefined,
      cash: settings.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      skipTurns: 0,
      reverseTurns: 0,
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
  ): { ok: boolean; error?: string; room?: ServerRoom; playerId?: string } {
    const cleanCode = code.trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return { ok: false, error: 'Комната не найдена' };

    const normalizedName = profile.name.trim().toLowerCase();
    // Переподключение существующего игрока: сначала по стабильному playerId, затем по нику к отключённому слоту в активном матче
    let existing = room.state.players.find((p) => p.id === profile.playerId);
    if (!existing && room.state.status === 'PLAYING' && normalizedName) {
      existing = room.state.players.find(
        (p) => !p.isBot && !p.isConnected && p.name.trim().toLowerCase() === normalizedName
      );
    }

    if (existing) {
      if (
        existing.id !== profile.playerId &&
        room.state.settings.password &&
        room.state.settings.password.trim() !== '' &&
        room.state.settings.password !== (password || '')
      ) {
        return { ok: false, error: 'Неверный пароль от комнаты' };
      }

      const wasDisconnected = !existing.isConnected;
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
      } else if (wasDisconnected) {
        const badge = logAvatarBadge(existing.avatar);
        this.addLog(
          room,
          'SYSTEM',
          `🔄 ${badge} ${existing.name} переподключился к игре!`,
          `🔄 ${badge} ${existing.name} вернулся в игру.`
        );
      }
      existing.stats = getPlayerStats(existing.id);
      this.emitState(room);
      return { ok: true, room, playerId: existing.id };
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
    upsertPlayerProfile(player.id, player.name, player.avatar, player.color, player.diceSkin);
    player.stats = getPlayerStats(player.id);
    room.state.players.push(player);
    this.recomputeTeams(room);

    const badge = logAvatarBadge(player.avatar);
    this.addLog(
      room,
      'SYSTEM',
      `${badge} ${player.name} залетел в хату!`,
      `${badge} ${player.name} подключился к комнате!`
    );
    this.emitState(room);
    return { ok: true, room, playerId: player.id };
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
    upsertPlayerProfile(player.id, player.name, player.avatar, player.color, player.diceSkin);
    this.emitState(room);
  }

  public syncPlayerProfileInLobbyRooms(
    playerId: string,
    patch: { name?: string; avatar?: string; color?: string; diceSkin?: DiceSkin }
  ) {
    for (const room of this.rooms.values()) {
      if (room.state.status === 'LOBBY') {
        if (room.state.players.some((p) => p.id === playerId)) {
          this.updateProfileInLobby(room, playerId, patch);
        }
      }
    }
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
        diceSkin: 'cyber_prism',
      },
      true,
      room.state.players.length,
      room.state.settings
    );
    upsertPlayerProfile(bot.id, bot.name, bot.avatar, bot.color, bot.diceSkin);
    bot.stats = getPlayerStats(bot.id);
    room.state.players.push(bot);
    this.recomputeTeams(room);
    const botBadge = logAvatarBadge(bot.avatar);
    this.addLog(room, 'SYSTEM', `Добавлен ${botBadge} ${bot.name}`, `Добавлен ${botBadge} ${bot.name}`);
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
    room.tradeDraftExtensionsThisTurn = 0;
    room.state.cells = BOARD_CELLS.map((c) => ({
      id: c.id,
      ownerId: null,
      branches: 0,
      isMortgaged: false,
      mortgageRoundsLeft: null,
    }));
    room.state.round = 1;
    room.state.startedAt = Date.now();
    this.setExtraTurns(room, 0);
    room.state.mortgagedThisTurn = false;
    room.state.builtGroupsThisTurn = [];
    room.state.tradesProposedThisTurn = 0;
    room.state.lastDice = null;
    room.state.speedTargetMode = 'NONE';
    room.state.validSpeedTargets = [];
    room.state.auction = null;
    room.state.activeTrade = null;
    room.state.activeKickVote = null;
    room.state.portal = null;
    room.state.lastJackpotResult = null;
    room.state.pendingDebt = null;
    room.state.lastCardPopup = null;
    room.state.lastTransfer = null;
    room.state.lastPoliceArrestAt = null;
    room.state.lastPoliceArrest = null;
    room.state.lastTauntAt = 0;
    room.state.winnerIds = [];
    room.state.winnerTeam = null;

    this.recomputeTeams(room);
    for (const p of room.state.players) {
      p.cash = room.state.settings.startingCash;
      if (!keepPositions) p.position = 0;
      p.inJail = false;
      p.jailTurns = 0;
      p.skipTurns = 0;
      p.reverseTurns = 0;
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

    const basket1GroupIds = shuffle(
      Object.keys(INDUSTRIES).filter(
        (gid) => INDUSTRIES[gid]?.raskladBasket === 1
      )
    ); // 6 отраслей по 3 поля -> по 2 полные монополии (6 полей) каждому игроку
    const basket1Ids: number[] = [];
    for (const gid of basket1GroupIds) {
      const gCells = BOARD_CELLS.filter((c) => c.groupId === gid).map((c) => c.id);
      basket1Ids.push(...gCells);
    }
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

  private setExtraTurns(room: ServerRoom, count: number) {
    const safe = Math.max(0, Math.floor(count));
    room.state.extraTurnsLeft = safe;
    room.state.hasExtraTurn = safe > 0;
  }

  private addExtraTurn(room: ServerRoom, delta = 1) {
    const cur = room.state.extraTurnsLeft ?? (room.state.hasExtraTurn ? 1 : 0);
    this.setExtraTurns(room, cur + delta);
  }

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
    room.state.speedTargetMode = 'NONE';
    room.state.validSpeedTargets = [];
    room.state.portal = null;
    room.pendingChance = null;
    room.postDebtLandingCellId = null;

    const player = room.state.players[idx];
    room.state.builtGroupsThisTurn = [];
    room.state.mortgagedThisTurn = false;
    room.state.tradesProposedThisTurn = 0;
    room.tradeDraftExtensionsThisTurn = 0;
    if (!isExtraTurn) {
      this.setExtraTurns(room, 0);
      player.doublesStreak = 0;
    } else {
      this.setExtraTurns(room, room.state.extraTurnsLeft ?? 0);
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
        `⚡ РАУНД ${room.state.round}: Разблокирован 3-й БЫСТРЫЙ КУБИК (Триплы, Маршрутка, Мем-подлянка)!`,
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
    this.recordTransfer(room, player.id, 'BANK', 500, 10);
    const buyoutMsg = pickRandom([
      {
        meme: `📋 ${player.name} оформил «белый билет» через ВЛК за ${formatMoney(500)} и списался из Учебки!`,
        clean: `📋 ${player.name} оплатил справку ${formatMoney(500)} и досрочно покинул Учебку!`,
      },
      {
        meme: `🔓 ${player.name} занёс старшине ${formatMoney(500)} на краску для бордюров и вышел за КПП Учебки!`,
        clean: `🔓 ${player.name} внёс выкуп ${formatMoney(500)} и вышел из Учебки!`,
      },
      {
        meme: `🪖 ${player.name} нашёл у себя «плоскостопие 4-й степени» за ${formatMoney(500)} и укатил из Учебки домой!`,
        clean: `🪖 ${player.name} оформил досрочный выход из Учебки за ${formatMoney(500)}!`,
      },
    ]);
    this.addLog(room, 'SYSTEM', buyoutMsg.meme, buyoutMsg.clean, player);
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
      const willMove = isDouble || player.jailTurns + 1 >= 3;
      const isReverseExit = willMove && player.reverseTurns > 0;
      room.state.lastDice = {
        die1,
        die2,
        speedDie: null,
        isDouble,
        isTriple: false,
        totalSteps: die1 + die2,
        rolledBy: player.id,
        timestamp: Date.now(),
        isReverse: isReverseExit,
      };

      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        this.setExtraTurns(room, 0);
        const escapeMsg = pickRandom([
          {
            meme: `🎲 [${die1} : ${die2}] ДУБЛЬ! ${player.name} перемахнул через забор Учебки пока старшина спал!`,
            clean: `🎲 [${die1} : ${die2}] Дубль! ${player.name} досрочно выходит из Учебки бесплатно!`,
          },
          {
            meme: `🎲 [${die1} : ${die2}] ДУБЛЬ! ${player.name} сбежал с наряда за хлебом и не вернулся в Учебку!`,
            clean: `🎲 [${die1} : ${die2}] Дубль! ${player.name} покидает полигон Учебки!`,
          },
          {
            meme: `🎲 [${die1} : ${die2}] ДУБЛЬ! ${player.name} замаскировался под куст на учениях и дал дёру из Учебки!`,
            clean: `🎲 [${die1} : ${die2}] Дубль! ${player.name} успешно завершает смену в Учебке!`,
          },
        ]);
        this.addLog(room, 'DICE', escapeMsg.meme, escapeMsg.clean, player);
        this.moveClockwiseAndResolve(room, player, die1 + die2);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= 3) {
          player.inJail = false;
          player.jailTurns = 0;
          const releaseMsg = pickRandom([
            {
              meme: `🎲 [${die1} : ${die2}] 3-й наряд позади! Дембельский взнос ${formatMoney(500)} в каптёрку — и выход из Учебки.`,
              clean: `🎲 [${die1} : ${die2}] 3-й ход в Учебке завершён — взнос ${formatMoney(500)} и выход на поле.`,
            },
            {
              meme: `🎲 [${die1} : ${die2}] Отмотал все 3 смены на полигоне! Списали ${formatMoney(500)} за казённые берцы — свободен.`,
              clean: `🎲 [${die1} : ${die2}] Срок в Учебке вышел — оплата ${formatMoney(500)} и ход.`,
            },
          ]);
          this.addLog(room, 'DICE', releaseMsg.meme, releaseMsg.clean, player);
          if (player.cash >= 500) {
            player.cash -= 500;
            this.moveClockwiseAndResolve(room, player, die1 + die2);
          } else {
            const steps = die1 + die2;
            const oldPos = player.position;
            let newPos = (oldPos + steps) % 40;
            let crossedStart = oldPos + steps >= 40;
            if (player.reverseTurns > 0) {
              player.reverseTurns = Math.max(0, player.reverseTurns - 1);
              newPos = ((oldPos - (steps % 40)) + 40) % 40;
              crossedStart = false;
            }
            player.position = newPos;
            if (crossedStart) {
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
                'Дембельский взнос из Учебки',
                'Обязательный взнос при выходе из Учебки',
                false
              );
            }
          }
        } else {
          this.setExtraTurns(room, 0);
          const stayMsg = pickRandom([
            {
              meme: `🎲 [${die1} : ${die2}] Не дубль — ${player.name} чистит ведро картошки на кухне Учебки (${player.jailTurns}/3).`,
              clean: `🎲 [${die1} : ${die2}] Не дубль — ${player.name} остаётся на подготовке в Учебке (${player.jailTurns}/3).`,
            },
            {
              meme: `🎲 [${die1} : ${die2}] Мимо дубля — ${player.name} копает окоп «от забора и до обеда» в Учебке (${player.jailTurns}/3).`,
              clean: `🎲 [${die1} : ${die2}] Не дубль — ${player.name} продолжает смену в Учебке (${player.jailTurns}/3).`,
            },
            {
              meme: `🎲 [${die1} : ${die2}] Без дубля — ${player.name} красит траву на плацу Учебки (${player.jailTurns}/3).`,
              clean: `🎲 [${die1} : ${die2}] Не дубль — ${player.name} дежурит в Учебке (${player.jailTurns}/3).`,
            },
          ]);
          this.addLog(room, 'DICE', stayMsg.meme, stayMsg.clean, player);
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

    const isReverseRoll = !isTriple && speedDie !== 'M1' && player.reverseTurns > 0;

    room.state.lastDice = {
      die1,
      die2,
      speedDie,
      isDouble,
      isTriple,
      totalSteps,
      rolledBy: player.id,
      timestamp: Date.now(),
      isReverse: isReverseRoll,
    };

    const speedLabel =
      speedDie === 'BUS'
        ? ' + 🚐 АВТОБУС'
        : speedDie === 'M1'
        ? ' + 😈 ПОДЛЯНКА'
        : speedDie !== null
        ? ` + ⚡${speedDie}`
        : '';

    // 1) ТРИПЛ (1:1:1, 2:2:2, 3:3:3) -> выбор любой клетки
    if (isTriple) {
      player.doublesStreak = 0;
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
        const arrestFrom = player.position;
        this.triggerPoliceArrest(
          room,
          player,
          'THREE_DOUBLES',
          arrestFrom,
          620,
          `[${die1}:${die2}]`
        );
        const speedTrapMsg = pickRandom([
          {
            meme: `🚐🎲 [${die1}:${die2}${speedLabel}] ТРИ ДУБЛЯ ПОДРЯД! ${player.name} гнал так быстро, что влетел прямо в блокпост ТЦК — уехал в Учебку!`,
            clean: `🚐🎲 [${die1}:${die2}${speedLabel}] Три дубля подряд! ${player.name} задержан на блокпосту и отправлен в Учебку!`,
          },
          {
            meme: `🪖🎲 [${die1}:${die2}${speedLabel}] 3 ДУБЛЯ КРЯДУ! Тонированный бусик перехватил гонщика ${player.name} — прямиком в Учебку!`,
            clean: `🪖🎲 [${die1}:${die2}${speedLabel}] Превышение скорости (3 дубля)! ${player.name} отправляется в Учебку!`,
          },
          {
            meme: `📋🎲 [${die1}:${die2}${speedLabel}] СПИДХАК (3 ДУБЛЯ)! У ${player.name} «сверили данные» на месте и выдали берцы в Учебку!`,
            clean: `📋🎲 [${die1}:${die2}${speedLabel}] Три дубля кряду — ${player.name} уезжает на полигон в Учебку!`,
          },
        ]);
        this.addLog(room, 'DICE', speedTrapMsg.meme, speedTrapMsg.clean, player);
        this.finishPostRollOrAdvance(room);
        this.emitState(room);
        return;
      }
      this.addExtraTurn(room, 1);
    } else {
      player.doublesStreak = 0;
      this.setExtraTurns(room, room.state.extraTurnsLeft ?? 0);
    }

    // 3) Бонус «АВТОБУС» на быстром кубике
    if (speedDie === 'BUS') {
      const goingBackwards = player.reverseTurns > 0;
      const distToCorner = goingBackwards
        ? player.position % 10 || 10
        : 10 - (player.position % 10);
      const maxSteps = Math.max(die1 + die2, distToCorner);
      const targets: number[] = [];
      for (let s = 1; s <= maxSteps; s++) {
        targets.push(
          goingBackwards
            ? ((player.position - s) % 40 + 40) % 40
            : (player.position + s) % 40
        );
      }
      room.state.phase = 'CHOOSE_SPEED_TARGET';
      room.state.speedTargetMode = 'BUS';
      room.state.validSpeedTargets = targets;
      this.setPhaseDeadline(room);
      this.addLog(
        room,
        'DICE',
        `🚐🎲 [${die1}:${die2} + АВТОБУС] ${player.name} выбирает остановку ${
          goingBackwards ? 'задом наперёд ⏪' : 'вперёд'
        } (до ${maxSteps} клеток)!`,
        `🚐🎲 [${die1}:${die2} + Автобус] ${player.name} выбирает клетку для остановки${
          goingBackwards ? ' (обратный ход ⏪)' : ''
        }!`,
        player
      );
      this.emitState(room);
      return;
    }

    // 4) Бонус «Мем-подлянка» на быстром кубике
    if (speedDie === 'M1') {
      const targetCellId = this.findM1Target(room, player);
      const steps = (targetCellId - player.position + 40) % 40 || 40;
      this.addLog(
        room,
        'DICE',
        `😈🎲 [${die1}:${die2} + ХАОС] Мем-подлянка швыряет ${player.name} на «${BOARD_CELLS[targetCellId].name}»!`,
        `😈🎲 [${die1}:${die2} + ХАОС] Перелёт ${player.name} на «${BOARD_CELLS[targetCellId].cleanName}»!`,
        player
      );
      this.moveClockwiseAndResolve(room, player, steps, true);
      this.emitState(room);
      return;
    }

    // 5) Стандартный ход по сумме кубиков
    const revNote = player.reverseTurns > 0 ? ' ⏪ ЗАДНИЙ ХОД' : '';
    this.addLog(
      room,
      'DICE',
      `🎲 [${die1} + ${die2}${speedLabel} = ${totalSteps}]${isDouble ? ' (ДУБЛЬ!)' : ''}${revNote} — ход ${player.name}`,
      `🎲 [${die1} + ${die2}${speedLabel} = ${totalSteps}]${isDouble ? ' (Дубль!)' : ''}${revNote} — ход ${player.name}`,
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
      const goingBackwards = player.reverseTurns > 0;
      const steps = goingBackwards
        ? (player.position - targetCellId + 40) % 40
        : (targetCellId - player.position + 40) % 40;
      if (room.state.lastDice && room.state.lastDice.rolledBy === player.id) {
        room.state.lastDice.totalSteps = steps;
        room.state.lastDice.isReverse = goingBackwards;
        room.state.lastDice.timestamp = Date.now();
      }
      this.addLog(
        room,
        'DICE',
        `🚐 ${player.name} вышел из маршрутки${goingBackwards ? ' задом наперёд ⏪' : ''} на «${BOARD_CELLS[targetCellId].name}»!`,
        `🚐 ${player.name} доехал на автобусе${goingBackwards ? ' (обратный ход ⏪)' : ''} до «${BOARD_CELLS[targetCellId].cleanName}»!`,
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
    this.recordTransfer(room, 'BANK', player.id, bonus, 0);
    this.addLog(
      room,
      'SYSTEM',
      `💸 Получка до списаний! ${player.name} лутает +${formatMoney(bonus)} ${
        landedExact && !retro ? `(+${formatMoney(2000)} за круг + ${formatMoney(1000)} бонусом на Старте!)` : 'за круг'
      }.`,
      `💸 Зарплата получена! ${player.name} получает +${formatMoney(bonus)}.`,
      player
    );
  }

  private triggerPoliceArrest(
    room: ServerRoom,
    player: PlayerState,
    reason: PoliceArrestReason,
    fromCell: number,
    walkDurationMs: number,
    diceSummary?: string,
    cardTitle?: string,
    cleanCardTitle?: string
  ) {
    const now = Date.now();
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    player.doublesStreak = 0;
    this.setExtraTurns(room, 0);
    room.state.lastPoliceArrestAt = now;

    let title = 'ПОПАЛСЯ К ТЦК НА СЕКТОРЕ #30!';
    let cleanTitle = 'ПРОВЕРКА ДОКУМЕНТОВ НА СЕКТОРЕ #30!';
    let subtitle =
      'Вы зашли за шаурмой, но рядом скрипнула боковая дверь тонированного бусика «просто сверить данные» — экспресс-доставка прямиком в Учебку без получки за Старт!';
    let cleanSubtitle =
      'Вы попали на сектор #30! Немедленная отправка на полигон в Учебку без бонуса за Старт.';

    if (reason === 'THREE_DOUBLES') {
      title = 'БЛОКПОСТ ТЦК: 3 ДУБЛЯ ПОДРЯД!';
      cleanTitle = 'ПРЕВЫШЕНИЕ СКОРОСТИ: 3 ДУБЛЯ!';
      subtitle = `Третий дубль кряду ${
        diceSummary ? `${diceSummary} ` : ''
      }завёл вас прямо в засаду с папкой повесток — срочный выезд в Учебку!`;
      cleanSubtitle = `Вы выбросили 3 дубля подряд ${
        diceSummary ? `${diceSummary} ` : ''
      }— по правилам это немедленная отправка в Учебку!`;
    } else if (reason === 'CHANCE_CARD') {
      title = 'ЭКСПРЕСС-ПОВЕСТКА В УЧЕБКУ!';
      cleanTitle = 'ПРЕДПИСАНИЕ КАРТЫ «ШАНС»!';
      subtitle = `Карта «${
        cardTitle || 'Шанс'
      }» оформила вам горящую путёвку в тонированный бусик до Учебки без заезда на Старт!`;
      cleanSubtitle = `По карте «${
        cleanCardTitle || 'Шанс'
      }» вы немедленно отправляетесь в Учебку.`;
    }

    room.state.lastPoliceArrest = {
      id: `arrest_${now}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      playerColor: player.color,
      reason,
      fromCell,
      walkDurationMs,
      diceSummary,
      title,
      cleanTitle,
      subtitle,
      cleanSubtitle,
      timestamp: now,
    };
  }

  private moveClockwiseAndResolve(
    room: ServerRoom,
    player: PlayerState,
    steps: number,
    forceClockwise = false
  ) {
    const oldPos = player.position;
    if (!forceClockwise && player.reverseTurns > 0) {
      player.reverseTurns = Math.max(0, player.reverseTurns - 1);
      const newPos = ((oldPos - (steps % 40)) + 40) % 40;
      player.position = newPos;
      // При ходе в обратном направлении через точку Старт деньги не начисляются
      this.resolveCellLanding(room, player, newPos);
      return;
    }

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
      const now = Date.now();
      const walkMs =
        room.state.lastDice &&
        room.state.lastDice.rolledBy === player.id &&
        now - room.state.lastDice.timestamp < 2000
          ? getTokenWalkDurationMs(room.state.lastDice)
          : 420;
      this.triggerPoliceArrest(room, player, 'POLICE_CELL', 30, walkMs);
      const tckLandingMsg = pickRandom([
        {
          meme: `🚐 ПОПАЛСЯ К ТЦК! У сектора #30 распахнулся тонированный бусик — ${player.name} уехал «уточнять данные» прямиком в Учебку!`,
          clean: `🚐 Проверка документов на секторе #30! ${player.name} отправляется прямиком в Учебку.`,
        },
        {
          meme: `🪖 БУСИФИКАЦИЯ! ${player.name} вышел за латте на секторе #30, а через минуту уже примеряет казённые берцы по дороге в Учебку!`,
          clean: `🪖 Патруль остановил ${player.name} на секторе #30! Экспресс-отправка в Учебку без бонуса Старта.`,
        },
        {
          meme: `📋 «Братик, буквально на 5 минут!» — ${player.name} тормознули на секторе #30 и увезли на полигон в Учебку без получки!`,
          clean: `📋 Внеплановая повестка на секторе #30: ${player.name} переезжает в Учебку!`,
        },
      ]);
      this.addLog(room, 'SYSTEM', tckLandingMsg.meme, tckLandingMsg.clean, player);
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
          `🎰 ${player.name} зашёл в «Додеп», но в кармане нет даже ${formatMoney(1000)} — выгнали взашей.`,
          `🎰 У ${player.name} недостаточно средств (${formatMoney(1000)}) для ставки в Джекпоте.`,
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
        this.recordTransfer(room, 'BANK', player.id, 1500, cellId);
        this.addLog(
          room,
          'SYSTEM',
          `🎁 Ретро-бонус! ${player.name} нашёл заначку +${formatMoney(1500)}!`,
          `🎁 Ретро-бонус! ${player.name} получает +${formatMoney(1500)}!`,
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
          this.recordTransfer(room, 'BANK', player.id, 1000, cellId);
          this.addLog(
            room,
            'CHANCE',
            `💰 Ретро-премия: ${player.name} получает +${formatMoney(1000)}!`,
            `💰 Ретро-премия: ${player.name} получает +${formatMoney(1000)}!`,
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
      case 'PAY_ALL': {
        const perPlayer = card.amount ?? 250;
        const activeOthers = room.state.players.filter((p) => p.id !== player.id && !p.isBankrupt).length;
        tone = 'bad';
        effectLabel = `Угостил всех по ${formatMoney(perPlayer)} (всего -${formatMoney(perPlayer * activeOthers)})`;
        cleanEffectLabel = `Выплата всем по ${formatMoney(perPlayer)} (-${formatMoney(perPlayer * activeOthers)})`;
        break;
      }
      case 'BRANCH_BONUS': {
        const totalBranches = room.state.cells
          .filter((c) => c.ownerId === player.id)
          .reduce((acc, c) => acc + c.branches, 0);
        const amt = Math.max(card.perBranchAmount ?? 300, totalBranches * (card.perBranchAmount ?? 300));
        tone = 'good';
        effectLabel = `Бонус за филиалы (${totalBranches} шт.): +${formatMoney(amt)}`;
        cleanEffectLabel = effectLabel;
        break;
      }
      case 'EXTRA_TURN': {
        tone = 'good';
        effectLabel = 'Турбо-буст: дополнительный ход 🎲';
        cleanEffectLabel = 'Дополнительный бросок кубиков 🎲';
        break;
      }
      case 'STEAL_LEADER': {
        const amt = card.amount ?? 700;
        tone = 'good';
        effectLabel = `Перехват сделки у лидера: +${formatMoney(amt)}`;
        cleanEffectLabel = `Бонусный контракт от лидера: +${formatMoney(amt)}`;
        break;
      }
      case 'FREE_PORTAL': {
        tone = 'move';
        effectLabel = 'Бесплатный телепорт на 6 направлений 🚄';
        cleanEffectLabel = 'Бесплатный выбор клетки для прыжка 🚄';
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
        effectLabel = 'Путёвка в Учебку 🪖';
        cleanEffectLabel = 'Отправка в Учебку 🪖';
        break;
      }
      case 'SKIP_TURN': {
        tone = 'bad';
        effectLabel = 'Пропуск следующего хода 🕯️';
        cleanEffectLabel = 'Пропуск следующего хода 🕯️';
        break;
      }
      case 'REVERSE_MOVE': {
        const turns = card.amount ?? 2;
        tone = 'special';
        effectLabel = `Задний ход на следующие ${turns} броска ⏪`;
        cleanEffectLabel = `Движение в обратную сторону (${turns} броска) ⏪`;
        break;
      }
      case 'SWAP_POSITION': {
        const candidates = room.state.players.filter(
          (p) => p.id !== player.id && !p.isBankrupt && !p.inJail
        );
        tone = 'move';
        effectLabel =
          candidates.length > 0
            ? 'Рокировка: обмен клетками со случайным кентом 🔀'
            : 'Все сидят по хатам — утешительный подгон +$600 💵';
        cleanEffectLabel =
          candidates.length > 0
            ? 'Обмен позициями на поле со случайным соперником 🔀'
            : 'Соперники недоступны для обмена: бонус +$600 💵';
        break;
      }
      case 'GOTO_CASINO': {
        tone = 'move';
        effectLabel = 'Срочный телепорт в Казино 777 (#20) 🎰';
        cleanEffectLabel = 'Мгновенное перемещение на сектор #20 «Казино 777» 🎰';
        break;
      }
      case 'ASSET_DIVIDEND': {
        const ownedActive = room.state.cells.filter(
          (c) => c.ownerId === player.id && !c.isMortgaged
        ).length;
        const perProp = card.amount ?? 250;
        const amt = Math.max(500, ownedActive * perProp);
        tone = 'good';
        effectLabel = `Дивиденды с точек (${ownedActive} шт.): +${formatMoney(amt)} 💼`;
        cleanEffectLabel = effectLabel;
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
        this.recordTransfer(room, 'BANK', player.id, amt, player.position);
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
          `🛡️ ${player.name} получил карточку «${card.title}»! Следующий штраф/аренда (до ${formatMoney(3000)}) обнулится!`,
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
        if (collected > 0) {
          this.recordTransfer(room, 'BANK', player.id, collected, player.position);
        }
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} «${card.title}» — игроки скинулись ${player.name} на +${formatMoney(collected)}!`,
          `${card.icon} «${card.cleanTitle}» — ${player.name} собрал +${formatMoney(collected)}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'PAY_ALL': {
        const perPlayer = card.amount ?? 250;
        const targets = room.state.players.filter((p) => p.id !== player.id && !p.isBankrupt);
        const totalPay = perPlayer * targets.length;
        if (totalPay > 0) {
          if (player.cash >= totalPay) {
            player.cash -= totalPay;
            for (const target of targets) {
              target.cash += perPlayer;
            }
            this.recordTransfer(room, player.id, 'BANK', totalPay, player.position);
            this.addLog(
              room,
              'CHANCE',
              `${card.icon} «${card.title}» — ${player.name} раздал всем по ${formatMoney(perPlayer)} (всего -${formatMoney(totalPay)})!`,
              `${card.icon} «${card.cleanTitle}» — ${player.name} выплатил всем -${formatMoney(totalPay)}.`,
              player
            );
            this.finishPostRollOrAdvance(room);
          } else {
            this.addLog(
              room,
              'CHANCE',
              `${card.icon} «${card.title}» — не хватает кэша на поляну (-${formatMoney(totalPay)})!`,
              `${card.icon} «${card.cleanTitle}» — нехватка средств (-${formatMoney(totalPay)})!`,
              player
            );
            this.chargePlayer(room, player, 'BANK', totalPay, card.title, card.cleanTitle, false);
          }
        } else {
          this.finishPostRollOrAdvance(room);
        }
        break;
      }
      case 'BRANCH_BONUS': {
        const totalBranches = room.state.cells
          .filter((c) => c.ownerId === player.id)
          .reduce((acc, c) => acc + c.branches, 0);
        const perBranch = card.perBranchAmount ?? 300;
        const amt = Math.max(perBranch, totalBranches * perBranch);
        player.cash += amt;
        this.recordTransfer(room, 'BANK', player.id, amt, player.position);
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» — за ${totalBranches} фил. прилетело +${formatMoney(amt)}!`,
          `${card.icon} Шанс: «${card.cleanTitle}» — премия +${formatMoney(amt)}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'EXTRA_TURN': {
        if (!player.inJail) {
          this.addExtraTurn(room, 1);
        }
        const totalExtra = room.state.extraTurnsLeft ?? (room.state.hasExtraTurn ? 1 : 0);
        const streakSuffix =
          totalExtra > 1 ? ` (всего в запасе: ${totalExtra} доп. ходов!)` : '';
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» — ${player.name} залетает на дополнительный бросок${streakSuffix}!`,
          `${card.icon} Шанс: «${card.cleanTitle}» — ${player.name} получает ещё один ход${streakSuffix}!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'STEAL_LEADER': {
        const amt = card.amount ?? 700;
        const leader = room.state.players
          .filter((p) => p.id !== player.id && !p.isBankrupt)
          .sort((a, b) => b.cash - a.cash)[0];
        if (leader && leader.cash > 0) {
          const stolen = Math.min(leader.cash, amt);
          leader.cash -= stolen;
          player.cash += stolen;
          this.recordTransfer(room, leader.id, player.id, stolen, player.position);
          this.addLog(
            room,
            'CHANCE',
            `${card.icon} ШАНС: «${card.title}» — ${player.name} подрезал +${formatMoney(stolen)} у лидера ${leader.name}!`,
            `${card.icon} Шанс: «${card.cleanTitle}» — ${player.name} получил ${formatMoney(stolen)} от ${leader.name}!`,
            player
          );
        } else {
          player.cash += 500;
          this.recordTransfer(room, 'BANK', player.id, 500, player.position);
          this.addLog(
            room,
            'CHANCE',
            `${card.icon} ШАНС: «${card.title}» — у соперников пусто, банк докинул утешительные +${formatMoney(500)}!`,
            `${card.icon} Шанс: «${card.cleanTitle}» — утешительный бонус +${formatMoney(500)}!`,
            player
          );
        }
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'FREE_PORTAL': {
        const pool = shuffle(
          BOARD_CELLS.map((c) => c.id).filter((id) => id !== player.position && id !== 30)
        );
        room.state.portal = {
          playerId: player.id,
          candidateCells: pool.slice(0, 6),
          extraDirectionsBought: 0,
        };
        room.state.phase = 'PORTAL';
        this.setPhaseDeadline(room);
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} ШАНС: «${card.title}» — ${player.name} выбирает точку для бесплатного телепорта!`,
          `${card.icon} Шанс: «${card.cleanTitle}» — ${player.name} выбирает направление телепорта!`,
          player
        );
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
        const arrestFrom = player.position;
        this.triggerPoliceArrest(
          room,
          player,
          'CHANCE_CARD',
          arrestFrom,
          260,
          undefined,
          card.title,
          card.cleanTitle
        );
        const chanceArrestMsg = pickRandom([
          {
            meme: `🚐 «${card.title}» — ${player.name} погрузили в бусик и увезли в Учебку!`,
            clean: `🚐 «${card.cleanTitle}» — ${player.name} отправляется в Учебку!`,
          },
          {
            meme: `🪖 «${card.title}» — ${player.name} получил повестку без очереди и уехал в Учебку!`,
            clean: `🪖 «${card.cleanTitle}» — ${player.name} переезжает на полигон в Учебку!`,
          },
          {
            meme: `📋 «${card.title}» — данные ${player.name} «обновились» прямо до ворот Учебки!`,
            clean: `📋 «${card.cleanTitle}» — ${player.name} направлен в Учебку!`,
          },
        ]);
        this.addLog(room, 'CHANCE', chanceArrestMsg.meme, chanceArrestMsg.clean, player);
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'SKIP_TURN': {
        player.skipTurns += 1;
        this.setExtraTurns(room, 0);
        this.addLog(
          room,
          'CHANCE',
          `${card.icon} «${card.title}» — ${player.name} пропустит следующий ход!`,
          `${card.icon} «${card.cleanTitle}» — ${player.name} пропустит следующий ход!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'REVERSE_MOVE': {
        const turns = card.amount ?? 2;
        player.reverseTurns = (player.reverseTurns || 0) + turns;
        this.addLog(
          room,
          'CHANCE',
          `⏪ «${card.title}» — ${player.name} ходит ЗАДОМ НАПЕРЁД следующие ${turns} броска!`,
          `⏪ «${card.cleanTitle}» — ${player.name} движется в обратном направлении следующие ${turns} броска!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'SWAP_POSITION': {
        const candidates = room.state.players.filter(
          (p) => p.id !== player.id && !p.isBankrupt && !p.inJail
        );
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          const myOldPos = player.position;
          const theirOldPos = target.position;
          player.position = theirOldPos;
          target.position = myOldPos;
          this.addLog(
            room,
            'CHANCE',
            `🔀 «${card.title}» — ${player.name} и ${target.name} махнулись местами на доске (#${myOldPos} ⇄ #${theirOldPos})!`,
            `🔀 «${card.cleanTitle}» — ${player.name} и ${target.name} поменялись клетками (#${myOldPos} ⇄ #${theirOldPos})!`,
            player
          );
        } else {
          player.cash += 600;
          this.recordTransfer(room, 'BANK', player.id, 600, player.position);
          this.addLog(
            room,
            'CHANCE',
            `🔀 «${card.title}» — меняться не с кем, ${player.name} нашёл в чужой куртке +${formatMoney(600)}!`,
            `🔀 «${card.cleanTitle}» — соперники недоступны, ${player.name} получает бонус +${formatMoney(600)}!`,
            player
          );
        }
        this.finishPostRollOrAdvance(room);
        break;
      }
      case 'GOTO_CASINO': {
        player.position = 20;
        this.addLog(
          room,
          'CHANCE',
          `🎰 «${card.title}» — ${player.name} врывается прямо в сектор #20 «Казино 777»!`,
          `🎰 «${card.cleanTitle}» — ${player.name} перемещается на сектор #20 «Казино 777»!`,
          player
        );
        this.resolveCellLanding(room, player, 20);
        break;
      }
      case 'ASSET_DIVIDEND': {
        const ownedActive = room.state.cells.filter(
          (c) => c.ownerId === player.id && !c.isMortgaged
        ).length;
        const perProp = card.amount ?? 250;
        const amt = Math.max(500, ownedActive * perProp);
        player.cash += amt;
        this.recordTransfer(room, 'BANK', player.id, amt, player.position);
        this.addLog(
          room,
          'CHANCE',
          `💼 «${card.title}» — ${player.name} собирает +${formatMoney(amt)} дивидендов со своих ${ownedActive} точек!`,
          `💼 «${card.cleanTitle}» — ${player.name} получает +${formatMoney(amt)} дивидендов (${ownedActive} активов)!`,
          player
        );
        this.finishPostRollOrAdvance(room);
        break;
      }
    }

    this.emitState(room);
  }

  private recordTransfer(
    room: ServerRoom,
    fromId: string | 'BANK',
    toId: string | 'BANK',
    amount: number,
    cellId: number
  ) {
    if (amount <= 0) return;
    room.state.lastTransfer = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fromId,
      toId,
      amount,
      cellId,
      timestamp: Date.now(),
    };
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
    this.recordTransfer(room, debtor.id, creditorId, amount, debtor.position);
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

  private get host(): EngineHost {
    return {
      emitState: (r) => this.emitState(r),
      addLog: (r, type, text, cleanText, player) => this.addLog(r, type, text, cleanText, player),
      bumpStat: (p, stat, delta) => this.bumpStat(p, stat, delta),
      checkAndCreditMonopolies: (r, p) => this.checkAndCreditMonopolies(r, p),
      setPhaseDeadline: (r, s) => this.setPhaseDeadline(r, s),
      finishPostRollOrAdvance: (r) => this.finishPostRollOrAdvance(r),
      chargePlayer: (r, d, cred, amt, reason, cleanReason, canShield, tax) =>
        this.chargePlayer(r, d, cred, amt, reason, cleanReason, canShield, tax),
      executeBankruptcy: (r, loser, cred, reason, cleanReason) =>
        this.executeBankruptcy(r, loser, cred, reason, cleanReason),
      checkVictory: (r) => this.checkVictory(r),
    };
  }

  public buyProperty(room: ServerRoom, playerId: string) { buyPropertyHandler(this.host, room, playerId); }
  public declineProperty(room: ServerRoom, playerId: string) { declinePropertyHandler(this.host, room, playerId); }
  public startMortgagedAuction(room: ServerRoom, playerId: string, cellId: number) { startMortgagedAuctionHandler(this.host, room, playerId, cellId); }
  public placeAuctionBid(room: ServerRoom, playerId: string, stepAmount: number = 100) { placeAuctionBidHandler(this.host, room, playerId, stepAmount); }
  public passAuction(room: ServerRoom, playerId: string) { passAuctionHandler(this.host, room, playerId); }
  public finalizeAuction(room: ServerRoom) { finalizeAuctionHandler(this.host, room); }
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
    const check = canUnmortgageCell(room.state, playerId, cellId);
    if (!check.ok) return;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    const player = room.state.players.find((p) => p.id === playerId);
    if (!def || !cell || !player) return;

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
      `🌀 Ебаный квантовый телепорт выплюнул ${player.name} прямо на «${BOARD_CELLS[chosenCell].name}»!`,
      `🌀 Квантовый телепорт перенёс ${player.name} на «${BOARD_CELLS[chosenCell].cleanName}»!`,
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
      // Русская рулетка: 1..5 выживаешь и лутаешь +$1 500, на 6 — осечка (-$2 000 и пропуск хода)
      const survived = rolled !== 6;
      if (survived) {
        player.cash += 1500;
        this.recordTransfer(room, 'BANK', player.id, 1500, 20);
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
          `🔫 РУССКАЯ РУЛЕТКА [${rolled}/6]: Щелчок пустой! ${player.name} выжил и поднял +${formatMoney(1500)}!`,
          `🔫 Рулетка [${rolled}/6]: Удача! ${player.name} выигрывает +${formatMoney(1500)}!`,
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
          `💥 РУССКАЯ РУЛЕТКА [6/6]: БАБАХ! ${player.name} словил осечку на -${formatMoney(2000)} и пропуск хода!`,
          `💥 Рулетка [6/6]: Проигрыш -${formatMoney(2000)} и пропуск хода для ${player.name}!`,
          player
        );
        this.chargePlayer(room, player, 'BANK', 2000, 'Русская рулетка в Додепе', 'Штраф рулетки', false);
      }
      this.emitState(room);
      return;
    }

    // Ставка $1 000 на 1, 2 или 3 грани кубика
    const faces = Array.from(
      new Set((payload.faces || [6]).filter((f) => f >= 1 && f <= 6))
    ).slice(0, 3);
    if (faces.length === 0 || player.cash < 1000) return;

    player.cash -= 1000;
    const won = faces.includes(rolled);
    const grossWin = faces.length === 1 ? 6000 : faces.length === 2 ? 3000 : 2000;

    if (won) {
      player.cash += grossWin;
      this.recordTransfer(room, 'BANK', player.id, grossWin - 1000, 20);
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
      this.recordTransfer(room, player.id, 'BANK', 1000, 20);
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
        `🎰 СЛИВ В ДОДЕПЕ! Выпало [${rolled}] мимо [${faces.join(',')}] — ${player.name} подарил казику ${formatMoney(1000)}!`,
        `🎰 Мимо! Выпало [${rolled}] — ${player.name} потерял ставку ${formatMoney(1000)}.`,
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
    const term = 10;

    player.cash += principal;
    player.credit = {
      principal,
      paybackAmount,
      dueRound: room.state.round + term,
      takenAtRound: room.state.round,
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

  public extendTurnForTradeDraft(room: ServerRoom, playerId: string) { extendTurnForTradeDraftHandler(this.host, room, playerId); }
  public proposeTrade(room: ServerRoom, fromPlayerId: string, toPlayerId: string, offer: TradeSide, request: TradeSide): { ok: boolean; error?: string } {
    return proposeTradeHandler(this.host, room, fromPlayerId, toPlayerId, offer, request);
  }
  public respondTrade(room: ServerRoom, playerId: string, accept: boolean) { respondTradeHandler(this.host, room, playerId, accept); }
  public startKickVote(room: ServerRoom, initiatorId: string, targetId: string): { ok: boolean; error?: string } {
    return startKickVoteHandler(this.host, room, initiatorId, targetId);
  }
  public castKickVote(room: ServerRoom, voterId: string, approve: boolean): { ok: boolean; error?: string } {
    return castKickVoteHandler(this.host, room, voterId, approve);
  }
  private evaluateKickVoteProgress(room: ServerRoom) { evaluateKickVoteProgressHandler(this.host, room); }
  private resolveKickVote(room: ServerRoom, passed: boolean, details: string) { resolveKickVoteHandler(this.host, room, passed, details); }
  // ================== ЗАВЕРШЕНИЕ ХОДА, БАНКРОТСТВО, ПОБЕДА ==================

  private finishPostRollOrAdvance(room: ServerRoom) {
    if (room.state.status !== 'PLAYING') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    const queuedExtraTurns =
      room.state.extraTurnsLeft ?? (room.state.hasExtraTurn ? 1 : 0);
    if (player && queuedExtraTurns > 0 && !player.inJail && !player.isBankrupt) {
      const remainingAfter = queuedExtraTurns - 1;
      this.setExtraTurns(room, remainingAfter);
      this.addLog(
        room,
        'DICE',
        `🎲 Доп. ход! ${player.name} получает ещё один бросок${
          remainingAfter > 0 ? ` (в запасе ещё +${remainingAfter})` : ''
        }.`,
        `🎲 Доп. ход! ${player.name} бросает ещё раз${
          remainingAfter > 0 ? ` (в запасе ещё +${remainingAfter})` : ''
        }.`,
        player
      );
      this.beginTurn(room, room.state.currentPlayerIndex, true);
    } else {
      this.setExtraTurns(room, 0);
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
    loser.reverseTurns = 0;
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
          if (c.isMortgaged) {
            c.mortgageRoundsLeft =
              room.state.settings.mortgageLimitRounds > 0 && !room.state.settings.retroRules
                ? room.state.settings.mortgageLimitRounds
                : null;
          }
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
    if (room.state.activeKickVote) {
      if (room.state.activeKickVote.targetId === loser.id) {
        room.state.activeKickVote = null;
      } else {
        room.state.activeKickVote.eligibleVoterIds = room.state.activeKickVote.eligibleVoterIds.filter(
          (id) => id !== loser.id
        );
        delete room.state.activeKickVote.votes[loser.id];
      }
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

    const loserBadge = logAvatarBadge(loser.avatar);
    this.addLog(
      room,
      'BANKRUPT',
      `💀 ПОТРАЧЕНО! ${loserBadge} ${loser.name} обанкротился (${reason})! Активы перешли: ${
        creditor ? creditor.name : 'Банку'
      }.`,
      `💀 Банкротство! ${loserBadge} ${loser.name} выбывает из игры (${cleanReason}).`,
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
      .map((p) => `${logAvatarBadge(p.avatar)} ${p.name}`)
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
    if (room.state.status !== 'PLAYING') return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.isBankrupt) return;
    const now = Date.now();
    // Одновременно звук может применить только 1 человек в комнате, затем общий кулдаун 10 сек
    if (now - (room.state.lastTauntAt ?? 0) < TAUNT_COOLDOWN_MS) return;

    const taunt = TAUNTS.find((t) => t.id === tauntId);
    if (!taunt) return;
    room.state.lastTauntAt = now;
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

      // Истечение таймера голосования за кик
      if (room.state.activeKickVote && now >= room.state.activeKickVote.expiresAt) {
        this.resolveKickVote(room, false, 'время вышло');
        continue;
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

      // Таймер хода активного игрока (не истекает, пока висит открытое предложение сделки)
      if (
        !room.state.activeTrade &&
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
