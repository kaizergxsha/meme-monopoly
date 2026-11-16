import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { GameManager, ServerRoom } from './gameEngine.ts';
import { tickBots } from './botAi.ts';
import {
  getLeaderboard,
  getPlayerProfile,
  getPlayerStats,
  getRecentMatches,
  getSessionAccount,
  initDb,
  loginUser,
  logoutSession,
  registerUser,
  upsertPlayerProfile,
} from './db.ts';
import { DiceSkin, GameMode, RoomSettings, TradeSide } from '../shared/types.ts';
import { TOKEN_COLORS } from '../shared/memeContent.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '2mb' }));

function extractBearerToken(req: express.Request): string {
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

const httpServer = http.createServer(app);
httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout = 66_000;
httpServer.on('connection', (sock) => {
  sock.setNoDelay(true);
  sock.setKeepAlive(true, 15_000);
});

const io = new Server(httpServer, {
  pingInterval: 15_000,
  pingTimeout: 30_000,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let lastPublicRoomsJson = '';
let manager!: GameManager;

function emitPublicRoomsIfChanged() {
  const list = manager.getPublicRooms();
  const nextJson = JSON.stringify(list);
  if (nextJson !== lastPublicRoomsJson) {
    lastPublicRoomsJson = nextJson;
    io.emit('rooms:list', list);
  }
}

manager = new GameManager({
  onStateChange: (roomCode, state) => {
    io.to(roomCode).emit('room:state', state);
    emitPublicRoomsIfChanged();
  },
  onTaunt: (roomCode, event) => {
    io.to(roomCode).emit('room:taunt', event);
  },
  onBankruptcyAnim: (roomCode, event) => {
    io.to(roomCode).emit('room:bankruptcy_anim', event);
  },
});

// Маппинг socket.id -> { roomCode, playerId }
const socketSessions = new Map<string, { roomCode: string; playerId: string }>();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/api/rooms', (_req, res) => {
  res.json(manager.getPublicRooms());
});

app.get('/api/leaderboard', (_req, res) => {
  res.json(getLeaderboard(12));
});

app.get('/api/stats/:playerId', (req, res) => {
  res.json(getPlayerStats(req.params.playerId));
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, nickname, avatar, color, diceSkin, guestPlayerId } = req.body || {};
  const result = registerUser({
    email: String(email || ''),
    password: String(password || ''),
    nickname: typeof nickname === 'string' ? nickname : undefined,
    avatar: typeof avatar === 'string' ? avatar : undefined,
    color: typeof color === 'string' ? color : undefined,
    diceSkin: typeof diceSkin === 'string' ? (diceSkin as DiceSkin) : undefined,
    guestPlayerId: typeof guestPlayerId === 'string' ? guestPlayerId : undefined,
  });
  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true, token: result.token, account: result.account });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const result = loginUser({
    email: String(email || ''),
    password: String(password || ''),
  });
  if (!result.ok) {
    res.status(401).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true, token: result.token, account: result.account });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) logoutSession(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = extractBearerToken(req);
  const account = token ? getSessionAccount(token) : null;
  if (!account) {
    res.status(401).json({ ok: false, error: 'Не авторизован' });
    return;
  }
  res.json({ ok: true, account });
});

app.put('/api/profile', (req, res) => {
  const token = extractBearerToken(req);
  const account = token ? getSessionAccount(token) : null;
  const body = req.body || {};

  const targetPlayerId = account
    ? account.playerId
    : typeof body.playerId === 'string'
    ? body.playerId.trim()
    : '';

  if (!targetPlayerId || targetPlayerId.startsWith('bot_')) {
    res.status(400).json({ ok: false, error: 'Некорректный ID игрока' });
    return;
  }

  const existing = getPlayerProfile(targetPlayerId);
  if (!account && existing.isRegistered) {
    res.status(401).json({ ok: false, error: 'Для изменения зарегистрированного профиля войдите в аккаунт' });
    return;
  }

  const rawName = typeof body.nickname === 'string' ? body.nickname : typeof body.name === 'string' ? body.name : undefined;
  const nextNick = rawName !== undefined ? rawName.trim().slice(0, 24) || existing.nickname : existing.nickname;
  const nextAvatar =
    typeof body.avatar === 'string' && body.avatar.trim() ? body.avatar.trim() : existing.avatar;
  const nextColor =
    typeof body.color === 'string' && TOKEN_COLORS.some((c) => c.hex === body.color)
      ? body.color
      : existing.color;
  const validDiceSkins: DiceSkin[] = ['classic', 'neon', 'gopnik', 'gold', 'comic'];
  const nextDiceSkin =
    typeof body.diceSkin === 'string' && validDiceSkins.includes(body.diceSkin as DiceSkin)
      ? (body.diceSkin as DiceSkin)
      : existing.diceSkin;

  upsertPlayerProfile(targetPlayerId, nextNick, nextAvatar, nextColor, nextDiceSkin);
  manager.syncPlayerProfileInLobbyRooms(targetPlayerId, {
    name: nextNick,
    avatar: nextAvatar,
    color: nextColor,
    diceSkin: nextDiceSkin,
  });

  res.json({ ok: true, profile: getPlayerProfile(targetPlayerId) });
});

app.get('/api/profile/:playerId', (req, res) => {
  const playerId = String(req.params.playerId || '').trim();
  res.json({
    profile: getPlayerProfile(playerId),
    leaderboard: getLeaderboard(10),
    recentMatches: getRecentMatches(8),
  });
});

io.on('connection', (socket) => {
  socket.emit('rooms:list', manager.getPublicRooms());

  const getCtx = (): { room: ServerRoom; playerId: string } | null => {
    const sess = socketSessions.get(socket.id);
    if (!sess) return null;
    const room = manager.rooms.get(sess.roomCode);
    if (!room) {
      socketSessions.delete(socket.id);
      return null;
    }
    return { room, playerId: sess.playerId };
  };

  const cleanupStalePlayerSessions = (playerId: string, keepSocketId: string) => {
    for (const [sockId, sess] of socketSessions.entries()) {
      if (sess.playerId === playerId && sockId !== keepSocketId) {
        socketSessions.delete(sockId);
      }
    }
  };

  socket.on(
    'room:create',
    (
      payload: {
        playerId: string;
        name: string;
        avatar: string;
        color: string;
        diceSkin: DiceSkin;
        mode?: GameMode;
      },
      ack?: (res: { ok: boolean; code?: string; error?: string }) => void
    ) => {
      const prev = socketSessions.get(socket.id);
      if (prev) socket.leave(prev.roomCode);

      const room = manager.createRoom(
        {
          playerId: payload.playerId,
          socketId: socket.id,
          name: payload.name,
          avatar: payload.avatar,
          color: payload.color,
          diceSkin: payload.diceSkin,
        },
        payload.mode || 'classic'
      );

      cleanupStalePlayerSessions(payload.playerId, socket.id);
      socketSessions.set(socket.id, {
        roomCode: room.state.code,
        playerId: payload.playerId,
      });
      socket.join(room.state.code);
      socket.emit('room:state', room.state);
      emitPublicRoomsIfChanged();
      ack?.({ ok: true, code: room.state.code });
    }
  );

  socket.on(
    'room:join',
    (
      payload: {
        code: string;
        password?: string;
        playerId: string;
        name: string;
        avatar: string;
        color: string;
        diceSkin: DiceSkin;
      },
      ack?: (res: { ok: boolean; code?: string; playerId?: string; error?: string }) => void
    ) => {
      const res = manager.joinRoom(
        payload.code,
        {
          playerId: payload.playerId,
          socketId: socket.id,
          name: payload.name,
          avatar: payload.avatar,
          color: payload.color,
          diceSkin: payload.diceSkin,
        },
        payload.password
      );
      if (!res.ok || !res.room) {
        ack?.({ ok: false, error: res.error || 'Ошибка входа' });
        return;
      }

      const resolvedPlayerId = res.playerId || payload.playerId;
      const prev = socketSessions.get(socket.id);
      if (prev && prev.roomCode !== res.room.state.code) {
        socket.leave(prev.roomCode);
      }

      cleanupStalePlayerSessions(resolvedPlayerId, socket.id);
      socketSessions.set(socket.id, {
        roomCode: res.room.state.code,
        playerId: resolvedPlayerId,
      });
      socket.join(res.room.state.code);
      socket.emit('room:state', res.room.state);
      emitPublicRoomsIfChanged();
      ack?.({ ok: true, code: res.room.state.code, playerId: resolvedPlayerId });
    }
  );

  socket.on('room:leave', () => {
    const sess = socketSessions.get(socket.id);
    if (!sess) return;
    socket.leave(sess.roomCode);
    socketSessions.delete(socket.id);
    const room = manager.rooms.get(sess.roomCode);
    if (room) {
      if (room.state.status === 'LOBBY') {
        room.state.players = room.state.players.filter((p) => p.id !== sess.playerId);
        if (room.state.players.filter((p) => !p.isBot).length === 0) {
          manager.rooms.delete(sess.roomCode);
        } else {
          if (room.state.hostId === sess.playerId) {
            const nextHuman = room.state.players.find((p) => !p.isBot);
            if (nextHuman) room.state.hostId = nextHuman.id;
          }
          io.to(sess.roomCode).emit('room:state', room.state);
        }
      } else {
        const pl = room.state.players.find((p) => p.id === sess.playerId);
        if (pl) pl.isConnected = false;
        io.to(sess.roomCode).emit('room:state', room.state);
      }
      emitPublicRoomsIfChanged();
    }
  });

  socket.on('lobby:update_settings', (patch: Partial<RoomSettings>) => {
    const ctx = getCtx();
    if (ctx) manager.updateSettings(ctx.room, ctx.playerId, patch);
  });

  socket.on(
    'lobby:update_profile',
    (patch: { name?: string; avatar?: string; color?: string; diceSkin?: DiceSkin }) => {
      const ctx = getCtx();
      if (ctx) manager.updateProfileInLobby(ctx.room, ctx.playerId, patch);
    }
  );

  socket.on('lobby:add_bot', () => {
    const ctx = getCtx();
    if (ctx) manager.addBot(ctx.room, ctx.playerId);
  });

  socket.on('lobby:remove_player', (targetId: string) => {
    const ctx = getCtx();
    if (!ctx) return;
    const targetPlayer = ctx.room.state.players.find((p) => p.id === targetId);
    manager.removePlayer(ctx.room, ctx.playerId, targetId);
    if (targetPlayer?.socketId && !ctx.room.state.players.some((p) => p.id === targetId)) {
      socketSessions.delete(targetPlayer.socketId);
    }
  });

  socket.on('lobby:swap_seat', (targetIndex: number) => {
    const ctx = getCtx();
    if (ctx) manager.swapSeat(ctx.room, ctx.playerId, targetIndex);
  });

  socket.on('lobby:start', (ack?: (res: { ok: boolean; error?: string }) => void) => {
    const ctx = getCtx();
    if (!ctx) return;
    const res = manager.startGame(ctx.room, ctx.playerId);
    ack?.(res);
  });

  socket.on('game:rematch', () => {
    const ctx = getCtx();
    if (ctx) manager.rematch(ctx.room, ctx.playerId);
  });

  socket.on('game:roll', () => {
    const ctx = getCtx();
    if (ctx) manager.rollDice(ctx.room, ctx.playerId);
  });

  socket.on('game:pay_jail', () => {
    const ctx = getCtx();
    if (ctx) manager.payJailFine(ctx.room, ctx.playerId);
  });

  socket.on('game:choose_speed_target', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.chooseSpeedTarget(ctx.room, ctx.playerId, cellId);
  });

  socket.on('game:buy', () => {
    const ctx = getCtx();
    if (ctx) manager.buyProperty(ctx.room, ctx.playerId);
  });

  socket.on('game:decline_buy', () => {
    const ctx = getCtx();
    if (ctx) manager.declineProperty(ctx.room, ctx.playerId);
  });

  socket.on('game:auction_bid', (step: number) => {
    const ctx = getCtx();
    if (ctx) manager.placeAuctionBid(ctx.room, ctx.playerId, step);
  });

  socket.on('game:auction_pass', () => {
    const ctx = getCtx();
    if (ctx) manager.passAuction(ctx.room, ctx.playerId);
  });

  socket.on('game:auction_mortgaged', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.startMortgagedAuction(ctx.room, ctx.playerId, cellId);
  });

  socket.on('game:build_branch', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.buildBranch(ctx.room, ctx.playerId, cellId);
  });

  socket.on('game:sell_branch', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.sellBranch(ctx.room, ctx.playerId, cellId);
  });

  socket.on('game:mortgage', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.mortgageProperty(ctx.room, ctx.playerId, cellId);
  });

  socket.on('game:unmortgage', (cellId: number) => {
    const ctx = getCtx();
    if (ctx) manager.unmortgageProperty(ctx.room, ctx.playerId, cellId);
  });

  const handleAckChance = () => {
    const ctx = getCtx();
    if (ctx) manager.acknowledgeChance(ctx.room, ctx.playerId);
  };
  socket.on('game:ack-chance', handleAckChance);
  socket.on('game:ack_chance', handleAckChance);

  socket.on('game:portal_add', () => {
    const ctx = getCtx();
    if (ctx) manager.buyPortalDirection(ctx.room, ctx.playerId);
  });

  socket.on('game:portal_jump', (targetCellId?: number) => {
    const ctx = getCtx();
    if (ctx) manager.activatePortal(ctx.room, ctx.playerId, targetCellId);
  });

  socket.on(
    'game:jackpot',
    (payload: { skip?: boolean; mode?: 'DICE' | 'ROULETTE'; faces?: number[] }) => {
      const ctx = getCtx();
      if (ctx) manager.playJackpot(ctx.room, ctx.playerId, payload);
    }
  );

  socket.on('game:take_credit', (ack?: (res: { ok: boolean; error?: string }) => void) => {
    const ctx = getCtx();
    if (!ctx) return;
    ack?.(manager.takeCredit(ctx.room, ctx.playerId));
  });

  socket.on('game:repay_credit', (ack?: (res: { ok: boolean; error?: string }) => void) => {
    const ctx = getCtx();
    if (!ctx) return;
    ack?.(manager.repayCredit(ctx.room, ctx.playerId));
  });

  socket.on('game:duel_restart', (ack?: (res: { ok: boolean; error?: string }) => void) => {
    const ctx = getCtx();
    if (!ctx) return;
    ack?.(manager.useDuelRestart(ctx.room, ctx.playerId));
  });

  socket.on(
    'game:propose_trade',
    (
      payload: { toPlayerId: string; offer: TradeSide; request: TradeSide },
      ack?: (res: { ok: boolean; error?: string }) => void
    ) => {
      const ctx = getCtx();
      if (!ctx) return;
      ack?.(
        manager.proposeTrade(
          ctx.room,
          ctx.playerId,
          payload.toPlayerId,
          payload.offer,
          payload.request
        )
      );
    }
  );

  socket.on('game:trade_draft_open', () => {
    const ctx = getCtx();
    if (ctx) manager.extendTurnForTradeDraft(ctx.room, ctx.playerId);
  });

  socket.on('game:respond_trade', (accept: boolean) => {
    const ctx = getCtx();
    if (ctx) manager.respondTrade(ctx.room, ctx.playerId, accept);
  });

  socket.on(
    'game:start_kick_vote',
    (targetId: string, cb?: (res: { ok: boolean; error?: string }) => void) => {
      const ctx = getCtx();
      if (!ctx) return cb?.({ ok: false, error: 'Комната не найдена' });
      cb?.(manager.startKickVote(ctx.room, ctx.playerId, targetId));
    }
  );

  socket.on(
    'game:cast_kick_vote',
    (approve: boolean, cb?: (res: { ok: boolean; error?: string }) => void) => {
      const ctx = getCtx();
      if (!ctx) return cb?.({ ok: false, error: 'Комната не найдена' });
      cb?.(manager.castKickVote(ctx.room, ctx.playerId, approve));
    }
  );

  socket.on('game:pay_debt', () => {
    const ctx = getCtx();
    if (ctx) manager.payPendingDebt(ctx.room, ctx.playerId);
  });

  socket.on('game:end_turn', () => {
    const ctx = getCtx();
    if (ctx) manager.endTurn(ctx.room, ctx.playerId);
  });

  socket.on('game:surrender', () => {
    const ctx = getCtx();
    if (ctx) manager.surrenderOrBankrupt(ctx.room, ctx.playerId);
  });

  socket.on('game:chat', (msg: string) => {
    const ctx = getCtx();
    if (ctx) manager.sendChat(ctx.room, ctx.playerId, msg);
  });

  socket.on('game:react_log', (payload: { logId: string; emoji: string }) => {
    const ctx = getCtx();
    if (ctx && payload?.logId && payload?.emoji) {
      manager.reactToLog(ctx.room, ctx.playerId, payload.logId, payload.emoji);
    }
  });

  socket.on('game:taunt', (tauntId: string) => {
    const ctx = getCtx();
    if (ctx) manager.sendTaunt(ctx.room, ctx.playerId, tauntId);
  });

  socket.on('disconnect', () => {
    const sess = socketSessions.get(socket.id);
    socketSessions.delete(socket.id);
    if (!sess) return;
    const room = manager.rooms.get(sess.roomCode);
    if (!room) return;
    const pl = room.state.players.find((p) => p.id === sess.playerId);
    if (pl && pl.socketId === socket.id) {
      pl.isConnected = false;
      io.to(sess.roomCode).emit('room:state', room.state);
      emitPublicRoomsIfChanged();
    }
  });
});

// Единый серверный цикл: таймеры комнат + ходы ИИ-ботов + очистка мёртвых сессий
setInterval(() => {
  manager.tickTimers(Date.now());
  for (const [sockId, sess] of socketSessions.entries()) {
    if (!io.sockets.sockets.has(sockId) || !manager.rooms.has(sess.roomCode)) {
      socketSessions.delete(sockId);
    }
  }
  tickBots(manager);
}, 750);

// Раздача собранного React-клиента из dist/
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

await initDb();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎲 Мемная Монополия запущена: http://localhost:${PORT}`);
});
