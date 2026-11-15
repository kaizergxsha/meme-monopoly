import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  BankruptcyAnimationEvent,
  DiceSkin,
  GameMode,
  PublicRoomSummary,
  RoomSettings,
  RoomState,
  TauntEvent,
  TradeSide,
} from '../../shared/types.ts';
import { MEME_AVATARS, TAUNTS, TOKEN_COLORS } from '../../shared/memeContent.ts';
import { soundEngine } from '../utils/soundEngine.ts';

function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem('mm_player_id');
  if (existing) return existing;
  const created = `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  localStorage.setItem('mm_player_id', created);
  return created;
}

export interface LocalProfile {
  playerId: string;
  name: string;
  avatar: string;
  color: string;
  diceSkin: DiceSkin;
}

let activeSocketInstance: Socket | null = null;

export function emitAckChance() {
  activeSocketInstance?.emit('game:ack-chance');
}

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const lastDiceServerTsRef = useRef<number>(0);
  const lastDiceLocalTsRef = useRef<number>(0);
  const lastCardServerTsRef = useRef<number>(0);
  const lastCardLocalTsRef = useRef<number>(0);
  const tauntTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const censoredRef = useRef<boolean>(false);
  const clientCensorRef = useRef<boolean>(localStorage.getItem('mm_censor') === '1');

  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<LocalProfile>(() => {
    const savedColor = localStorage.getItem('mm_color');
    const validColor =
      savedColor && TOKEN_COLORS.some((c) => c.hex === savedColor)
        ? savedColor
        : TOKEN_COLORS[0].hex;
    return {
      playerId: getOrCreatePlayerId(),
      name: localStorage.getItem('mm_name') || `Кент_${Math.floor(Math.random() * 900 + 100)}`,
      avatar: localStorage.getItem('mm_avatar') || MEME_AVATARS[0].emoji,
      color: validColor,
      diceSkin: (localStorage.getItem('mm_dice_skin') as DiceSkin) || 'classic',
    };
  });

  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [activeTaunts, setActiveTaunts] = useState<Record<string, TauntEvent>>({});
  const [bankruptcyAnim, setBankruptcyAnim] = useState<BankruptcyAnimationEvent | null>(null);
  const [clientCensorOverride, setClientCensorOverride] = useState<boolean>(
    () => localStorage.getItem('mm_censor') === '1'
  );

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    activeSocketInstance = socket;

    socket.on('connect', () => {
      setConnected(true);
      const params = new URLSearchParams(window.location.search);
      const inviteCode = params.get('room');
      if (inviteCode) {
        socket.emit(
          'room:join',
          {
            code: inviteCode,
            playerId: profile.playerId,
            name: profile.name,
            avatar: profile.avatar,
            color: profile.color,
            diceSkin: profile.diceSkin,
          },
          (res: { ok: boolean; error?: string }) => {
            if (!res.ok && res.error) {
              showError(res.error);
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('rooms:list', (list: PublicRoomSummary[]) => {
      setPublicRooms(list);
    });

    socket.on('room:state', (rawState: RoomState) => {
      const localNow = Date.now();
      const clockOffset = rawState.serverNow ? localNow - rawState.serverNow : 0;

      let normalizedLastDice = rawState.lastDice;
      if (rawState.lastDice) {
        if (rawState.lastDice.timestamp !== lastDiceServerTsRef.current) {
          lastDiceServerTsRef.current = rawState.lastDice.timestamp;
          lastDiceLocalTsRef.current = localNow;
          soundEngine.playDice();
        }
        normalizedLastDice = {
          ...rawState.lastDice,
          timestamp: lastDiceLocalTsRef.current,
        };
      }

      let normalizedLastCard = rawState.lastCardPopup;
      if (rawState.lastCardPopup) {
        if (rawState.lastCardPopup.timestamp !== lastCardServerTsRef.current) {
          lastCardServerTsRef.current = rawState.lastCardPopup.timestamp;
          const serverAgeMs = rawState.serverNow
            ? rawState.serverNow - rawState.lastCardPopup.timestamp
            : 0;
          lastCardLocalTsRef.current =
            serverAgeMs > 10000 && rawState.phase !== 'CHANCE'
              ? rawState.lastCardPopup.timestamp + clockOffset
              : localNow;
        }
        normalizedLastCard = {
          ...rawState.lastCardPopup,
          timestamp: lastCardLocalTsRef.current,
        };
      }

      censoredRef.current = Boolean(rawState.settings.censored || clientCensorRef.current);

      const nextState: RoomState = {
        ...rawState,
        startedAt: rawState.startedAt ? rawState.startedAt + clockOffset : null,
        turnStartedAt: rawState.turnStartedAt ? rawState.turnStartedAt + clockOffset : null,
        turnDeadlineAt: rawState.turnDeadlineAt ? rawState.turnDeadlineAt + clockOffset : null,
        lastDice: normalizedLastDice,
        lastCardPopup: normalizedLastCard,
        auction: rawState.auction
          ? { ...rawState.auction, endsAt: rawState.auction.endsAt + clockOffset }
          : null,
        activeTrade: rawState.activeTrade
          ? { ...rawState.activeTrade, expiresAt: rawState.activeTrade.expiresAt + clockOffset }
          : null,
        players: rawState.players.map((p) => ({
          ...p,
          lastTauntAt: p.lastTauntAt ? p.lastTauntAt + clockOffset : 0,
        })),
      };

      setRoomState(nextState);
      // Обновляем URL для удобного шеринга ссылки с друзьями
      const url = new URL(window.location.href);
      if (url.searchParams.get('room') !== nextState.code) {
        url.searchParams.set('room', nextState.code);
        window.history.replaceState({}, '', url.toString());
      }
    });

    socket.on('room:taunt', (ev: TauntEvent) => {
      const def = TAUNTS.find((t) => t.id === ev.tauntId);
      if (def) soundEngine.playTaunt(def.sound, censoredRef.current);
      setActiveTaunts((prev) => ({ ...prev, [ev.playerId]: ev }));

      const prevTimer = tauntTimersRef.current[ev.playerId];
      if (prevTimer) {
        clearTimeout(prevTimer);
        delete tauntTimersRef.current[ev.playerId];
      }

      tauntTimersRef.current[ev.playerId] = setTimeout(() => {
        delete tauntTimersRef.current[ev.playerId];
        setActiveTaunts((prev) => {
          if (prev[ev.playerId]?.id !== ev.id) return prev;
          const copy = { ...prev };
          delete copy[ev.playerId];
          return copy;
        });
      }, 4200);
    });

    socket.on('room:bankruptcy_anim', (ev: BankruptcyAnimationEvent) => {
      soundEngine.playBankruptcy(ev.style);
      setBankruptcyAnim(ev);
      setTimeout(() => {
        setBankruptcyAnim((cur) => (cur?.timestamp === ev.timestamp ? null : cur));
      }, 5200);
    });

    return () => {
      Object.values(tauntTimersRef.current).forEach(clearTimeout);
      tauntTimersRef.current = {};
      if (activeSocketInstance === socket) {
        activeSocketInstance = null;
      }
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLocalProfile = (patch: Partial<LocalProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('mm_name', next.name);
      localStorage.setItem('mm_avatar', next.avatar);
      localStorage.setItem('mm_color', next.color);
      localStorage.setItem('mm_dice_skin', next.diceSkin);
      if (roomState?.status === 'LOBBY') {
        socketRef.current?.emit('lobby:update_profile', patch);
      }
      return next;
    });
  };

  const toggleClientCensor = () => {
    setClientCensorOverride((prev) => {
      const next = !prev;
      clientCensorRef.current = next;
      localStorage.setItem('mm_censor', next ? '1' : '0');
      return next;
    });
  };

  const actions = {
    createRoom: (mode: GameMode = 'classic') => {
      socketRef.current?.emit('room:create', { ...profile, mode }, (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) showError(res.error);
      });
    },
    joinRoom: (code: string, password?: string) => {
      socketRef.current?.emit(
        'room:join',
        { ...profile, code, password },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok && res.error) showError(res.error);
        }
      );
    },
    leaveRoom: () => {
      socketRef.current?.emit('room:leave');
      setRoomState(null);
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    },
    updateSettings: (patch: Partial<RoomSettings>) => {
      socketRef.current?.emit('lobby:update_settings', patch);
    },
    addBot: () => socketRef.current?.emit('lobby:add_bot'),
    removePlayer: (targetId: string) => socketRef.current?.emit('lobby:remove_player', targetId),
    swapSeat: (idx: number) => socketRef.current?.emit('lobby:swap_seat', idx),
    startGame: () => {
      socketRef.current?.emit('lobby:start', (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) showError(res.error);
      });
    },
    rematch: () => socketRef.current?.emit('game:rematch'),
    rollDice: () => socketRef.current?.emit('game:roll'),
    payJail: () => socketRef.current?.emit('game:pay_jail'),
    chooseSpeedTarget: (cellId: number) => socketRef.current?.emit('game:choose_speed_target', cellId),
    buyProperty: () => {
      socketRef.current?.emit('game:buy');
    },
    declineProperty: () => socketRef.current?.emit('game:decline_buy'),
    bidAuction: (step = 100) => socketRef.current?.emit('game:auction_bid', step),
    passAuction: () => socketRef.current?.emit('game:auction_pass'),
    auctionMortgaged: (cellId: number) => socketRef.current?.emit('game:auction_mortgaged', cellId),
    buildBranch: (cellId: number) => {
      socketRef.current?.emit('game:build_branch', cellId);
    },
    sellBranch: (cellId: number) => socketRef.current?.emit('game:sell_branch', cellId),
    mortgage: (cellId: number) => socketRef.current?.emit('game:mortgage', cellId),
    unmortgage: (cellId: number) => socketRef.current?.emit('game:unmortgage', cellId),
    ackChance: () => socketRef.current?.emit('game:ack-chance'),
    portalAddDirection: () => socketRef.current?.emit('game:portal_add'),
    portalJump: (targetCellId?: number) => socketRef.current?.emit('game:portal_jump', targetCellId),
    playJackpot: (payload: { skip?: boolean; mode?: 'DICE' | 'ROULETTE'; faces?: number[] }) =>
      socketRef.current?.emit('game:jackpot', payload),
    takeCredit: () =>
      socketRef.current?.emit('game:take_credit', (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) showError(res.error);
      }),
    repayCredit: () =>
      socketRef.current?.emit('game:repay_credit', (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) showError(res.error);
      }),
    duelRestart: () =>
      socketRef.current?.emit('game:duel_restart', (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) showError(res.error);
      }),
    proposeTrade: (toPlayerId: string, offer: TradeSide, request: TradeSide, onDone?: () => void) =>
      socketRef.current?.emit(
        'game:propose_trade',
        { toPlayerId, offer, request },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok && res.error) showError(res.error);
          else onDone?.();
        }
      ),
    respondTrade: (accept: boolean) => socketRef.current?.emit('game:respond_trade', accept),
    payDebt: () => socketRef.current?.emit('game:pay_debt'),
    endTurn: () => socketRef.current?.emit('game:end_turn'),
    surrender: () => socketRef.current?.emit('game:surrender'),
    sendChat: (msg: string) => socketRef.current?.emit('game:chat', msg),
    reactToLog: (logId: string, emoji: string) =>
      socketRef.current?.emit('game:react_log', { logId, emoji }),
    sendTaunt: (tauntId: string) => {
      soundEngine.unlock();
      socketRef.current?.emit('game:taunt', tauntId);
    },
    dismissBankruptcyAnim: () => setBankruptcyAnim(null),
  };

  const effectiveCensored = Boolean(roomState?.settings.censored || clientCensorOverride);
  censoredRef.current = effectiveCensored;

  return {
    connected,
    profile,
    updateLocalProfile,
    publicRooms,
    roomState,
    errorToast,
    activeTaunts,
    bankruptcyAnim,
    censored: effectiveCensored,
    clientCensorOverride,
    toggleClientCensor,
    actions,
  };
}
