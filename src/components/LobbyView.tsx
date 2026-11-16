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
import { AppleEmoji, renderAppleEmojis } from './AppleEmoji.tsx';
import { DiceSkinPairPreview } from './DiceSkinPreview.tsx';
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

const GLASS_CARD = 'glass-panel rounded-2xl';
const GLASS_SUBCARD =
  'bg-[#12151E]/92 backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
const GLASS_INPUT =
  'bg-[#090B10]/95 backdrop-blur-md border border-white/[0.1] focus:border-[#E5B869]/75 outline-none rounded-xl text-[#F1F5F9] placeholder:text-neutral-500 transition';

const AmbientBackdrop: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
    <div
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(229, 184, 105, 0.09) 0%, transparent 65%)',
      }}
      className="absolute inset-0"
    />
    <div className="absolute -bottom-32 right-1/4 w-[460px] h-[460px] rounded-full bg-[#10B981]/[0.05] blur-[140px]" />
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
            : 'bg-[#12151E]/85 border-white/[0.08] hover:border-[#E5B869]/40 hover:bg-[#161A26]'
        } ${disabled ? 'opacity-80' : ''}`}
      >
        {active && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#E5B869] to-transparent"
          />
        )}
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
            <div className="font-display font-extrabold text-[11.5px] text-[#F8FAFC] truncate">
              {info.title}
            </div>
            <span
              className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-mono-num font-bold border ${
                active
                  ? 'bg-[#E5B869]/18 border-[#E5B869]/45 text-[#F3D082]'
                  : 'bg-[#090B10]/80 border-white/10 text-neutral-400'
              }`}
            >
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
            className={`w-6 h-6 rounded-full border flex items-center justify-center font-mono-num text-[11px] font-black shrink-0 transition cursor-pointer ${
              isInfoOpen
                ? 'bg-[#E5B869]/25 border-[#E5B869]/70 text-[#F3D082]'
                : 'bg-white/[0.06] border-white/15 text-neutral-400 hover:bg-white/15 hover:text-white'
            }`}
          >
            i
          </button>
        </div>

        {isInfoOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none absolute left-0 right-0 top-full mt-1.5 z-50 p-3 rounded-xl bg-[#0E1118]/98 backdrop-blur-xl border border-[#E5B869]/45 shadow-[0_20px_44px_rgba(0,0,0,0.9)] text-[11px] text-neutral-200 leading-snug"
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
        className="h-full w-full flex flex-col bg-[#08090C] p-3 md:p-5 overflow-y-auto relative"
      >
        <AmbientBackdrop />

        {/* Шапка комнаты */}
        <div
          className={`max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 relative z-10 ${GLASS_CARD}`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveRoom}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#F43F5E]/25 border border-white/10 hover:border-[#F43F5E]/50 text-xs font-semibold text-neutral-200 hover:text-white transition cursor-pointer"
            >
              ← Выйти
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-display font-extrabold tracking-wide text-[#F3D082]">
                  КОМНАТА <span className="font-mono-num text-[#E5B869]">#{roomState.code}</span>
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Кидай инвайт кентам — залетайте за VIP-стол по ссылке в один клик
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(profile.playerId)}
              className="px-3 py-2 rounded-xl bg-[#141720] hover:bg-[#1A1E2B] border border-white/12 hover:border-[#E5B869]/45 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-black/30 shrink-0">
                <PlayerAvatar avatar={profile.avatar} fill />
              </span>
              <span className="hidden sm:inline">Профиль</span>
            </button>
            <button
              onClick={copyInviteLink}
              className="btn-gold-3d px-4 py-2 rounded-xl text-xs font-display font-extrabold cursor-pointer inline-flex items-center gap-1.5"
            >
              <AppleEmoji emoji={copiedInvite ? '✅' : '🔗'} />
              <span>{copiedInvite ? 'Ссылка скопирована!' : 'Скопировать инвайт'}</span>
            </button>
          </div>
        </div>

        {/* Основная сетка настроек комнаты */}
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 relative z-10">
          {/* Левая колонка: Игроки и кастомизация */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className={`${GLASS_CARD} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#F8FAFC]">
                  Игроки (<span className="font-mono-num text-[#E5B869]">{roomState.players.length} / {s.maxPlayers}</span>)
                </h2>
                {isHost && roomState.players.length < s.maxPlayers && (
                  <button
                    onClick={onAddBot}
                    className="px-3 py-1 rounded-lg bg-[#E5B869]/15 hover:bg-[#E5B869]/25 text-[#F3D082] border border-[#E5B869]/45 text-xs font-bold transition cursor-pointer"
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
                      <div className="flex items-center justify-between gap-2">
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
                              <span className="font-bold text-sm text-[#F8FAFC] truncate">{p.name}</span>
                              {p.id === roomState.hostId && (
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#E5B869]/20 border border-[#E5B869]/40 text-[#F3D082] font-mono-num font-bold">
                                  ХОСТ
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#6EE7B7] font-mono-num font-bold">
                                  ВЫ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <DiceSkinPairPreview skin={p.diceSkin} size={13} />
                              <span className="truncate">
                                {DICE_SKINS.find((d) => d.id === p.diceSkin)?.name}
                              </span>
                              {s.mode === 'team2v2' && (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-mono-num font-bold ${
                                    p.team === 0
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'bg-fuchsia-500/20 text-fuchsia-300'
                                  }`}
                                >
                                  {p.team === 0 ? '2×2 А' : '2×2 Б'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {s.mode === 'team2v2' && !isMe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSwapSeat(idx);
                              }}
                              title="Поменяться местами (выбор команды)"
                              className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-neutral-100 cursor-pointer"
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
                              className="px-2 py-1 text-xs rounded bg-[#F43F5E]/20 hover:bg-[#F43F5E]/40 text-rose-200 cursor-pointer"
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
              <div className="mt-4 pt-3 border-t border-white/[0.08]">
                {isHost ? (
                  <button
                    onClick={onStartGame}
                    className="btn-emerald-3d active:translate-y-1 w-full py-3 rounded-xl font-display font-extrabold text-sm tracking-wider uppercase cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <AppleEmoji emoji="🎲" />
                    <span>ЗАПУСТИТЬ КАТКУ!</span>
                  </button>
                ) : (
                  <div className="text-center py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 w-full">
                    <AppleEmoji emoji="⏳" />
                    <span>Ждём, пока хост запустит катку...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Быстрая смена аватара, цвета и скина кубиков в комнате */}
            <div className={`${GLASS_CARD} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#E5B869]">
                  Твоя кастомизация
                </h3>
                <span className="text-[10px] font-mono-num text-neutral-400">5 контрастных цветов</span>
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
                          ? 'ring-2 ring-[#E5B869] border-white scale-105 cursor-pointer'
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
                    className="w-8 h-8 rounded-lg overflow-hidden ring-2 ring-[#E5B869] scale-105 shrink-0"
                  >
                    <PlayerAvatar avatar={profile.avatar} fill />
                  </div>
                )}
                {MEME_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => onUpdateProfile({ avatar: av.emoji })}
                    title={av.label}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition cursor-pointer border ${
                      profile.avatar === av.emoji
                        ? 'bg-[#E5B869]/22 border-[#E5B869]/80 shadow-[0_0_12px_rgba(229,184,105,0.28)] scale-105'
                        : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.12]'
                    }`}
                  >
                    <AppleEmoji emoji={av.emoji} className="w-5 h-5" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenAvatarCreator}
                  className="px-2.5 h-8 rounded-lg bg-[#161A26] hover:bg-[#1E2436] border border-[#E5B869]/40 text-[#F3D082] text-[11px] font-bold cursor-pointer transition inline-flex items-center gap-1"
                >
                  <AppleEmoji emoji="🎨" />
                  <span>Своя</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {DICE_SKINS.map((sk, idx) => {
                  const active = profile.diceSkin === sk.id;
                  const isLastOdd = DICE_SKINS.length % 2 === 1 && idx === DICE_SKINS.length - 1;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => onUpdateProfile({ diceSkin: sk.id })}
                      className={`px-2.5 py-2 rounded-xl text-[11.5px] font-bold border transition cursor-pointer flex items-center gap-2 min-w-0 ${
                        isLastOdd ? 'sm:col-span-2' : ''
                      } ${
                        active
                          ? 'bg-gradient-to-r from-[#1D1A12] to-[#131722] border-[#E5B869]/80 text-[#F8FAFC] shadow-[0_0_16px_rgba(229,184,105,0.2)]'
                          : 'bg-[#11141D] border-white/[0.08] text-neutral-300 hover:bg-[#171B27] hover:border-white/20'
                      }`}
                    >
                      <DiceSkinPairPreview skin={sk.id} size={17} />
                      <span className="min-w-0 flex-1 truncate text-left">{sk.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая колонка: Режимы и настройки правил */}
          <div className={`lg:col-span-7 ${GLASS_CARD} p-4 space-y-4`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#E5B869]">
                Режим игры и регламент стола
              </h2>
              {!isHost && (
                <span className="text-xs text-neutral-400">Настраивает хост</span>
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
                  'bg-gradient-to-br from-[#1C1912] to-[#121520] border-[#E5B869]/80 shadow-[0_0_22px_rgba(229,184,105,0.2)]'
                )
              )}
            </div>

            {/* Гибкие настройки: Капитал, Таймер, Лимит слотов */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.08]">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Таймер хода
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {([0, 45, 75, 120] as const).map((sec) => (
                    <button
                      key={sec}
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ turnTimerSec: sec })}
                      className={`py-1.5 rounded-lg font-mono-num text-xs font-bold border transition ${
                        s.turnTimerSec === sec
                          ? 'bg-[#E5B869]/22 border-[#E5B869]/75 text-[#F3D082]'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300'
                      } ${isHost ? 'cursor-pointer hover:bg-white/[0.1]' : ''}`}
                    >
                      {sec === 0 ? '∞' : `${sec}с`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Макс. игроков {fixedSeats && '(фикс.)'}
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      disabled={!isHost || fixedSeats}
                      onClick={() => onUpdateSettings({ maxPlayers: cnt })}
                      className={`py-1.5 rounded-lg font-mono-num text-xs font-bold border transition ${
                        s.maxPlayers === cnt
                          ? 'bg-[#E5B869]/22 border-[#E5B869]/75 text-[#F3D082]'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300'
                      } ${isHost && !fixedSeats ? 'cursor-pointer hover:bg-white/[0.1]' : 'opacity-60'}`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Стартовый капитал (<span className="font-mono-num text-[#6EE7B7]">{formatMoney(s.startingCash)}</span>)
                </label>
                <div className="flex gap-1">
                  {[10000, 15000, 17500, 25000].map((cap) => (
                    <button
                      key={cap}
                      disabled={!isHost}
                      onClick={() => onUpdateSettings({ startingCash: cap })}
                      className={`flex-1 py-1.5 rounded-lg font-mono-num text-[11px] font-bold border transition ${
                        s.startingCash === cap
                          ? 'bg-[#10B981]/22 border-[#10B981]/70 text-[#6EE7B7]'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300'
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
                      className={`flex-1 px-2 py-1 text-xs font-mono-num ${GLASS_INPUT}`}
                    />
                    <button
                      onClick={() => {
                        const val = Number(customCashInput);
                        if (val >= 3000 && val <= 200000) {
                          onUpdateSettings({ startingCash: Math.round(val) });
                          setCustomCashInput('');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#E5B869]/20 hover:bg-[#E5B869]/35 border border-[#E5B869]/45 text-[#F3D082] text-xs font-bold cursor-pointer"
                    >
                      ОК
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Тумблеры правил */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.08]">
              {[
                {
                  key: 'creditEnabled' as const,
                  label: '🏦 Кредит в банке',
                  sub: '$5 000 под процент на 10 ходов',
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
                        ? 'bg-[#10B981]/12 border-[#10B981]/45'
                        : 'bg-white/[0.03] border-white/[0.08] opacity-75'
                    } ${isHost ? 'cursor-pointer hover:bg-white/[0.07]' : ''}`}
                  >
                    <div className="pr-2">
                      <div className="text-xs font-bold text-[#F8FAFC]">
                        {renderAppleEmojis(item.label, `rule_${item.key}`)}
                      </div>
                      <div className="text-[10px] text-neutral-400">{item.sub}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono-num text-[10px] font-black shrink-0 ${
                        checked
                          ? 'bg-[#10B981]/25 text-[#6EE7B7]'
                          : 'bg-white/10 text-neutral-400'
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
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => onUpdateSettings({ isPrivate: !s.isPrivate })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition inline-flex items-center gap-1.5 ${
                    s.isPrivate
                      ? 'bg-[#E5B869]/20 border-[#E5B869]/60 text-[#F3D082]'
                      : 'bg-white/[0.05] border-white/10 text-neutral-200 hover:bg-white/[0.1]'
                  }`}
                >
                  <AppleEmoji emoji={s.isPrivate ? '🔒' : '🌐'} />
                  <span>
                    {s.isPrivate
                      ? 'Скрыта из общего списка (только по ссылке)'
                      : 'Видна в списке комнат'}
                  </span>
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
      className="h-full w-full flex flex-col bg-[#08090C] p-3 md:p-6 overflow-y-auto relative"
    >
      <AmbientBackdrop />

      {/* Фрезерованная шапка терминала в эстетике Dark Luxury */}
      <div
        className={`max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-5 relative z-10 ${GLASS_CARD}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B1811] via-[#12151E] to-[#0A0C11] flex items-center justify-center shadow-[0_10px_28px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(229,184,105,0.35)] border border-[#E5B869]/55 shrink-0">
            <DiceSkinPairPreview skin="gold" size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-lg md:text-xl font-black tracking-tight text-[#F8FAFC]">
                МЕМНАЯ МОНОПОЛИЯ
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[#E5B869]/18 border border-[#E5B869]/50 font-mono-num text-[11px] font-extrabold text-[#F3D082]">
                18+
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              VIP-терминал для своих • Угар, договорняки и честная игра без доната
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-profile-btn"
            onClick={() => onOpenProfile(profile.playerId)}
            className="px-3.5 py-1.5 rounded-full bg-[#141720] hover:bg-[#1B202E] border border-white/12 hover:border-[#E5B869]/50 text-xs font-extrabold text-[#F8FAFC] flex items-center gap-2 shadow-md cursor-pointer transition"
          >
            <span
              style={{ borderColor: profile.color }}
              className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-black/40 border shrink-0 text-sm"
            >
              <PlayerAvatar avatar={profile.avatar} fill />
            </span>
            <span className="max-w-[120px] truncate">{profile.name}</span>
            <span
              className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                authAccount
                  ? 'bg-[#10B981]/18 border-[#10B981]/45 text-[#6EE7B7]'
                  : 'bg-[#E5B869]/16 border-[#E5B869]/45 text-[#F3D082]'
              }`}
            >
              <AppleEmoji emoji={authAccount ? '✅' : '🚀'} />
              <span>{authAccount ? 'Профиль' : 'Регистрация / Вход'}</span>
            </span>
          </button>

          <span
            className={`px-3 py-1.5 rounded-full font-mono-num text-[11px] font-bold border ${
              connected
                ? 'bg-[#10B981]/14 text-[#6EE7B7] border-[#10B981]/40'
                : 'bg-[#F43F5E]/15 text-[#FDA4AF] border-[#F43F5E]/40'
            }`}
          >
            {connected ? '● Онлайн' : '○ Подключение...'}
          </span>
        </div>
      </div>

      {myActiveRoom && (
        <div
          data-testid="reconnect-active-banner"
          className="max-w-6xl w-full mx-auto mb-4 relative z-10 rounded-2xl bg-gradient-to-r from-[#221B10] via-[#161924] to-[#111E1A] border border-[#E5B869]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl leading-none shrink-0">
              <AppleEmoji emoji="🔄" />
            </span>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-display font-extrabold text-[#F3D082] truncate">
                Идёт активная партия <span className="font-mono-num">#{myActiveRoom.code}</span> ({MODE_INFO[myActiveRoom.mode].title})
              </div>
              <div className="text-[11px] text-neutral-300 truncate">
                Игроков: <span className="font-mono-num">{myActiveRoom.playerCount}/{myActiveRoom.maxPlayers}</span> · Вы можете вернуться обратно за стол
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="reconnect-banner-btn"
            onClick={() => onJoinRoom(myActiveRoom.code, joinPassword)}
            className="btn-gold-3d px-4 py-2 rounded-xl font-display font-extrabold text-xs cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <AppleEmoji emoji="🔄" />
            <span>Вернуться в игру</span>
          </button>
        </div>
      )}

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* 01. Профиль игрока */}
        <div className={`lg:col-span-4 ${GLASS_CARD} p-5 space-y-4`}>
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[#E5B869]/18 border border-[#E5B869]/40 font-mono-num text-[10px] font-extrabold text-[#F3D082]">
                01
              </span>
              <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
                Твой мем-профиль
              </h2>
            </div>
            <button
              type="button"
              data-testid="lobby-profile-stats-btn"
              onClick={() => onOpenProfile(profile.playerId)}
              className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1C2232] border border-white/12 hover:border-[#E5B869]/45 text-[11px] font-bold text-[#F3D082] cursor-pointer transition inline-flex items-center gap-1"
            >
              <AppleEmoji emoji="📊" />
              <span>Статистика</span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
              Никнейм за столом
            </label>
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Мем-аватар
              </label>
              <button
                type="button"
                data-testid="lobby-avatar-creator-btn"
                onClick={onOpenAvatarCreator}
                className="px-2.5 py-1 rounded-lg bg-[#161A26] hover:bg-[#1E2436] border border-[#E5B869]/45 text-[11px] font-extrabold text-[#F3D082] cursor-pointer transition inline-flex items-center gap-1"
              >
                <AppleEmoji emoji="🎨" />
                <span>Своя аватарка</span>
              </button>
            </div>
            {isImageAvatar(profile.avatar) && (
              <div className="mb-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#E5B869]/14 border border-[#E5B869]/45">
                <span className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#E5B869] shrink-0">
                  <PlayerAvatar avatar={profile.avatar} fill />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-extrabold text-[#F3D082]">
                    Выбрана кастомная аватарка
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Можно изменить или выбрать эмодзи ниже
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
                  className={`h-10 rounded-xl text-xl flex items-center justify-center transition cursor-pointer border ${
                    profile.avatar === av.emoji
                      ? 'bg-[#E5B869]/22 border-[#E5B869]/85 shadow-[0_0_16px_rgba(229,184,105,0.28)] scale-105'
                      : 'bg-[#12151E] border-white/[0.08] hover:bg-[#191E2B] hover:border-white/20'
                  }`}
                >
                  <AppleEmoji emoji={av.emoji} className="w-6 h-6" />
                </button>
              ))}
            </div>
            <div className="mt-3.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
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
                          ? 'ring-2 ring-[#E5B869] border-white scale-105'
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
              <div className="mt-1 text-[10px] text-neutral-400">
                Выбран:{' '}
                <span className="text-[#F8FAFC] font-bold">
                  {TOKEN_COLORS.find((c) => c.hex === profile.color)?.name ?? 'Красный'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Скин кубиков
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DICE_SKINS.map((sk, idx) => {
                const active = profile.diceSkin === sk.id;
                const isLastOdd = DICE_SKINS.length % 2 === 1 && idx === DICE_SKINS.length - 1;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => onUpdateProfile({ diceSkin: sk.id })}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition cursor-pointer flex items-center gap-2 min-w-0 ${
                      isLastOdd ? 'sm:col-span-2' : ''
                    } ${
                      active
                        ? 'bg-gradient-to-r from-[#1D1A12] to-[#131722] border-[#E5B869]/80 text-[#F8FAFC] shadow-[0_0_18px_rgba(229,184,105,0.22)]'
                        : 'bg-[#12151E] border-white/[0.08] text-neutral-300 hover:bg-[#191E2B] hover:border-white/20'
                    }`}
                  >
                    <DiceSkinPairPreview skin={sk.id} size={18} />
                    <span className="min-w-0 flex-1 truncate">{sk.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 02 & 03. Создание комнаты и вход по коду */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className={`${GLASS_CARD} p-5 relative z-20`}>
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5 mb-3.5">
              <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/45 font-mono-num text-[10px] font-extrabold text-[#6EE7B7]">
                02
              </span>
              <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
                Создать стол для друзей
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              {(Object.keys(MODE_INFO) as GameMode[]).map((m) =>
                renderModeCard(
                  m,
                  selectedCreateMode === m,
                  false,
                  () => setSelectedCreateMode(m),
                  'bg-gradient-to-br from-[#13221D] to-[#111520] border-[#10B981]/75 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                )
              )}
            </div>

            <button
              onClick={() => onCreateRoom(selectedCreateMode)}
              className="btn-emerald-3d active:translate-y-1 w-full py-3.5 px-4 rounded-xl font-display font-extrabold text-xs sm:text-sm tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              <span>+ СОЗДАТЬ КОМНАТУ ({MODE_INFO[selectedCreateMode].title})</span>
            </button>
          </div>

          {/* 03. Подключение по коду и открытые комнаты */}
          <div className={`${GLASS_CARD} p-5 flex-1 relative z-10`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#E5B869]/18 border border-[#E5B869]/40 font-mono-num text-[10px] font-extrabold text-[#F3D082]">
                  03
                </span>
                <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
                  Залететь по коду или из списка
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="КОД (ABCDEF)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className={`px-3 py-1.5 text-xs font-mono-num font-bold flex-1 min-w-[125px] sm:flex-none sm:w-36 uppercase ${GLASS_INPUT}`}
                />
                <input
                  type="password"
                  placeholder="Пароль (если есть)"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className={`px-3 py-1.5 text-xs flex-1 min-w-[125px] sm:flex-none sm:w-36 ${GLASS_INPUT}`}
                />
                <button
                  onClick={() => joinCode && onJoinRoom(joinCode, joinPassword)}
                  className="btn-gold-3d px-4 py-1.5 rounded-xl font-display text-xs font-extrabold cursor-pointer"
                >
                  Войти →
                </button>
              </div>
            </div>

            {publicRooms.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/12 rounded-xl bg-[#0B0D14]/60 text-neutral-400 text-xs">
                Открытых столов сейчас нет — создай комнату выше за секунду и скинь инвайт кентам (или протестируй с мем-ботами)!
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
                          <span className="font-mono-num font-extrabold text-sm text-[#E5B869]">
                            #{r.code}
                          </span>
                          <span className="font-display text-xs font-bold text-[#F8FAFC]">
                            {MODE_INFO[r.mode].title}
                          </span>
                          <span className="text-[11px] text-neutral-400">Хост: {r.hostName}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>
                            Игроков: <b className="font-mono-num text-neutral-200">{r.playerCount}/{r.maxPlayers}</b>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            {renderAppleEmojis(
                              r.status === 'LOBBY'
                                ? '🟢 Ожидание игроков'
                                : isMine
                                ? '🔥 В игре (ваш матч)'
                                : r.hasDisconnectedHumans
                                ? '🟡 В игре (есть свободный слот)'
                                : '🔥 В игре',
                              `rm_${r.code}`
                            )}
                          </span>
                        </div>
                      </div>
                      {r.status === 'LOBBY' ? (
                        <button
                          onClick={() => onJoinRoom(r.code, joinPassword)}
                          className="btn-emerald-3d px-3.5 py-1.5 rounded-xl font-display text-[11px] font-bold cursor-pointer"
                        >
                          За стол →
                        </button>
                      ) : canReconnect ? (
                        <button
                          type="button"
                          data-testid="reconnect-room-btn"
                          onClick={() => onJoinRoom(r.code, joinPassword)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition inline-flex items-center gap-1.5 ${
                            isMine || r.hasDisconnectedHumans
                              ? 'btn-gold-3d'
                              : 'bg-white/[0.07] hover:bg-white/[0.14] text-neutral-200 border border-white/12'
                          }`}
                        >
                          <AppleEmoji emoji="🔄" />
                          <span>Переподключиться</span>
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
