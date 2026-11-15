import React, { useEffect, useRef, useState } from 'react';
import { BOARD_CELLS, INDUSTRIES } from '../../shared/boardData.ts';
import {
  checkTradeFairness,
  formatMoney,
  isSpeedRulesMode,
  txt,
} from '../../shared/rules.ts';
import { RoomState, TradeSide } from '../../shared/types.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { ChanceCardIllustration } from './CardIllustration.tsx';

interface ModalsProps {
  roomState: RoomState;
  myPlayerId: string;
  censored: boolean;
  nowMs: number;
  creditModalOpen: boolean;
  onCloseCreditModal: () => void;
  onAckChance: () => void;
  onRespondTrade: (accept: boolean) => void;
  onTakeCredit: () => void;
  onRepayCredit: () => void;
}

export const Modals: React.FC<ModalsProps> = ({
  roomState,
  myPlayerId,
  censored,
  nowMs,
  creditModalOpen,
  onCloseCreditModal,
  onAckChance,
  onRespondTrade,
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
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm shrink-0"
                  >
                    {lp?.avatar || '🎲'}
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

      {/* Аукцион, Портал и Казино теперь отображаются прямо внутри верхней карточки 9×9 без перекрытия доски! */}

      {/* 5. ВХОДЯЩИЙ ДОГОВОР (ОБМЕН) ДЛЯ ПОЛУЧАТЕЛЯ */}
      {roomState.activeTrade && roomState.activeTrade.toPlayerId === myPlayerId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-[#1b1c22] border-2 border-indigo-400/80 rounded-2xl p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.85)] space-y-3.5 text-neutral-100">
            {(() => {
              const tr = roomState.activeTrade!;
              const sender = roomState.players.find((p) => p.id === tr.fromPlayerId);
              const incomingFairness = checkTradeFairness(roomState.cells, tr.offer, tr.request);
              const secLeft = Math.max(0, Math.ceil((tr.expiresAt - nowMs) / 1000));
              const diff = incomingFairness.offerValue - incomingFairness.requestValue;

              const renderSideCards = (side: TradeSide, isGain: boolean) => {
                const isEmpty =
                  side.cash === 0 && side.shields === 0 && side.propertyIds.length === 0;

                return (
                  <div className="space-y-2">
                    {side.cash > 0 && (
                      <div
                        className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                          isGain
                            ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100'
                            : 'bg-rose-500/15 border-rose-400/45 text-rose-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg leading-none">{isGain ? '💵' : '💸'}</span>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide opacity-75 font-bold">
                              Наличные
                            </div>
                            <div className="text-sm font-black tabular-nums">
                              {isGain ? '+' : '-'}
                              {formatMoney(side.cash)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {side.shields > 0 && (
                      <div className="rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2 flex items-center gap-2 text-sky-100">
                        <span className="text-lg leading-none">🛡️</span>
                        <div>
                          <div className="text-xs font-extrabold">
                            Крыша от братков ×{side.shields}
                          </div>
                          <div className="text-[10px] opacity-75">Оценка $1 000 за щит</div>
                        </div>
                      </div>
                    )}

                    {side.propertyIds.map((cid) => {
                      const def = BOARD_CELLS[cid];
                      const grp = def.groupId ? INDUSTRIES[def.groupId] : null;
                      const rt = roomState.cells[cid];
                      const baseRent = def.rents?.[0] ?? 0;

                      const completesMonopoly =
                        isGain &&
                        Boolean(def.groupId) &&
                        BOARD_CELLS.filter((c) => c.groupId === def.groupId).every((c) => {
                          if (tr.request.propertyIds.includes(c.id)) return false;
                          return (
                            roomState.cells[c.id]?.ownerId === myPlayerId ||
                            tr.offer.propertyIds.includes(c.id)
                          );
                        });

                      return (
                        <div
                          key={cid}
                          className="rounded-xl overflow-hidden border border-white/15 bg-[#23252d] shadow-sm"
                        >
                          <div
                            style={{ backgroundColor: grp?.accentHex || '#475569' }}
                            className="px-2.5 py-1 flex items-center justify-between gap-2 text-[10px] font-extrabold text-white"
                          >
                            <span className="truncate flex items-center gap-1">
                              <span>{def.icon}</span>
                              <span>{grp ? txt(grp.name, grp.cleanName, censored) : 'Актив'}</span>
                            </span>
                            <span className="shrink-0 bg-black/30 px-1.5 py-0.5 rounded">
                              {rt?.isMortgaged
                                ? '🔒 Залог'
                                : `$${def.price ?? 0}`}
                            </span>
                          </div>
                          <div className="px-2.5 py-1.5 space-y-0.5">
                            <div className="text-xs font-extrabold text-white leading-tight">
                              {txt(def.name, def.cleanName, censored)}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-neutral-400">
                              <span>
                                {def.type === 'IT_UTILITY'
                                  ? 'Рента: 🎲×100 / ×250'
                                  : `Базовая рента: $${baseRent}`}
                              </span>
                              {completesMonopoly && (
                                <span className="text-amber-300 font-black">⭐ МОНОПОЛИЯ!</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isEmpty && (
                      <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center text-xs text-neutral-400">
                        {isGain ? 'Ничего (пусто)' : 'Ничего (подарок)'}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        style={{
                          borderColor: sender?.color || '#818cf8',
                          backgroundColor: `${sender?.color || '#818cf8'}28`,
                        }}
                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-base shrink-0"
                      >
                        {sender?.avatar || '🤝'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10.5px] uppercase tracking-wider text-indigo-300 font-extrabold">
                          Входящее предложение обмена
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-white truncate">
                          От{' '}
                          <span style={{ color: sender?.color || '#fff' }}>{sender?.name}</span>{' '}
                          <span className="text-neutral-400 font-normal">→ вам</span>
                        </h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 font-black text-xs shrink-0 tabular-nums">
                      ⏳ {secLeft}с
                    </span>
                  </div>

                  {/* Сводка оценки сделки */}
                  <div className="rounded-xl bg-black/35 border border-white/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-emerald-300 font-extrabold">
                        Ты получишь: {formatMoney(incomingFairness.offerValue)}
                      </span>
                      <span className="text-neutral-500">⇄</span>
                      <span className="text-rose-300 font-extrabold">
                        Ты отдашь: {formatMoney(incomingFairness.requestValue)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                        diff > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : diff < 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          : 'bg-white/10 text-neutral-300 border border-white/15'
                      }`}
                    >
                      {diff > 0
                        ? `📈 В плюс +${formatMoney(diff)}`
                        : diff < 0
                        ? `📉 Разница -${formatMoney(Math.abs(diff))}`
                        : '⚖️ Равноценно 1:1'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-emerald-950/35 border border-emerald-500/45 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between font-black text-emerald-300 text-xs border-b border-emerald-500/25 pb-1.5">
                        <span>📥 ТЫ ПОЛУЧАЕШЬ</span>
                        <span className="tabular-nums">{formatMoney(incomingFairness.offerValue)}</span>
                      </div>
                      {renderSideCards(tr.offer, true)}
                    </div>

                    <div className="bg-rose-950/35 border border-rose-500/45 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between font-black text-rose-300 text-xs border-b border-rose-500/25 pb-1.5">
                        <span>📤 ТЫ ОТДАЁШЬ</span>
                        <span className="tabular-nums">{formatMoney(incomingFairness.requestValue)}</span>
                      </div>
                      {renderSideCards(tr.request, false)}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onRespondTrade(true)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-md transition"
                    >
                      ✅ Принять сделку
                    </button>
                    <button
                      onClick={() => onRespondTrade(false)}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm cursor-pointer transition"
                    >
                      ❌ Отклонить
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. МОДАЛКА БАНКОВСКОГО КРЕДИТА */}
      {creditModalOpen && me && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/60 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-amber-300">
                🏦 Банковский Кредит
              </h3>
              <button
                onClick={onCloseCreditModal}
                className="px-2 py-1 rounded-lg bg-slate-800 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {me.credit ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs text-slate-300">
                  Активный займ: нужно вернуть{' '}
                  <b className="text-rose-400">{formatMoney(me.credit.paybackAmount)}</b> до{' '}
                  <b>{me.credit.dueRound}-го раунда</b> (сейчас {roomState.round}-й раунд).
                </div>
                <button
                  disabled={
                    me.cash < me.credit.paybackAmount ||
                    roomState.settings.retroRules ||
                    roomState.settings.mode === 'retro'
                  }
                  onClick={() => {
                    onRepayCredit();
                    onCloseCreditModal();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer"
                >
                  {roomState.settings.retroRules
                    ? 'В Ретро-режиме досрочное погашение недоступно'
                    : `💸 Погасить досрочно (${formatMoney(me.credit.paybackAmount)})`}
                </button>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs text-slate-300">
                <p>
                  Получи мгновенно <b className="text-emerald-400">+5.000k</b> на руки. Возврат с
                  процентами — <b className="text-amber-300">6.000k</b> через{' '}
                  {isSpeedRulesMode(roomState.settings) ? 6 : 8} раундов.
                </p>
                <p className="text-[11px] text-slate-400">
                  Доступен в свой ход с {isSpeedRulesMode(roomState.settings) ? 10 : 3}-го раунда
                  (повторно через 3 раунда после возврата).
                </p>
                <button
                  disabled={!isMyTurn || !roomState.settings.creditEnabled}
                  onClick={() => {
                    onTakeCredit();
                    onCloseCreditModal();
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer"
                >
                  🏦 Взять +5.000k прямо сейчас
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
