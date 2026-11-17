import React, { useEffect, useRef, useState } from 'react';
import { TAUNT_COOLDOWN_MS, TAUNTS } from '../../shared/memeContent.ts';
import {
  calculateNetWorth,
  formatMoney,
  getTokenWalkDurationMs,
  isSpeedRulesMode,
  txt,
} from '../../shared/rules.ts';
import { RoomState, TauntEvent } from '../../shared/types.ts';
import { useCockpitMode } from '../hooks/useCockpitMode.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { AppleEmoji } from './AppleEmoji.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface PlayersSidebarProps {
  roomState: RoomState;
  myPlayerId: string;
  activeTaunts: Record<string, TauntEvent>;
  censored: boolean;
  nowMs: number;
  onToggleCensor: () => void;
  onOpenTradeWith: (targetPlayerId?: string) => void;
  onStartKickVote: (targetPlayerId: string) => void;
  onOpenCredit: () => void;
  onOpenProfile: (playerId: string) => void;
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
  return formatMoney(amount);
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

const SoundpadEqIcon: React.FC<{ playing: boolean; accentHex: string }> = ({
  playing,
  accentHex,
}) => (
  <span
    style={
      playing
        ? {
            borderColor: `${accentHex}99`,
            backgroundColor: `${accentHex}24`,
            boxShadow: `0 0 10px ${accentHex}55`,
          }
        : undefined
    }
    className="shrink-0 w-5 h-4 rounded-md bg-[#0A0C12]/90 border border-white/10 flex items-center justify-center gap-[1.5px] px-0.5"
    aria-hidden="true"
  >
    <span
      style={{ backgroundColor: playing ? accentHex : '#94A3B8' }}
      className={`w-[2px] h-2.5 rounded-full origin-bottom transition-transform ${
        playing ? 'animate-eq-1' : 'scale-y-50 opacity-75'
      }`}
    />
    <span
      style={{ backgroundColor: playing ? accentHex : '#CBD5E1' }}
      className={`w-[2px] h-3 rounded-full origin-bottom transition-transform ${
        playing ? 'animate-eq-2' : 'scale-y-90 opacity-85'
      }`}
    />
    <span
      style={{ backgroundColor: playing ? accentHex : '#94A3B8' }}
      className={`w-[2px] h-2.5 rounded-full origin-bottom transition-transform ${
        playing ? 'animate-eq-3' : 'scale-y-65 opacity-75'
      }`}
    />
  </span>
);

export const PlayersSidebar: React.FC<PlayersSidebarProps> = ({
  roomState,
  myPlayerId,
  activeTaunts,
  censored,
  nowMs,
  onOpenTradeWith,
  onStartKickVote,
  onOpenCredit,
  onOpenProfile,
  onSendTaunt,
  onSurrender,
}) => {
  const { isCockpit } = useCockpitMode();
  const [menuPlayerId, setMenuPlayerId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [playingPadId, setPlayingPadId] = useState<string | null>(null);
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
  const tradesLeft = Math.max(0, 3 - (roomState.tradesProposedThisTurn ?? 0));
  const me = roomState.players.find((p) => p.id === myPlayerId);
  const tauntCooldownLeft = roomState.lastTauntAt
    ? Math.max(0, Math.ceil((roomState.lastTauntAt + TAUNT_COOLDOWN_MS - nowMs) / 1000))
    : 0;

  const triggerPadTaunt = (tauntId: string) => {
    if (tauntCooldownLeft > 0) return;
    setPlayingPadId(tauntId);
    onSendTaunt(tauntId);
    const t = setTimeout(() => {
      deltaTimersRef.current.delete(t);
      setPlayingPadId((cur) => (cur === tauntId ? null : cur));
    }, 2400);
    deltaTimersRef.current.add(t);
  };

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
      {/* Лёгкая элегантная вуаль при открытии меню игрока без тяжёлого замыливания всей доски */}
      {menuPlayerId && (
        <div
          onClick={() => {
            setMenuPlayerId(null);
            setMenuAnchor(null);
            setConfirmSurrender(false);
          }}
          className="fixed inset-0 bg-black/18 backdrop-blur-[1.5px] z-30 transition-opacity"
        />
      )}

      <aside className="cockpit-sidebar-aside shrink-0 h-full flex flex-col select-none relative z-40">
        {/* Заголовок левого HUD резидентов */}
        <div className="px-1.5 flex items-center justify-between text-[10px] text-neutral-400 font-semibold shrink-0 uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5B869] shadow-[0_0_8px_#E5B869]" />
            <span>Резиденты ({roomState.players.length})</span>
          </span>
          <span className="text-neutral-500 normal-case tracking-normal">клик = меню</span>
        </div>

        {/* Вертикальный стек карточек игроков на тёмном графите #141720 с мощным неоновым акцентом слева */}
        <div className="sidebar-players-list flex flex-col gap-1.5 xl:gap-2 px-0.5 chat-scrollbar">
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
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-[#F3D082] to-[#C8963E] text-[#140F06] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-[0_8px_20px_rgba(229,184,105,0.45)] animate-bounce z-30 border border-[#FEF3C7]/70">
                    {txt(tauntDef.text, tauntDef.cleanText, censored)}
                  </div>
                )}

                {/* Карточка игрока: благородный графит #141720 + неоновый LED-акцент слева и вокруг аватара */}
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setConfirmSurrender(false);
                    setMenuPlayerId((cur) => {
                      if (cur === p.id) {
                        setMenuAnchor(null);
                        return null;
                      }
                      setMenuAnchor({ top: rect.top, right: rect.right });
                      return p.id;
                    });
                  }}
                  style={
                    p.isBankrupt
                      ? undefined
                      : isActive
                      ? {
                          background: `radial-gradient(125% 115% at 0% 50%, color-mix(in srgb, ${p.color} 26%, #141720) 0%, #141720 66%, #0F121A 100%)`,
                          boxShadow: `0 14px 34px -6px rgba(0,0,0,0.88), 0 0 24px -4px ${p.color}55, inset 0 1px 0 rgba(255,255,255,0.14)`,
                        }
                      : {
                          background: `radial-gradient(110% 100% at 0% 50%, color-mix(in srgb, ${p.color} 11%, #141720) 0%, #141720 62%)`,
                          boxShadow:
                            '0 10px 24px -6px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08)',
                        }
                  }
                  className={`sidebar-player-card relative overflow-hidden rounded-2xl pl-3.5 pr-2.5 py-2 transition-all duration-200 cursor-pointer ${
                    p.isBankrupt
                      ? 'bg-[#0F1117]/80 border border-white/[0.06] opacity-55'
                      : isActive
                      ? 'border border-[#E5B869]/45 ring-1 ring-[#E5B869]/30 text-[#F8FAFC]'
                      : 'border border-[#222736] hover:border-white/20 text-[#F1F5F9]'
                  }`}
                >
                  {/* Мощная неоновая LED-полоса цвета игрока слева */}
                  {!p.isBankrupt && (
                    <span
                      aria-hidden="true"
                      style={{
                        backgroundColor: p.color,
                        boxShadow: isActive
                          ? `0 0 18px ${p.color}, 3px 0 22px ${p.color}aa`
                          : `0 0 10px ${p.color}88`,
                      }}
                      className={`pointer-events-none absolute left-0 inset-y-0 ${
                        isActive ? 'w-[4.5px]' : 'w-[3.5px] opacity-90'
                      }`}
                    />
                  )}

                  {/* Верхняя строка карточки: Аватар с неоновым ореолом + Имя и Баланс */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={
                        p.isBankrupt
                          ? { borderColor: '#3f3f46', backgroundColor: '#18181b' }
                          : {
                              borderColor: p.color,
                              backgroundColor: `${p.color}1F`,
                              boxShadow: isActive
                                ? `0 0 18px ${p.color}99, 0 0 6px ${p.color}, inset 0 0 8px ${p.color}55`
                                : `0 0 12px ${p.color}4D`,
                            }
                      }
                      className={`sidebar-player-avatar w-10 h-10 xl:w-11 xl:h-11 shrink-0 rounded-full border-2 flex items-center justify-center text-xl overflow-hidden ${
                        p.isBankrupt ? 'grayscale opacity-60' : ''
                      }`}
                    >
                      <PlayerAvatar avatar={p.avatar} fill />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      {/* Никнейм + статус ВЫ / 2×2 / таймер */}
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {isActive && !p.isBankrupt && (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span
                                style={{ backgroundColor: p.color }}
                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
                              />
                              <span
                                style={{ backgroundColor: p.color }}
                                className="relative inline-flex rounded-full h-2 w-2"
                              />
                            </span>
                          )}
                          <span
                            className={`text-[12px] font-bold truncate ${
                              p.isBankrupt
                                ? 'text-neutral-500 line-through'
                                : isActive
                                ? 'text-[#F8FAFC]'
                                : 'text-[#E2E8F0]'
                            }`}
                          >
                            {p.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {p.inJail && (
                            <span className="text-[11px] inline-flex items-center" title={`В Учебке (${p.jailTurns}/3)`}>
                              <AppleEmoji emoji="🪖" />
                            </span>
                          )}
                          {(p.reverseTurns ?? 0) > 0 && (
                            <span
                              className="px-1 py-[0.5px] rounded-full bg-purple-500/25 border border-purple-400/50 text-purple-200 text-[8.5px] font-mono-num font-bold"
                              title={`Задний ход: ещё ${p.reverseTurns} бр.`}
                            >
                              ⏪×{p.reverseTurns}
                            </span>
                          )}
                          {p.shields > 0 && (
                            <span className="text-[11px] inline-flex items-center" title={`Крыша ×${p.shields}`}>
                              <AppleEmoji emoji="🛡️" />
                            </span>
                          )}
                          {roomState.settings.mode === 'team2v2' && (
                            <span
                              className={`px-1.5 py-[1px] rounded-full text-[8px] font-mono-num font-bold ${
                                p.team === 0
                                  ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/35'
                                  : 'bg-fuchsia-400/20 text-fuchsia-200 border border-fuchsia-400/35'
                              }`}
                            >
                              {p.team === 0 ? '2×2 A' : '2×2 B'}
                            </span>
                          )}
                          {p.id === myPlayerId && (
                            <span className="px-1.5 py-[1px] rounded-full bg-white/[0.08] border border-white/15 text-[#E5B869] text-[8px] font-display font-bold uppercase">
                              Вы
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Баланс крупно шрифтом Unbounded / JetBrains Mono либо RIP */}
                      {p.isBankrupt ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RipTombstoneSvg />
                          <span className="text-[10px] font-mono-num font-bold text-neutral-500 uppercase">
                            Банкрот
                          </span>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-baseline justify-between gap-1.5">
                          <span className="sidebar-player-cash font-display font-extrabold tabular-nums text-[15px] xl:text-[17.5px] leading-tight tracking-tight text-[#F8FAFC]">
                            {formatM1Cash(p.cash)}
                          </span>

                          {isActive && turnRemainingSec !== null ? (
                            <span
                              title={`Осталось ${turnRemainingSec} сек на ход`}
                              className={`px-1.5 py-[1px] rounded-full font-mono-num text-[9.5px] font-bold flex items-center gap-0.5 shrink-0 ${
                                turnRemainingSec <= 10
                                  ? 'bg-[#F43F5E] text-white animate-pulse'
                                  : 'bg-[#0A0C12]/85 border border-white/12 text-neutral-300'
                              }`}
                            >
                              <span>⏱</span>
                              <span>{turnRemainingSec}с</span>
                            </span>
                          ) : propCount > 0 ? (
                            <span className="text-[9.5px] font-mono-num text-neutral-400 shrink-0">
                              {propCount} ак.
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Плашка активного хода ВАШ ХОД / ХОДИТ */}
                  {isActive && !p.isBankrupt && (
                    <div className="mt-1.5 flex items-center justify-between gap-1.5 pt-1 border-t border-white/[0.06]">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-[1.5px] rounded-full font-display font-bold text-[8.5px] tracking-wider uppercase ${
                          p.id === myPlayerId
                            ? 'bg-[#E5B869]/16 border border-[#E5B869]/50 text-[#F3D082] shadow-[0_0_12px_rgba(229,184,105,0.2)]'
                            : 'bg-[#10B981]/14 border border-[#10B981]/40 text-[#6EE7B7]'
                        }`}
                      >
                        <span>{p.id === myPlayerId ? 'ВАШ ХОД' : 'ХОДИТ'}</span>
                      </span>
                      <span className="text-[9.5px] font-mono-num text-neutral-400">
                        Капитал {formatMoney(netWorth)}
                      </span>
                    </div>
                  )}

                  {/* Индикатор открытого кредита */}
                  {!p.isBankrupt && p.credit && (() => {
                    const defaultTerm = 10;
                    const totalTerm =
                      p.credit.takenAtRound !== undefined
                        ? Math.max(1, p.credit.dueRound - p.credit.takenAtRound)
                        : defaultTerm;
                    const roundsLeft = Math.max(0, p.credit.dueRound - roomState.round);
                    const elapsed = Math.max(0, Math.min(totalTerm, totalTerm - roundsLeft));
                    const pct = Math.round((elapsed / totalTerm) * 100);
                    const urgent = roundsLeft <= 2;
                    return (
                      <div
                        data-testid="player-credit-countdown"
                        title={`Кредит: вернуть ${formatMoney(p.credit.paybackAmount)} до ${p.credit.dueRound} раунда (осталось ${roundsLeft} р.)`}
                        className={`mt-1.5 px-2 py-0.5 rounded-lg border font-mono-num text-[9.5px] font-bold ${
                          urgent
                            ? 'bg-[#F43F5E]/20 border-[#F43F5E]/60 text-rose-100 animate-pulse'
                            : 'bg-[#E5B869]/14 border-[#E5B869]/40 text-[#F3D082]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span>🏦 Долг {formatMoney(p.credit.paybackAmount)}</span>
                          <span>{roundsLeft}р</span>
                        </div>
                        <div className="mt-0.5 h-1 w-full rounded-full bg-black/45 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              urgent ? 'bg-[#F43F5E]' : 'bg-[#E5B869]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Всплывающая дельта денег строго внутри границ карточки */}
                  {playerDeltas.map((d) => (
                    <div
                      key={d.id}
                      className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-30 flex justify-end pr-2"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono-num text-[11px] font-extrabold shadow-lg border animate-cash-delta ${
                          d.delta > 0
                            ? 'bg-[#10B981] border-[#6EE7B7]/60 text-white'
                            : 'bg-[#F43F5E] border-rose-300/50 text-white'
                        }`}
                      >
                        {d.delta > 0 ? `+${formatM1Cash(d.delta)}` : formatM1Cash(d.delta)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Выпадающее контекстное меню при клике по игроку: локальная глубокая тень без мёртвого блюра поля */}
                {isMenuOpen && (
                  <div
                    style={
                      isCockpit && menuAnchor
                        ? {
                            position: 'fixed',
                            top: Math.max(12, Math.min(window.innerHeight - 270, menuAnchor.top)),
                            left: Math.min(window.innerWidth - 246, menuAnchor.right + 10),
                            width: 234,
                          }
                        : undefined
                    }
                    className={`${
                      isCockpit ? '' : 'mt-1.5'
                    } z-50 rounded-2xl bg-[#11141E]/98 backdrop-blur-xl border border-white/12 p-2 shadow-[0_28px_70px_rgba(0,0,0,0.92),0_0_0_1px_rgba(229,184,105,0.16)] text-left text-xs space-y-1 animate-action-card`}
                  >
                    <div className="px-2.5 py-1.5 text-[10px] text-neutral-400 border-b border-white/[0.07] flex justify-between items-center font-mono-num">
                      <span>Активов: <b className="text-[#F1F5F9]">{propCount}</b></span>
                      <span>Капитал: <b className="text-[#E5B869]">{formatMoney(netWorth)}</b></span>
                    </div>

                    <button
                      type="button"
                      data-testid="card-profile-btn"
                      onClick={() => {
                        setMenuPlayerId(null);
                        onOpenProfile(p.id);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-[#F1F5F9] font-semibold transition cursor-pointer"
                    >
                      <span>📊 Профиль и статистика</span>
                    </button>

                    {p.id !== myPlayerId && !p.isBankrupt && roomState.status === 'PLAYING' && (
                      <>
                        <button
                          data-testid="card-trade-btn"
                          disabled={!isMyTurn || tradesLeft <= 0}
                          onClick={() => {
                            setMenuPlayerId(null);
                            onOpenTradeWith(p.id);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[#E5B869]/14 disabled:opacity-40 text-[#F3D082] font-semibold transition cursor-pointer"
                        >
                          <span>🤝 Договор ({tradesLeft}/3)</span>
                          <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white">
                            {propCount}
                          </span>
                        </button>
                        <button
                          data-testid="card-kick-btn"
                          disabled={
                            Boolean(roomState.activeKickVote) ||
                            roomState.players.filter((pl) => !pl.isBankrupt).length < 3
                          }
                          title={
                            roomState.activeKickVote
                              ? 'Уже идёт другое голосование за кик'
                              : roomState.players.filter((pl) => !pl.isBankrupt).length < 3
                              ? 'Голосование за кик доступно от 3 активных игроков'
                              : `Запустить голосование за кик ${p.name}`
                          }
                          onClick={() => {
                            setMenuPlayerId(null);
                            onStartKickVote(p.id);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[#F43F5E]/18 disabled:opacity-40 text-rose-300 font-semibold transition cursor-pointer"
                        >
                          <span>👢 Кикнуть</span>
                          <span className="text-[10px] opacity-80">🗳️</span>
                        </button>
                      </>
                    )}

                    {p.id === myPlayerId && !p.isBankrupt && roomState.status === 'PLAYING' && (
                      <>
                        <button
                          onClick={() => {
                            setMenuPlayerId(null);
                            onOpenCredit();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#10B981]/14 text-[#6EE7B7] font-semibold transition cursor-pointer"
                        >
                          <span>🏦 Кредит банка</span>
                        </button>
                        {!confirmSurrender ? (
                          <button
                            onClick={() => setConfirmSurrender(true)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#F43F5E]/18 text-[#F43F5E] font-semibold transition cursor-pointer"
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
                              className="flex-1 py-1 rounded-lg bg-[#F43F5E] text-white text-[11px] font-bold cursor-pointer"
                            >
                              Точно!
                            </button>
                            <button
                              onClick={() => setConfirmSurrender(false)}
                              className="px-2.5 py-1 rounded-lg bg-white/10 text-neutral-200 text-[11px] cursor-pointer"
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

        {/* НИЖНИЙ ДОК HUD: VIP-ЛИМИТ БАНКА «КРЕДИТ» + ФИЗИЧЕСКИЕ DJ / STREAMDECK ПЭДЫ САУНДПАДА */}
        {me && !me.isBankrupt && roomState.status === 'PLAYING' && (() => {
          const myCredit = me.credit;
          const defaultTerm = 10;
          const totalTerm = myCredit
            ? myCredit.takenAtRound !== undefined
              ? Math.max(1, myCredit.dueRound - myCredit.takenAtRound)
              : defaultTerm
            : defaultTerm;
          const roundsLeft = myCredit ? Math.max(0, myCredit.dueRound - roomState.round) : 0;
          const elapsed = myCredit ? Math.max(0, Math.min(totalTerm, totalTerm - roundsLeft)) : 0;
          const pct = Math.round((elapsed / totalTerm) * 100);
          const urgent = Boolean(myCredit && roundsLeft <= 2);
          const cooldownLeft =
            !myCredit && me.creditCooldownUntilRound && roomState.round < me.creditCooldownUntilRound
              ? me.creditCooldownUntilRound - roomState.round
              : 0;

          const activeRoomTaunt = Object.values(activeTaunts)[0] || null;
          const activeTauntPadId = playingPadId || activeRoomTaunt?.tauntId || null;

          return (
            <div className="shrink-0 min-w-0 glass-panel rounded-2xl p-2 space-y-2">
              {/* VIP-лимит в банке: блок «КРЕДИТ» с изумрудно-золотым акцентом (высота >= 48px) */}
              <button
                type="button"
                data-testid="sidebar-credit-report"
                onClick={onOpenCredit}
                className={`sidebar-credit-btn relative overflow-hidden w-full py-2 px-3 rounded-xl flex flex-col gap-1.5 transition cursor-pointer border ${
                  myCredit
                    ? urgent
                      ? 'bg-gradient-to-br from-[#271219] to-[#120B10] border-[#F43F5E]/70 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.28)]'
                      : 'bg-gradient-to-br from-[#201A12] to-[#101219] border-[#E5B869]/60 text-[#F3D082] shadow-[0_0_18px_rgba(229,184,105,0.18)]'
                    : 'bg-gradient-to-br from-[#10221E] via-[#131922] to-[#0D1017] border-[#10B981]/45 hover:border-[#E5B869]/70 text-[#F8FAFC] shadow-[inset_0_1px_0_rgba(110,231,183,0.2),0_8px_20px_rgba(0,0,0,0.5)]'
                }`}
                title="Открыть VIP-лимит и кредитную линию банка"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-4 -top-4 w-16 h-16 rounded-full bg-[radial-gradient(circle,rgba(229,184,105,0.22)_0%,transparent_70%)]"
                />
                <div className="w-full flex items-center justify-between gap-2 relative z-10">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#090C11]/85 border border-[#E5B869]/40 flex items-center justify-center text-sm shadow-inner shrink-0">
                      🏦
                    </span>
                    <span className="text-left leading-tight min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-display font-extrabold text-[11px] tracking-wider text-[#F8FAFC]">
                          КРЕДИТ
                        </span>
                        <span
                          className={`px-1.5 py-[0.5px] rounded text-[8px] font-mono-num font-bold uppercase ${
                            myCredit
                              ? urgent
                                ? 'bg-[#F43F5E]/25 text-rose-200'
                                : 'bg-[#E5B869]/20 text-[#F3D082]'
                              : 'bg-[#10B981]/20 border border-[#10B981]/35 text-[#6EE7B7]'
                          }`}
                        >
                          {myCredit ? (urgent ? 'СРОЧНО' : 'АКТИВЕН') : 'VIP ЛИМИТ'}
                        </span>
                      </span>
                      <span className="block font-mono-num text-[10px] font-semibold text-neutral-300 mt-0.5">
                        {myCredit
                          ? `Долг ${formatMoney(myCredit.paybackAmount)} · ${roundsLeft}р`
                          : cooldownLeft > 0
                          ? `Откат линии: ${cooldownLeft}р`
                          : `Доступно +${formatMoney(5000)}`}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#E5B869] shrink-0">›</span>
                </div>
                {myCredit && (
                  <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        urgent
                          ? 'bg-[#F43F5E]'
                          : me.cash >= myCredit.paybackAmount
                          ? 'bg-[#10B981]'
                          : 'bg-[#E5B869]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>

              {/* Физический DJ / StreamDeck Саундпад */}
              <div className="space-y-1.5 pt-0.5 min-w-0">
                <div className="flex items-center justify-between px-0.5 text-[9px] uppercase tracking-[0.14em] text-neutral-500 font-bold">
                  <span>Soundpad Deck</span>
                  {tauntCooldownLeft > 0 ? (
                    <span className="font-mono-num text-[#E5B869] normal-case tracking-normal">
                      ⏳ {tauntCooldownLeft}с
                    </span>
                  ) : (
                    <span className="font-mono-num text-[#10B981]">LIVE</span>
                  )}
                </div>

                <div className="sidebar-soundpad-grid grid grid-cols-2 gap-1 min-w-0 chat-scrollbar">
                  {TAUNTS.map((pad, idx) => {
                    const isPlaying = activeTauntPadId === pad.id;
                    const isOddLast = TAUNTS.length % 2 === 1 && idx === TAUNTS.length - 1;
                    return (
                      <button
                        key={pad.id}
                        type="button"
                        data-testid={`taunt-voice-${pad.id}`}
                        disabled={tauntCooldownLeft > 0}
                        onClick={() => triggerPadTaunt(pad.id)}
                        title={
                          tauntCooldownLeft > 0
                            ? `Общий кулдаун: ${tauntCooldownLeft}с`
                            : `${pad.label} (с озвучкой)`
                        }
                        className={`streamdeck-pad w-full min-w-0 py-1.5 pl-2.5 pr-1.5 rounded-xl overflow-hidden disabled:opacity-40 text-left flex items-center justify-between gap-1 cursor-pointer ${
                          isOddLast ? 'col-span-2' : ''
                        } ${
                          isPlaying ? 'animate-pad-playing !border-[#E5B869]/75' : ''
                        }`}
                      >
                        {/* Левая неоновая LED-полоса пэда */}
                        <span
                          aria-hidden="true"
                          style={{
                            backgroundColor: pad.ledHex,
                            boxShadow: isPlaying
                              ? `0 0 14px ${pad.ledHex}, 2px 0 16px ${pad.ledHex}`
                              : `0 0 8px ${pad.ledHex}aa`,
                          }}
                          className="pointer-events-none absolute left-0 inset-y-1 w-[3px] rounded-r-full"
                        />
                        <span className="min-w-0 flex-1 text-[8.5px] font-bold text-[#F1F5F9] leading-[1.1] whitespace-normal break-words flex items-center gap-0.5 tracking-tight">
                          <AppleEmoji emoji={pad.emoji} />
                          <span>{pad.label}</span>
                        </span>
                        <SoundpadEqIcon playing={isPlaying} accentHex={pad.ledHex} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </aside>
    </>
  );
};
