import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { txt } from '../../shared/rules.ts';
import { BankruptcyAnimationEvent, RoomState } from '../../shared/types.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface BankruptcyOverlayProps {
  anim: BankruptcyAnimationEvent | null;
  onDismissAnim: () => void;
  roomState: RoomState;
  myPlayerId: string;
  censored: boolean;
  onRematch: () => void;
  onLeaveRoom: () => void;
}

export const BankruptcyOverlay: React.FC<BankruptcyOverlayProps> = ({
  anim,
  onDismissAnim,
  roomState,
  myPlayerId,
  censored,
  onRematch,
  onLeaveRoom,
}) => {
  useEffect(() => {
    if (roomState.status === 'FINISHED') {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [roomState.status]);

  return (
    <>
      {/* АНИМАЦИЯ БАНКРОТСТВА (WASTED / CURB / ЕРАЛАШ) */}
      {anim && (
        <div
          onClick={onDismissAnim}
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none"
        >
          {anim.style === 'wasted' && (
            <div className="w-full h-full bg-black/80 backdrop-grayscale flex flex-col items-center justify-center p-6 text-center">
              <div className="animate-wasted bg-black/85 border-y-4 border-rose-600 px-12 py-6 shadow-2xl">
                <div className="text-5xl md:text-7xl font-black tracking-widest text-rose-500 uppercase drop-shadow-[0_4px_12px_rgba(244,63,94,0.8)]">
                  ПОТРАЧЕНО
                </div>
                <div className="text-lg md:text-2xl font-extrabold text-slate-200 mt-3 flex items-center justify-center gap-2">
                  <PlayerAvatar avatar={anim.loserAvatar} />
                  <span>{anim.loserName} — WASTED</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Причина: {txt(anim.reason, anim.cleanReason, censored)} • Раздел: {anim.winnerName}
                </div>
              </div>
            </div>
          )}

          {anim.style === 'curb' && (
            <div className="w-full h-full bg-black/92 flex flex-col items-center justify-center p-6 text-center font-serif">
              <div className="animate-curb space-y-5 max-w-xl">
                <div className="text-2xl md:text-4xl font-bold tracking-wider text-white uppercase">
                  Directed by
                </div>
                <div className="text-3xl md:text-5xl font-black tracking-widest text-white uppercase">
                  ROBERT B. WEIDE
                </div>
                <div className="pt-4 space-y-2 text-slate-300 font-sans">
                  <div className="text-sm uppercase tracking-widest text-slate-400">
                    Executive Producer
                  </div>
                  <div className="text-xl font-black text-amber-300">{anim.winnerName}</div>
                </div>
                <div className="pt-2 space-y-1 text-slate-300 font-sans">
                  <div className="text-sm uppercase tracking-widest text-slate-400">
                    Главный мамонт выпуска
                  </div>
                  <div className="text-xl font-black text-rose-400 flex items-center justify-center gap-2">
                    <PlayerAvatar avatar={anim.loserAvatar} />
                    <span>{anim.loserName}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {anim.style === 'eralash' && (
            <div className="w-full h-full bg-gradient-to-br from-sky-900/90 via-indigo-950/95 to-amber-900/90 flex flex-col items-center justify-center p-6 text-center">
              <div className="animate-wasted bg-amber-400 text-slate-950 rounded-3xl border-4 border-white px-12 py-8 shadow-2xl">
                <div className="text-6xl md:text-8xl font-black italic tracking-tight">ВСЁ!</div>
                <div className="text-base md:text-xl font-black mt-3 flex items-center justify-center gap-2">
                  <span>Пара-пара-пам!</span>
                  <PlayerAvatar avatar={anim.loserAvatar} />
                  <span>{anim.loserName} уехал на завод!</span>
                </div>
                <div className="text-xs font-bold opacity-80 mt-1">
                  Спонсор выпуска: {anim.winnerName}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ФИНАЛЬНЫЙ ЭКРАН ПОБЕДИТЕЛЯ МАТЧА */}
      {roomState.status === 'FINISHED' && !anim && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="text-5xl">🏆</div>
            <h2 className="text-2xl font-black text-amber-300 uppercase">
              {roomState.winnerTeam !== null
                ? `Победа ${roomState.winnerTeam === 0 ? 'Команды А' : 'Команды Б'}!`
                : 'Король Монополии!'}
            </h2>

            <div className="space-y-2">
              {roomState.players
                .filter((p) => roomState.winnerIds.includes(p.id))
                .map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-center gap-3 bg-slate-800/90 border border-amber-400/50 rounded-2xl py-3 px-4"
                  >
                    <span className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-3xl shrink-0">
                      <PlayerAvatar avatar={w.avatar} fill />
                    </span>
                    <span className="text-lg font-black text-white">{w.name}</span>
                  </div>
                ))}
            </div>

            <p className="text-xs text-slate-400">
              Сыграно раундов: <b>{roomState.round}</b> • Все остальные официально признаны банкротами.
            </p>

            <div className="flex gap-2 pt-2">
              {roomState.hostId === myPlayerId && (
                <button
                  onClick={onRematch}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs cursor-pointer"
                >
                  🔄 Реванш в этой комнате
                </button>
              )}
              <button
                onClick={onLeaveRoom}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Выйти в главное меню
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
