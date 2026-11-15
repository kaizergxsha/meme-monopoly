import React, { useEffect, useRef, useState } from 'react';
import { TAUNTS } from '../../shared/memeContent.ts';
import {
  calculateNetWorth,
  formatMoney,
  getTokenWalkDurationMs,
  txt,
} from '../../shared/rules.ts';
import { PlayerStats, RoomState, TauntEvent } from '../../shared/types.ts';
import { soundEngine } from '../utils/soundEngine.ts';

export const PLAYER_STAT_ROWS: { key: keyof PlayerStats; icon: string; label: string }[] = [
  { key: 'cellsBought', icon: '🏷️', label: 'Куплено клеток' },
  { key: 'monopoliesCollected', icon: '🏢', label: 'Собрано монополий' },
  { key: 'rouletteDeaths', icon: '💀', label: 'Смертей в рулетке' },
  { key: 'casinoWins', icon: '🎰', label: 'Выигрышей в казино' },
  { key: 'wins', icon: '🏆', label: 'Побед' },
  { key: 'bankruptcies', icon: '📉', label: 'Банкротств' },
];

interface PlayersSidebarProps {
  roomState: RoomState;
  myPlayerId: string;
  activeTaunts: Record<string, TauntEvent>;
  censored: boolean;
  nowMs: number;
  onToggleCensor: () => void;
  onOpenTradeWith: (targetPlayerId?: string) => void;
  onOpenCredit: () => void;
  onSendTaunt: (tauntId: string) => void;
  onSurrender: () => void;
  onLeaveRoom: () => void;
}

interface CashDeltaItem {
  id: string;
  playerId: string;
  delta: number;
}

function formatM1Cash(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const formatted = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}$ ${formatted}`;
}

const RipTombstoneSvg: React.FC = () => (
  <svg viewBox="0 0 36 38" className="w-6 h-6 mx-auto mt-1 opacity-75">
    <path
      d="M7 34V16C7 9.925 11.925 5 18 5s11 4.925 11 11v18H7z"
      fill="#6b7280"
    />
    <path
      d="M9 34V16c0-4.97 4.03-9 9-9s9 4.03 9 9v18H9z"
      fill="#8b929e"
    />
    <rect x="4" y="33" width="28" height="3.5" rx="1.5" fill="#525866" />
    <text
      x="18"
      y="23"
      textAnchor="middle"
      fill="#23252b"
      fontSize="8.5"
      fontWeight="900"
      fontFamily="Inter, sans-serif"
    >
      RIP
    </text>
  </svg>
);

export const PlayersSidebar: React.FC<PlayersSidebarProps> = ({
  roomState,
  myPlayerId,
  activeTaunts,
  censored,
  nowMs,
  onOpenTradeWith,
  onOpenCredit,
  onSendTaunt,
  onSurrender,
}) => {
  const [menuPlayerId, setMenuPlayerId] = useState<string | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [deltas, setDeltas] = useState<CashDeltaItem[]>([]);
  const prevCashRef = useRef<Record<string, number>>({});
  const deltaTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = deltaTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const curPlayer = roomState.players[roomState.currentPlayerIndex];
  const isMyTurn = curPlayer?.id === myPlayerId;
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const tauntCooldownLeft = me
    ? Math.max(0, Math.ceil((me.lastTauntAt + 5000 - nowMs) / 1000))
    : 0;

  // Отслеживание изменений баланса: плашка внутри карточки + личные звуки прихода/траты денег
  useEffect(() => {
    const diceTs = roomState.lastDice?.timestamp ?? 0;
    const walkRemaining =
      roomState.lastDice && Date.now() - diceTs < 500
        ? Math.max(0, diceTs + getTokenWalkDurationMs(roomState.lastDice) - Date.now())
        : 0;

    for (const p of roomState.players) {
      const prev = prevCashRef.current[p.id];
      if (prev !== undefined && prev !== p.cash) {
        const diff = p.cash - prev;
        if (Math.abs(diff) > 0) {
          const trigger = () => {
            const id = `${p.id}_${Date.now()}_${Math.random()}`;
            setDeltas((cur) => [...cur.slice(-6), { id, playerId: p.id, delta: diff }]);
            // Звук монет или списания слышит ТОЛЬКО тот игрок, чей баланс изменился
            if (p.id === myPlayerId) {
              if (diff > 0) {
                soundEngine.playCashGain();
              } else {
                soundEngine.playCashSpend();
              }
            }
            const rmTimer = setTimeout(() => {
              deltaTimersRef.current.delete(rmTimer);
              setDeltas((cur) => cur.filter((x) => x.id !== id));
            }, 1900);
            deltaTimersRef.current.add(rmTimer);
          };

          if (walkRemaining > 0) {
            const delayTimer = setTimeout(() => {
              deltaTimersRef.current.delete(delayTimer);
              trigger();
            }, walkRemaining);
            deltaTimersRef.current.add(delayTimer);
          } else {
            trigger();
          }
        }
      }
      prevCashRef.current[p.id] = p.cash;
    }
  }, [roomState.players, roomState.lastDice, myPlayerId]);

  const turnRemainingSec =
    roomState.turnDeadlineAt && roomState.status === 'PLAYING'
      ? Math.max(0, Math.ceil((roomState.turnDeadlineAt - nowMs) / 1000))
      : null;

  return (
    <>
      {/* Затемнение и размытие фона при клике на карточку игрока (1:1 референс) */}
      {menuPlayerId && (
        <div
          onClick={() => {
            setMenuPlayerId(null);
            setConfirmSurrender(false);
          }}
          className="fixed inset-0 bg-black/55 backdrop-blur-[3px] z-40 transition-opacity"
        />
      )}

      <aside className="w-full max-w-md lg:max-w-none lg:w-[192px] xl:w-[216px] shrink-0 h-full flex flex-col justify-start lg:justify-center gap-2.5 py-2 lg:py-3 px-2 select-none relative z-40">
        {/* Подсказка по панели игроков для новичков */}
        <div className="px-1 flex items-center justify-between text-[11px] lg:text-[10px] text-neutral-400 font-semibold shrink-0">
          <span>Игроки ({roomState.players.length})</span>
          <span className="text-neutral-500">клик = меню</span>
        </div>
        {/* Вертикальный стек карточек игроков в стиле Monopoly One */}
        <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-0 lg:flex-initial py-1 px-0.5 chat-scrollbar">
          {roomState.players.map((p, idx) => {
            const isActive = idx === roomState.currentPlayerIndex && roomState.status === 'PLAYING';
            const isMenuOpen = menuPlayerId === p.id;
            const tauntEv = activeTaunts[p.id];
            const tauntDef = tauntEv ? TAUNTS.find((t) => t.id === tauntEv.tauntId) : null;
            const netWorth = calculateNetWorth(p, roomState.cells);
            const propCount = roomState.cells.filter((c) => c.ownerId === p.id).length;
            const playerDeltas = deltas.filter((d) => d.playerId === p.id);

            return (
              <div
                key={p.id}
                className={`relative ${isMenuOpen ? 'z-50' : 'z-10'}`}
              >
                {/* Облачко мем-насмешки */}
                {tauntDef && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-300 text-neutral-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xl animate-bounce z-30 border border-neutral-900">
                    {txt(tauntDef.text, tauntDef.cleanText, censored)}
                  </div>
                )}

                {/* Сама карточка игрока (overflow-hidden чтобы анимация дельты не выезжала за край) */}
                <div
                  onClick={() => {
                    setConfirmSurrender(false);
                    setMenuPlayerId((cur) => (cur === p.id ? null : p.id));
                  }}
                  style={
                    p.isBankrupt
                      ? undefined
                      : isActive
                      ? {
                          backgroundColor: p.color,
                          boxShadow: `0 10px 26px ${p.color}55, 0 0 24px rgba(163,230,53,0.4)`,
                        }
                      : {
                          borderLeftColor: p.color,
                        }
                  }
                  className={`relative overflow-hidden rounded-[14px] px-3 py-3 text-center transition-all duration-300 cursor-pointer ${
                    p.isBankrupt
                      ? 'bg-[#1e1f24] border border-[#282a30] opacity-75'
                      : isActive
                      ? 'text-white border border-white/40 ring-2 ring-lime-300 scale-[1.02]'
                      : 'bg-[#222328] hover:bg-[#292b31] border border-[#2e3038] border-l-4 text-neutral-100'
                  }`}
                >
                  {/* Таймер активного хода слева от аватара */}
                  {isActive && !p.isBankrupt && turnRemainingSec !== null && (
                    <div
                      title={`Осталось ${turnRemainingSec} сек на ход`}
                      className={`absolute left-2 top-2.5 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 text-[10px] font-extrabold shadow-inner ${
                        turnRemainingSec <= 10
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-black/30 text-white'
                      }`}
                    >
                      <span>⏱</span>
                      <span className="tabular-nums">{turnRemainingSec}с</span>
                    </div>
                  )}

                  {/* Мини-бейджи статусов в правом верхнем углу */}
                  <div className="absolute right-2 top-2 flex flex-col gap-0.5 items-end text-[10px]">
                    {p.id === myPlayerId && (
                      <span
                        className={`px-1.5 py-[1px] rounded-full text-[8px] font-black uppercase ${
                          isActive
                            ? 'bg-black/25 text-white'
                            : 'bg-white/10 text-neutral-300'
                        }`}
                      >
                        Вы
                      </span>
                    )}
                    {roomState.settings.mode === 'team2v2' && (
                      <span
                        className={`px-1.5 py-[1px] rounded-full text-[8px] font-black ${
                          p.team === 0
                            ? 'bg-cyan-400/25 text-cyan-200'
                            : 'bg-fuchsia-400/25 text-fuchsia-200'
                        }`}
                      >
                        {p.team === 0 ? '2×2 A' : '2×2 B'}
                      </span>
                    )}
                    {p.inJail && <span title={`В обезьяннике (${p.jailTurns}/3)`}>⛓️</span>}
                    {p.shields > 0 && <span title={`Крыша ×${p.shields}`}>🛡️</span>}
                  </div>

                  {/* Круглый аватар с цветным кольцом */}
                  <div
                    style={{
                      borderColor: p.isBankrupt
                        ? '#52525b'
                        : isActive
                        ? 'rgba(255,255,255,0.85)'
                        : p.color,
                      backgroundColor: p.isBankrupt
                        ? '#27272a'
                        : isActive
                        ? 'rgba(0,0,0,0.18)'
                        : `${p.color}22`,
                    }}
                    className={`w-11 h-11 mx-auto rounded-full border-[2.5px] flex items-center justify-center text-xl shadow-md ${
                      p.isBankrupt ? 'grayscale opacity-60' : ''
                    }`}
                  >
                    {p.avatar}
                  </div>

                  {/* Никнейм и явный индикатор активного хода */}
                  <div className="mt-1.5 flex items-center justify-center gap-1 min-w-0">
                    {isActive && !p.isBankrupt && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-300 opacity-85" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400" />
                      </span>
                    )}
                    <span
                      className={`text-[12px] font-semibold truncate ${
                        p.isBankrupt
                          ? 'text-neutral-500'
                          : isActive
                          ? 'text-white font-bold'
                          : 'text-neutral-200'
                      }`}
                    >
                      {p.name}
                    </span>
                  </div>
                  {isActive && !p.isBankrupt && (
                    <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-[1px] rounded-full bg-black/30 border border-lime-300/60 text-lime-200 text-[9px] font-black tracking-wide uppercase shadow-xs">
                      <span>👉</span>
                      <span>{p.id === myPlayerId ? 'ВАШ ХОД' : 'ХОДИТ'}</span>
                    </div>
                  )}

                  {/* Баланс либо надгробие RIP */}
                  {p.isBankrupt ? (
                    <RipTombstoneSvg />
                  ) : (
                    <>
                      <div
                        className={`mt-0.5 text-[18px] leading-tight font-semibold tracking-tight ${
                          isActive ? 'text-white' : 'text-white'
                        }`}
                      >
                        {formatM1Cash(p.cash)}
                      </div>
                      {p.credit && (
                        <div
                          title={`Активный кредит: вернуть ${formatMoney(p.credit.paybackAmount)} до ${p.credit.dueRound} раунда`}
                          className="mt-1 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-300/60 text-amber-100 text-[10px] font-extrabold shadow-xs"
                        >
                          <span className="text-sm leading-none">🏦</span>
                          <span>Кредит · {p.credit.dueRound}р</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Всплывающая дельта денег строго внутри границ карточки */}
                  {playerDeltas.map((d) => (
                    <div
                      key={d.id}
                      className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-30 flex justify-center"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-black shadow-lg border border-black/20 animate-cash-delta ${
                          d.delta > 0
                            ? 'bg-lime-400 text-neutral-950'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {d.delta > 0 ? `+${formatM1Cash(d.delta)}` : formatM1Cash(d.delta)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Выпадающее контекстное меню при клике по карточке (как в референсе M1) */}
                {isMenuOpen && (
                  <div className="mt-1.5 rounded-xl bg-[#222328] border border-[#343640] p-1.5 shadow-2xl text-left text-xs space-y-1 animate-action-card">
                    <div className="px-2 py-1 text-[10px] text-neutral-400 border-b border-white/5 flex justify-between">
                      <span>Полей: {propCount}</span>
                      <span>Активы: {formatMoney(netWorth)}</span>
                    </div>

                    <div className="px-1 py-1 border-b border-white/5 space-y-0.5" data-testid="player-stats-panel">
                      <div className="px-1 pb-0.5 text-[10px] font-bold text-amber-300/90">
                        📊 Статистика за всё время
                      </div>
                      {PLAYER_STAT_ROWS.map((row) => (
                        <div
                          key={row.key}
                          className="text-[11px] flex items-center justify-between gap-1 px-2 py-0.5 rounded bg-white/[0.03]"
                        >
                          <span className="text-neutral-300 truncate">
                            {row.icon} {row.label}
                          </span>
                          <span className="font-extrabold text-white tabular-nums shrink-0">
                            {p.stats?.[row.key] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>

                    {p.id !== myPlayerId && !p.isBankrupt && roomState.status === 'PLAYING' && (
                      <button
                        disabled={!isMyTurn}
                        onClick={() => {
                          setMenuPlayerId(null);
                          onOpenTradeWith(p.id);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 text-neutral-100 font-semibold transition cursor-pointer"
                      >
                        <span>📄 Договор</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">
                          {propCount}
                        </span>
                      </button>
                    )}

                    {p.id === myPlayerId && !p.isBankrupt && roomState.status === 'PLAYING' && (
                      <>
                        <button
                          onClick={() => {
                            setMenuPlayerId(null);
                            onOpenCredit();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-neutral-100 font-semibold transition cursor-pointer"
                        >
                          <span>🏦 Кредит банка</span>
                        </button>
                        {!confirmSurrender ? (
                          <button
                            onClick={() => setConfirmSurrender(true)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 font-semibold transition cursor-pointer"
                          >
                            <span>🏳️ Сдаться</span>
                          </button>
                        ) : (
                          <div className="flex gap-1 pt-0.5">
                            <button
                              onClick={() => {
                                setConfirmSurrender(false);
                                setMenuPlayerId(null);
                                onSurrender();
                              }}
                              className="flex-1 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Точно!
                            </button>
                            <button
                              onClick={() => setConfirmSurrender(false)}
                              className="px-2 py-1 rounded-lg bg-neutral-700 text-neutral-200 text-[11px] cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Понятная панель быстрых действий: Крупная кнопка Кредита, Договор и мем-реакции */}
        {me && !me.isBankrupt && roomState.status === 'PLAYING' && (
          <div className="shrink-0 min-w-0 bg-[#222328] border border-[#2e3038] rounded-xl p-2 space-y-1.5 shadow-lg">
            <button
              onClick={onOpenCredit}
              className={`w-full py-1.5 px-2.5 rounded-xl flex items-center justify-between transition cursor-pointer border ${
                me.credit
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-200'
                  : 'bg-amber-400/15 hover:bg-amber-400/25 border-amber-400/35 text-amber-300'
              }`}
              title="Взять или погасить кредит банка"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-xl leading-none shrink-0">🏦</span>
                <span className="text-left leading-tight min-w-0">
                  <span className="block text-xs font-black tracking-wide text-amber-200">
                    КРЕДИТ
                  </span>
                  <span className="block text-[10px] font-semibold text-amber-300/80 truncate">
                    {me.credit ? `Долг ${formatMoney(me.credit.paybackAmount)}` : 'Взять +$5 000'}
                  </span>
                </span>
              </span>
              <span className="text-[11px] font-black opacity-80 shrink-0">›</span>
            </button>

            <button
              disabled={!isMyTurn}
              onClick={() => onOpenTradeWith()}
              className="w-full py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/12 disabled:opacity-35 flex items-center justify-center gap-1.5 text-xs font-bold text-lime-300 transition cursor-pointer border border-white/10"
              title="Предложить обмен полями и деньгами другому игроку"
            >
              <span className="text-base leading-none">🤝</span>
              <span>Сделка (обмен)</span>
            </button>

            {/* Голосовые фразы с озвучкой для всех игроков */}
            <div className="space-y-1 pt-0.5 min-w-0">
              {tauntCooldownLeft > 0 && (
                <div className="text-[9.5px] font-bold text-amber-300/85 text-center leading-none pb-0.5 tabular-nums">
                  ⏳ Откат озвучки: {tauntCooldownLeft}с
                </div>
              )}
              <button
                type="button"
                data-testid="taunt-voice-loh"
                disabled={tauntCooldownLeft > 0}
                onClick={() => onSendTaunt('loh')}
                title={censored ? 'Ну ты и простофиля! (с озвучкой)' : 'Ебать ты лох! (с озвучкой)'}
                className="w-full min-w-0 py-1.5 px-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 border border-amber-400/45 disabled:opacity-35 text-amber-100 text-[10.5px] xl:text-[11px] font-extrabold leading-tight flex items-center justify-between gap-1 transition cursor-pointer shadow-xs"
              >
                <span className="min-w-0 text-left break-words">
                  {censored ? '🤡 Ну ты и простофиля' : '🤡 Ебать ты лох'}
                </span>
                <span className="shrink-0 text-xs leading-none">🔊</span>
              </button>

              <button
                type="button"
                data-testid="taunt-voice-rent-rage"
                disabled={tauntCooldownLeft > 0}
                onClick={() => onSendTaunt('rent_rage')}
                title={
                  censored
                    ? 'Да сколько можно платить аренду?! (с озвучкой)'
                    : 'Иди нахуй со своей арендой! (с озвучкой)'
                }
                className="w-full min-w-0 py-1.5 px-2 rounded-lg bg-gradient-to-r from-rose-500/20 to-fuchsia-500/20 hover:from-rose-500/35 hover:to-fuchsia-500/35 border border-rose-400/45 disabled:opacity-35 text-rose-100 text-[10px] xl:text-[10.5px] font-extrabold leading-tight flex items-center justify-between gap-1 transition cursor-pointer shadow-xs"
              >
                <span className="min-w-0 text-left break-words">
                  {censored
                    ? '😤 Сколько можно платить аренду'
                    : '🖕 Иди нахуй со своей арендой'}
                </span>
                <span className="shrink-0 text-xs leading-none">🔊</span>
              </button>

              {/* Быстрые звуковые подколы */}
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {TAUNTS.filter((t) => t.id !== 'loh' && t.id !== 'rent_rage').map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={tauntCooldownLeft > 0}
                    onClick={() => onSendTaunt(t.id)}
                    title={txt(t.text, t.cleanText, censored)}
                    className="py-1 rounded-md bg-black/30 hover:bg-white/10 border border-white/5 disabled:opacity-35 text-xs flex items-center justify-center transition cursor-pointer"
                  >
                    {t.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
