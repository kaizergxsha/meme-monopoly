import React, { useEffect, useRef, useState } from 'react';
import {
  formatMoney,
  isSpeedRulesMode,
  txt,
} from '../../shared/rules.ts';
import { RoomState } from '../../shared/types.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { ChanceCardIllustration } from './CardIllustration.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

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
  const showChanceCard =
    isLandedReady &&
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
            ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
            : popup.tone === 'bad'
            ? 'bg-rose-50 border-rose-400 text-rose-950'
            : popup.tone === 'move'
            ? 'bg-gradient-to-r from-indigo-50 to-amber-50 border-indigo-400 text-indigo-950'
            : 'bg-purple-50 border-purple-400 text-purple-950';
        const toneBadgeClass =
          popup.tone === 'good'
            ? 'text-emerald-700'
            : popup.tone === 'bad'
            ? 'text-rose-700'
            : popup.tone === 'move'
            ? 'text-indigo-700'
            : 'text-purple-700';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-3 sm:p-4">
            <div
              data-testid="chance-card-popup"
              className="w-full max-w-[380px] max-h-[88dvh] overflow-y-auto pointer-events-auto animate-action-card rounded-2xl bg-white text-neutral-900 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.85)] border-2 border-neutral-200 space-y-3"
            >
              {/* Чёткая шапка карточки */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-900 text-amber-300 text-[10.5px] font-black uppercase tracking-wider">
                    🃏 КАРТОЧКА «ШАНС»
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedCardTs(popup.timestamp)}
                    title="Закрыть плашку"
                    className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-black flex items-center justify-center cursor-pointer shrink-0 transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200/80 rounded-xl px-2.5 py-1.5">
                  <span
                    style={{
                      borderColor: lp?.color || '#52525b',
                      backgroundColor: `${lp?.color || '#52525b'}22`,
                    }}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm shrink-0 overflow-hidden"
                  >
                    <PlayerAvatar avatar={lp?.avatar || '🎲'} fill />
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    <span style={{ color: lp?.color || '#18181b' }} className="font-black">
                      {lp?.name || 'Игрок'}
                    </span>{' '}
                    наступил на Шанс!
                  </span>
                </div>
              </div>

              <ChanceCardIllustration cardId={popup.card.id} kind={popup.card.kind} />

              {/* Крупная иконка + Заголовок и описание */}
              <div className="flex items-start gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                  {popup.card.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-[15px] text-neutral-950 leading-tight">
                    {txt(popup.card.title, popup.card.cleanTitle, censored)}
                  </h4>
                  <p className="text-xs text-neutral-600 mt-1 leading-snug">
                    {txt(popup.card.description, popup.card.cleanDescription, censored)}
                  </p>
                </div>
              </div>

              {/* Яркий блок «ЧТО ВЫПАЛО:» */}
              <div className={`rounded-xl border-2 px-3 py-2.5 shadow-2xs ${toneBoxClass}`}>
                <div className={`text-[10px] font-black uppercase tracking-wider ${toneBadgeClass}`}>
                  ЧТО ВЫПАЛО:
                </div>
                <div className="text-sm sm:text-[15px] font-black leading-snug mt-0.5">
                  {txt(popup.effectLabel, popup.cleanEffectLabel, censored)}
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
                    className="w-full py-2.5 px-4 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-sm tracking-wide shadow-[0_6px_20px_rgba(143,206,0,0.4)] transition cursor-pointer"
                  >
                    Понял, применить!
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-xs font-semibold text-neutral-500">
                      ⏳ Игрок читает карточку...
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissedCardTs(popup.timestamp)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold cursor-pointer transition shrink-0"
                    >
                      Скрыть
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-bold text-emerald-700">
                    ✅ Эффект карточки применён
                  </span>
                  <button
                    type="button"
                    onClick={() => setDismissedCardTs(popup.timestamp)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold cursor-pointer transition shrink-0"
                  >
                    Скрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Аукцион, Портал, Казино и Входящая сделка теперь отображаются прямо внутри верхней карточки 9×9 без перекрытия и замыливания доски! */}

      {/* 3. ВИЗУАЛЬНЫЙ ОТЧЁТ ПО БАНКОВСКОМУ КРЕДИТУ */}
      {creditModalOpen && me && (() => {
        const defaultTerm = isSpeedRulesMode(roomState.settings) ? 6 : 8;
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
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              data-testid="credit-visual-report"
              className="w-full max-w-md bg-[#171923] border border-amber-400/60 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                    <span>🏦</span>
                    <span>Визуальный отчёт по кредиту</span>
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    Текущий раунд: <b className="text-slate-200">{roomState.round}</b> · Ставка: +20%
                  </div>
                </div>
                <button
                  onClick={onCloseCreditModal}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
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
                    {/* 3 KPI-карточки */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Тело займа</div>
                        <div className="text-sm font-black text-emerald-300 tabular-nums mt-0.5">
                          {formatMoney(me.credit.principal)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Процент</div>
                        <div className="text-sm font-black text-amber-300 tabular-nums mt-0.5">
                          +{formatMoney(me.credit.paybackAmount - me.credit.principal)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-rose-500/10 border border-rose-400/35 p-2.5 text-center">
                        <div className="text-[10px] text-rose-200 uppercase font-bold">К возврату</div>
                        <div className="text-sm font-black text-rose-300 tabular-nums mt-0.5">
                          {formatMoney(me.credit.paybackAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Шкала срока и дедлайна */}
                    <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300">
                          ⏳ Срок ({takenAt}р → {me.credit.dueRound}р)
                        </span>
                        <span
                          className={`font-black px-2 py-0.5 rounded-full text-[10px] ${
                            urgent
                              ? 'bg-rose-500/25 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          Осталось {roundsLeft} р.
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            urgent
                              ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                              : 'bg-gradient-to-r from-emerald-400 to-amber-400'
                          }`}
                          style={{ width: `${termPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Прошло: {elapsed} / {totalRounds} р.</span>
                        <span>Дедлайн: {me.credit.dueRound}-й раунд</span>
                      </div>
                    </div>

                    {/* Шкала готовности наличных к погашению */}
                    <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300">💵 Покрытие наличкой</span>
                        <span
                          className={`font-black text-[11px] ${
                            missingCash === 0 ? 'text-emerald-400' : 'text-amber-300'
                          }`}
                        >
                          {missingCash === 0 ? 'Хватает на закрытие ✓' : `Не хватает ${formatMoney(missingCash)}`}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            missingCash === 0 ? 'bg-emerald-400' : 'bg-sky-400'
                          }`}
                          style={{ width: `${cashPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
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
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer transition"
                    >
                      {retroLocked
                        ? 'В Ретро-режиме досрочное погашение недоступно'
                        : `💸 Погасить досрочно (${formatMoney(me.credit.paybackAmount)})`}
                    </button>
                  </div>
                );
              })() : (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-2.5 text-center">
                      <div className="text-[10px] text-emerald-200 uppercase font-bold">На руки</div>
                      <div className="text-sm font-black text-emerald-300 mt-0.5">+$5 000</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Переплата</div>
                      <div className="text-sm font-black text-amber-300 mt-0.5">+20% ($1 000)</div>
                    </div>
                    <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-2.5 text-center">
                      <div className="text-[10px] text-rose-200 uppercase font-bold">Возврат</div>
                      <div className="text-sm font-black text-rose-300 mt-0.5">$6 000 · {defaultTerm}р</div>
                    </div>
                  </div>

                  {/* Визуальный чек-лист доступности */}
                  <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Кредиты в комнате</span>
                      <span className={roomState.settings.creditEnabled ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {roomState.settings.creditEnabled ? '✓ Разрешены' : '✕ Отключены'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Доступно с {unlockRound}-го раунда</span>
                      <span className={roomState.round >= unlockRound ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                        {roomState.round >= unlockRound
                          ? '✓ Открыт'
                          : `Через ${unlockRound - roomState.round} р.`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Откат после прошлого займа</span>
                      <span className={cooldownLeft === 0 ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                        {cooldownLeft === 0 ? '✓ Готов' : `Ещё ${cooldownLeft} р.`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Право хода</span>
                      <span className={isMyTurn ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
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
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer transition"
                  >
                    🏦 Взять +5.000k прямо сейчас
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
};
