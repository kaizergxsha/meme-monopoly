import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AuthAccount,
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

function generateGuestPlayerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem('mm_player_id');
  if (existing) return existing;
  const created = generateGuestPlayerId();
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
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null);
  const authTokenRef = useRef<string | null>(localStorage.getItem('mm_auth_token'));
  const profileSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<LocalProfile>(profile);
  profileRef.current = profile;
  const roomStateRef = useRef<RoomState | null>(roomState);
  roomStateRef.current = roomState;

  const applyAuthenticatedAccount = (acc: AuthAccount) => {
    const prevId = profileRef.current.playerId;
    const validColor = TOKEN_COLORS.some((c) => c.hex === acc.profile.color)
      ? acc.profile.color
      : profileRef.current.color;
    const nextProfile: LocalProfile = {
      playerId: acc.playerId,
      name: acc.profile.nickname || profileRef.current.name,
      avatar: acc.profile.avatar || profileRef.current.avatar,
      color: validColor,
      diceSkin: acc.profile.diceSkin || profileRef.current.diceSkin,
    };
    localStorage.setItem('mm_player_id', nextProfile.playerId);
    localStorage.setItem('mm_name', nextProfile.name);
    localStorage.setItem('mm_avatar', nextProfile.avatar);
    localStorage.setItem('mm_color', nextProfile.color);
    localStorage.setItem('mm_dice_skin', nextProfile.diceSkin);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setAuthAccount(acc);

    const curRoom = roomStateRef.current;
    if (curRoom && curRoom.status === 'LOBBY') {
      if (prevId === nextProfile.playerId) {
        socketRef.current?.emit('lobby:update_profile', {
          name: nextProfile.name,
          avatar: nextProfile.avatar,
          color: nextProfile.color,
          diceSkin: nextProfile.diceSkin,
        });
      } else {
        socketRef.current?.emit('room:leave');
        socketRef.current?.emit('room:join', {
          code: curRoom.code,
          password: curRoom.settings.password,
          ...nextProfile,
        });
      }
    }
  };

  const adoptReconnectedPlayerId = (newId?: string) => {
    if (authTokenRef.current) return;
    if (!newId || newId === profileRef.current.playerId) return;
    localStorage.setItem('mm_player_id', newId);
    setProfile((prev) => {
      const next = { ...prev, playerId: newId };
      profileRef.current = next;
      return next;
    });
  };

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
      const urlCode = params.get('room');
      const activeCode = localStorage.getItem('mm_active_room');
      const reconnectCode = urlCode || activeCode;
      if (reconnectCode) {
        const curProfile = profileRef.current;
        socket.emit(
          'room:join',
          {
            code: reconnectCode,
            playerId: curProfile.playerId,
            name: curProfile.name,
            avatar: curProfile.avatar,
            color: curProfile.color,
            diceSkin: curProfile.diceSkin,
          },
          (res: { ok: boolean; playerId?: string; error?: string }) => {
            if (res.ok) {
              adoptReconnectedPlayerId(res.playerId);
            } else {
              localStorage.removeItem('mm_active_room');
              if (urlCode && res.error) {
                showError(res.error);
              }
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
        activeKickVote: rawState.activeKickVote
          ? {
              ...rawState.activeKickVote,
              expiresAt: rawState.activeKickVote.expiresAt + clockOffset,
            }
          : null,
        lastTauntAt: rawState.lastTauntAt ? rawState.lastTauntAt + clockOffset : 0,
        players: rawState.players.map((p) => ({
          ...p,
          lastTauntAt: p.lastTauntAt ? p.lastTauntAt + clockOffset : 0,
        })),
      };

      setRoomState(nextState);
      if (nextState.status !== 'FINISHED') {
        localStorage.setItem('mm_active_room', nextState.code);
        localStorage.setItem('mm_last_room', nextState.code);
      } else {
        localStorage.removeItem('mm_active_room');
        localStorage.removeItem('mm_last_room');
      }
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

      Object.values(tauntTimersRef.current).forEach(clearTimeout);
      tauntTimersRef.current = {};
      setActiveTaunts({ [ev.playerId]: ev });

      tauntTimersRef.current[ev.playerId] = setTimeout(() => {
        delete tauntTimersRef.current[ev.playerId];
        setActiveTaunts((prev) => {
          if (prev[ev.playerId]?.id !== ev.id) return prev;
          const copy = { ...prev };
          delete copy[ev.playerId];
          return copy;
        });
      }, 4500);
    });

    socket.on('room:bankruptcy_anim', (ev: BankruptcyAnimationEvent) => {
      soundEngine.playBankruptcy(ev.style);
      setBankruptcyAnim(ev);
      setTimeout(() => {
        setBankruptcyAnim((cur) => (cur?.timestamp === ev.timestamp ? null : cur));
      }, 5200);
    });

    return () => {
      if (profileSyncTimerRef.current) {
        clearTimeout(profileSyncTimerRef.current);
      }
      Object.values(tauntTimersRef.current).forEach(clearTimeout);
      tauntTimersRef.current = {};
      if (activeSocketInstance === socket) {
        activeSocketInstance = null;
      }
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = authTokenRef.current;
    if (!token) return;
    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('mm_auth_token');
          authTokenRef.current = null;
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; account?: AuthAccount };
        if (!cancelled && json.ok && json.account) {
          applyAuthenticatedAccount(json.account);
        }
      })
      .catch(() => {
        // ignore network errors on boot
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistProfileToServer = async (next: LocalProfile) => {
    const token = authTokenRef.current;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          playerId: next.playerId,
          nickname: next.name,
          avatar: next.avatar,
          color: next.color,
          diceSkin: next.diceSkin,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; profile?: AuthAccount['profile'] };
        if (json.ok && json.profile) {
          const updatedProfile = json.profile;
          setAuthAccount((prev) => (prev ? { ...prev, profile: updatedProfile } : prev));
        }
      }
    } catch {
      // ignore offline errors
    }
  };

  const updateLocalProfile = (patch: Partial<LocalProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      profileRef.current = next;
      localStorage.setItem('mm_name', next.name);
      localStorage.setItem('mm_avatar', next.avatar);
      localStorage.setItem('mm_color', next.color);
      localStorage.setItem('mm_dice_skin', next.diceSkin);
      if (roomStateRef.current?.status === 'LOBBY') {
        socketRef.current?.emit('lobby:update_profile', patch);
      }
      if (profileSyncTimerRef.current) {
        clearTimeout(profileSyncTimerRef.current);
      }
      const isNameOnlyPatch = patch.name !== undefined && Object.keys(patch).length === 1;
      if (isNameOnlyPatch) {
        profileSyncTimerRef.current = setTimeout(() => {
          profileSyncTimerRef.current = null;
          void persistProfileToServer(profileRef.current);
        }, 180);
      } else {
        void persistProfileToServer(next);
      }
      return next;
    });
  };

  const registerAccount = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const cur = profileRef.current;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nickname: cur.name,
          avatar: cur.avatar,
          color: cur.color,
          diceSkin: cur.diceSkin,
          guestPlayerId: cur.playerId,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        token?: string;
        account?: AuthAccount;
      };
      if (!res.ok || !json.ok || !json.token || !json.account) {
        return { ok: false, error: json.error || 'Ошибка регистрации' };
      }
      localStorage.setItem('mm_auth_token', json.token);
      authTokenRef.current = json.token;
      applyAuthenticatedAccount(json.account);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Сервер недоступен' };
    }
  };

  const loginAccount = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        token?: string;
        account?: AuthAccount;
      };
      if (!res.ok || !json.ok || !json.token || !json.account) {
        return { ok: false, error: json.error || 'Неверная почта или пароль' };
      }
      localStorage.setItem('mm_auth_token', json.token);
      authTokenRef.current = json.token;
      applyAuthenticatedAccount(json.account);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Сервер недоступен' };
    }
  };

  const logoutAccount = async (): Promise<void> => {
    const token = authTokenRef.current;
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('mm_auth_token');
    authTokenRef.current = null;
    setAuthAccount(null);
    const freshGuestId = generateGuestPlayerId();
    localStorage.setItem('mm_player_id', freshGuestId);
    setProfile((prev) => {
      const next = { ...prev, playerId: freshGuestId };
      profileRef.current = next;
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
      const curProfile = profileRef.current;
      socketRef.current?.emit(
        'room:join',
        { ...curProfile, code, password },
        (res: { ok: boolean; playerId?: string; error?: string }) => {
          if (res.ok) {
            adoptReconnectedPlayerId(res.playerId);
          } else if (res.error) {
            showError(res.error);
          }
        }
      );
    },
    leaveRoom: () => {
      const leavingCode = roomState?.status === 'PLAYING' ? roomState.code : null;
      socketRef.current?.emit('room:leave');
      localStorage.removeItem('mm_active_room');
      if (leavingCode) {
        localStorage.setItem('mm_last_room', leavingCode);
      } else {
        localStorage.removeItem('mm_last_room');
      }
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
    notifyTradeDraftOpen: () => socketRef.current?.emit('game:trade_draft_open'),
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
    startKickVote: (targetId: string) =>
      socketRef.current?.emit(
        'game:start_kick_vote',
        targetId,
        (res: { ok: boolean; error?: string }) => {
          if (res && !res.ok && res.error) showError(res.error);
        }
      ),
    castKickVote: (approve: boolean) =>
      socketRef.current?.emit(
        'game:cast_kick_vote',
        approve,
        (res: { ok: boolean; error?: string }) => {
          if (res && !res.ok && res.error) showError(res.error);
        }
      ),
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
    authAccount,
    updateLocalProfile,
    registerAccount,
    loginAccount,
    logoutAccount,
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
