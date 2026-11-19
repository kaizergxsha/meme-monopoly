import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatMoney,
  isSpeedRulesMode,
  txt,
} from '../../shared/rules.ts';
import { RoomState } from '../../shared/types.ts';
import { useCockpitMode } from '../hooks/useCockpitMode.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { AppleEmoji, renderAppleEmojis } from './AppleEmoji.tsx';
import { ChanceCardIllustration } from './CardIllustration.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

const CenterStagePortal: React.FC<{ children: React.ReactNode; backdrop?: boolean }> = ({
  children,
  backdrop = false,
}) => {
  const { isCockpit } = useCockpitMode();
  const [arenaEl, setArenaEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setArenaEl(document.getElementById('center-stage-arena'));
  }, [isCockpit]);

  if (isCockpit && arenaEl) {
    return createPortal(
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 ${
          backdrop ? 'bg-black/68 backdrop-blur-sm pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {children}
      </div>,
      arenaEl
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 ${
        backdrop ? 'bg-black/70 backdrop-blur-sm' : 'pointer-events-none'
      }`}
    >
      {children}
    </div>
  );
};

interface ModalsProps {
  roomState: RoomState;
  myPlayerId: string;
  censored: boolean;
  creditModalOpen: boolean;
  onCloseCreditModal: () => void;
  onAckChance: () => void;
  onTakeCredit: () => void;
  onRepayCredit: () => void;
}

export const Modals: React.FC<ModalsProps> = ({
  roomState,
  myPlayerId,
  censored,
  creditModalOpen,
  onCloseCreditModal,
  onAckChance,
  onTakeCredit,
  onRepayCredit,
}) => {
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const curPlayer = roomState.players[roomState.currentPlayerIndex];
  const isMyTurn = curPlayer?.id === myPlayerId;

  // Всплывающая плашка «Шанса»: строго ПОСЛЕ того, как фишка дошагала и встала на клетку!
  const popup = roomState.lastCardPopup;
  const [revealedCard, setRevealedCard] = useState<{ ts: number; revealedAt: number } | null>(
    null
  );
  const [dismissedCardTs, setDismissedCardTs] = useState<number>(0);
  const [autoHideCardTs, setAutoHideCardTs] = useState<number>(0);
  const playedSoundTsRef = useRef<number>(0);

  useEffect(() => {
    if (!popup) return;
    const ageNow = Date.now() - popup.timestamp;
    if (ageNow > 10000 && roomState.phase !== 'CHANCE') {
      setAutoHideCardTs(popup.timestamp);
      return;
    }

    const delayMs = Math.max(0, popup.timestamp + popup.walkDurationMs - Date.now());
    const timer = setTimeout(() => {
      setRevealedCard((prev) =>
        prev?.ts === popup.timestamp ? prev : { ts: popup.timestamp, revealedAt: Date.now() }
      );
      if (playedSoundTsRef.current !== popup.timestamp) {
        playedSoundTsRef.current = popup.timestamp;
        soundEngine.playChanceReveal(popup.tone);
      }
    }, delayMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.timestamp, popup?.walkDurationMs, popup?.tone]);

  useEffect(() => {
    if (!popup || roomState.phase === 'CHANCE') return;
    if (revealedCard?.ts !== popup.timestamp || dismissedCardTs === popup.timestamp) return;

    const minVisibleMs = 3000;
    const remainingMs = Math.max(0, revealedCard.revealedAt + minVisibleMs - Date.now());
    const timer = setTimeout(() => {
      setAutoHideCardTs(popup.timestamp);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [popup, roomState.phase, revealedCard, dismissedCardTs]);

  const isLandedReady = !!popup && revealedCard?.ts === popup.timestamp;
  const arrestEvt = roomState.lastPoliceArrest ?? null;
  const [revealedArrest, setRevealedArrest] = useState<{ id: string; revealedAt: number } | null>(
    null
  );
  const [dismissedArrestId, setDismissedArrestId] = useState<string>('');
  const [autoHideArrestId, setAutoHideArrestId] = useState<string>('');

  useEffect(() => {
    if (!arrestEvt) return;
    const ageNow = Date.now() - arrestEvt.timestamp;
    if (ageNow > 8500) {
      setAutoHideArrestId(arrestEvt.id);
      return;
    }
    const delayMs = Math.max(0, arrestEvt.timestamp + arrestEvt.walkDurationMs - Date.now());
    const timer = setTimeout(() => {
      setRevealedArrest((prev) =>
        prev?.id === arrestEvt.id ? prev : { id: arrestEvt.id, revealedAt: Date.now() }
      );
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrestEvt?.id, arrestEvt?.timestamp, arrestEvt?.walkDurationMs]);

  useEffect(() => {
    if (!arrestEvt || revealedArrest?.id !== arrestEvt.id) return;
    if (dismissedArrestId === arrestEvt.id) return;
    const isMyArrest = arrestEvt.playerId === myPlayerId;
    const visibleMs = isMyArrest ? 4800 : 3400;
    const remainingMs = Math.max(0, revealedArrest.revealedAt + visibleMs - Date.now());
    const timer = setTimeout(() => {
      setAutoHideArrestId(arrestEvt.id);
    }, remainingMs);
    return () => clearTimeout(timer);
  }, [arrestEvt, revealedArrest, dismissedArrestId, myPlayerId]);

  const showArrestModal =
    !!arrestEvt &&
    revealedArrest?.id === arrestEvt.id &&
    dismissedArrestId !== arrestEvt.id &&
    autoHideArrestId !== arrestEvt.id &&
    roomState.phase !== 'CHANCE';

  const showChanceCard =
    isLandedReady &&
    !showArrestModal &&
    dismissedCardTs !== popup.timestamp &&
    (roomState.phase === 'CHANCE' || autoHideCardTs !== popup.timestamp);

  return (
    <>
      {/* 1. КАРТОЧКА МЕМ-ШАНСА С ИЛЛЮСТРАЦИЕЙ — всплывает строго после приземления фишки */}
      {showChanceCard && popup && (() => {
        const lp = roomState.players.find((p) => p.id === popup.playerId);
        const isMyChance = popup.playerId === myPlayerId;
        const toneBoxClass =
          popup.tone === 'good'
            ? 'bg-[#10B981]/15 border-[#10B981]/45 text-emerald-100'
            : popup.tone === 'bad'
            ? 'bg-[#F43F5E]/15 border-[#F43F5E]/45 text-rose-100'
            : popup.tone === 'move'
            ? 'bg-gradient-to-r from-[#E5B869]/18 to-[#10B981]/12 border-[#E5B869]/45 text-[#F3D082]'
            : 'bg-purple-500/16 border-purple-400/45 text-purple-100';
        const toneBadgeClass =
          popup.tone === 'good'
            ? 'text-[#6EE7B7]'
            : popup.tone === 'bad'
            ? 'text-[#FDA4AF]'
            : popup.tone === 'move'
            ? 'text-[#E5B869]'
            : 'text-purple-300';
        const specialMechanicBadge =
          popup.card.kind === 'EXTRA_TURN'
            ? '⚡ ДОП. ХОД'
            : popup.card.kind === 'FREE_PORTAL'
            ? '🚅 ПОРТАЛ'
            : popup.card.kind === 'BRANCH_BONUS'
            ? '🏗️ КЭШБЭК ФИЛИАЛОВ'
            : popup.card.kind === 'STEAL_LEADER'
            ? '🦝 РЭКЕТ ЛИДЕРА'
            : popup.card.kind === 'PAY_ALL'
            ? '💸 ВСЕМ ПО КЕШУ'
            : popup.card.kind === 'REVERSE_MOVE'
            ? '⏪ ЗАДНИЙ ХОД'
            : popup.card.kind === 'SWAP_POSITION'
            ? '🔀 РОКИРОВКА'
            : popup.card.kind === 'GOTO_CASINO'
            ? '🎰 В КАЗИНО 777'
            : popup.card.kind === 'ASSET_DIVIDEND'
            ? '💼 ДИВИДЕНДЫ'
            : null;

        return (
          <CenterStagePortal>
            <div
              data-testid="chance-card-popup"
              className="glass-panel w-full max-w-[396px] max-h-[88dvh] lg:max-h-full overflow-y-auto chat-scrollbar pointer-events-auto animate-action-card rounded-2xl text-[#F1F5F9] p-3.5 sm:p-4 shadow-[0_28px_80px_rgba(0,0,0,0.92)] !border-[#E5B869]/35 space-y-2.5 sm:space-y-3"
            >
              {/* Шапка VIP-карточки Шанса */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#10B981]/14 border border-[#E5B869]/45 text-[#F3D082] font-display text-[10px] font-bold uppercase tracking-wider">
                      <AppleEmoji emoji="🃏" />
                      <span>VIP-ЛУТБОКС «ШАНС»</span>
                    </span>
                    {specialMechanicBadge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5B869]/18 border border-[#E5B869]/40 text-[#F3D082] text-[9.5px] font-mono-num font-extrabold">
                        {renderAppleEmojis(specialMechanicBadge, 'ch_spec')}
                      </span>
                    )}
                  </div>
                  {!(roomState.phase === 'CHANCE' && isMyChance) && (
                    <button
                      type="button"
                      onClick={() => setDismissedCardTs(popup.timestamp)}
                      title="Закрыть плашку"
                      className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-[#F43F5E]/25 border border-white/10 hover:border-[#F43F5E]/50 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center cursor-pointer shrink-0 transition"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-200 bg-[#0B0D14]/85 border border-white/[0.08] rounded-xl px-2.5 py-1.5">
                  <span
                    style={{
                      borderColor: lp?.color || '#52525b',
                      backgroundColor: `${lp?.color || '#52525b'}28`,
                      boxShadow: lp?.color ? `0 0 10px ${lp.color}55` : undefined,
                    }}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm shrink-0 overflow-hidden"
                  >
                    <PlayerAvatar avatar={lp?.avatar || '🎲'} fill />
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    <span style={{ color: lp?.color || '#ffffff' }} className="font-extrabold">
                      {lp?.name || 'Игрок'}
                    </span>{' '}
                    открыл слот Шанса
                  </span>
                </div>
              </div>

              <ChanceCardIllustration cardId={popup.card.id} kind={popup.card.kind} />

              {/* Крупная иконка + Заголовок и описание */}
              <div className="flex items-start gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-[#0B0D14] border border-[#E5B869]/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                  <AppleEmoji emoji={popup.card.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-display font-extrabold text-[14px] text-[#F8FAFC] leading-tight">
                    {txt(popup.card.title, popup.card.cleanTitle, censored)}
                  </h4>
                  <p className="text-xs text-neutral-300 mt-1 leading-snug">
                    {txt(popup.card.description, popup.card.cleanDescription, censored)}
                  </p>
                </div>
              </div>

              {/* Блок результата */}
              <div className={`rounded-xl border px-3 py-2.5 backdrop-blur-md shadow-xs ${toneBoxClass}`}>
                <div className={`text-[9.5px] font-mono-num font-extrabold uppercase tracking-wider ${toneBadgeClass}`}>
                  ВЕРДИКТ ТЕРМИНАЛА:
                </div>
                <div className="text-sm sm:text-[14.5px] font-mono-num font-extrabold leading-snug mt-0.5 text-[#F8FAFC]">
                  {renderAppleEmojis(txt(popup.effectLabel, popup.cleanEffectLabel, censored), 'ch_eff')}
                </div>
              </div>

              {/* Панель действий */}
              {roomState.phase === 'CHANCE' ? (
                isMyChance ? (
                  <button
                    type="button"
                    data-testid="ack-chance-btn"
                    onClick={() => {
                      setDismissedCardTs(popup.timestamp);
                      onAckChance();
                    }}
                    className="btn-emerald-3d active:translate-y-1 w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs sm:text-sm tracking-wide cursor-pointer"
                  >
                    Понял, применить!
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-xs font-semibold text-neutral-400">
                      ⏳ Игрок изучает инсайд...
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissedCardTs(popup.timestamp)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-neutral-200 text-xs font-bold cursor-pointer transition shrink-0"
                    >
                      Скрыть
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-bold text-[#6EE7B7] inline-flex items-center gap-1">
                    <AppleEmoji emoji="✅" />
                    <span>Эффект карточки применён</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedCardTs(popup.timestamp)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-neutral-200 text-xs font-bold cursor-pointer transition shrink-0"
                  >
                    Скрыть
                  </button>
                </div>
              )}
            </div>
          </CenterStagePortal>
        );
      })()}

      {/* 1.5. ПРОТОКОЛ БУСИФИКАЦИИ ТЦК -> УЧЕБКА — центрированная плашка внутри арены */}
      {showArrestModal && arrestEvt && (() => {
        const isMyArrest = arrestEvt.playerId === myPlayerId;
        const reasonTag =
          arrestEvt.reason === 'THREE_DOUBLES'
            ? `🎲×3 БЛОКПОСТ ТЦК: 3 ДУБЛЯ ${arrestEvt.diceSummary || ''}`
            : arrestEvt.reason === 'CHANCE_CARD'
            ? '📋 ПОВЕСТКА ИЗ КОЛОДЫ «ШАНС»'
            : '🚐 СЕКТОР #30 · ПОПАЛСЯ К ТЦК';

        return (
          <CenterStagePortal>
            <div
              data-testid="police-arrest-modal"
              className="glass-panel w-full max-w-[392px] max-h-[88dvh] lg:max-h-full overflow-y-auto chat-scrollbar pointer-events-auto animate-action-card rounded-2xl text-[#F1F5F9] shadow-[0_28px_85px_rgba(0,0,0,0.95),0_0_40px_rgba(244,63,94,0.45)] !border-[#F43F5E]/65"
            >
              {/* Верхняя тактическая сигнальная полоса */}
              <div className="h-2 w-full bg-gradient-to-r from-[#F43F5E] via-[#D97706] to-[#F43F5E] animate-pulse" />

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F43F5E]/20 border border-[#F43F5E]/55 text-[#FDA4AF] font-display text-[10px] font-extrabold uppercase tracking-wider">
                    <AppleEmoji emoji="🚐" />
                    <span>ПРОТОКОЛ ТЦК · УЧЕБКА</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedArrestId(arrestEvt.id)}
                    title="Закрыть протокол"
                    className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-[#F43F5E]/30 border border-white/15 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center cursor-pointer transition shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Карточка мобилизованного с каской */}
                <div className="flex items-center gap-3 rounded-xl bg-[#0B0D14]/90 border border-white/10 p-3 relative overflow-hidden">
                  <div className="relative w-12 h-12 rounded-xl border-2 border-[#F43F5E] bg-black/50 flex items-center justify-center text-2xl shrink-0 overflow-hidden shadow-[0_0_16px_rgba(244,63,94,0.5)]">
                    <PlayerAvatar avatar={arrestEvt.playerAvatar || '🐸'} fill />
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-tl-lg bg-[#090C10]/90 border-t border-l border-[#F43F5E]/60 flex items-center justify-center text-xs">
                      <AppleEmoji emoji="🪖" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono-num font-extrabold uppercase tracking-wider text-amber-300">
                      {renderAppleEmojis(reasonTag, 'arr_tag')}
                    </div>
                    <div className="font-display font-extrabold text-[14px] text-white leading-tight mt-0.5">
                      {txt(arrestEvt.title, arrestEvt.cleanTitle, censored)}
                    </div>
                    <div className="text-[11.5px] font-semibold text-neutral-300 mt-0.5">
                      В бусике:{' '}
                      <span style={{ color: arrestEvt.playerColor }} className="font-extrabold">
                        {arrestEvt.playerName}
                      </span>
                      {isMyArrest ? ' (Вы)' : ''}
                    </div>
                  </div>
                </div>

                {/* Подробное объяснение причины отправки в Учебку */}
                <p className="text-xs text-neutral-200 leading-relaxed bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-xl px-3 py-2">
                  {txt(arrestEvt.subtitle, arrestEvt.cleanSubtitle, censored)}
                </p>

                {/* Напоминание как выйти */}
                <div className="flex items-center justify-between gap-2 text-[10.5px] text-neutral-400 font-mono-num px-1">
                  <span className="inline-flex items-center gap-1">
                    <AppleEmoji emoji="🎲" />
                    <span>Побег по дублю — $0</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AppleEmoji emoji="📋" />
                    <span>Справка ВЛК — $500</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedArrestId(arrestEvt.id)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#F43F5E] to-[#E11D48] hover:brightness-110 text-white font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer transition shadow-[0_6px_20px_rgba(244,63,94,0.4)] inline-flex items-center justify-center gap-1.5"
                >
                  {isMyArrest ? (
                    <>
                      <span>Понял, в Учебку</span>
                      <AppleEmoji emoji="🪖" />
                    </>
                  ) : (
                    <span>Понятно</span>
                  )}
                </button>
              </div>
            </div>
          </CenterStagePortal>
        );
      })()}

      {/* 2. VIP-ЛИМИТ И ВИЗУАЛЬНЫЙ ОТЧЁТ ПО КРЕДИТУ БАНКА */}
      {creditModalOpen && me && (() => {
        const defaultTerm = 10;
        const unlockRound = isSpeedRulesMode(roomState.settings) ? 10 : 3;
        const retroLocked = roomState.settings.retroRules || roomState.settings.mode === 'retro';
        const cooldownLeft =
          !me.credit && me.creditCooldownUntilRound && roomState.round < me.creditCooldownUntilRound
            ? me.creditCooldownUntilRound - roomState.round
            : 0;
        const canTakeNow =
          !me.credit &&
          isMyTurn &&
          roomState.settings.creditEnabled &&
          roomState.round >= unlockRound &&
          cooldownLeft === 0;

        return (
          <CenterStagePortal backdrop>
            <div
              data-testid="credit-visual-report"
              className="glass-panel w-full max-w-md max-h-[90dvh] lg:max-h-full overflow-y-auto chat-scrollbar !border-[#E5B869]/45 rounded-2xl p-4 sm:p-5 shadow-[0_32px_90px_rgba(0,0,0,0.92)] space-y-4 text-[#F1F5F9]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/35 text-[#6EE7B7] font-mono-num text-[9px] font-bold uppercase tracking-wider mb-1">
                    VIP Private Banking
                  </div>
                  <h3 className="text-[15px] font-display font-extrabold text-[#F3D082] flex items-center gap-2">
                    <span>🏦</span>
                    <span>Кредитный лимит банка</span>
                  </h3>
                  <div className="text-[11px] text-neutral-400 font-mono-num mt-0.5">
                    Раунд: <b className="text-[#F8FAFC]">{roomState.round}</b> · Ставка линии: <b className="text-[#E5B869]">+20%</b>
                  </div>
                </div>
                <button
                  onClick={onCloseCreditModal}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-[#F43F5E]/25 border border-white/10 hover:border-[#F43F5E]/50 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {me.credit ? (() => {
                const takenAt = me.credit.takenAtRound ?? Math.max(1, me.credit.dueRound - defaultTerm);
                const totalRounds = Math.max(1, me.credit.dueRound - takenAt);
                const roundsLeft = Math.max(0, me.credit.dueRound - roomState.round);
                const elapsed = Math.max(0, Math.min(totalRounds, totalRounds - roundsLeft));
                const termPct = Math.round((elapsed / totalRounds) * 100);
                const cashPct = Math.min(
                  100,
                  Math.round((Math.max(0, me.cash) / me.credit.paybackAmount) * 100)
                );
                const missingCash = Math.max(0, me.credit.paybackAmount - me.cash);
                const urgent = roundsLeft <= 2;

                return (
                  <div className="space-y-3">
                    {/* 3 KPI-карточки в стиле банковского терминала */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-[#0B0D14] border border-white/[0.08] p-2.5 text-center">
                        <div className="text-[9.5px] text-neutral-400 uppercase font-bold">Тело займа</div>
                        <div className="text-sm font-mono-num font-extrabold text-[#6EE7B7] mt-0.5">
                          {formatMoney(me.credit.principal)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#0B0D14] border border-white/[0.08] p-2.5 text-center">
                        <div className="text-[9.5px] text-neutral-400 uppercase font-bold">Процент</div>
                        <div className="text-sm font-mono-num font-extrabold text-[#E5B869] mt-0.5">
                          +{formatMoney(me.credit.paybackAmount - me.credit.principal)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#F43F5E]/12 border border-[#F43F5E]/35 p-2.5 text-center">
                        <div className="text-[9.5px] text-rose-200 uppercase font-bold">К возврату</div>
                        <div className="text-sm font-mono-num font-extrabold text-[#FDA4AF] mt-0.5">
                          {formatMoney(me.credit.paybackAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Шкала срока и дедлайна */}
                    <div className="glass-card-inner rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-300 font-mono-num">
                          ⏳ Срок ({takenAt}р → {me.credit.dueRound}р)
                        </span>
                        <span
                          className={`font-mono-num font-extrabold px-2 py-0.5 rounded-full text-[10px] ${
                            urgent
                              ? 'bg-[#F43F5E]/25 text-rose-200'
                              : 'bg-[#E5B869]/20 text-[#F3D082]'
                          }`}
                        >
                          Осталось {roundsLeft} р.
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#08090E] border border-white/[0.05] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            urgent
                              ? 'bg-gradient-to-r from-amber-500 to-[#F43F5E]'
                              : 'bg-gradient-to-r from-[#10B981] to-[#E5B869]'
                          }`}
                          style={{ width: `${termPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-400 font-mono-num">
                        <span>Прошло: {elapsed} / {totalRounds} р.</span>
                        <span>Дедлайн: {me.credit.dueRound}-й раунд</span>
                      </div>
                    </div>

                    {/* Шкала готовности наличных к погашению */}
                    <div className="glass-card-inner rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-300">💵 Покрытие наличкой</span>
                        <span
                          className={`font-mono-num font-extrabold text-[11px] ${
                            missingCash === 0 ? 'text-[#6EE7B7]' : 'text-[#E5B869]'
                          }`}
                        >
                          {missingCash === 0 ? 'Готово к закрытию ✓' : `Дефицит ${formatMoney(missingCash)}`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#08090E] border border-white/[0.05] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            missingCash === 0 ? 'bg-[#10B981]' : 'bg-[#E5B869]'
                          }`}
                          style={{ width: `${cashPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-400 font-mono-num">
                        <span>Баланс: {formatMoney(me.cash)}</span>
                        <span>{cashPct}% от долга</span>
                      </div>
                    </div>

                    <button
                      disabled={me.cash < me.credit.paybackAmount || retroLocked}
                      onClick={() => {
                        onRepayCredit();
                        onCloseCreditModal();
                      }}
                      className="btn-emerald-3d active:translate-y-1 w-full py-2.5 rounded-xl font-display font-bold text-xs cursor-pointer"
                    >
                      {retroLocked
                        ? 'В Ретро-режиме досрочное погашение недоступно'
                        : `💸 Погасить досрочно (${formatMoney(me.credit.paybackAmount)})`}
                    </button>
                  </div>
                );
              })() : (
                <div className="space-y-3 text-xs text-neutral-300">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#10B981]/12 border border-[#10B981]/35 p-2.5 text-center">
                      <div className="text-[9.5px] text-emerald-200 uppercase font-bold">Лимит</div>
                      <div className="text-sm font-mono-num font-extrabold text-[#6EE7B7] mt-0.5 whitespace-nowrap">+$5 000</div>
                    </div>
                    <div className="rounded-xl bg-[#0B0D14] border border-white/[0.08] p-2.5 text-center">
                      <div className="text-[9.5px] text-neutral-400 uppercase font-bold">Комиссия</div>
                      <div className="text-sm font-mono-num font-extrabold text-[#E5B869] mt-0.5 whitespace-nowrap">+20%</div>
                      <div className="text-[10px] font-mono-num font-bold text-[#E5B869]/80 whitespace-nowrap">($1 000)</div>
                    </div>
                    <div className="rounded-xl bg-[#F43F5E]/12 border border-[#F43F5E]/30 p-2.5 text-center">
                      <div className="text-[9.5px] text-rose-200 uppercase font-bold">К возврату</div>
                      <div className="text-sm font-mono-num font-extrabold text-[#FDA4AF] mt-0.5 whitespace-nowrap">$6 000 · {defaultTerm}р</div>
                    </div>
                  </div>

                  {/* Чек-лист доступности кредитной линии */}
                  <div className="glass-card-inner rounded-xl p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-neutral-400">Кредиты в комнате</span>
                      <span className={roomState.settings.creditEnabled ? 'text-[#6EE7B7] font-bold' : 'text-[#F43F5E] font-bold'}>
                        {roomState.settings.creditEnabled ? '✓ Разрешены' : '✕ Отключены'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-neutral-400">Доступно с {unlockRound}-го раунда</span>
                      <span className={`font-mono-num font-bold ${roomState.round >= unlockRound ? 'text-[#6EE7B7]' : 'text-[#E5B869]'}`}>
                        {roomState.round >= unlockRound
                          ? '✓ Открыт'
                          : `Через ${unlockRound - roomState.round} р.`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1">
                      <span className="text-neutral-400">Откат после прошлого займа</span>
                      <span className={`font-mono-num font-bold ${cooldownLeft === 0 ? 'text-[#6EE7B7]' : 'text-[#E5B869]'}`}>
                        {cooldownLeft === 0 ? '✓ Готов' : `Ещё ${cooldownLeft} р.`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Право хода</span>
                      <span className={isMyTurn ? 'text-[#6EE7B7] font-bold' : 'text-neutral-400 font-bold'}>
                        {isMyTurn ? '✓ Ваш ход' : 'Ожидание своего хода'}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={!canTakeNow}
                    onClick={() => {
                      onTakeCredit();
                      onCloseCreditModal();
                    }}
                    className="btn-gold-3d w-full py-2.5 rounded-xl font-display font-extrabold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    🏦 Активировать лимит +{formatMoney(5000)}
                  </button>
                </div>
              )}
            </div>
          </CenterStagePortal>
        );
      })()}
    </>
  );
};
