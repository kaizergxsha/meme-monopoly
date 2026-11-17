import confetti from 'canvas-confetti';
import React, { useEffect, useRef, useState } from 'react';
import { BOARD_CELLS, INDUSTRIES } from '../../shared/boardData.ts';
import { JACKPOT_QUOTES } from '../../shared/memeContent.ts';
import {
  checkTradeFairness,
  formatMoney,
  getAntiStallStatus,
  getSpeedDieUnlockRound,
  getTokenWalkDurationMs,
  txt,
} from '../../shared/rules.ts';
import { DiceSkin, PlayerState, RoomState, SpeedDieFace, TradeSide } from '../../shared/types.ts';
import { emitAckChance } from '../hooks/useGameSocket.ts';
import { useCockpitMode } from '../hooks/useCockpitMode.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { AppleEmoji, renderAppleEmojis } from './AppleEmoji.tsx';
import { IndustryCardBanner } from './CardIllustration.tsx';
import { CellArtwork } from './CellArtwork.tsx';
import { InlineSpeedDieChip, MiniStyledDie } from './DiceSkinPreview.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

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
  onRespondTrade: (accept: boolean) => void;
  onCastKickVote: (approve: boolean) => void;
}

import {
  DiceDualIcon,
  formatClock,
  M1DieBox,
  renderColoredLogText,
  SpeedDieBox,
  TradePropertyIconTile,
} from './center/CenterDiceAndLogHelpers.tsx';

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
  onRespondTrade,
  onCastKickVote,
}) => {
  const { isCockpit, isCompactHeight } = useCockpitMode();
  const [chatDraft, setChatDraft] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'CHAT' | 'DICE' | 'TRADE'>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<number[]>([6]);
  const [selectedChambers, setSelectedChambers] = useState<number[]>([1]);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * JACKPOT_QUOTES.length));
  const logBottomRef = useRef<HTMLDivElement | null>(null);
  const lastAucTickSecRef = useRef<number | null>(null);
  const prevJackpotRef = useRef<RoomState['lastJackpotResult']>(null);

  // Тиканье аукциона в последние 3 секунды
  useEffect(() => {
    if (roomState.phase !== 'AUCTION' || !roomState.auction) {
      lastAucTickSecRef.current = null;
      return;
    }
    const secLeft = Math.max(0, Math.ceil((roomState.auction.endsAt - nowMs) / 1000));
    if (secLeft >= 1 && secLeft <= 3 && lastAucTickSecRef.current !== secLeft) {
      lastAucTickSecRef.current = secLeft;
      soundEngine.playTick();
    }
  }, [roomState.phase, roomState.auction, nowMs]);

  // Конфетти при выигрыше в Додепе / Рулетке
  useEffect(() => {
    const res = roomState.lastJackpotResult;
    if (res && res !== prevJackpotRef.current && res.won) {
      prevJackpotRef.current = res;
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.55 },
      });
    } else if (!res) {
      prevJackpotRef.current = null;
    }
  }, [roomState.lastJackpotResult]);

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
    if (logFilter === 'TRADE') return l.type === 'TRADE';
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
      roomState.phase !== 'CHOOSE_SPEED_TARGET' &&
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

  const isBlockingCenterCardOpen =
    Boolean(roomState.activeKickVote) ||
    (!tradeDraft.open && Boolean(roomState.activeTrade)) ||
    Boolean(tradeDraft.open && me) ||
    showAuctionCard ||
    (showMyTurnActionCard && roomState.phase !== 'PRE_ROLL');

  const expandCenterCard = isBlockingCenterCardOpen && (!isCockpit || isCompactHeight || tradeDraft.open);

  // Крупные кубики всплывают по центру во время шагов фишки и скрываются сразу при открытии карточки выбора, чтобы не перекрывать кнопки
  const showCenterDice =
    !!roomState.lastDice &&
    !isBlockingCenterCardOpen &&
    (isWalkingAfterRoll || nowMs - roomState.lastDice.timestamp < 1750);

  return (
    <div
      id="center-stage-arena"
      style={{ gridRow: '2 / span 9', gridColumn: '2 / span 9' }}
      className="min-w-0 min-h-0 bg-gradient-to-b from-[#11141D] via-[#0D1017] to-[#090B10] border border-white/[0.07] rounded-[8px] sm:rounded-[12px] m-[1px] sm:m-[2px] p-1 sm:p-2 md:p-3 flex flex-col justify-between overflow-hidden relative shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_48px_rgba(0,0,0,0.72)]"
    >
      {/* Тонкий верхний хайроллер-блик центрального терминала */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(229,184,105,0.07)_0%,transparent_72%)] z-0"
      />

      {/* 1. ВЕРХНЯЯ ЗОНА: Плашка голосования за кик + Оникс-карточка активного действия / Смарт-контракта ИЛИ компактная пилюля времени */}
      <div
        className={`relative z-20 shrink-0 ${
          expandCenterCard ? 'max-h-full flex-1' : 'max-h-[75%]'
        } overflow-y-auto chat-scrollbar space-y-1.5`}
      >
        {roomState.activeKickVote && (() => {
          const kv = roomState.activeKickVote!;
          const target = roomState.players.find((p) => p.id === kv.targetId);
          const initiator = roomState.players.find((p) => p.id === kv.initiatorId);
          const totalEligible = kv.eligibleVoterIds.length;
          const neededYes = Math.floor(totalEligible / 2) + 1;
          const yesCount = kv.eligibleVoterIds.filter((id) => kv.votes[id] === true).length;
          const noCount = kv.eligibleVoterIds.filter((id) => kv.votes[id] === false).length;
          const secLeft = Math.max(0, Math.ceil((kv.expiresAt - nowMs) / 1000));
          const isTarget = myPlayerId === kv.targetId;
          const isEligible = kv.eligibleVoterIds.includes(myPlayerId);
          const myVote = kv.votes[myPlayerId];

          return (
            <div
              data-testid="kick-vote-banner"
              className="rounded-xl bg-[#16121C] border border-[#F43F5E]/55 px-2.5 py-2 shadow-xl text-neutral-100 space-y-1.5 animate-action-card"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                <div className="flex items-center gap-1.5 min-w-0 font-extrabold text-rose-200">
                  <span>🗳️</span>
                  <span className="truncate flex items-center gap-1">
                    <span>Кик</span>
                    {target && <PlayerAvatar avatar={target.avatar} />}
                    <span>{target?.name}</span>
                  </span>
                  <span className="text-[10px] font-normal text-neutral-400 hidden sm:inline">
                    (инициатор {initiator?.name})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-num">
                    За {yesCount}/{neededYes}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono-num">
                    Против {noCount}
                  </span>
                  <span className="text-[#E5B869] font-mono-num">{secLeft}с</span>
                </div>
              </div>

              {isTarget ? (
                <div
                  data-testid="kick-vote-excluded"
                  className="text-[10.5px] font-bold text-[#E5B869] bg-[#E5B869]/12 border border-[#E5B869]/35 rounded-lg px-2 py-1 text-center"
                >
                  🚫 Против вас идёт голосование — вы не голосуете
                </div>
              ) : !isEligible ? (
                <div className="text-[10px] text-neutral-400 text-center">
                  Вы не участвуете в голосовании
                </div>
              ) : myVote !== undefined ? (
                <div className="text-[10.5px] font-bold text-center text-neutral-300 bg-white/5 rounded-lg py-1">
                  Ваш голос учтён: {myVote ? '👍 За кик' : '👎 Против'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="kick-vote-yes"
                    onClick={() => onCastKickVote(true)}
                    className="py-1 rounded-lg bg-[#F43F5E] hover:bg-rose-500 text-white font-extrabold text-[11px] cursor-pointer transition"
                  >
                    👍 За кик
                  </button>
                  <button
                    type="button"
                    data-testid="kick-vote-no"
                    onClick={() => onCastKickVote(false)}
                    className="py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 font-bold text-[11px] cursor-pointer transition"
                  >
                    👎 Против
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {!tradeDraft.open && roomState.activeTrade ? (
          /* АКТИВНЫЙ СМАРТ-КОНТРАКТ ВНУТРИ 9×9 БЕЗ ЗАМЫЛИВАНИЯ ДОСКИ СЗАДИ */
          <div
            data-testid="active-trade-card"
            className="glass-panel !border-[#E5B869]/45 text-neutral-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-2xl animate-action-card space-y-2"
          >
            {(() => {
              const tr = roomState.activeTrade!;
              const sender = roomState.players.find((p) => p.id === tr.fromPlayerId);
              const receiver = roomState.players.find((p) => p.id === tr.toPlayerId);
              const isRecipient = tr.toPlayerId === myPlayerId;
              const isSender = tr.fromPlayerId === myPlayerId;
              const fairness = checkTradeFairness(roomState.cells, tr.offer, tr.request);
              const secLeft = Math.max(0, Math.ceil((tr.expiresAt - nowMs) / 1000));

              const leftSide = isRecipient ? tr.request : tr.offer;
              const rightSide = isRecipient ? tr.offer : tr.request;
              const leftTitle = isRecipient
                ? '📤 Вы отдаёте'
                : isSender
                ? '📤 Вы отдаёте'
                : `📤 ${sender?.name} отдаёт`;
              const rightTitle = isRecipient
                ? '📥 Вы получаете'
                : isSender
                ? `📥 От ${receiver?.name}`
                : `📥 ${sender?.name} получает`;

              const renderSummaryBadges = (side: TradeSide, tone: 'give' | 'get') => {
                const empty =
                  side.cash === 0 && side.shields === 0 && side.propertyIds.length === 0;
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {side.propertyIds.map((cid) => (
                      <TradePropertyIconTile
                        key={cid}
                        cellId={cid}
                        censored={censored}
                        fallbackHex={tone === 'give' ? '#F43F5E' : '#10B981'}
                      />
                    ))}
                    {side.cash > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono-num inline-flex items-center gap-1 ${
                          tone === 'give'
                            ? 'bg-[#F43F5E]/20 border border-[#F43F5E]/35 text-rose-200'
                            : 'bg-[#10B981]/20 border border-[#10B981]/35 text-emerald-200'
                        }`}
                      >
                        <AppleEmoji emoji="💵" />
                        <span>{formatMoney(side.cash)}</span>
                      </span>
                    )}
                    {side.shields > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-200 text-[10px] font-extrabold font-mono-num inline-flex items-center gap-1">
                        <AppleEmoji emoji="🛡️" />
                        <span>×{side.shields}</span>
                      </span>
                    )}
                    {empty && (
                      <span className="text-[10px] text-neutral-500 italic">ничего</span>
                    )}
                  </div>
                );
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 text-xs font-display font-bold text-[#F8FAFC]">
                      <span className="text-[#E5B869]">🤝</span>
                      <span className="truncate flex items-center gap-1">
                        {isRecipient ? (
                          <>
                            <span>Смарт-контракт от</span>
                            {sender && <PlayerAvatar avatar={sender.avatar} />}
                            <span style={{ color: sender?.color }}>{sender?.name}</span>
                          </>
                        ) : (
                          `Договор ${sender?.name} ⇄ ${receiver?.name}`
                        )}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#E5B869]/15 border border-[#E5B869]/40 text-[#F3D082] text-[10px] font-mono-num font-bold shrink-0">
                      ⏱ {secLeft}с
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[11px]">
                    <div className="rounded-xl bg-[#0B0D14]/90 border border-[#F43F5E]/35 p-2 space-y-1.5">
                      <div className="text-[10px] font-bold text-[#FDA4AF] flex justify-between items-center">
                        <span>{leftTitle}</span>
                        <span className="font-mono-num font-bold text-[#F8FAFC]">
                          {formatMoney(isRecipient ? fairness.requestValue : fairness.offerValue)}
                        </span>
                      </div>
                      {renderSummaryBadges(leftSide, 'give')}
                    </div>
                    <div className="rounded-xl bg-[#0B0D14]/90 border border-[#10B981]/35 p-2 space-y-1.5">
                      <div className="text-[10px] font-bold text-[#6EE7B7] flex justify-between items-center">
                        <span>{rightTitle}</span>
                        <span className="font-mono-num font-bold text-[#F8FAFC]">
                          {formatMoney(isRecipient ? fairness.offerValue : fairness.requestValue)}
                        </span>
                      </div>
                      {renderSummaryBadges(rightSide, 'get')}
                    </div>
                  </div>

                  {isRecipient ? (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        data-testid="trade-accept-btn"
                        onClick={() => onRespondTrade(true)}
                        className="btn-emerald-3d active:translate-y-1 py-1.5 sm:py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs cursor-pointer"
                      >
                        ✅ Принять сделку
                      </button>
                      <button
                        type="button"
                        data-testid="trade-decline-btn"
                        onClick={() => onRespondTrade(false)}
                        className="py-1.5 sm:py-2 rounded-xl bg-[#1A1319] hover:bg-[#F43F5E] border border-[#F43F5E]/45 text-rose-200 hover:text-white font-bold text-xs cursor-pointer transition"
                      >
                        ❌ Отклонить
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-[10.5px] text-neutral-300 font-semibold flex items-center justify-center gap-1">
                      <span>⏳ Ожидаем подписи</span>
                      {receiver && <PlayerAvatar avatar={receiver.avatar} />}
                      <span style={{ color: receiver?.color }} className="font-bold">
                        {receiver?.name}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : tradeDraft.open && me ? (
          /* «СХОДКА / СМАРТ-КОНТРАКТ ТЕМЩИКОВ» — ДВЕ КОЛОНКИ СТОРОН + ПОКЕРНЫЕ ТОКЕНЫ */
          <div className="glass-panel !border-[#E5B869]/30 text-neutral-100 rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-2xl animate-action-card space-y-2">
            {/* Шапка смарт-контракта */}
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs border-b border-white/[0.08] pb-1.5">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 font-mono-num text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] inline-block" />
                <span>{clockStr}</span>
                <span className="text-white/20">•</span>
                <span>Р.{roomState.round}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[#E5B869]/14 border border-[#E5B869]/35 text-[#E5B869] text-[9px] font-mono-num font-bold uppercase tracking-wider">
                  Сходка
                </span>
                <span
                  data-testid="trade-draft-header"
                  className="font-display font-bold text-[11.5px] sm:text-[13px] text-[#F8FAFC]"
                >
                  Договор ({Math.max(0, 3 - (roomState.tradesProposedThisTurn ?? 0))}/3 за ход)
                </span>
              </div>
              <button
                onClick={() => onChangeTradeDraft((p) => ({ ...p, open: false }))}
                className="w-6 h-6 rounded-full bg-white/[0.05] hover:bg-[#F43F5E]/25 border border-white/10 hover:border-[#F43F5E]/50 text-neutral-400 hover:text-white font-bold text-xs flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Переключатель стороны контрагента */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10.5px] sm:text-[11px]">
              <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[9.5px]">
                Контрагент сделки:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {otherAlivePlayers.map((op) => {
                  const selected = tradeDraft.partnerId === op.id;
                  return (
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
                      style={
                        selected
                          ? {
                              borderColor: op.color,
                              boxShadow: `0 0 14px ${op.color}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
                            }
                          : undefined
                      }
                      className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1 border ${
                        selected
                          ? 'bg-[#181C28] text-white'
                          : 'bg-[#0C0E14] text-neutral-300 border-white/10 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <PlayerAvatar avatar={op.avatar} />
                      <span>{op.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {partner && (
              <>
                {/* Двухколоночный стол переговоров: СЛЕВА ВЫ | ПО ЦЕНТРУ ТОКЕНЫ КОЭФФИЦИЕНТОВ | СПРАВА ПАРТНЁР */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 sm:gap-2">
                  {/* ЛЕВАЯ КОЛОНКА: ВЫ ПРЕДЛАГАЕТЕ */}
                  <div
                    style={{
                      borderColor: `${me.color}55`,
                      boxShadow: `inset 3px 0 0 ${me.color}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                    }}
                    className="rounded-xl bg-[#0B0D14]/90 border p-2 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-white/[0.06] pb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          style={{ borderColor: me.color, boxShadow: `0 0 8px ${me.color}66` }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center overflow-hidden shrink-0"
                        >
                          <PlayerAvatar avatar={me.avatar} fill />
                        </span>
                        <span className="font-bold text-[11px] text-[#F1F5F9] truncate">
                          Вы предлагаете
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-[10.5px] text-[#E5B869] shrink-0">
                        {formatMoney(tradeFairness.offerValue)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] text-neutral-400">
                        <span>Кэш в сделку</span>
                        <span className="font-mono-num text-neutral-500">
                          макс. {formatMoney(me.cash)}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono-num font-bold text-[#E5B869]">
                          $
                        </span>
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
                          className="w-full bg-[#07090E] border border-white/12 focus:border-[#E5B869]/65 outline-none rounded-lg pl-5 pr-2 py-1 text-xs font-mono-num font-bold text-[#F8FAFC] transition"
                        />
                      </div>
                      {/* Покерные фишки быстрых сумм */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {[100, 500, 1000].map((add) => (
                          <button
                            key={add}
                            type="button"
                            onClick={() =>
                              onChangeTradeDraft((p) => ({
                                ...p,
                                offerCash: Math.min(me.cash, p.offerCash + add),
                              }))
                            }
                            className="poker-chip-btn flex-1 py-0.5 px-1 rounded-full font-mono-num text-[9.5px] font-bold text-[#6EE7B7] cursor-pointer"
                          >
                            +{add}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onChangeTradeDraft((p) => ({ ...p, offerCash: 0 }))}
                          className="poker-chip-btn py-0.5 px-2 rounded-full font-mono-num text-[9.5px] font-bold text-neutral-300 hover:!border-[#F43F5E]/70 hover:text-rose-200 cursor-pointer"
                        >
                          0
                        </button>
                      </div>
                    </div>

                    {/* Зона активов с золотисто-графитовым пунктиром и иконками карточек */}
                    <div className="rounded-lg border border-dashed border-[#E5B869]/38 bg-[#07090D]/80 p-1.5 min-h-[54px] flex flex-wrap content-start gap-1.5">
                      {tradeDraft.offerProps.length === 0 ? (
                        <span className="text-neutral-500 text-[9.5px] leading-tight m-auto text-center">
                          Кликните по своим полям на доске
                        </span>
                      ) : (
                        tradeDraft.offerProps.map((cid) => (
                          <TradePropertyIconTile
                            key={cid}
                            cellId={cid}
                            censored={censored}
                            fallbackHex={me.color}
                            onRemove={() =>
                              onChangeTradeDraft((p) => ({
                                ...p,
                                offerProps: p.offerProps.filter((id) => id !== cid),
                              }))
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* ЦЕНТРАЛЬНЫЕ ПОКЕРНЫЕ ТОКЕНЫ КОЭФФИЦИЕНТОВ: ÷2 | 1:1 | ×2 */}
                  <div className="flex sm:flex-col items-center justify-center gap-1 py-0.5">
                    <button
                      type="button"
                      title="Предложить половину стоимости активов партнёра (÷2)"
                      onClick={() => {
                        const ownPropsVal = tradeFairness.offerValue - tradeDraft.offerCash;
                        const partnerPropsVal = tradeFairness.requestValue - tradeDraft.reqCash;
                        if (partnerPropsVal > 0) {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            offerCash: Math.min(
                              me.cash,
                              Math.max(0, Math.round(partnerPropsVal / 2) - ownPropsVal)
                            ),
                            reqCash: 0,
                          }));
                        } else {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            reqCash: Math.min(partner.cash, Math.max(0, Math.round(ownPropsVal / 2))),
                            offerCash: 0,
                          }));
                        }
                      }}
                      className="poker-chip-btn w-9 h-7 sm:h-8 rounded-full font-mono-num text-[10px] font-bold text-neutral-200 flex items-center justify-center cursor-pointer"
                    >
                      ÷2
                    </button>
                    <button
                      type="button"
                      title="Выровнять оценку сделки 1 к 1"
                      onClick={() => {
                        const ownPropsVal = tradeFairness.offerValue - tradeDraft.offerCash;
                        const partnerPropsVal = tradeFairness.requestValue - tradeDraft.reqCash;
                        const diff = partnerPropsVal - ownPropsVal;
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
                      className="poker-chip-btn !border-[#E5B869]/75 w-9 h-7 sm:h-8 rounded-full font-mono-num text-[10px] font-extrabold text-[#F3D082] flex items-center justify-center cursor-pointer"
                    >
                      1:1
                    </button>
                    <button
                      type="button"
                      title="Удвоить оценку актива (×2)"
                      onClick={() => {
                        const ownPropsVal = tradeFairness.offerValue - tradeDraft.offerCash;
                        const partnerPropsVal = tradeFairness.requestValue - tradeDraft.reqCash;
                        if (partnerPropsVal > 0) {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            offerCash: Math.min(
                              me.cash,
                              Math.max(0, partnerPropsVal * 2 - ownPropsVal)
                            ),
                            reqCash: 0,
                          }));
                        } else {
                          onChangeTradeDraft((p) => ({
                            ...p,
                            reqCash: Math.min(partner.cash, Math.max(0, ownPropsVal * 2)),
                            offerCash: 0,
                          }));
                        }
                      }}
                      className="poker-chip-btn w-9 h-7 sm:h-8 rounded-full font-mono-num text-[10px] font-bold text-neutral-200 flex items-center justify-center cursor-pointer"
                    >
                      ×2
                    </button>
                  </div>

                  {/* ПРАВАЯ КОЛОНКА: ВЫБРАННЫЙ ИГРОК */}
                  <div
                    style={{
                      borderColor: `${partner.color}55`,
                      boxShadow: `inset -3px 0 0 ${partner.color}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                    }}
                    className="rounded-xl bg-[#0B0D14]/90 border p-2 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1 border-b border-white/[0.06] pb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          style={{
                            borderColor: partner.color,
                            boxShadow: `0 0 8px ${partner.color}66`,
                          }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center overflow-hidden shrink-0"
                        >
                          <PlayerAvatar avatar={partner.avatar} fill />
                        </span>
                        <span
                          style={{ color: partner.color }}
                          className="font-extrabold text-[11px] truncate"
                        >
                          {partner.name}
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-[10.5px] text-[#E5B869] shrink-0">
                        {formatMoney(tradeFairness.requestValue)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] text-neutral-400">
                        <span>Запросить кэш</span>
                        <span className="font-mono-num text-neutral-500">
                          макс. {formatMoney(partner.cash)}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono-num font-bold text-[#E5B869]">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={partner.cash}
                          step={100}
                          value={tradeDraft.reqCash}
                          onChange={(e) =>
                            onChangeTradeDraft((p) => ({
                              ...p,
                              reqCash: Math.max(
                                0,
                                Math.min(partner.cash, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          className="w-full bg-[#07090E] border border-white/12 focus:border-[#E5B869]/65 outline-none rounded-lg pl-5 pr-2 py-1 text-xs font-mono-num font-bold text-[#F8FAFC] text-right transition"
                        />
                      </div>
                      {/* Покерные фишки быстрых сумм партнёра */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {[100, 500, 1000].map((add) => (
                          <button
                            key={add}
                            type="button"
                            onClick={() =>
                              onChangeTradeDraft((p) => ({
                                ...p,
                                reqCash: Math.min(partner.cash, p.reqCash + add),
                              }))
                            }
                            className="poker-chip-btn flex-1 py-0.5 px-1 rounded-full font-mono-num text-[9.5px] font-bold text-[#F3D082] cursor-pointer"
                          >
                            +{add}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onChangeTradeDraft((p) => ({ ...p, reqCash: 0 }))}
                          className="poker-chip-btn py-0.5 px-2 rounded-full font-mono-num text-[9.5px] font-bold text-neutral-300 hover:!border-[#F43F5E]/70 hover:text-rose-200 cursor-pointer"
                        >
                          0
                        </button>
                      </div>
                    </div>

                    {/* Зона активов партнёра с золотисто-графитовым пунктиром и иконками карточек */}
                    <div className="rounded-lg border border-dashed border-white/20 hover:border-[#E5B869]/40 bg-[#07090D]/80 p-1.5 min-h-[54px] flex flex-wrap content-start gap-1.5 transition-colors">
                      {tradeDraft.reqProps.length === 0 ? (
                        <span className="text-neutral-500 text-[9.5px] leading-tight m-auto text-center">
                          Кликните по полям партнёра на доске
                        </span>
                      ) : (
                        tradeDraft.reqProps.map((cid) => (
                          <TradePropertyIconTile
                            key={cid}
                            cellId={cid}
                            censored={censored}
                            fallbackHex={partner.color}
                            onRemove={() =>
                              onChangeTradeDraft((p) => ({
                                ...p,
                                reqProps: p.reqProps.filter((id) => id !== cid),
                              }))
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {roomState.settings.fairTradeLimit &&
                  !tradeFairness.fair &&
                  (tradeFairness.offerValue > 0 || tradeFairness.requestValue > 0) && (
                    <div className="text-[10px] text-[#FDA4AF] bg-[#F43F5E]/12 border border-[#F43F5E]/30 rounded-lg py-1 px-2 font-semibold text-center">
                      ⚠️ Разница оценки больше ±50% (анти-абуз фильтр смарт-контракта)
                    </div>
                  )}

                <div className="sticky bottom-0 bg-[#11141D]/95 backdrop-blur-md flex items-center justify-center gap-2 pt-1.5 pb-0.5 z-10 border-t border-white/[0.06]">
                  <button
                    disabled={
                      (roomState.tradesProposedThisTurn ?? 0) >= 3 ||
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
                    className="btn-emerald-3d active:translate-y-1 px-5 py-1.5 rounded-xl font-display font-bold text-[11px] sm:text-xs cursor-pointer"
                  >
                    Отправить
                  </button>
                  <button
                    onClick={() => onChangeTradeDraft((p) => ({ ...p, open: false }))}
                    className="px-4 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white font-semibold text-xs transition cursor-pointer"
                  >
                    Отменить
                  </button>
                </div>
              </>
            )}
          </div>
        ) : showMyTurnActionCard && curPlayer ? (
          /* ФРЕЗЕРОВАННАЯ ПАНЕЛЬ АКТИВНОГО ХОДА И ПОКУПКИ В ЭСТЕТИКЕ DARK LUXURY TERMINAL */
          <div
            style={{
              borderColor: 'rgba(255,255,255,0.09)',
              boxShadow: `0 24px 58px rgba(0,0,0,0.82), 0 0 28px ${curPlayer.color}24, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 2px 0 ${curPlayer.color}`,
            }}
            className="bg-gradient-to-b from-[#161923]/96 to-[#0E1017]/96 backdrop-blur-2xl text-neutral-100 rounded-xl sm:rounded-2xl border p-1.5 sm:p-2.5 animate-action-card space-y-1.5 sm:space-y-2"
          >
            <div className="flex items-center justify-between gap-1 sm:gap-2 text-[10px] sm:text-xs">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 font-mono-num text-[11px]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] inline-block" />
                <span>{clockStr}</span>
                <span className="text-white/20">|</span>
                <span>Р.{roomState.round}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <span
                  style={{
                    borderColor: curPlayer.color,
                    backgroundColor: `${curPlayer.color}2b`,
                    boxShadow: `0 0 12px ${curPlayer.color}66`,
                  }}
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center text-[10px] sm:text-[11px] shrink-0 overflow-hidden"
                >
                  <PlayerAvatar avatar={curPlayer.avatar} fill />
                </span>
                <span className="font-display font-extrabold text-[10.5px] sm:text-[13px] text-[#F8FAFC] truncate leading-tight">
                  {roomState.phase === 'PRE_ROLL'
                    ? 'Ваш ход!'
                    : roomState.phase === 'BUY_DECISION'
                    ? 'Покупаем?'
                    : roomState.phase === 'CHANCE'
                    ? 'Карточка Шанс!'
                    : roomState.phase === 'PORTAL'
                    ? txt('Ебаный квантовый телепорт', 'Квантовый телепорт', censored)
                    : roomState.phase === 'JACKPOT'
                    ? roomState.settings.russianRoulette
                      ? 'Русская рулетка'
                      : 'Казино 777'
                    : roomState.phase === 'CHOOSE_SPEED_TARGET'
                    ? 'Выбор клетки!'
                    : 'Погашение долга!'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#E5B869]/14 border border-[#E5B869]/40 text-[#F3D082] font-mono-num text-[11px] font-bold shrink-0 shadow-[0_0_12px_rgba(229,184,105,0.18)]">
                  {formatMoney(curPlayer.cash)}
                </span>
              </div>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs cursor-pointer transition shrink-0 border ${
                  settingsOpen
                    ? 'bg-[#10B981]/20 border-[#10B981]/60 text-emerald-200'
                    : 'bg-white/[0.04] border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
                title="Параметры комнаты и звук"
              >
                ⚙️
              </button>
            </div>

            {/* Мини-панель активных эффектов/дебаффов игрока */}
            {(curPlayer.inJail ||
              (roomState.extraTurnsLeft ?? 0) > 0 ||
              (curPlayer.reverseTurns ?? 0) > 0 ||
              curPlayer.shields > 0 ||
              curPlayer.credit ||
              (speedUnlock !== null && roomState.round >= speedUnlock)) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold">
                {(roomState.extraTurnsLeft ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#10B981]/18 border border-[#10B981]/45 text-[#6EE7B7] font-mono-num inline-flex items-center gap-1">
                    <AppleEmoji emoji="🎲" />
                    <span>Ещё ходов: +{roomState.extraTurnsLeft}</span>
                  </span>
                )}
                {curPlayer.inJail && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F43F5E]/18 border border-[#F43F5E]/40 text-rose-200 font-mono-num inline-flex items-center gap-1">
                    <AppleEmoji emoji="🪖" />
                    <span>В Учебке ({curPlayer.jailTurns}/3)</span>
                  </span>
                )}
                {(curPlayer.reverseTurns ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 font-mono-num">
                    ⏪ Задний ход ×{curPlayer.reverseTurns}
                  </span>
                )}
                {curPlayer.shields > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/18 border border-sky-400/40 text-sky-200 font-mono-num">
                    🛡️ Скам-иммунитет ×{curPlayer.shields}
                  </span>
                )}
                {curPlayer.credit && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E5B869]/16 border border-[#E5B869]/40 text-[#F3D082] font-mono-num">
                    🏦 Кредит до {curPlayer.credit.dueRound}р
                  </span>
                )}
                {speedUnlock !== null && roomState.round >= speedUnlock && (
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/18 border border-fuchsia-400/40 text-fuchsia-200">
                    ⚡ 3D-кубик активен
                  </span>
                )}
              </div>
            )}

            {roomState.phase === 'PRE_ROLL' && (
              <div className="show-in-cockpit-block space-y-1.5">
                <button
                  onClick={onRoll}
                  className="btn-emerald-3d active:translate-y-1 w-full py-2 sm:py-2.5 px-4 rounded-xl font-display font-extrabold text-[11px] sm:text-xs md:text-[13.5px] tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DiceDualIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>
                    {(curPlayer.reverseTurns ?? 0) > 0
                      ? '⏪ БРОСИТЬ ЗАДОМ НАПЕРЁД'
                      : 'БРОСИТЬ КУБИКИ'}
                  </span>
                </button>
                <div className="hidden sm:block text-[10.5px] text-neutral-400 text-center">
                  Кликните на любую карточку поля, чтобы построить филиал или заложить актив
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {me?.inJail && me.cash >= 500 && (
                    <button
                      onClick={onPayJail}
                      className="flex-1 py-1 sm:py-1.5 rounded-lg bg-[#162032] hover:bg-sky-600 border border-sky-400/40 text-sky-100 hover:text-white font-bold text-[10px] sm:text-xs cursor-pointer transition inline-flex items-center justify-center gap-1"
                    >
                      <AppleEmoji emoji="📋" />
                      <span>
                        Справка ВЛК (<span className="font-mono-num">$500</span>)
                      </span>
                    </button>
                  )}
                  {roomState.settings.mode === 'duel_restart' && roomState.round <= 20 && (
                    <button
                      onClick={onDuelRestart}
                      className="flex-1 py-1 sm:py-1.5 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/35 border border-fuchsia-400/40 text-fuchsia-200 font-bold text-[10px] sm:text-xs cursor-pointer transition"
                    >
                      🔄 Рестарт (<span className="font-mono-num">${roomState.round <= 10 ? '1000' : '2000'}</span>)
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
                  className="!h-[64px] sm:!h-[86px]"
                />
                <div className="space-y-1">
                  <div className="text-[11px] sm:text-xs text-neutral-300 leading-snug">
                    Вы попали на{' '}
                    <b className="text-[#F8FAFC] font-bold">
                      «
                      {txt(
                        BOARD_CELLS[curPlayer.position].name,
                        BOARD_CELLS[curPlayer.position].cleanName,
                        censored
                      )}
                      »
                    </b>
                    <span className="hidden sm:inline text-neutral-400">
                      {' '}— выкуп актива в портфель или открытые торги.
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded-lg bg-[#0A0C12]/85 border border-white/[0.06] border-l-2 border-l-[#E5B869] px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[10.5px] text-neutral-300 italic leading-snug">
                    «
                    {txt(
                      BOARD_CELLS[curPlayer.position].description ||
                        BOARD_CELLS[curPlayer.position].subtitle,
                      BOARD_CELLS[curPlayer.position].cleanDescription ||
                        BOARD_CELLS[curPlayer.position].cleanSubtitle,
                      censored
                    )}
                    »
                  </div>
                </div>
                <div className="show-in-cockpit-grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    disabled={(me?.cash ?? 0) < (BOARD_CELLS[curPlayer.position].price ?? 0)}
                    onClick={onBuy}
                    className="btn-emerald-3d active:translate-y-1 py-1.5 sm:py-2 px-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <DiceDualIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 hidden sm:block" />
                    <span>
                      Купить за{' '}
                      <span className="font-mono-num font-extrabold">
                        {formatMoney(BOARD_CELLS[curPlayer.position].price ?? 0)}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={onDeclineBuy}
                    className="py-1.5 sm:py-2 rounded-xl bg-[#171B26] hover:bg-[#1F2433] border border-white/12 hover:border-[#E5B869]/45 text-neutral-200 hover:text-white font-bold text-[11px] sm:text-xs cursor-pointer shadow-[0_3px_0_#07080C] active:translate-y-0.5 transition"
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
                  <div className="glass-card-inner rounded-xl px-3 py-2 text-xs space-y-1 border-l-2 !border-l-[#E5B869]">
                    <div className="font-display font-bold text-[#F8FAFC] flex items-center gap-1.5">
                      <span className="shrink-0">{roomState.lastCardPopup.card.icon}</span>
                      <span className="whitespace-normal break-words leading-tight">
                        {txt(
                          roomState.lastCardPopup.card.title,
                          roomState.lastCardPopup.card.cleanTitle,
                          censored
                        )}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-neutral-300 leading-snug whitespace-normal break-words">
                      {txt(
                        roomState.lastCardPopup.card.description,
                        roomState.lastCardPopup.card.cleanDescription,
                        censored
                      )}
                    </div>
                    <div className="text-[11px] font-mono-num font-bold text-[#E5B869]">
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
                  className="show-in-cockpit-block btn-emerald-3d active:translate-y-1 w-full py-2 sm:py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Применить Шанс 🃏
                </button>
              </div>
            )}

            {roomState.phase === 'CHOOSE_SPEED_TARGET' && (
              <div className="text-xs font-bold text-fuchsia-200 bg-fuchsia-500/18 border border-fuchsia-400/50 backdrop-blur-md rounded-xl px-3 py-2 text-center">
                {roomState.speedTargetMode === 'TRIPLE'
                  ? '🔥 ТРИПЛ! Кликните на любую подсвеченную клетку на доске для перелёта!'
                  : '🚐 МАРШРУТКА В АД! Кликните на подсвеченную клетку впереди!'}
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
                  <div className="glass-card-inner rounded-xl px-3 py-2 text-xs space-y-1 border-l-2 !border-l-[#F43F5E]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-neutral-300 font-semibold">
                        {creditor ? (
                          <>
                            Получатель:{' '}
                            <b style={{ color: creditor.color }} className="font-extrabold inline-flex items-center gap-1">
                              <PlayerAvatar avatar={creditor.avatar} />
                              <span>{creditor.name}</span>
                            </b>
                          </>
                        ) : (
                          <>
                            Получатель: <b className="text-white">🏦 Банк</b>
                          </>
                        )}
                      </span>
                      <span className="font-mono-num font-extrabold text-[#F43F5E] text-sm">
                        -{formatMoney(debt.amount)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-snug">
                      {txt(debt.reason, debt.cleanReason, censored)}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        canPay ? 'text-[#6EE7B7]' : 'text-[#FDA4AF]'
                      }`}
                    >
                      {canPay
                        ? `На счету ${formatMoney(me?.cash ?? 0)} — нажмите «Оплатить», чтобы подтвердить перевод.`
                        : `Не хватает ${formatMoney(debt.amount - (me?.cash ?? 0))}! Кликните на свои поля на доске (продать филиал / заложить) или возьмите кредит.`}
                    </div>
                  </div>
                  {canPay ? (
                    <button
                      onClick={onPayDebt}
                      className="show-in-cockpit-block btn-emerald-3d active:translate-y-1 w-full py-2.5 rounded-xl font-display font-bold text-xs md:text-sm cursor-pointer"
                    >
                      💸 Оплатить <span className="font-mono-num">{formatMoney(debt.amount)}</span>
                    </button>
                  ) : (
                    <div className="show-in-cockpit-grid grid-cols-2 gap-2">
                      <button
                        onClick={onOpenCredit}
                        className="btn-gold-3d py-2 rounded-xl font-display font-extrabold text-xs cursor-pointer"
                      >
                        🏦 Взять кредит
                      </button>
                      <button
                        onClick={onSurrender}
                        className="py-2 rounded-xl bg-[#F43F5E] hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition"
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
                <div className="text-[10.5px] sm:text-[11px] font-semibold text-[#F3D082]">
                  🌀 {txt('Ебаный квантовый телепорт', 'Квантовый телепорт', censored)}: выберите клетку назначения на доске или ниже (+точка ={' '}
                  <span className="font-mono-num">+{formatMoney(500)}</span>):
                </div>
                <div className="show-in-cockpit-flex flex-wrap gap-1 sm:gap-1.5 max-h-24 sm:max-h-28 overflow-y-auto chat-scrollbar pr-1">
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#131826] hover:bg-[#1B2336] border border-[#E5B869]/40 hover:border-[#E5B869] text-[10px] sm:text-[11px] font-bold text-[#F1F5F9] transition cursor-pointer shadow-xs"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: cOwner
                              ? cOwner.color
                              : cDef.price
                              ? '#10B981'
                              : '#E5B869',
                          }}
                        />
                        <span>{cDef.icon}</span>
                        <span>{txt(cDef.shortName || cDef.name, cDef.cleanShortName || cDef.cleanName, censored)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="show-in-cockpit-grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={roomState.portal.candidateCells.length >= 8 || (me?.cash ?? 0) < 500}
                    onClick={onPortalAdd}
                    className="py-1.5 sm:py-2 rounded-xl bg-[#171B26] hover:bg-[#202636] border border-white/12 disabled:opacity-40 text-neutral-100 font-bold text-[11px] sm:text-xs cursor-pointer transition"
                  >
                    + Точка (<span className="font-mono-num">$500</span>)
                  </button>
                  <button
                    type="button"
                    onClick={() => onPortalJump()}
                    className="btn-emerald-3d active:translate-y-1 py-1.5 sm:py-2 rounded-xl font-bold text-[11px] sm:text-xs cursor-pointer"
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
                          <b className="text-white font-mono-num">{survivePct}%</b>
                        </span>
                        <span className="font-mono-num font-extrabold text-[#6EE7B7] shrink-0 ml-2">
                          +{formatMoney(reward)}
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
                              className={`h-8 rounded-lg font-mono-num font-extrabold text-xs border transition cursor-pointer ${
                                active
                                  ? 'bg-[#F43F5E] text-white border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                                  : 'bg-[#12151F] text-neutral-300 border-white/12 hover:border-white/30'
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
                          className="col-span-2 py-2 rounded-xl bg-[#F43F5E] hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer transition shadow-md"
                        >
                          🔫 Спустить курок (<span className="font-mono-num">+{formatMoney(reward)}</span>)
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlayJackpot({ skip: true })}
                          className="py-2 rounded-xl bg-[#171B26] hover:bg-[#222838] border border-white/12 text-neutral-200 font-bold text-xs cursor-pointer transition"
                        >
                          Пас
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between text-[11px] text-neutral-300 gap-2">
                    <span className="italic whitespace-normal break-words leading-snug">
                      {txt(JACKPOT_QUOTES[quoteIdx].hard, JACKPOT_QUOTES[quoteIdx].clean, censored)}
                    </span>
                    <span className="font-mono-num font-extrabold text-[#E5B869] shrink-0">
                      Куш:{' '}
                      {selectedFaces.length === 1
                        ? formatMoney(6000)
                        : selectedFaces.length === 2
                        ? formatMoney(3000)
                        : formatMoney(2000)}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((f) => {
                      const active = selectedFaces.includes(f);
                      return (
                        <button
                          key={f}
                          onClick={() => toggleFace(f)}
                          className={`h-8 rounded-lg font-mono-num font-extrabold text-xs border transition cursor-pointer ${
                            active
                              ? 'bg-gradient-to-b from-[#F3D082] to-[#C8963E] text-[#140F06] border-[#FEF3C7] shadow-[0_0_14px_rgba(229,184,105,0.45)]'
                              : 'bg-[#12151F] text-neutral-300 border-white/12 hover:border-[#E5B869]/45'
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      disabled={(me?.cash ?? 0) < 1000}
                      onClick={() => onPlayJackpot({ mode: 'DICE', faces: selectedFaces })}
                      className="btn-emerald-3d active:translate-y-1 py-2 rounded-xl font-bold text-[11px] cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <AppleEmoji emoji="🎲" />
                      <span>
                        Ставка <span className="font-mono-num">{formatMoney(1000)}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => onPlayJackpot({ skip: true })}
                      className="py-2 rounded-xl bg-[#171B26] hover:bg-[#222838] border border-white/12 text-neutral-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      Пас
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : showAuctionCard && roomState.auction ? (
          /* ОНИКС-КАРТОЧКА ЗАКРЫТОГО VIP-АУКЦИОНА */
          <div
            className={`glass-panel text-neutral-100 rounded-xl sm:rounded-2xl p-2 sm:p-3 animate-action-card space-y-1.5 sm:space-y-2 transition-all ${
              Math.max(0, Math.ceil((roomState.auction.endsAt - nowMs) / 1000)) <= 3
                ? '!border-[#F43F5E]/90 shadow-[0_0_28px_rgba(244,63,94,0.45)]'
                : '!border-[#E5B869]/45'
            }`}
          >
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
                  <div className="flex items-start justify-between text-[11px] sm:text-xs gap-1.5">
                    <span className="font-display font-bold text-[#F3D082] whitespace-normal break-words leading-tight">
                      🔨 {txt(def.name, def.cleanName, censored)}
                    </span>
                    <span
                      className={`font-mono-num font-extrabold shrink-0 px-2 py-0.5 rounded-full ${
                        secLeft <= 3
                          ? 'bg-[#F43F5E] text-white animate-pulse'
                          : 'bg-[#F43F5E]/18 border border-[#F43F5E]/35 text-rose-200'
                      }`}
                    >
                      ⏳ {secLeft}с
                    </span>
                  </div>
                  <IndustryCardBanner
                    groupId={def.groupId}
                    cellType={def.type}
                    cellId={def.id}
                    censored={censored}
                    className="!h-[54px] sm:!h-[64px]"
                  />
                  <div className="hidden sm:block rounded-lg bg-[#0A0C12]/85 border border-white/[0.06] border-l-2 border-l-[#E5B869] px-2.5 py-1.5 text-[10.5px] text-neutral-300 italic whitespace-normal break-words leading-snug">
                    «{txt(def.description || def.subtitle, def.cleanDescription || def.cleanSubtitle, censored)}»
                  </div>
                  <div className="flex items-center justify-between text-[11px] sm:text-xs bg-[#0B0D14] border border-white/[0.08] rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 gap-2">
                    <span className="shrink-0">
                      {leader ? (
                        <>
                          Ставка:{' '}
                          <b className="text-xs sm:text-sm text-[#6EE7B7] font-mono-num">
                            {formatMoney(auc.currentBid)}
                          </b>
                        </>
                      ) : (
                        <>
                          Мин. ставка:{' '}
                          <b className="text-xs sm:text-sm text-[#E5B869] font-mono-num">
                            {formatMoney(nextMinBid)}
                          </b>
                        </>
                      )}
                    </span>
                    <span className="text-neutral-300 font-semibold truncate inline-flex items-center gap-1">
                      {leader ? (
                        <>
                          <span>👑</span>
                          <PlayerAvatar avatar={leader.avatar} />
                          <span style={{ color: leader.color }}>{leader.name}</span>
                        </>
                      ) : (
                        <span className="font-mono-num">
                          Номинал {formatMoney(def.price ?? auc.currentBid)}
                        </span>
                      )}
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
                              ? { borderColor: p.color, backgroundColor: `${p.color}30` }
                              : undefined
                          }
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold border ${
                            isPassed
                              ? 'bg-white/5 border-white/10 text-neutral-500 line-through opacity-55'
                              : isTurn
                              ? 'text-white ring-1 ring-[#E5B869] shadow-xs'
                              : 'bg-[#0C0E14] border-white/12 text-neutral-300'
                          }`}
                        >
                          <span>{isLead ? '👑' : isTurn ? '🎯' : <PlayerAvatar avatar={p.avatar} />}</span>
                          <span className="max-w-[70px] truncate">{p.name}</span>
                        </span>
                      );
                    })}
                  </div>

                  {canIBid ? (
                    <div className="space-y-1">
                      <div className="text-[10px] font-extrabold text-[#6EE7B7] text-center">
                        🎯 Ваша очередь на торгах! (от{' '}
                        <span className="font-mono-num">{formatMoney(nextMinBid)}</span>)
                      </div>
                      <div className="show-in-cockpit-grid grid-cols-4 gap-1 sm:gap-1.5">
                        {[100, 300, 500].map((step) => (
                          <button
                            key={step}
                            disabled={(me?.cash ?? 0) < auc.currentBid + step}
                            onClick={() => onBidAuction(step)}
                            className="btn-emerald-3d active:translate-y-0.5 py-1 sm:py-1.5 rounded-lg font-mono-num font-extrabold text-[10px] sm:text-xs cursor-pointer leading-tight"
                          >
                            <div>+${step}</div>
                            <div className="text-[8.5px] opacity-85">
                              {formatMoney(auc.currentBid + step)}
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={onPassAuction}
                          className="py-1 sm:py-1.5 rounded-lg bg-[#171B26] hover:bg-[#F43F5E] border border-white/12 text-neutral-200 hover:text-white font-bold text-[10px] sm:text-xs cursor-pointer transition"
                        >
                          Пас
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[10px] sm:text-[11px] font-semibold text-neutral-300 bg-[#0B0D14] border border-white/[0.08] rounded-lg py-1 px-2 space-y-0.5">
                      <div>
                        ⏳ Сейчас торгуется:{' '}
                        <b style={{ color: currentBidder?.color }} className="font-extrabold inline-flex items-center gap-1">
                          {currentBidder ? (
                            <>
                              <PlayerAvatar avatar={currentBidder.avatar} />
                              <span>{currentBidder.name}</span>
                            </>
                          ) : (
                            '...'
                          )}
                        </b>{' '}
                        (<span className="font-mono-num">{secLeft}с</span>)
                      </div>
                      {auc.initiatorId === myPlayerId &&
                        auc.passedIds.includes(myPlayerId) &&
                        auc.highestBidderId && (
                          <div className="text-[9.5px] text-[#FDA4AF] font-semibold">
                            Вы выставили лот и выбыли из торгов после чужой ставки
                          </div>
                        )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          /* ВЕРХНЯЯ ТЕЛЕМЕТРИЯ РАУНДА И АКТИВНОГО ИГРОКА */
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
              <div className="bg-[#141722]/90 backdrop-blur-xl border border-white/12 text-[#F1F5F9] rounded-full px-2.5 sm:px-3.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono-num font-bold shadow-lg flex items-center gap-1.5 sm:gap-2">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                <span>{clockStr}</span>
                <span className="text-white/20">|</span>
                <span>{roomState.round} р.</span>
                {speedUnlock !== null && roomState.round >= speedUnlock && (
                  <span className="text-fuchsia-300 font-black">⚡3D</span>
                )}
                {antiStall.rentTaxPercent > 0 && (
                  <span className="text-[#F43F5E] font-extrabold">-{antiStall.rentTaxPercent}%</span>
                )}
              </div>
              {curPlayer && roomState.status === 'PLAYING' && (
                <div className="bg-[#141722]/90 backdrop-blur-xl border border-white/12 text-neutral-100 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold shadow-lg flex items-center gap-1 sm:gap-1.5 max-w-[145px] sm:max-w-none">
                  <span className="hidden sm:inline text-neutral-400">
                    {isWalkingAfterRoll ? '👣 Шагает:' : 'Ходит:'}
                  </span>
                  <span style={{ color: curPlayer.color }} className="font-extrabold truncate inline-flex items-center gap-1">
                    <PlayerAvatar avatar={curPlayer.avatar} />
                    <span>{curPlayer.name}</span>
                  </span>
                </div>
              )}
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full backdrop-blur-xl border shadow-lg flex items-center justify-center text-[10px] sm:text-xs cursor-pointer transition ${
                  settingsOpen
                    ? 'bg-[#10B981]/25 border-[#10B981]/70 text-emerald-200'
                    : 'bg-[#141722]/90 border-white/12 text-neutral-300 hover:text-white hover:border-white/25'
                }`}
                title="Параметры комнаты и звук"
              >
                ⚙️
              </button>
            </div>
            <div className="hidden sm:block text-[10px] text-neutral-500 text-center">
              Клик по клетке — VIP-досье актива и стройка филиалов • Клик по игроку — смарт-контракт
            </div>
          </div>
        )}

        {/* Выпадающая карточка быстрых настроек */}
        {settingsOpen && (
          <div className="mt-1.5 glass-panel text-neutral-100 rounded-2xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-action-card">
            <button
              onClick={copyRoomLink}
              className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 font-mono-num font-bold cursor-pointer transition"
            >
              {copiedCode ? '✅ Ссылка скопирована!' : `🔗 Комната #${roomState.code}`}
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={onToggleCensor}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 font-semibold cursor-pointer transition"
              >
                {censored ? '😇 Цензура: ВКЛ' : '🤬 Мемы: 18+'}
              </button>
              <button
                onClick={() => setMuted(soundEngine.toggleMute())}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 font-semibold cursor-pointer transition"
              >
                {muted ? '🔇 Звук выкл' : '🔊 Звук вкл'}
              </button>
              <button
                onClick={onOpenCredit}
                className="px-2.5 py-1 rounded-lg bg-[#E5B869]/18 hover:bg-[#E5B869]/28 border border-[#E5B869]/45 text-[#F3D082] font-bold cursor-pointer transition"
              >
                🏦 Кредит
              </button>
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-2 py-1 text-neutral-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. КРУПНЫЕ ЦЕНТРАЛЬНЫЕ КУБИКИ ВО ВРЕМЯ БРОСКА */}
      {showCenterDice && roomState.lastDice && (
        <div
          style={{ perspective: '760px' }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3.5 sm:gap-5 z-25"
        >
          <M1DieBox
            value={roomState.lastDice.die1}
            skin={diceRoller?.diceSkin ?? 'liquid_glass'}
            animKey={roomState.lastDice.timestamp}
            variant="a"
          />
          <M1DieBox
            value={roomState.lastDice.die2}
            skin={diceRoller?.diceSkin ?? 'liquid_glass'}
            animKey={roomState.lastDice.timestamp + 1}
            variant="b"
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

      {/* 3. НИЖНЯЯ ЗОНА 9×9: СТРУКТУРИРОВАННЫЙ ЛОГ ТЕРМИНАЛА И ЧАТ */}
      <div
        className={`flex-1 min-h-0 ${
          expandCenterCard ? 'hidden' : 'flex'
        } flex-col justify-end pt-1 sm:pt-1.5 z-10`}
      >
        {/* Компактные фильтры лога */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1 border-b border-white/[0.05] pb-0.5 sm:pb-1">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-neutral-500 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5B869]/75" />
            Лента операций
          </span>
          <div className="flex items-center justify-end gap-0.5 sm:gap-1 ml-auto overflow-x-auto chat-scrollbar">
            {(
              [
                { id: 'ALL', label: 'Все', testId: 'log-filter-all' },
                { id: 'CHAT', label: 'Чат', testId: 'log-filter-chat' },
                { id: 'DICE', label: 'Кубики', testId: 'log-filter-dice' },
                { id: 'TRADE', label: 'Договоры', testId: 'log-filter-trade' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={f.testId}
                onClick={() => setLogFilter(f.id)}
                className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[8.5px] sm:text-[10px] font-bold transition cursor-pointer shrink-0 ${
                  logFilter === f.id
                    ? 'bg-[#191E2C] border border-[#E5B869]/40 text-[#F3D082]'
                    : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Скроллящийся лог с левыми цветными индикаторами и бейджами сумм */}
        <div
          data-testid="center-chat-logs"
          className="chat-scrollbar flex-1 min-h-0 overflow-y-auto space-y-0.5 sm:space-y-1.5 pr-0.5 sm:pr-1 text-[9.5px] sm:text-[12px] xl:text-[13px] leading-[1.3] sm:leading-snug"
        >
          {filteredLogs.slice(-60).map((entry) => {
            const rawText = txt(entry.text, entry.cleanText, censored);
            const matchedPlayer =
              (entry.playerName &&
                roomState.players.find((p) => p.name === entry.playerName)) ||
              roomState.players.find((p) => rawText.startsWith(p.name));

            const isGoldHeadline = /КАТКА НАЧАЛАСЬ!|ДУБЛЬ!|СТАРТ|ПОБЕД|ЧЕМПИОН/i.test(rawText);
            const isBuyEvent =
              entry.type === 'BUY' ||
              /прикупил|купил|выкупил|построил|филиал/i.test(rawText);
            const isDangerEvent =
              entry.type === 'RENT' ||
              entry.type === 'BANKRUPT' ||
              /обезьянник|сизо|изолятор|приём|облава|тюрьм|тцк|бусик|бусификац|учебк|влк|повестк|скам|мфо|115-фз|додеп|штраф|долг/i.test(rawText);

            const accentClass = isGoldHeadline
              ? 'border-l-[3px] border-l-[#E5B869] bg-gradient-to-r from-[#E5B869]/14 via-[#141722]/75 to-transparent pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.04]'
              : isBuyEvent
              ? 'border-l-[3px] border-l-[#10B981] bg-gradient-to-r from-[#10B981]/12 via-[#121720]/70 to-transparent pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.04]'
              : entry.type === 'TRADE'
              ? 'border-l-[3px] border-l-[#8B5CF6] bg-gradient-to-r from-[#8B5CF6]/14 via-[#141424]/75 to-transparent pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.04]'
              : entry.type === 'AUCTION' || entry.type === 'CHANCE'
              ? 'border-l-[3px] border-l-[#F59E0B] bg-gradient-to-r from-[#F59E0B]/12 via-[#17151C]/70 to-transparent pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.04]'
              : isDangerEvent
              ? 'border-l-[3px] border-l-[#F43F5E] bg-gradient-to-r from-[#F43F5E]/13 via-[#181219]/75 to-transparent pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.04]'
              : entry.type === 'TAUNT'
              ? 'border-l-[3px] border-l-[#E5B869] bg-[#151823]/80 pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.05]'
              : entry.type === 'CHAT'
              ? 'border-l-[3px] border-l-[#38BDF8] bg-[#121622]/80 pl-2.5 pr-1.5 py-1 rounded-r-lg border-y border-r border-white/[0.05]'
              : 'border-l-2 border-l-white/12 pl-2 pr-1 py-0.5 hover:bg-white/[0.02] rounded-r';

            const activeReactions = entry.reactions
              ? Object.entries(entry.reactions).filter(([, cnt]) => cnt > 0)
              : [];

            return (
              <div key={entry.id} className={`group relative transition-colors ${accentClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 text-neutral-200">
                    {(entry.type === 'CHAT' || entry.type === 'TAUNT') && (
                      <span
                        style={{ color: entry.playerColor || matchedPlayer?.color || '#10B981' }}
                        className="font-extrabold mr-1.5"
                      >
                        {entry.playerName || matchedPlayer?.name || 'Игрок'}:
                      </span>
                    )}
                    <span
                      className={
                        entry.type === 'TAUNT'
                          ? 'text-[#F3D082] font-bold'
                          : entry.type === 'CHAT'
                          ? 'text-[#F8FAFC]'
                          : 'text-[#E2E8F0] font-medium'
                      }
                    >
                      {renderColoredLogText(
                        rawText,
                        roomState.players,
                        matchedPlayer?.diceSkin ?? 'liquid_glass'
                      )}
                    </span>
                  </div>

                  {/* Быстрые реакции на событие при наведении */}
                  <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-[#12151F]/95 backdrop-blur-md border border-white/15 rounded-full px-1 py-0.5 shadow-lg">
                    {(['🤡', '💀', '🔥', '💸'] as const).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => onReactLog(entry.id, em)}
                        className="hover:scale-125 transition text-[11px] leading-none px-0.5 cursor-pointer inline-flex items-center"
                        title={`Реакция ${em}`}
                      >
                        <AppleEmoji emoji={em} />
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
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 font-mono-num text-[10px] font-bold text-neutral-200 cursor-pointer"
                      >
                        <AppleEmoji emoji={em} />
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

        {/* Строка ввода чата терминала */}
        <form onSubmit={handleChatSubmit} className="mt-1.5 sm:mt-2 shrink-0 flex gap-1 sm:gap-1.5">
          <input
            type="text"
            maxLength={240}
            placeholder="Сообщение в терминал..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            className="flex-1 min-w-0 bg-[#0B0D14]/90 border border-white/10 focus:border-[#E5B869]/55 focus:bg-[#0F121B] outline-none rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs text-[#F1F5F9] placeholder-neutral-500 transition shadow-inner"
          />
          {chatDraft.trim().length > 0 && (
            <button
              type="submit"
              className="btn-emerald-3d active:translate-y-0.5 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-white text-xs font-bold cursor-pointer shrink-0"
            >
              ➤
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
