import React, { useEffect, useRef, useState } from 'react';
import { BOARD_CELLS } from '../../shared/boardData.ts';
import { JACKPOT_QUOTES } from '../../shared/memeContent.ts';
import {
  checkTradeFairness,
  getAntiStallStatus,
  getSpeedDieUnlockRound,
  getTokenWalkDurationMs,
  txt,
} from '../../shared/rules.ts';
import { DiceSkin, PlayerState, RoomState, SpeedDieFace, TradeSide } from '../../shared/types.ts';
import { emitAckChance } from '../hooks/useGameSocket.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { IndustryCardBanner } from './CardIllustration.tsx';

export interface TradeDraftState {
  open: boolean;
  partnerId: string;
  offerCash: number;
  reqCash: number;
  offerProps: number[];
  reqProps: number[];
  offerShields: number;
  reqShields: number;
}

export interface CenterStageProps {
  roomState: RoomState;
  myPlayerId: string;
  selectedCellId: number | null;
  onSelectCell: (id: number | null) => void;
  censored: boolean;
  onToggleCensor: () => void;
  nowMs: number;
  onRoll: () => void;
  onPayJail: () => void;
  onBuy: () => void;
  onDeclineBuy: () => void;
  onPayDebt: () => void;
  onEndTurn: () => void;
  onBuildBranch: (cellId: number) => void;
  onSellBranch: (cellId: number) => void;
  onMortgage: (cellId: number) => void;
  onUnmortgage: (cellId: number) => void;
  onAuctionMortgaged: (cellId: number) => void;
  onDuelRestart: () => void;
  onSurrender: () => void;
  onSendChat: (msg: string) => void;
  onReactLog: (logId: string, emoji: string) => void;
  onOpenCredit: () => void;
  onBidAuction: (step: number) => void;
  onPassAuction: () => void;
  onPortalAdd: () => void;
  onPortalJump: (targetCellId?: number) => void;
  onPlayJackpot: (payload: { skip?: boolean; mode?: 'DICE' | 'ROULETTE'; faces?: number[] }) => void;
  onAckChance?: () => void;
  tradeDraft: TradeDraftState;
  onChangeTradeDraft: React.Dispatch<React.SetStateAction<TradeDraftState>>;
  onProposeTrade: (
    toPlayerId: string,
    offer: TradeSide,
    request: TradeSide,
    onDone?: () => void
  ) => void;
}

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function formatClock(startedAt: number | null, nowMs: number): string {
  if (!startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderColoredLogText(text: string, players: PlayerState[]): React.ReactNode {
  const validPlayers = players
    .filter((p) => p.name && p.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  if (validPlayers.length === 0) return text;

  const escaped = validPlayers.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const byName = new Map(validPlayers.map((p) => [p.name, p]));
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    const matched = byName.get(part);
    if (matched) {
      return (
        <span key={idx} style={{ color: matched.color }} className="font-extrabold">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const M1DieBox: React.FC<{ value: number; skin: DiceSkin; animKey: number }> = ({
  value,
  skin,
  animKey,
}) => {
  const pips = PIP_POSITIONS[value] || [4];

  // Фирменные скины кубиков (включая геометрический неоново-фиолетовый скин из видео!)
  const skinStyle: React.CSSProperties =
    skin === 'neon'
      ? {
          background:
            'conic-gradient(from 90deg at 50% 50%, #7c3aed 0deg 90deg, #f43f8a 90deg 180deg, #7c3aed 180deg 270deg, #2dd4bf 270deg 360deg)',
          color: '#ffffff',
          boxShadow: '0 14px 32px rgba(124,58,237,0.45)',
        }
      : skin === 'gold'
      ? {
          background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)',
          color: '#171717',
          boxShadow: '0 14px 32px rgba(245,158,11,0.4)',
        }
      : skin === 'gopnik'
      ? {
          background: '#18181b',
          color: '#facc15',
          border: '2px solid #52525b',
          boxShadow: '0 14px 32px rgba(0,0,0,0.65)',
        }
      : skin === 'comic'
      ? {
          background: '#f43f5e',
          color: '#fef08a',
          border: '2.5px solid #171717',
          boxShadow: '5px 5px 0px #171717',
        }
      : {
          background: '#ffffff',
          color: '#171717',
          boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
        };

  return (
    <div
      key={`${animKey}_${value}`}
      style={skinStyle}
      className="w-[44px] h-[44px] sm:w-[64px] sm:h-[64px] md:w-[74px] md:h-[74px] rounded-[8px] sm:rounded-[10px] p-1.5 sm:p-2.5 grid grid-cols-3 grid-rows-3 gap-0.5 sm:gap-1 animate-dice-roll"
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-center">
          {pips.includes(idx) && (
            <span className="w-2 h-2 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-current shadow-xs" />
          )}
        </div>
      ))}
    </div>
  );
};

const SpeedDieBox: React.FC<{ face: SpeedDieFace; animKey: number }> = ({ face, animKey }) => (
  <div
    key={`sp_${animKey}_${String(face)}`}
    className="w-[44px] h-[44px] sm:w-[64px] sm:h-[64px] md:w-[74px] md:h-[74px] rounded-[8px] sm:rounded-[10px] bg-gradient-to-br from-fuchsia-600 to-indigo-700 border-2 border-fuchsia-300 text-white font-black flex flex-col items-center justify-center shadow-[0_14px_32px_rgba(217,70,239,0.5)] animate-dice-roll"
  >
    {face === 'BUS' ? (
      <>
        <span className="text-base sm:text-xl leading-none">🚐</span>
        <span className="text-[8px] sm:text-[10px] mt-0.5">БУС</span>
      </>
    ) : face === 'M1' ? (
      <>
        <span className="text-base sm:text-xl leading-none">😈</span>
        <span className="text-[8px] sm:text-[10px] mt-0.5">М1</span>
      </>
    ) : (
      <>
        <span className="text-lg sm:text-2xl leading-none">+{face}</span>
        <span className="text-[8px] sm:text-[9px] uppercase opacity-80">Speed</span>
      </>
    )}
  </div>
);

export const CenterStage: React.FC<CenterStageProps> = ({
  roomState,
  myPlayerId,
  selectedCellId,
  onSelectCell,
  censored,
  onToggleCensor,
  nowMs,
  onRoll,
  onPayJail,
  onBuy,
  onDeclineBuy,
  onPayDebt,
  onEndTurn,
  onBuildBranch,
  onSellBranch,
  onMortgage,
  onUnmortgage,
  onAuctionMortgaged,
  onDuelRestart,
  onSurrender,
  onSendChat,
  onReactLog,
  onOpenCredit,
  onBidAuction,
  onPassAuction,
  onPortalAdd,
  onPortalJump,
  onPlayJackpot,
  onAckChance,
  tradeDraft,
  onChangeTradeDraft,
  onProposeTrade,
}) => {
  const [chatDraft, setChatDraft] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'CHAT' | 'DICE'>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<number[]>([6]);
  const [selectedChambers, setSelectedChambers] = useState<number[]>([1]);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * JACKPOT_QUOTES.length));
  const logBottomRef = useRef<HTMLDivElement | null>(null);

  const toggleFace = (f: number) => {
    setSelectedFaces((prev) => {
      if (prev.includes(f)) return prev.length > 1 ? prev.filter((x) => x !== f) : prev;
      return prev.length >= 3 ? [...prev.slice(1), f] : [...prev, f];
    });
  };

  const toggleChamber = (c: number) => {
    setSelectedChambers((prev) => {
      if (prev.includes(c)) return prev.length > 1 ? prev.filter((x) => x !== c) : prev;
      return prev.length >= 5 ? [...prev.slice(1), c] : [...prev, c];
    });
  };

  const curPlayer = roomState.players[roomState.currentPlayerIndex];
  const isMyTurn = curPlayer?.id === myPlayerId;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const diceRoller =
    roomState.players.find((p) => p.id === roomState.lastDice?.rolledBy) || curPlayer;

  const antiStall = getAntiStallStatus(roomState, nowMs);
  const speedUnlock = getSpeedDieUnlockRound(roomState.settings);
  const clockStr = formatClock(roomState.startedAt, nowMs);

  // Крупные кубики всплывают по центру на 2.6 сек при каждом броске (1:1 референс)
  const showCenterDice =
    !!roomState.lastDice && nowMs - roomState.lastDice.timestamp < 2600;

  // Данные конструктора Договора
  const otherAlivePlayers = roomState.players.filter(
    (p) => !p.isBankrupt && p.id !== myPlayerId
  );
  const partner = roomState.players.find((p) => p.id === tradeDraft.partnerId);
  const tradeFairness = checkTradeFairness(
    roomState.cells,
    {
      cash: tradeDraft.offerCash,
      propertyIds: tradeDraft.offerProps,
      shields: tradeDraft.offerShields,
    },
    {
      cash: tradeDraft.reqCash,
      propertyIds: tradeDraft.reqProps,
      shields: tradeDraft.reqShields,
    }
  );

  // Фильтрация логов и автоскролл вниз только при появлении нового события (по ID, даже после лимита 60+ записей)
  const filteredLogs = roomState.logs.filter((l) => {
    if (logFilter === 'CHAT') return l.type === 'CHAT' || l.type === 'TAUNT';
    if (logFilter === 'DICE') return l.type === 'DICE';
    return true;
  });
  const latestLogId = filteredLogs[filteredLogs.length - 1]?.id ?? '';

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const logScrollEl = logBottomRef.current?.parentElement;
      if (logScrollEl) {
        logScrollEl.scrollTop = logScrollEl.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [latestLogId, logFilter]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    onSendChat(chatDraft);
    setChatDraft('');
  };

  const copyRoomLink = () => {
    navigator.clipboard
      .writeText(`${window.location.origin}/?room=${roomState.code}`)
      .catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  // Пока фишка шагает по доске после броска кубиков, не перекрываем обзор карточкой выбора/покупки/оплаты
  const walkMs = getTokenWalkDurationMs(roomState.lastDice);
  const isWalkingToChance =
    roomState.phase === 'CHANCE' &&
    !!roomState.lastCardPopup &&
    nowMs - roomState.lastCardPopup.timestamp < roomState.lastCardPopup.walkDurationMs;
  const isWalkingAfterRoll =
    isWalkingToChance ||
    (!!roomState.lastDice &&
      nowMs - roomState.lastDice.timestamp < walkMs &&
      (roomState.phase !== 'PRE_ROLL' || roomState.lastDice.rolledBy === myPlayerId));

  const showAuctionCard =
    !tradeDraft.open &&
    !isWalkingAfterRoll &&
    roomState.status === 'PLAYING' &&
    roomState.phase === 'AUCTION' &&
    !!roomState.auction;

  const showMyTurnActionCard =
    !tradeDraft.open &&
    !isWalkingAfterRoll &&
    isMyTurn &&
    roomState.status === 'PLAYING' &&
    (roomState.phase === 'PRE_ROLL' ||
      roomState.phase === 'BUY_DECISION' ||
      roomState.phase === 'CHANCE' ||
      roomState.phase === 'PORTAL' ||
      roomState.phase === 'JACKPOT' ||
      roomState.phase === 'CHOOSE_SPEED_TARGET' ||
      roomState.phase === 'PENDING_DEBT');

  return (
    <div
      style={{ gridRow: '2 / span 9', gridColumn: '2 / span 9' }}
      className="min-w-0 min-h-0 bg-[#16171b] rounded-[8px] sm:rounded-[12px] m-[1px] sm:m-[2px] p-1.5 sm:p-2.5 md:p-3.5 flex flex-col justify-between overflow-hidden relative shadow-inner"
    >
      {/* 1. ВЕРХНЯЯ ЗОНА: Белая карточка активного действия / Договора ИЛИ компактная пилюля времени */}
      <div className="relative z-20 shrink-0 max-h-[75%] overflow-y-auto chat-scrollbar">
        {tradeDraft.open && me ? (
          /* БЕЛАЯ КАРТОЧКА «ДОГОВОР» ВНУТРИ ДОСКИ (1:1 кадры 10–12 видео!) */
          <div className="bg-white text-neutral-900 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-2xl animate-action-card space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center justify-between text-[11px] sm:text-xs border-b border-neutral-200 pb-1 sm:pb-1.5">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-lime-500 inline-block" />
                <span>{clockStr}</span>
                <span>•</span>
                <span>{roomState.round} раунд</span>
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-neutral-900">Договор</span>
              <button
                onClick={() => onChangeTradeDraft((p) => ({ ...p, open: false }))}
                className="text-neutral-400 hover:text-neutral-800 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Переключатель партнёра */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1 font-bold">
                <span>{me.avatar}</span>
                <span style={{ color: me.color }}>Вы</span>
                <span className="text-neutral-500 font-normal hidden sm:inline">предлагаете</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {otherAlivePlayers.map((op) => (
                  <button
                    key={op.id}
                    onClick={() =>
                      onChangeTradeDraft((prev) => ({
                        ...prev,
                        partnerId: op.id,
                        reqProps: [],
                        reqCash: 0,
                      }))
                    }
                    className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition cursor-pointer ${
                      tradeDraft.partnerId === op.id
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {op.avatar} {op.name}
                  </button>
                ))}
              </div>
            </div>

            {partner && (
              <>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2">
                  <div>
                    <div className="text-[10px] text-neutral-500 mb-0.5">Наличные ($)</div>
                    <input
                      type="number"
                      min={0}
                      max={me.cash}
                      step={100}
                      value={tradeDraft.offerCash}
                      onChange={(e) =>
                        onChangeTradeDraft((p) => ({
                          ...p,
                          offerCash: Math.max(0, Math.min(me.cash, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full bg-neutral-100 border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold text-neutral-900"
                    />
                  </div>

                  {/* Быстрые кнопки коэффициентов как в M1: ← ×2 | 1:1 | ×2 → */}
                  <div className="flex items-center gap-1 pt-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeTradeDraft((p) => ({
                          ...p,
                          offerCash: Math.min(
                            me.cash,
                            Math.max(0, tradeFairness.requestValue * 2 - (tradeFairness.offerValue - p.offerCash))
                          ),
                        }))
                      }
                      className="px-1.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 cursor-pointer"
                    >
                      ← ×2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const diff = tradeFairness.requestValue - (tradeFairness.offerValue - tradeDraft.offerCash);
                        if (diff >= 0) {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            offerCash: Math.min(me.cash, diff),
                            reqCash: 0,
                          }));
                        } else {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            offerCash: 0,
                            reqCash: Math.min(partner.cash, Math.abs(diff)),
                          }));
                        }
                      }}
                      className="px-1.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 cursor-pointer"
                    >
                      1:1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeTradeDraft((p) => ({
                          ...p,
                          reqCash: Math.min(
                            partner.cash,
                            Math.max(0, (tradeFairness.offerValue - p.reqCash) * 2)
                          ),
                        }))
                      }
                      className="px-1.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 cursor-pointer"
                    >
                      ×2 →
                    </button>
                  </div>

                  <div>
                    <div className="text-[10px] text-neutral-500 mb-0.5 text-right">Наличные ($)</div>
                    <input
                      type="number"
                      min={0}
                      max={partner.cash}
                      step={100}
                      value={tradeDraft.reqCash}
                      onChange={(e) =>
                        onChangeTradeDraft((p) => ({
                          ...p,
                          reqCash: Math.max(0, Math.min(partner.cash, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full bg-neutral-100 border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold text-neutral-900 text-right"
                    />
                  </div>
                </div>

                {/* Список кликнутых на доске полей */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 min-h-[34px] flex flex-wrap gap-1">
                    {tradeDraft.offerProps.length === 0 ? (
                      <span className="text-neutral-400 text-[10px]">
                        Кликните по своим полям на доске
                      </span>
                    ) : (
                      tradeDraft.offerProps.map((cid) => (
                        <span
                          key={cid}
                          className="px-1.5 py-0.5 rounded bg-lime-100 text-lime-900 font-bold text-[10px]"
                        >
                          {txt(BOARD_CELLS[cid].name, BOARD_CELLS[cid].cleanName, censored)}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 min-h-[34px] flex flex-wrap gap-1">
                    {tradeDraft.reqProps.length === 0 ? (
                      <span className="text-neutral-400 text-[10px]">
                        Кликните по полям партнёра на доске
                      </span>
                    ) : (
                      tradeDraft.reqProps.map((cid) => (
                        <span
                          key={cid}
                          className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]"
                        >
                          {txt(BOARD_CELLS[cid].name, BOARD_CELLS[cid].cleanName, censored)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-600 pt-0.5">
                  <span>
                    Общая стоимость: <b className="text-neutral-900">${tradeFairness.offerValue}</b>
                  </span>
                  <span>
                    Общая стоимость: <b className="text-neutral-900">${tradeFairness.requestValue}</b>
                  </span>
                </div>

                {roomState.settings.fairTradeLimit && !tradeFairness.fair && (
                  <div className="text-[10px] text-rose-600 font-semibold text-center">
                    ⚠️ Разница оценки больше ±50% (анти-абуз фильтр включён)
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <button
                    disabled={
                      (roomState.settings.fairTradeLimit && !tradeFairness.fair) ||
                      (tradeFairness.offerValue === 0 && tradeFairness.requestValue === 0)
                    }
                    onClick={() =>
                      onProposeTrade(
                        partner.id,
                        {
                          cash: tradeDraft.offerCash,
                          propertyIds: tradeDraft.offerProps,
                          shields: tradeDraft.offerShields,
                        },
                        {
                          cash: tradeDraft.reqCash,
                          propertyIds: tradeDraft.reqProps,
                          shields: tradeDraft.reqShields,
                        },
                        () => onChangeTradeDraft((p) => ({ ...p, open: false }))
                      )
                    }
                    className="px-5 py-1.5 rounded-lg bg-[#8fce00] hover:bg-[#7eb800] disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Отправить
                  </button>
                  <button
                    onClick={() => onChangeTradeDraft((p) => ({ ...p, open: false }))}
                    className="px-4 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Отменить
                  </button>
                </div>
              </>
            )}
          </div>
        ) : showMyTurnActionCard && curPlayer ? (
          /* ТЁМНАЯ СТЕКЛЯННАЯ ПЛАШКА АКТИВНОГО ХОДА В ЕДИНОМ СТИЛЕ С ИНТЕРФЕЙСОМ */
          <div
            style={{
              borderColor: `${curPlayer.color}99`,
              boxShadow: `0 18px 46px rgba(0,0,0,0.72), 0 0 24px ${curPlayer.color}28`,
            }}
            className="bg-[#1d1f27]/95 backdrop-blur-md text-neutral-100 rounded-xl sm:rounded-2xl border-2 p-2 sm:p-3 animate-action-card space-y-1.5 sm:space-y-2.5"
          >
            <div className="flex items-center justify-between gap-1 sm:gap-2 text-[10px] sm:text-xs">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#8fce00] inline-block" />
                <span>{clockStr}</span>
                <span className="text-neutral-600">|</span>
                <span>{roomState.round} раунд</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span
                  style={{ borderColor: curPlayer.color, backgroundColor: `${curPlayer.color}33` }}
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-[10px] sm:text-[11px] shrink-0"
                >
                  {curPlayer.avatar}
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-white truncate">
                  {roomState.phase === 'PRE_ROLL'
                    ? 'Ваш ход!'
                    : roomState.phase === 'BUY_DECISION'
                    ? 'Покупаем?'
                    : roomState.phase === 'CHANCE'
                    ? 'Карточка Шанс! 🃏'
                    : roomState.phase === 'PORTAL'
                    ? txt('Квантовый пиздец', 'Квантовый Портал', censored)
                    : roomState.phase === 'JACKPOT'
                    ? roomState.settings.russianRoulette
                      ? 'Русская рулетка'
                      : txt('Ебучий Додеп', 'Казино-Джекпот', censored)
                    : roomState.phase === 'CHOOSE_SPEED_TARGET'
                    ? 'Выбор клетки!'
                    : 'Погашение долга!'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-lime-300 text-[11px] font-extrabold shrink-0">
                  ${curPlayer.cash.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="text-neutral-400 hover:text-white text-sm cursor-pointer shrink-0"
                title="Настройки матча"
              >
                ⚙️
              </button>
            </div>

            {/* Мини-панель активных эффектов/дебаффов игрока */}
            {(curPlayer.inJail ||
              curPlayer.shields > 0 ||
              curPlayer.credit ||
              (speedUnlock !== null && roomState.round >= speedUnlock)) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold">
                {curPlayer.inJail && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200">
                    ⛓️ В обезьяннике ({curPlayer.jailTurns}/3)
                  </span>
                )}
                {curPlayer.shields > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200">
                    🛡️ Скам-иммунитет ×{curPlayer.shields}
                  </span>
                )}
                {curPlayer.credit && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200">
                    🏦 Кредит до {curPlayer.credit.dueRound}р
                  </span>
                )}
                {speedUnlock !== null && roomState.round >= speedUnlock && (
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200">
                    ⚡ 3D-кубик активен
                  </span>
                )}
              </div>
            )}

            {roomState.phase === 'PRE_ROLL' && (
              <div className="space-y-1 sm:space-y-1.5">
                <button
                  onClick={onRoll}
                  className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-[11px] sm:text-xs md:text-sm tracking-wide shadow-[0_6px_20px_rgba(143,206,0,0.35)] transition cursor-pointer"
                >
                  🎲 БРОСИТЬ КУБИКИ
                </button>
                <div className="hidden sm:block text-[11px] text-neutral-400 text-center">
                  Кликните на любую карточку поля, чтобы построить филиал или заложить актив
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {me?.inJail && me.cash >= 500 && (
                    <button
                      onClick={onPayJail}
                      className="flex-1 py-1 sm:py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] sm:text-xs cursor-pointer"
                    >
                      🔓 Выкуп ($500)
                    </button>
                  )}
                  {roomState.settings.mode === 'duel_restart' && roomState.round <= 20 && (
                    <button
                      onClick={onDuelRestart}
                      className="flex-1 py-1 sm:py-1.5 rounded-lg bg-fuchsia-500/25 hover:bg-fuchsia-500/35 border border-fuchsia-400/40 text-fuchsia-200 font-bold text-[10px] sm:text-xs cursor-pointer"
                    >
                      🔄 Рестарт (${roomState.round <= 10 ? '1000' : '2000'})
                    </button>
                  )}
                </div>
              </div>
            )}

            {roomState.phase === 'BUY_DECISION' && (
              <div className="space-y-1.5 sm:space-y-2">
                <IndustryCardBanner
                  groupId={BOARD_CELLS[curPlayer.position].groupId}
                  cellType={BOARD_CELLS[curPlayer.position].type}
                  cellId={curPlayer.position}
                  censored={censored}
                  className="!h-[44px] sm:!h-[84px]"
                />
                <div className="text-[10.5px] sm:text-xs text-neutral-300 leading-snug line-clamp-2 sm:line-clamp-none">
                  Вы попали на{' '}
                  <b className="text-white">
                    «
                    {txt(
                      BOARD_CELLS[curPlayer.position].name,
                      BOARD_CELLS[curPlayer.position].cleanName,
                      censored
                    )}
                    »
                  </b>
                  <span className="hidden sm:inline">
                    , и у вас есть право его купить. Если откажетесь — поле уйдёт на аукцион.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    disabled={(me?.cash ?? 0) < (BOARD_CELLS[curPlayer.position].price ?? 0)}
                    onClick={onBuy}
                    className="py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[#8fce00] hover:bg-[#7fb800] disabled:opacity-40 text-neutral-950 font-black text-[11px] sm:text-xs cursor-pointer"
                  >
                    Купить за ${BOARD_CELLS[curPlayer.position].price ?? 0}
                  </button>
                  <button
                    onClick={onDeclineBuy}
                    className="py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-neutral-100 font-bold text-[11px] sm:text-xs cursor-pointer"
                  >
                    {roomState.settings.auctionsEnabled && !roomState.settings.retroRules ? (
                      <>
                        <span className="hidden sm:inline">Выставить на </span>
                        <span className="sm:hidden">На </span>
                        аукцион
                      </>
                    ) : (
                      'Пропустить'
                    )}
                  </button>
                </div>
              </div>
            )}

            {roomState.phase === 'CHANCE' && (
              <div className="space-y-1.5 sm:space-y-2">
                {roomState.lastCardPopup && (
                  <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs space-y-0.5">
                    <div className="font-extrabold text-white flex items-center gap-1.5">
                      <span>{roomState.lastCardPopup.card.icon}</span>
                      <span className="truncate">
                        {txt(
                          roomState.lastCardPopup.card.title,
                          roomState.lastCardPopup.card.cleanTitle,
                          censored
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-amber-300">
                      {txt(
                        roomState.lastCardPopup.effectLabel,
                        roomState.lastCardPopup.cleanEffectLabel,
                        censored
                      )}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => (onAckChance ?? emitAckChance)()}
                  className="w-full py-2 sm:py-2.5 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer"
                >
                  Применить Шанс 🃏
                </button>
              </div>
            )}

            {roomState.phase === 'CHOOSE_SPEED_TARGET' && (
              <div className="text-xs font-bold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-xl px-3 py-2 text-center">
                {roomState.speedTargetMode === 'TRIPLE'
                  ? '🔥 ТРИПЛ! Кликните на любую подсвеченную клетку на доске для перелёта!'
                  : '🚐 МАРШРУТКА! Кликните на подсвеченную клетку впереди!'}
              </div>
            )}

            {roomState.phase === 'PENDING_DEBT' && roomState.pendingDebt && (() => {
              const debt = roomState.pendingDebt;
              const creditor =
                debt.creditorId === 'BANK'
                  ? null
                  : roomState.players.find((p) => p.id === debt.creditorId);
              const canPay = (me?.cash ?? 0) >= debt.amount;
              return (
                <div className="space-y-2">
                  <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-300 font-semibold">
                        {creditor ? (
                          <>
                            Получатель:{' '}
                            <b style={{ color: creditor.color }} className="font-extrabold">
                              {creditor.avatar} {creditor.name}
                            </b>
                          </>
                        ) : (
                          <>
                            Получатель: <b className="text-white">🏦 Банк</b>
                          </>
                        )}
                      </span>
                      <span className="font-black text-rose-400 text-sm">-${debt.amount}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-snug">
                      {txt(debt.reason, debt.cleanReason, censored)}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        canPay ? 'text-lime-300' : 'text-rose-300'
                      }`}
                    >
                      {canPay
                        ? `На счету $${me?.cash ?? 0} — нажмите «Оплатить», чтобы подтвердить перевод.`
                        : `Не хватает $${debt.amount - (me?.cash ?? 0)}! Кликните на свои поля на доске (продать филиал / заложить) или возьмите кредит.`}
                    </div>
                  </div>
                  {canPay ? (
                    <button
                      onClick={onPayDebt}
                      className="w-full py-2.5 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-xs md:text-sm shadow-md transition cursor-pointer"
                    >
                      💸 Оплатить ${debt.amount}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={onOpenCredit}
                        className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs cursor-pointer"
                      >
                        🏦 Взять кредит
                      </button>
                      <button
                        onClick={onSurrender}
                        className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                      >
                        Признать банкротство
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {roomState.phase === 'PORTAL' && roomState.portal && (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="text-[10.5px] sm:text-[11px] font-semibold text-cyan-200">
                  🌀 Нажмите на подсвеченную клетку на доске или выберите точку ниже (ещё точка +$500):
                </div>
                <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-24 sm:max-h-28 overflow-y-auto chat-scrollbar pr-1">
                  {roomState.portal.candidateCells.map((cid) => {
                    const cDef = BOARD_CELLS[cid];
                    const cRt = roomState.cells[cid];
                    const cOwner = cRt?.ownerId
                      ? roomState.players.find((p) => p.id === cRt.ownerId)
                      : null;
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => onPortalJump(cid)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/55 text-[10px] sm:text-[11px] font-bold text-cyan-100 hover:text-white transition cursor-pointer shadow-xs"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: cOwner
                              ? cOwner.color
                              : cDef.price
                              ? '#84cc16'
                              : '#22d3ee',
                          }}
                        />
                        <span>{cDef.icon}</span>
                        <span>{txt(cDef.shortName || cDef.name, cDef.cleanShortName || cDef.cleanName, censored)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={roomState.portal.candidateCells.length >= 8 || (me?.cash ?? 0) < 500}
                    onClick={onPortalAdd}
                    className="py-1.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-neutral-100 font-bold text-[11px] sm:text-xs cursor-pointer transition"
                  >
                    + Точка ($500)
                  </button>
                  <button
                    type="button"
                    onClick={() => onPortalJump()}
                    className="py-1.5 sm:py-2 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-extrabold text-[11px] sm:text-xs cursor-pointer transition"
                  >
                    🎲 Случайный прыжок
                  </button>
                </div>
              </div>
            )}

            {roomState.phase === 'JACKPOT' &&
              (roomState.settings.russianRoulette ? (
                (() => {
                  const rewardMap: Record<number, number> = {
                    1: 1000,
                    2: 2000,
                    3: 3500,
                    4: 5500,
                    5: 10000,
                  };
                  const reward = rewardMap[selectedChambers.length] ?? 1000;
                  const surviveChances = 6 - selectedChambers.length;
                  const survivePct = Math.round((surviveChances / 6) * 100);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-neutral-300">
                        <span>
                          🔫 В 1 из 6 патронников пуля • Шанс выжить:{' '}
                          <b className="text-white">{survivePct}%</b>
                        </span>
                        <span className="font-extrabold text-emerald-300 shrink-0 ml-2">
                          Награда: +${reward}
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((c) => {
                          const active = selectedChambers.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => toggleChamber(c)}
                              className={`h-8 rounded-lg font-extrabold text-xs border transition cursor-pointer ${
                                active
                                  ? 'bg-rose-500/85 text-white border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                                  : 'bg-white/10 text-neutral-200 border-white/15 hover:bg-white/20'
                              }`}
                            >
                              #{c}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onPlayJackpot({ mode: 'ROULETTE', faces: selectedChambers })
                          }
                          className="col-span-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer transition shadow-md"
                        >
                          🔫 Спустить курок (+${reward})
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlayJackpot({ skip: true })}
                          className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 font-bold text-xs cursor-pointer transition"
                        >
                          Пас
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-600">
                    <span className="italic truncate">
                      {txt(JACKPOT_QUOTES[quoteIdx].hard, JACKPOT_QUOTES[quoteIdx].clean, censored)}
                    </span>
                    <span className="font-extrabold text-neutral-900 shrink-0 ml-2">
                      Куш:{' '}
                      {selectedFaces.length === 1
                        ? '$6000'
                        : selectedFaces.length === 2
                        ? '$3000'
                        : '$2000'}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((f) => {
                      const active = selectedFaces.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() => toggleFace(f)}
                          className={`h-8 rounded-lg font-extrabold text-xs border transition cursor-pointer ${
                            active
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      disabled={(me?.cash ?? 0) < 1000}
                      onClick={() => onPlayJackpot({ mode: 'DICE', faces: selectedFaces })}
                      className="py-2 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] disabled:opacity-40 text-white font-extrabold text-[11px] cursor-pointer"
                    >
                      🎲 Ставка $1000
                    </button>
                    <button
                      onClick={() => onPlayJackpot({ mode: 'ROULETTE' })}
                      className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      🔫 Рулетка +$1500
                    </button>
                    <button
                      onClick={() => onPlayJackpot({ skip: true })}
                      className="py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[11px] cursor-pointer"
                    >
                      Пас
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : showAuctionCard && roomState.auction ? (
          /* БЕЛАЯ КАРТОЧКА ПООЧЕРЁДНОГО АУКЦИОНА ПРЯМО ВВЕРХУ ДОСКИ БЕЗ РАЗМЫТИЯ ПОЛЯ */
          <div className="bg-white text-neutral-900 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-2xl animate-action-card space-y-1.5 sm:space-y-2">
            {(() => {
              const auc = roomState.auction!;
              const def = BOARD_CELLS[auc.cellId];
              const leader = auc.highestBidderId
                ? roomState.players.find((p) => p.id === auc.highestBidderId)
                : null;
              const currentBidder = auc.currentBidderId
                ? roomState.players.find((p) => p.id === auc.currentBidderId)
                : null;
              const secLeft = Math.max(0, Math.ceil((auc.endsAt - nowMs) / 1000));
              const canIBid =
                auc.currentBidderId === myPlayerId &&
                auc.activeParticipantIds.includes(myPlayerId) &&
                !auc.passedIds.includes(myPlayerId);
              const nextMinBid = auc.currentBid + 100;
              return (
                <>
                  <div className="flex items-center justify-between text-[11px] sm:text-xs gap-1">
                    <span className="font-extrabold text-amber-700 truncate">
                      🔨 {txt(def.name, def.cleanName, censored)}
                    </span>
                    <span className="font-extrabold text-rose-600 shrink-0">⏳ {secLeft}с</span>
                  </div>
                  <IndustryCardBanner
                    groupId={def.groupId}
                    cellType={def.type}
                    cellId={def.id}
                    censored={censored}
                    className="!h-[36px] sm:!h-[68px]"
                  />
                  <div className="flex items-center justify-between text-[11px] sm:text-xs bg-neutral-100 rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 gap-2">
                    <span className="shrink-0">
                      {leader ? (
                        <>
                          Ставка:{' '}
                          <b className="text-xs sm:text-sm text-neutral-900">
                            ${auc.currentBid}
                          </b>
                        </>
                      ) : (
                        <>
                          Мин. ставка:{' '}
                          <b className="text-xs sm:text-sm text-amber-700">${nextMinBid}</b>
                        </>
                      )}
                    </span>
                    <span className="text-neutral-600 font-semibold truncate">
                      {leader
                        ? `👑 ${leader.avatar} ${leader.name}`
                        : `Цена поля $${def.price ?? auc.currentBid}`}
                    </span>
                  </div>

                  {/* Очередь участников аукциона */}
                  <div className="flex flex-wrap items-center gap-1">
                    {auc.activeParticipantIds.map((pid) => {
                      const p = roomState.players.find((pl) => pl.id === pid);
                      if (!p) return null;
                      const isPassed = auc.passedIds.includes(pid);
                      const isTurn = auc.currentBidderId === pid;
                      const isLead = auc.highestBidderId === pid;
                      return (
                        <span
                          key={pid}
                          style={
                            isTurn
                              ? { borderColor: p.color, backgroundColor: `${p.color}20` }
                              : undefined
                          }
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold border ${
                            isPassed
                              ? 'bg-neutral-100 border-neutral-200 text-neutral-400 line-through opacity-60'
                              : isTurn
                              ? 'text-neutral-900 ring-1 ring-amber-400 shadow-xs'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <span>{isLead ? '👑' : isTurn ? '🎯' : p.avatar}</span>
                          <span className="max-w-[70px] truncate">{p.name}</span>
                        </span>
                      );
                    })}
                  </div>

                  {canIBid ? (
                    <div className="space-y-1">
                      <div className="text-[10px] font-extrabold text-emerald-700 text-center">
                        🎯 Ваша очередь на торгах! (от ${nextMinBid})
                      </div>
                      <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                        {[100, 300, 500].map((step) => (
                          <button
                            key={step}
                            disabled={(me?.cash ?? 0) < auc.currentBid + step}
                            onClick={() => onBidAuction(step)}
                            className="py-1 sm:py-1.5 rounded-lg bg-[#8fce00] hover:bg-[#7fb800] disabled:opacity-35 text-neutral-950 font-extrabold text-[10px] sm:text-xs cursor-pointer leading-tight"
                          >
                            <div>+${step}</div>
                            <div className="text-[8.5px] opacity-80">${auc.currentBid + step}</div>
                          </button>
                        ))}
                        <button
                          onClick={onPassAuction}
                          className="py-1 sm:py-1.5 rounded-lg bg-neutral-200 hover:bg-rose-600 text-neutral-800 hover:text-white font-bold text-[10px] sm:text-xs cursor-pointer"
                        >
                          Пас
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[10px] sm:text-[11px] font-semibold text-neutral-600 bg-neutral-100 rounded-lg py-1 px-2">
                      ⏳ Сейчас торгуется:{' '}
                      <b style={{ color: currentBidder?.color }} className="font-extrabold">
                        {currentBidder ? `${currentBidder.avatar} ${currentBidder.name}` : '...'}
                      </b>{' '}
                      ({secLeft}с)
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          /* КОМПАКТНАЯ БЕЛАЯ ПИЛЮЛЯ ВРЕМЕНИ, ТЕКУЩЕГО ХОДА И ПОДСКАЗКА ДЛЯ НОВИЧКОВ */
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
              <div className="bg-white text-neutral-900 rounded-full px-2.5 sm:px-3.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-1.5 sm:gap-2">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#8fce00]" />
                <span>{clockStr}</span>
                <span className="text-neutral-300">|</span>
                <span>{roomState.round} р.</span>
                {speedUnlock !== null && roomState.round >= speedUnlock && (
                  <span className="text-fuchsia-600 font-black">⚡3D</span>
                )}
                {antiStall.rentTaxPercent > 0 && (
                  <span className="text-rose-600 font-extrabold">-{antiStall.rentTaxPercent}%</span>
                )}
              </div>
              {curPlayer && roomState.status === 'PLAYING' && (
                <div className="bg-[#23252c]/95 border border-white/10 text-neutral-200 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold shadow flex items-center gap-1 sm:gap-1.5 max-w-[145px] sm:max-w-none">
                  <span className="hidden sm:inline">{isWalkingAfterRoll ? '👣 Шагает:' : 'Ходит:'}</span>
                  <span style={{ color: curPlayer.color }} className="font-extrabold truncate">
                    {curPlayer.avatar} {curPlayer.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-neutral-700 hover:text-neutral-950 shadow-lg flex items-center justify-center text-[10px] sm:text-xs cursor-pointer"
                title="Параметры комнаты"
              >
                ⚙️
              </button>
            </div>
            <div className="hidden sm:block text-[10px] text-neutral-500 text-center">
              💡 Кликните по любой карточке поля — аренда, филиалы и залог • По игроку — сделка
            </div>
          </div>
        )}

        {/* Выпадающая карточка быстрых настроек (Звук, Цензура, Инвайт-код) */}
        {settingsOpen && (
          <div className="mt-1.5 bg-white text-neutral-900 rounded-xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-action-card">
            <button
              onClick={copyRoomLink}
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-bold cursor-pointer"
            >
              {copiedCode ? '✅ Ссылка скопирована!' : `🔗 Комната #${roomState.code}`}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMuted(soundEngine.toggleMute())}
                className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-semibold cursor-pointer"
              >
                {muted ? '🔇 Звук выкл' : '🔊 Звук вкл'}
              </button>
              <button
                onClick={onOpenCredit}
                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
              >
                🏦 Кредит
              </button>
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-2 py-1 text-neutral-400 hover:text-neutral-900 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. КРУПНЫЕ ЦЕНТРАЛЬНЫЕ КУБИКИ ВО ВРЕМЯ БРОСКА (1:1 кадры 02, 05, 06) */}
      {showCenterDice && roomState.lastDice && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 z-25">
          <M1DieBox
            value={roomState.lastDice.die1}
            skin={diceRoller?.diceSkin ?? 'classic'}
            animKey={roomState.lastDice.timestamp}
          />
          <M1DieBox
            value={roomState.lastDice.die2}
            skin={diceRoller?.diceSkin ?? 'classic'}
            animKey={roomState.lastDice.timestamp + 1}
          />
          {roomState.lastDice.speedDie !== null &&
            roomState.lastDice.speedDie !== undefined && (
              <SpeedDieBox
                face={roomState.lastDice.speedDie}
                animKey={roomState.lastDice.timestamp}
              />
            )}
        </div>
      )}

      {/* 3. НИЖНЯЯ ЗОНА 9×9: ЕДИНАЯ ЛЕНТА СОБЫТИЙ И ЧАТА КАК В ВИДЕОРЕФЕРЕНСЕ */}
      <div className="flex-1 min-h-0 flex flex-col justify-end pt-1 sm:pt-2 z-10">
        {/* Компактные фильтры лога справа */}
        <div className="flex items-center justify-end gap-1 mb-0.5 sm:mb-1">
          {(
            [
              { id: 'ALL', label: 'Все' },
              { id: 'CHAT', label: 'Чат' },
              { id: 'DICE', label: 'Кубики' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setLogFilter(f.id)}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9.5px] sm:text-[10px] font-semibold transition cursor-pointer ${
                logFilter === f.id
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Скроллящийся лог с визуальными акцентами важных событий и быстрыми реакциями */}
        <div className="chat-scrollbar flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-1 text-[10.5px] sm:text-[13px] xl:text-[13.5px] leading-snug sm:leading-relaxed">
          {filteredLogs.slice(-60).map((entry) => {
            const rawText = txt(entry.text, entry.cleanText, censored);
            const matchedPlayer =
              (entry.playerName &&
                roomState.players.find((p) => p.name === entry.playerName)) ||
              roomState.players.find((p) => rawText.startsWith(p.name));

            const isImportant =
              entry.type === 'RENT' ||
              entry.type === 'CHANCE' ||
              entry.type === 'TRADE' ||
              entry.type === 'AUCTION' ||
              entry.type === 'BANKRUPT' ||
              entry.type === 'CHAT' ||
              entry.type === 'TAUNT' ||
              /обезьянник|тюрьм|дубл/i.test(rawText);

            const accentClass =
              entry.type === 'RENT'
                ? 'border-l-2 border-l-rose-400 bg-rose-500/8 pl-2 py-1 rounded-r-lg'
                : entry.type === 'TRADE'
                ? 'border-l-2 border-l-indigo-400 bg-indigo-500/12 pl-2 py-1 rounded-r-lg'
                : entry.type === 'AUCTION'
                ? 'border-l-2 border-l-amber-400 bg-amber-500/10 pl-2 py-1 rounded-r-lg'
                : entry.type === 'CHANCE'
                ? 'border-l-2 border-l-amber-400 bg-amber-500/8 pl-2 py-1 rounded-r-lg'
                : entry.type === 'BANKRUPT'
                ? 'border-l-2 border-l-red-500 bg-red-500/12 pl-2 py-1 rounded-r-lg'
                : entry.type === 'CHAT' || entry.type === 'TAUNT'
                ? 'border-l-2 border-l-lime-400 bg-white/[0.04] pl-2 py-1 rounded-r-lg'
                : isImportant
                ? 'border-l-2 border-l-sky-400 bg-sky-500/8 pl-2 py-1 rounded-r-lg'
                : 'px-1 py-0.5';

            const activeReactions = entry.reactions
              ? Object.entries(entry.reactions).filter(([, cnt]) => cnt > 0)
              : [];

            return (
              <div key={entry.id} className={`group relative ${accentClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 text-neutral-200">
                    {(entry.type === 'CHAT' || entry.type === 'TAUNT') && (
                      <span
                        style={{ color: entry.playerColor || matchedPlayer?.color || '#a3e635' }}
                        className="font-extrabold mr-1.5"
                      >
                        {entry.playerName || matchedPlayer?.name || 'Игрок'}:
                      </span>
                    )}
                    <span
                      className={
                        entry.type === 'TAUNT'
                          ? 'text-amber-300 font-bold'
                          : entry.type === 'CHAT'
                          ? 'text-white'
                          : 'text-neutral-100 font-medium'
                      }
                    >
                      {renderColoredLogText(rawText, roomState.players)}
                    </span>
                  </div>

                  {/* Быстрые реакции на событие при наведении */}
                  <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-[#141519]/90 border border-white/10 rounded-full px-1 py-0.5">
                    {(['🤡', '💀', '🔥', '💸'] as const).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => onReactLog(entry.id, em)}
                        className="hover:scale-125 transition text-[11px] leading-none px-0.5 cursor-pointer"
                        title={`Реакция ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {activeReactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activeReactions.map(([em, cnt]) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => onReactLog(entry.id, em)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-bold text-neutral-200 cursor-pointer"
                      >
                        <span>{em}</span>
                        <span>{cnt}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={logBottomRef} />
        </div>

        {/* Строка ввода «Сообщение в чат» прямо внизу центральной арены */}
        <form onSubmit={handleChatSubmit} className="mt-1 sm:mt-2 shrink-0 flex gap-1 sm:gap-1.5">
          <input
            type="text"
            maxLength={240}
            placeholder="Чат..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            className="flex-1 min-w-0 bg-[#111216] border border-[#2a2c34] focus:border-neutral-500 outline-none rounded-lg px-2 py-1 sm:px-3 sm:py-2 text-[11px] sm:text-xs text-neutral-100 placeholder-neutral-500"
          />
          {chatDraft.trim().length > 0 && (
            <button
              type="submit"
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#8fce00] hover:bg-[#7fb800] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              ➤
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
