import React, { useState } from 'react';
import { DICE_SKINS, MEME_AVATARS, MODE_INFO, TOKEN_COLORS } from '../../shared/memeContent.ts';
import { formatMoney } from '../../shared/rules.ts';
import {
  AuthAccount,
  GameMode,
  PublicRoomSummary,
  RoomSettings,
  RoomState,
} from '../../shared/types.ts';
import { LocalProfile } from '../hooks/useGameSocket.ts';
import { isImageAvatar, PlayerAvatar } from './PlayerAvatar.tsx';

interface LobbyViewProps {
  connected: boolean;
  profile: LocalProfile;
  authAccount: AuthAccount | null;
  onUpdateProfile: (patch: Partial<LocalProfile>) => void;
  onOpenProfile: (playerId?: string) => void;
  onOpenAvatarCreator: () => void;
  publicRooms: PublicRoomSummary[];
  roomState: RoomState | null;
  censored: boolean;
  clientCensorOverride: boolean;
  onToggleClientCensor: () => void;
  onCreateRoom: (mode: GameMode) => void;
  onJoinRoom: (code: string, password?: string) => void;
  onLeaveRoom: () => void;
  onUpdateSettings: (patch: Partial<RoomSettings>) => void;
  onAddBot: () => void;
  onRemovePlayer: (id: string) => void;
  onSwapSeat: (idx: number) => void;
  onStartGame: () => void;
}

const GLASS_CARD =
  'glass-panel rounded-2xl';
const GLASS_SUBCARD =
  'bg-[#0D1017]/90 backdrop-blur-md border border-white/[0.07] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const GLASS_INPUT =
  'bg-[#090B10]/90 backdrop-blur-md border border-white/[0.1] focus:border-[#E5B869]/75 outline-none rounded-xl text-[#F1F5F9] placeholder:text-neutral-500 transition';

const AmbientBackdrop: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
    <div className="absolute -top-28 left-1/4 w-[480px] h-[480px] rounded-full bg-[#E5B869]/[0.06] blur-[140px]" />
    <div className="absolute -bottom-32 right-1/4 w-[460px] h-[460px] rounded-full bg-[#10B981]/[0.07] blur-[140px]" />
  </div>
);

export const LobbyView: React.FC<LobbyViewProps> = ({
  connected,
  profile,
  authAccount,
  onUpdateProfile,
  onOpenProfile,
  onOpenAvatarCreator,
  publicRooms,
  roomState,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onUpdateSettings,
  onAddBot,
  onRemovePlayer,
  onSwapSeat,
  onStartGame,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedCreateMode, setSelectedCreateMode] = useState<GameMode>('classic');
  const [openModeInfo, setOpenModeInfo] = useState<GameMode | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [customCashInput, setCustomCashInput] = useState('');

  const copyInviteLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}/?room=${roomState.code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2200);
  };

  const renderModeCard = (
    m: GameMode,
    active: boolean,
    disabled: boolean,
    onSelect: () => void,
    activeClasses: string
  ) => {
    const info = MODE_INFO[m];
    const isInfoOpen = openModeInfo === m;

    return (
      <div
        key={m}
        className={`relative rounded-xl border transition backdrop-blur-md ${
          isInfoOpen ? 'z-40' : 'z-10'
        } ${
          active
            ? activeClasses
            : 'bg-white/[0.04] border-white/[0.1] hover:border-white/[0.24] hover:bg-white/[0.07]'
        } ${disabled ? 'opacity-80' : ''}`}
      >
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (!disabled) onSelect();
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onSelect();
            }
          }}
          className={`p-3 flex items-center justify-between gap-2 ${
            disabled ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-xs text-white truncate">{info.title}</div>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-black/30 border border-white/10 text-amber-300 font-bold">
              {info.badge}
            </span>
          </div>

          <button
            type="button"
            aria-label={`Описание режима ${info.title}`}
            onMouseEnter={() => setOpenModeInfo(m)}
            onMouseLeave={() => setOpenModeInfo((cur) => (cur === m ? null : cur))}
            onClick={(e) => {
              e.stopPropagation();
              setOpenModeInfo((cur) => (cur === m ? null : m));
            }}
            className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-black shrink-0 transition cursor-pointer ${
              isInfoOpen
                ? 'bg-amber-400/25 border-amber-300/70 text-amber-200'
                : 'bg-white/[0.08] border-white/20 text-slate-300 hover:bg-white/20 hover:text-white'
            }`}
          >
            i
          </button>
        </div>

        {isInfoOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none absolute left-0 right-0 top-full mt-1.5 z-50 p-3 rounded-xl bg-[#10131e]/95 backdrop-blur-xl border border-amber-300/35 shadow-[0_16px_38px_rgba(0,0,0,0.85)] text-[11px] text-slate-100 leading-snug"
          >
            {info.desc}
          </div>
        )}
      </div>
    );
  };

  // ================== КОМНАТА ОЖИДАНИЯ (ВНУТРИ ЛОББИ) ==================
  if (roomState && roomState.status === 'LOBBY') {
    const isHost = roomState.hostId === profile.playerId;
    const s = roomState.settings;
    const fixedSeats =
      s.mode === 'team2v2' || s.mode === 'rasklad' || s.mode === 'duel_restart';

    return (
      <div
        onClick={() => setOpenModeInfo(null)}
        className="h-full w-full flex flex-col bg-[#0b0d14] p-3 md:p-5 overflow-y-auto relative"
      >
        <AmbientBackdrop />

        {/* Шапка комнаты */}
        <div
          className={`max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 relative z-10 ${GLASS_CARD}`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveRoom}
              className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-rose-500/30 border border-white/10 hover:border-rose-400/50 text-xs font-semibold transition cursor-pointer"
            >
              ← Выйти
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide text-amber-300">
                  КОМНАТА #{roomState.code}
                </span>
              </div>
              <p className="text-xs text-slate-300/80">
                Кидай инвайт пацанам — залетайте по ссылке в один клик
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(profile.playerId)}
              className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-black/30 shrink-0">
                <PlayerAvatar avatar={profile.avatar} fill />
              </span>
              <span className="hidden sm:inline">Профиль</span>
            </button>
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 border border-indigo-300/30 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 backdrop-blur-md transition cursor-pointer"
            >
              {copiedInvite ? '✅ Ссылка скопирована!' : '🔗 Скопировать инвайт-ссылку'}
            </button>
          </div>
        </div>

        {/* Основная сетка настроек комнаты */}
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 relative z-10">
          {/* Левая колонка: Игроки и кастомизация */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className={`${GLASS_CARD} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-100">
                  Игроки ({roomState.players.length} / {s.maxPlayers})
                </h2>
                {isHost && roomState.players.length < s.maxPlayers && (
                  <button
                    onClick={onAddBot}
                    className="px-3 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 border border-amber-400/40 text-xs font-bold transition cursor-pointer"
                  >
                    + Добавить мем-бота
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {roomState.players.map((p, idx) => {
                  const isMe = p.id === profile.playerId;
                  return (
                    <div
                      key={p.id}
                      className={`${GLASS_SUBCARD} px-3 py-2.5 transition`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenProfile(p.id)}
                            title={`Открыть профиль ${p.name}`}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition"
                            style={{
                              backgroundColor: `${p.color}28`,
                              border: `2px solid ${p.color}`,
                            }}
                          >
                            <PlayerAvatar avatar={p.avatar} fill />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm truncate">{p.name}</span>
                              {p.id === roomState.hostId && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                  ХОСТ
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                                  ВЫ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-300/75 flex items-center gap-2">
                              <span>Скин кубиков: {DICE_SKINS.find((d) => d.id === p.diceSkin)?.name}</span>
                              {s.mode === 'team2v2' && (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold ${
                                    p.team === 0
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'bg-fuchsia-500/20 text-fuchsia-300'
                                  }`}
                                >
                                  {p.team === 0 ? 'Команда А' : 'Команда Б'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {s.mode === 'team2v2' && !isMe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSwapSeat(idx);
                              }}
                              title="Поменяться местами (выбор команды)"
                              className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-slate-100 cursor-pointer"
                            >
                              ⇄ Место
                            </button>
                          )}
                          {isHost && p.id !== roomState.hostId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemovePlayer(p.id);
                              }}
                              className="px-2 py-1 text-xs rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Кнопка старта игры */}
              <div className="mt-4 pt-3 border-t border-white/10">
                {isHost ? (
                  <button
                    onClick={onStartGame}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-base tracking-wide shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                  >
                    🎲 ЗАПУСТИТЬ КАТКУ!
                  </button>
                ) : (
                  <div className="text-center py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-200 text-xs font-semibold">
                    ⏳ Ждём, пока хост нажмёт «Запустить катку»...
                  </div>
                )}
              </div>
            </div>

            {/* Быстрая смена аватара, цвета и скина кубиков в комнате */}
            <div className={`${GLASS_CARD} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Твоя кастомизация
                </h3>
                <span className="text-[10px] text-slate-400">5 контрастных цветов</span>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="lobby-color-picker">
                {TOKEN_COLORS.map((c) => {
                  const myPlayer = roomState.players.find((pl) => pl.id === profile.playerId);
                  const currentColor = myPlayer?.color || profile.color;
                  const takenByOther = roomState.players.some(
                    (pl) => pl.id !== profile.playerId && pl.color === c.hex
                  );
                  const isSelected = currentColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      disabled={takenByOther}
                      onClick={() => onUpdateProfile({ color: c.hex })}
                      title={takenByOther ? `${c.name} (занят)` : c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-white shadow-md border transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'ring-2 ring-white border-white scale-105 cursor-pointer'
                          : takenByOther
                          ? 'opacity-30 border-black/40 cursor-not-allowed grayscale-[35%]'
                          : 'border-white/30 opacity-85 hover:opacity-100 cursor-pointer'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white/90 inline-block" />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {isImageAvatar(profile.avatar) && (
                  <div
                    title="Твоя кастомная аватарка"
                    className="w-8 h-8 rounded-lg overflow-hidden ring-2 ring-amber-300 scale-105 shrink-0"
                  >
                    <PlayerAvatar avatar={profile.avatar} fill />
                  </div>
                )}
                {MEME_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => onUpdateProfile({ avatar: av.emoji })}
                    title={av.label}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition cursor-pointer ${
                      profile.avatar === av.emoji
                        ? 'bg-amber-400/25 ring-2 ring-amber-300 scale-105'
                        : 'bg-white/[0.06] hover:bg-white/[0.14]'
                    }`}
                  >
                    {av.emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenAvatarCreator}
                  className="px-2.5 h-8 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-100 text-[11px] font-bold cursor-pointer transition"
                >
                  🎨 Своя
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {DICE_SKINS.map((sk) => (
                  <button
                    key={sk.id}
                    onClick={() => onUpdateProfile({ diceSkin: sk.id })}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      profile.diceSkin === sk.id
                        ? 'bg-indigo-500/35 border-indigo-300/70 text-white'
                        : 'bg-white/[0.05] border-white/10 text-slate-200 hover:bg-white/[0.12]'
                    }`}
                  >
                    {sk.preview} {sk.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Правая колонка: Режимы и настройки правил */}
          <div className={`lg:col-span-7 ${GLASS_CARD} p-4 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-100">
                Режим игры и правила
              </h2>
              {!isHost && (
                <span className="text-xs text-slate-400">Настраивает хост</span>
              )}
            </div>

            {/* Сетка 6 режимов (без описания на карточке, только значок i) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(Object.keys(MODE_INFO) as GameMode[]).map((m) =>
                renderModeCard(
                  m,
                  s.mode === m,
                  !isHost,
                  () => onUpdateSettings({ mode: m }),
                  'bg-indigo-500/25 border-indigo-300/70 shadow-[0_0_20px_rgba(99,102,241,0.22)]'
                )
              )}
            </div>

            {/* Гибкие настройки: Капитал, Таймер, Лимит слотов */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="block text-[11px] font-bold text-slate-300/80 mb-1">
                  Таймер хода
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {([0, 45, 75, 120] as const).map((sec) => (
                    <button
                      key={sec}
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ turnTimerSec: sec })}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                        s.turnTimerSec === sec
                          ? 'bg-amber-400/25 border-amber-300/70 text-amber-100'
                          : 'bg-white/[0.05] border-white/10 text-slate-300'
                      } ${isHost ? 'cursor-pointer hover:bg-white/[0.1]' : ''}`}
                    >
                      {sec === 0 ? '∞' : `${sec}с`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300/80 mb-1">
                  Макс. игроков {fixedSeats && '(фикс. режимом)'}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      disabled={!isHost || fixedSeats}
                      onClick={() => onUpdateSettings({ maxPlayers: cnt })}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                        s.maxPlayers === cnt
                          ? 'bg-sky-400/25 border-sky-300/70 text-sky-100'
                          : 'bg-white/[0.05] border-white/10 text-slate-300'
                      } ${isHost && !fixedSeats ? 'cursor-pointer hover:bg-white/[0.1]' : 'opacity-60'}`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300/80 mb-1">
                  Стартовый капитал ({formatMoney(s.startingCash)})
                </label>
                <div className="flex gap-1">
                  {[10000, 15000, 17500, 25000].map((cap) => (
                    <button
                      key={cap}
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ startingCash: cap })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                        s.startingCash === cap
                          ? 'bg-emerald-400/25 border-emerald-300/70 text-emerald-100'
                          : 'bg-white/[0.05] border-white/10 text-slate-300'
                      } ${isHost ? 'cursor-pointer hover:bg-white/[0.1]' : ''}`}
                    >
                      {cap / 1000}k
                    </button>
                  ))}
                </div>
                {isHost && (
                  <div className="flex gap-1 mt-1.5">
                    <input
                      type="number"
                      placeholder="Свой капитал (напр. 30000)"
                      value={customCashInput}
                      onChange={(e) => setCustomCashInput(e.target.value)}
                      className={`flex-1 px-2 py-1 text-xs ${GLASS_INPUT}`}
                    />
                    <button
                      onClick={() => {
                        const val = Number(customCashInput);
                        if (val >= 3000 && val <= 200000) {
                          onUpdateSettings({ startingCash: Math.round(val) });
                          setCustomCashInput('');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
                    >
                      ОК
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Тумблеры правил */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
              {[
                {
                  key: 'creditEnabled' as const,
                  label: '🏦 Кредит в банке',
                  sub: '$5 000 под процент на 5 раундов',
                },
                {
                  key: 'auctionsEnabled' as const,
                  label: '🔨 Аукционы полей (и заложенных)',
                  sub: 'Торги при отказе от покупки + аукцион залога',
                },
                {
                  key: 'rentTaxEnabled' as const,
                  label: '⏳ Налог на аренду (Анти-затягивание)',
                  sub: 'Отключение Старта и налог 50%→99% в затяжных катках',
                },
                {
                  key: 'fairTradeLimit' as const,
                  label: '⚖️ Фильтр ±50% на договоры',
                  sub: 'Защита от перелива всех активов за $1 000',
                },
                {
                  key: 'retroRules' as const,
                  label: '📼 Ретро-опции',
                  sub: 'Прямые бонусы вместо Шанса, Парк отдыха, вечный залог',
                },
                {
                  key: 'russianRoulette' as const,
                  label: '🔫 Русская рулетка',
                  sub: 'Вместо казино: 6 патронников (1 пуля), смерть освобождает все клетки',
                },
              ].map((item) => {
                const checked = Boolean(s[item.key]);
                return (
                  <button
                    key={item.key}
                    disabled={!isHost}
                    onClick={() => onUpdateSettings({ [item.key]: !checked })}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition backdrop-blur-md ${
                      checked
                        ? 'bg-emerald-500/15 border-emerald-400/50'
                        : 'bg-white/[0.03] border-white/10 opacity-75'
                    } ${isHost ? 'cursor-pointer hover:bg-white/[0.08]' : ''}`}
                  >
                    <div className="pr-2">
                      <div className="text-xs font-bold text-slate-100">{item.label}</div>
                      <div className="text-[10px] text-slate-300/70">{item.sub}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                        checked
                          ? 'bg-emerald-400/25 text-emerald-200'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {checked ? 'ВКЛ' : 'ВЫКЛ'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Приватность и пароль */}
            {isHost && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
                <button
                  onClick={() => onUpdateSettings({ isPrivate: !s.isPrivate })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                    s.isPrivate
                      ? 'bg-amber-400/20 border-amber-300/60 text-amber-200'
                      : 'bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.12]'
                  }`}
                >
                  {s.isPrivate ? '🔒 Скрыта из общего списка (только по ссылке)' : '🌐 Видна в списке комнат'}
                </button>
                <input
                  type="text"
                  placeholder="Пароль на вход (необязательно)"
                  value={s.password || ''}
                  onChange={(e) => onUpdateSettings({ password: e.target.value })}
                  className={`px-3 py-1.5 text-xs w-full sm:w-56 ${GLASS_INPUT}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================== ГЛАВНЫЙ ЭКРАН ВХОДА И СПИСКА КОМНАТ ==================
  const lastRoomCode =
    typeof window !== 'undefined' ? localStorage.getItem('mm_last_room') : null;
  const normalizedMyName = profile.name.trim().toLowerCase();
  const isMyOngoingRoom = (r: PublicRoomSummary) =>
    r.status === 'PLAYING' &&
    Boolean(
      r.playerIds?.includes(profile.playerId) ||
        (normalizedMyName &&
          r.playerNames?.some((n) => n.trim().toLowerCase() === normalizedMyName)) ||
        lastRoomCode === r.code
    );
  const myActiveRoom =
    publicRooms.find((r) => isMyOngoingRoom(r)) ||
    publicRooms.find((r) => r.status === 'PLAYING' && r.hasDisconnectedHumans) ||
    null;

  return (
    <div
      onClick={() => setOpenModeInfo(null)}
      className="h-full w-full flex flex-col bg-[#0b0d14] p-3 md:p-6 overflow-y-auto relative"
    >
      <AmbientBackdrop />

      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-2xl shadow-lg shadow-rose-600/30 border border-white/20">
            🎲
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              МЕМНАЯ МОНОПОЛИЯ <span className="text-amber-300">18+</span>
            </h1>
            <p className="text-xs text-slate-300/75">
              Все режимы M1 • Угар и нецензурщина для своих
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-profile-btn"
            onClick={() => onOpenProfile(profile.playerId)}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 text-xs font-extrabold text-white flex items-center gap-2 backdrop-blur-md shadow-md cursor-pointer transition"
          >
            <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-black/30 border border-white/20 shrink-0 text-sm">
              <PlayerAvatar avatar={profile.avatar} fill />
            </span>
            <span className="max-w-[120px] truncate">{profile.name}</span>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 font-bold">
              {authAccount ? '📊 Профиль' : '🔑 Вход / Профиль'}
            </span>
          </button>

          <span
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md border ${
              connected
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
                : 'bg-rose-500/15 text-rose-200 border-rose-400/40'
            }`}
          >
            {connected ? '● Онлайн' : '○ Подключение...'}
          </span>
        </div>
      </div>

      {myActiveRoom && (
        <div
          data-testid="reconnect-active-banner"
          className="max-w-6xl w-full mx-auto mb-4 relative z-10 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border border-amber-400/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl leading-none shrink-0">🔄</span>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-amber-200 truncate">
                Идёт активная партия #{myActiveRoom.code} ({MODE_INFO[myActiveRoom.mode].title})
              </div>
              <div className="text-[11px] text-slate-200/80 truncate">
                Игроков: {myActiveRoom.playerCount}/{myActiveRoom.maxPlayers} · Вы можете вернуться обратно за стол
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="reconnect-banner-btn"
            onClick={() => onJoinRoom(myActiveRoom.code, joinPassword)}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer transition shadow-md shrink-0"
          >
            🔄 Вернуться в игру
          </button>
        </div>
      )}

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* Профиль игрока */}
        <div className={`lg:col-span-4 ${GLASS_CARD} p-5 space-y-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
              1. Твой мем-профиль
            </h2>
            <button
              type="button"
              data-testid="lobby-profile-stats-btn"
              onClick={() => onOpenProfile(profile.playerId)}
              className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-[11px] font-bold text-sky-200 cursor-pointer transition"
            >
              📊 Статистика
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300/80 mb-1">Никнейм</label>
            <input
              type="text"
              maxLength={24}
              value={profile.name}
              onChange={(e) => onUpdateProfile({ name: e.target.value })}
              className={`w-full px-3 py-2 text-sm font-bold ${GLASS_INPUT}`}
              placeholder="Введи погоняло..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-slate-300/80">Мем-аватар</label>
              <button
                type="button"
                data-testid="lobby-avatar-creator-btn"
                onClick={onOpenAvatarCreator}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500/35 to-fuchsia-500/35 hover:from-indigo-500/55 hover:to-fuchsia-500/55 border border-indigo-300/40 text-[11px] font-extrabold text-indigo-100 cursor-pointer transition"
              >
                🎨 Своя аватарка
              </button>
            </div>
            {isImageAvatar(profile.avatar) && (
              <div className="mb-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-300/50">
                <span className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-300 shrink-0">
                  <PlayerAvatar avatar={profile.avatar} fill />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-extrabold text-amber-200">
                    Выбрана твоя кастомная аватарка
                  </div>
                  <div className="text-[10px] text-slate-300/80">
                    Можешь изменить её или переключить на эмодзи ниже
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-6 gap-1.5">
              {MEME_AVATARS.map((av) => (
                <button
                  key={av.id}
                  onClick={() => onUpdateProfile({ avatar: av.emoji })}
                  title={av.label}
                  className={`h-10 rounded-xl text-xl flex items-center justify-center transition cursor-pointer backdrop-blur-md border ${
                    profile.avatar === av.emoji
                      ? 'bg-amber-400/25 border-amber-300/80 shadow-[0_0_16px_rgba(251,191,36,0.25)] scale-105'
                      : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.12]'
                  }`}
                >
                  {av.emoji}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-300/80 mb-1.5">
                Цвет фишки (5 контрастных цветов)
              </label>
              <div className="grid grid-cols-5 gap-1.5" data-testid="home-color-picker">
                {TOKEN_COLORS.map((c) => {
                  const selected = profile.color === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => onUpdateProfile({ color: c.hex })}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`h-9 rounded-xl border transition cursor-pointer flex items-center justify-center shadow-md ${
                        selected
                          ? 'ring-2 ring-white border-white scale-105'
                          : 'border-white/25 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {selected ? (
                        <span className="text-xs font-black text-white drop-shadow">✓</span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-white/80" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                Выбран: <span className="text-slate-200 font-bold">{TOKEN_COLORS.find((c) => c.hex === profile.color)?.name ?? 'Красный'}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300/80 mb-1.5">
              Скин кубиков
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {DICE_SKINS.map((sk) => (
                <button
                  key={sk.id}
                  onClick={() => onUpdateProfile({ diceSkin: sk.id })}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition cursor-pointer backdrop-blur-md ${
                    profile.diceSkin === sk.id
                      ? 'bg-indigo-500/30 border-indigo-300/75 text-white shadow-[0_0_18px_rgba(99,102,241,0.25)]'
                      : 'bg-white/[0.05] border-white/[0.08] text-slate-200 hover:bg-white/[0.12]'
                  }`}
                >
                  {sk.preview} {sk.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Создание комнаты и вход по коду */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className={`${GLASS_CARD} p-5 relative z-20`}>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-300 mb-3">
              2. Создать комнату для друзей
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              {(Object.keys(MODE_INFO) as GameMode[]).map((m) =>
                renderModeCard(
                  m,
                  selectedCreateMode === m,
                  false,
                  () => setSelectedCreateMode(m),
                  'bg-emerald-500/20 border-emerald-300/75 shadow-[0_0_22px_rgba(16,185,129,0.22)]'
                )
              )}
            </div>

            <button
              onClick={() => onCreateRoom(selectedCreateMode)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-rose-500/25 transition cursor-pointer"
            >
              ➕ СОЗДАТЬ КОМНАТУ ({MODE_INFO[selectedCreateMode].title})
            </button>
          </div>

          {/* Подключение по коду и открытые комнаты */}
          <div className={`${GLASS_CARD} p-5 flex-1 relative z-10`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-300">
                3. Залететь в комнату по коду или из списка
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Код комнаты (ABCDEF)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className={`px-3 py-1.5 text-xs font-bold flex-1 min-w-[130px] sm:flex-none sm:w-36 uppercase ${GLASS_INPUT}`}
                />
                <input
                  type="password"
                  placeholder="Пароль (если есть)"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className={`px-3 py-1.5 text-xs flex-1 min-w-[130px] sm:flex-none sm:w-36 ${GLASS_INPUT}`}
                />
                <button
                  onClick={() => joinCode && onJoinRoom(joinCode, joinPassword)}
                  className="px-4 py-1.5 rounded-xl bg-sky-500/80 hover:bg-sky-400 border border-sky-300/30 text-white text-xs font-bold cursor-pointer transition"
                >
                  Войти →
                </button>
              </div>
            </div>

            {publicRooms.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/15 rounded-xl bg-white/[0.02] text-slate-300/75 text-xs">
                Открытых комнат пока нет — создай свою за секунду и закинь ссылку кентам (или поиграй с мем-ботами)!
              </div>
            ) : (
              <div className="space-y-2">
                {publicRooms.map((r) => {
                  const isMine = isMyOngoingRoom(r);
                  const canReconnect = r.status === 'PLAYING';
                  return (
                    <div
                      key={r.code}
                      className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 ${GLASS_SUBCARD}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-amber-300">#{r.code}</span>
                          <span className="text-xs font-bold text-white">
                            {MODE_INFO[r.mode].title}
                          </span>
                          <span className="text-[11px] text-slate-300/75">Хост: {r.hostName}</span>
                        </div>
                        <div className="text-[11px] text-slate-300/75">
                          Игроков: {r.playerCount}/{r.maxPlayers} •{' '}
                          {r.status === 'LOBBY'
                            ? '🟢 Ожидание'
                            : isMine
                            ? '🔥 В игре (ваш матч)'
                            : r.hasDisconnectedHumans
                            ? '🟡 В игре (есть отключившийся игрок)'
                            : '🔥 В игре'}
                        </div>
                      </div>
                      {r.status === 'LOBBY' ? (
                        <button
                          onClick={() => onJoinRoom(r.code, joinPassword)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/80 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer transition"
                        >
                          Подключиться
                        </button>
                      ) : canReconnect ? (
                        <button
                          type="button"
                          data-testid="reconnect-room-btn"
                          onClick={() => onJoinRoom(r.code, joinPassword)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                            isMine || r.hasDisconnectedHumans
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md'
                              : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15'
                          }`}
                        >
                          🔄 Переподключиться
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
