import React, { useEffect, useState } from 'react';
import { DICE_SKINS, MEME_AVATARS, MODE_INFO, TOKEN_COLORS } from '../../shared/memeContent.ts';
import {
  AuthAccount,
  GameMode,
  LeaderboardEntry,
  PlayerProfileData,
  RecentMatchSummary,
} from '../../shared/types.ts';
import { LocalProfile } from '../hooks/useGameSocket.ts';
import { AppleEmoji, renderAppleEmojis } from './AppleEmoji.tsx';
import { DiceSkinPairPreview } from './DiceSkinPreview.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface ProfileModalProps {
  open: boolean;
  targetPlayerId: string | null;
  myProfile: LocalProfile;
  authAccount: AuthAccount | null;
  isPlayingMatch?: boolean;
  onClose: () => void;
  onSelectPlayerId: (playerId: string) => void;
  onOpenAvatarCreator: () => void;
  onUpdateProfile: (patch: Partial<LocalProfile>) => void;
  onRegister: (
    email: string,
    password: string,
    nicknameOverride?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onLogin: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => Promise<void>;
}

interface ProfileApiResponse {
  profile: PlayerProfileData;
  leaderboard: LeaderboardEntry[];
  recentMatches: RecentMatchSummary[];
}

function getMemeRank(wins: number, gamesPlayed: number): { title: string; badge: string } {
  if (wins >= 25) return { title: 'Олигарх всея Монополии', badge: '👑' };
  if (wins >= 10) return { title: 'Акула недвижимости', badge: '🦈' };
  if (wins >= 3) return { title: 'Опытный темщик', badge: '💼' };
  if (gamesPlayed >= 1) return { title: 'Участник замеса', badge: '🎲' };
  return { title: 'Новичок падика', badge: '🐣' };
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  targetPlayerId,
  myProfile,
  authAccount,
  isPlayingMatch = false,
  onClose,
  onSelectPlayerId,
  onOpenAvatarCreator,
  onUpdateProfile,
  onRegister,
  onLogin,
  onLogout,
}) => {
  const viewedId = targetPlayerId || myProfile.playerId;
  const isOwnProfile = viewedId === myProfile.playerId;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProfileApiResponse | null>(null);
  const [nickDraft, setNickDraft] = useState(myProfile.name);
  const [nickSavedToast, setNickSavedToast] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);

  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [regNickname, setRegNickname] = useState(myProfile.name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'stats' | 'leaderboard' | 'matches'>('stats');

  useEffect(() => {
    setNickDraft(myProfile.name);
    setRegNickname((prev) => (prev.trim() ? prev : myProfile.name));
  }, [myProfile.name]);

  const fetchProfileData = async (pid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(pid)}`);
      if (res.ok) {
        const json = (await res.json()) as ProfileApiResponse;
        setData(json);
      }
    } catch {
      // ignore network glitches
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setAuthError(null);
    setAuthSuccess(null);
    setNickError(null);
    setNickSavedToast(false);
    setRegNickname(myProfile.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchProfileData(viewedId);
  }, [open, viewedId, authAccount?.playerId, myProfile.avatar, myProfile.name]);

  if (!open) return null;

  const profileData = data?.profile;
  const displayName = isOwnProfile ? myProfile.name : profileData?.nickname || 'Игрок';
  const displayAvatar = isOwnProfile ? myProfile.avatar : profileData?.avatar || '🐸';
  const displayColor = isOwnProfile ? myProfile.color : profileData?.color || '#dc2626';
  const stats = profileData?.stats ?? {
    cellsBought: 0,
    monopoliesCollected: 0,
    rouletteDeaths: 0,
    casinoWins: 0,
    wins: 0,
    bankruptcies: 0,
  };
  const gamesPlayed = profileData?.gamesPlayed ?? 0;
  const wins = stats.wins ?? profileData?.wins ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const rank = getMemeRank(wins, gamesPlayed);

  const handleSaveNickname = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = nickDraft.trim().slice(0, 24);
    if (!cleaned) {
      setNickError('Введите хотя бы 1 видимый символ для ника');
      return;
    }
    setNickError(null);
    onUpdateProfile({ name: cleaned });
    setRegNickname(cleaned);
    setNickSavedToast(true);
    setTimeout(() => setNickSavedToast(false), 2200);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setAuthError('Введите корректный адрес электронной почты');
      return;
    }
    if (password.length < 4) {
      setAuthError('Пароль должен содержать минимум 4 символа');
      return;
    }
    const desiredNick = regNickname.trim().slice(0, 24) || myProfile.name;
    setAuthBusy(true);
    try {
      const res =
        authTab === 'register'
          ? await onRegister(trimmedEmail, password, desiredNick)
          : await onLogin(trimmedEmail, password);
      if (!res.ok) {
        setAuthError(res.error || 'Не удалось выполнить операцию');
      } else {
        setAuthSuccess(
          authTab === 'register'
            ? '🎉 Аккаунт создан! Ник, аватар и статистика надёжно сохранены в базе.'
            : '✅ Успешный вход! Ваш профиль и статистика загружены.'
        );
        setPassword('');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const statCards = [
    { label: 'Сыграно игр', value: gamesPlayed, icon: '🎮', tone: 'text-slate-100' },
    { label: 'Побед', value: wins, icon: '🏆', tone: 'text-amber-300' },
    { label: 'Винрейт', value: `${winRate}%`, icon: '📈', tone: 'text-emerald-300' },
    { label: 'Куплено полей', value: stats.cellsBought, icon: '🏢', tone: 'text-sky-300' },
    { label: 'Монополий', value: stats.monopoliesCollected, icon: '💎', tone: 'text-indigo-300' },
    { label: 'Побед в казино', value: stats.casinoWins, icon: '🎰', tone: 'text-fuchsia-300' },
    { label: 'Банкротств', value: stats.bankruptcies, icon: '💀', tone: 'text-rose-300' },
    { label: 'Рулетка RIP', value: stats.rouletteDeaths, icon: '🔫', tone: 'text-orange-300' },
  ];

  return (
    <div
      data-testid="profile-modal"
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-4xl max-h-[92dvh] overflow-y-auto chat-scrollbar rounded-2xl !border-[#E5B869]/30 shadow-[0_32px_96px_rgba(0,0,0,0.94)] p-4 sm:p-6 space-y-5 text-[#F1F5F9]"
      >
        {/* Шапка модального окна */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                borderColor: displayColor,
                backgroundColor: `${displayColor}28`,
                boxShadow: `0 0 20px ${displayColor}44`,
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] flex items-center justify-center text-3xl shrink-0 overflow-hidden shadow-lg"
            >
              <PlayerAvatar avatar={displayAvatar} fill />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-black text-[#F8FAFC] truncate">
                  {displayName}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5B869]/16 border border-[#E5B869]/45 text-[#F3D082] text-[10.5px] font-extrabold">
                  <AppleEmoji emoji={rank.badge} />
                  <span>{rank.title}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-neutral-400">
                {isOwnProfile ? (
                  authAccount ? (
                    <span className="text-[#6EE7B7] font-bold inline-flex items-center gap-1">
                      <AppleEmoji emoji="✅" />
                      <span>Аккаунт: {authAccount.email}</span>
                    </span>
                  ) : (
                    <span className="text-[#E5B869] font-semibold inline-flex items-center gap-1">
                      <AppleEmoji emoji="👤" />
                      <span>Гостевой режим (зарегистрируйтесь, чтобы сохранить прогресс навсегда)</span>
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <AppleEmoji emoji={profileData?.isRegistered ? '✅' : '👤'} />
                      <span>{profileData?.isRegistered ? 'Зарегистрированный игрок' : 'Гость'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectPlayerId(myProfile.playerId)}
                      className="text-[#F3D082] hover:underline font-bold cursor-pointer"
                    >
                      ← Вернуться в свой профиль
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="profile-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-[#F43F5E]/25 border border-white/10 hover:border-[#F43F5E]/50 text-neutral-300 hover:text-white font-black text-xs flex items-center justify-center cursor-pointer shrink-0 transition"
          >
            ✕
          </button>
        </div>

        {/* Редактирование своего профиля + Регистрация/Вход */}
        {isOwnProfile && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Левая карточка: Никнейм, кастомная аватарка, цвет, кубики */}
            <div className="md:col-span-6 rounded-2xl bg-[#12151E]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <h3 className="font-display text-[11px] font-extrabold uppercase tracking-wider text-[#E5B869]">
                  Настройка профиля
                </h3>
                <button
                  type="button"
                  data-testid="open-avatar-creator-btn"
                  onClick={onOpenAvatarCreator}
                  className="px-2.5 py-1.5 rounded-xl bg-[#161A26] hover:bg-[#1E2436] border border-[#E5B869]/45 text-[#F3D082] text-[11px] font-extrabold cursor-pointer transition inline-flex items-center gap-1.5"
                >
                  <AppleEmoji emoji="🎨" />
                  <span>Своя аватарка</span>
                </button>
              </div>

              <form onSubmit={handleSaveNickname} className="space-y-1.5">
                <label className="block text-[11px] font-bold text-neutral-400">
                  Никнейм (сохраняется в базе, можно менять в любой момент)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={24}
                    data-testid="profile-nickname-input"
                    value={nickDraft}
                    onChange={(e) => {
                      setNickDraft(e.target.value);
                      if (nickError) setNickError(null);
                    }}
                    placeholder="Введите ник..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#090B10]/95 border border-white/[0.1] focus:border-[#E5B869]/75 outline-none text-xs font-bold text-[#F8FAFC] transition"
                  />
                  <button
                    type="submit"
                    data-testid="profile-save-nick-btn"
                    className="btn-emerald-3d px-3.5 py-2 rounded-xl font-display font-extrabold text-xs cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    <AppleEmoji emoji={nickSavedToast ? '✅' : '💾'} />
                    <span>{nickSavedToast ? 'Сохранено' : 'Сохранить'}</span>
                  </button>
                </div>
                {nickError && (
                  <div className="text-[11px] font-bold text-[#FDA4AF]">{nickError}</div>
                )}
              </form>

              <div>
                <div className="text-[11px] font-bold text-neutral-400 mb-1.5">
                  Быстрый выбор мем-аватарки
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {MEME_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      title={av.label}
                      onClick={() => onUpdateProfile({ avatar: av.emoji })}
                      className={`h-9 rounded-xl text-lg flex items-center justify-center border transition cursor-pointer ${
                        myProfile.avatar === av.emoji
                          ? 'bg-[#E5B869]/22 border-[#E5B869]/85 shadow-[0_0_12px_rgba(229,184,105,0.28)] scale-105'
                          : 'bg-[#0D1017] border-white/[0.08] hover:bg-[#171C28]'
                      }`}
                    >
                      <AppleEmoji emoji={av.emoji} className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-1.5">Скин кубиков</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {DICE_SKINS.map((sk, idx) => {
                      const active = myProfile.diceSkin === sk.id;
                      const isLastOdd = DICE_SKINS.length % 2 === 1 && idx === DICE_SKINS.length - 1;
                      return (
                        <button
                          key={sk.id}
                          type="button"
                          onClick={() => onUpdateProfile({ diceSkin: sk.id })}
                          className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border text-left transition cursor-pointer flex items-center gap-1.5 min-w-0 ${
                            isLastOdd ? 'sm:col-span-2' : ''
                          } ${
                            active
                              ? 'bg-gradient-to-r from-[#1D1A12] to-[#131722] border-[#E5B869]/80 text-[#F8FAFC] shadow-[0_0_14px_rgba(229,184,105,0.2)]'
                              : 'bg-[#0D1017] border-white/[0.08] text-neutral-300 hover:bg-[#171C28]'
                          }`}
                        >
                          <DiceSkinPairPreview skin={sk.id} size={15} />
                          <span className="min-w-0 flex-1 truncate">{sk.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Правая карточка: Аккаунт (почта + пароль) */}
            <div className="md:col-span-6 rounded-2xl bg-[#12151E]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-4 space-y-3">
              <h3 className="font-display text-[11px] font-extrabold uppercase tracking-wider text-[#E5B869] border-b border-white/[0.06] pb-2.5">
                Аккаунт и сохранение в базе
              </h3>

              {authSuccess && (
                <div
                  data-testid="auth-success-msg"
                  className="text-[11px] font-bold text-[#6EE7B7] bg-[#10B981]/16 border border-[#10B981]/45 rounded-xl px-3 py-2"
                >
                  {renderAppleEmojis(authSuccess, 'auth_ok')}
                </div>
              )}

              {authAccount ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#10B981]/12 border border-[#10B981]/40 p-3 space-y-1">
                    <div className="text-xs font-black text-[#6EE7B7] inline-flex items-center gap-1.5">
                      <AppleEmoji emoji="✅" />
                      <span>Вы вошли в аккаунт</span>
                    </div>
                    <div className="text-xs text-neutral-200 break-all">
                      Почта: <b>{authAccount.email}</b>
                    </div>
                    <div className="text-[10.5px] text-neutral-400 font-mono-num">
                      ID игрока: {authAccount.playerId}
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Ваш ник, кастомная аватарка и вся статистика игр сохраняются в базе данных
                    сервера. Заходите с любого устройства по своей почте и паролю!
                  </p>

                  {isPlayingMatch ? (
                    <div className="text-[11px] font-semibold text-[#F3D082] bg-[#E5B869]/12 border border-[#E5B869]/40 rounded-xl px-3 py-2 inline-flex items-center gap-1.5">
                      <AppleEmoji emoji="🔒" />
                      <span>Выход из аккаунта станет доступен после завершения текущей партии.</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="auth-logout-btn"
                      onClick={async () => {
                        setAuthSuccess(null);
                        setAuthError(null);
                        await onLogout();
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#F43F5E]/18 hover:bg-[#F43F5E]/30 border border-[#F43F5E]/45 text-[#FDA4AF] font-display font-extrabold text-xs cursor-pointer transition inline-flex items-center justify-center gap-1.5"
                    >
                      <AppleEmoji emoji="🚪" />
                      <span>Выйти из аккаунта</span>
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="auth-tab-register"
                      onClick={() => {
                        setAuthTab('register');
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className={`py-2 rounded-xl font-display text-xs font-extrabold border transition cursor-pointer ${
                        authTab === 'register'
                          ? 'bg-[#E5B869]/20 border-[#E5B869]/75 text-[#F3D082] shadow-[0_0_16px_rgba(229,184,105,0.18)]'
                          : 'bg-[#0D1017] border-white/[0.08] text-neutral-400 hover:bg-[#171C28] hover:text-neutral-200'
                      }`}
                    >
                      Регистрация
                    </button>
                    <button
                      type="button"
                      data-testid="auth-tab-login"
                      disabled={isPlayingMatch}
                      title={
                        isPlayingMatch
                          ? 'Вход в другой аккаунт доступен после завершения партии'
                          : undefined
                      }
                      onClick={() => {
                        setAuthTab('login');
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className={`py-2 rounded-xl font-display text-xs font-extrabold border transition ${
                        isPlayingMatch
                          ? 'opacity-40 cursor-not-allowed bg-white/[0.02] border-white/10 text-neutral-500'
                          : authTab === 'login'
                          ? 'bg-[#E5B869]/20 border-[#E5B869]/75 text-[#F3D082] shadow-[0_0_16px_rgba(229,184,105,0.18)] cursor-pointer'
                          : 'bg-[#0D1017] border-white/[0.08] text-neutral-400 hover:bg-[#171C28] hover:text-neutral-200 cursor-pointer'
                      }`}
                    >
                      Вход
                    </button>
                  </div>

                  <div className="space-y-2">
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                          Ваш игровой никнейм
                        </label>
                        <input
                          type="text"
                          maxLength={24}
                          data-testid="auth-nickname-input"
                          value={regNickname}
                          onChange={(e) => setRegNickname(e.target.value)}
                          placeholder="Например: Мамонт_777"
                          className="w-full px-3 py-2 rounded-xl bg-[#090B10]/95 border border-white/[0.1] focus:border-[#E5B869]/75 outline-none text-xs font-semibold text-[#F8FAFC] transition"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        Электронная почта
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        data-testid="auth-email-input"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (authError) setAuthError(null);
                        }}
                        placeholder="player@example.com"
                        className="w-full px-3 py-2 rounded-xl bg-[#090B10]/95 border border-white/[0.1] focus:border-[#E5B869]/75 outline-none text-xs font-semibold text-[#F8FAFC] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        Пароль (от 4 символов)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={4}
                          autoComplete={authTab === 'register' ? 'new-password' : 'current-password'}
                          data-testid="auth-password-input"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="••••••••"
                          className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#090B10]/95 border border-white/[0.1] focus:border-[#E5B869]/75 outline-none text-xs font-semibold text-[#F8FAFC] transition"
                        />
                        <button
                          type="button"
                          data-testid="auth-toggle-password"
                          onClick={() => setShowPassword((v) => !v)}
                          title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                          className="absolute right-2 px-1.5 py-1 text-xs text-neutral-400 hover:text-white cursor-pointer select-none"
                        >
                          <AppleEmoji emoji={showPassword ? '🙈' : '👁️'} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {authTab === 'register' && (
                    <div className="text-[10.5px] text-neutral-400 leading-snug">
                      Ваша аватарка, скин кубиков и вся гостевая статистика автоматически привяжутся к
                      новому аккаунту.
                    </div>
                  )}

                  {authError && (
                    <div
                      data-testid="auth-error-msg"
                      className="text-[11px] font-bold text-[#FDA4AF] bg-[#F43F5E]/16 border border-[#F43F5E]/45 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 w-full"
                    >
                      <AppleEmoji emoji="⚠️" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authBusy}
                    data-testid="auth-submit-btn"
                    className="btn-emerald-3d active:translate-y-0.5 w-full py-2.5 rounded-xl disabled:opacity-50 font-display font-extrabold text-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <AppleEmoji
                      emoji={authBusy ? '⏳' : authTab === 'register' ? '🚀' : '🔑'}
                    />
                    <span>
                      {authBusy
                        ? 'Загрузка...'
                        : authTab === 'register'
                        ? 'Зарегистрироваться бесплатно'
                        : 'Войти в аккаунт'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Вкладки статистики, топа и истории матчей */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'stats' as const, emoji: '📊', label: 'Статистика игрока' },
                { id: 'leaderboard' as const, emoji: '🏆', label: 'Топ игроков' },
                { id: 'matches' as const, emoji: '🕒', label: 'Последние катки' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl font-display text-[11px] font-extrabold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                    subTab === t.id
                      ? 'bg-[#E5B869]/18 border-[#E5B869]/70 text-[#F3D082] shadow-[0_0_14px_rgba(229,184,105,0.16)]'
                      : 'bg-[#12151E] border-white/[0.08] text-neutral-400 hover:bg-[#171C28] hover:text-neutral-200'
                  }`}
                >
                  <AppleEmoji emoji={t.emoji} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            {loading && <span className="text-[11px] text-neutral-400">Обновление...</span>}
          </div>

          {subTab === 'stats' && (
            <div
              data-testid="profile-stats-grid"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl bg-[#12151E]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-bold">
                    <span>{card.label}</span>
                    <AppleEmoji emoji={card.icon} />
                  </div>
                  <div className={`font-mono-num text-xl font-black mt-1 tabular-nums ${card.tone}`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {subTab === 'leaderboard' && (
            <div className="space-y-1.5">
              {!data?.leaderboard || data.leaderboard.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-[#12151E]/70 border border-white/[0.08] text-xs text-neutral-400">
                  Пока нет завершённых матчей в рейтинге — сыграй первую катку!
                </div>
              ) : (
                data.leaderboard.map((entry, idx) => (
                  <button
                    key={`${entry.playerId || entry.nickname}_${idx}`}
                    type="button"
                    onClick={() => {
                      if (entry.playerId) onSelectPlayerId(entry.playerId);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#12151E]/90 hover:bg-[#181D2B] border border-white/[0.08] text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-center font-mono-num font-black text-xs text-[#E5B869] shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg overflow-hidden shrink-0">
                        <PlayerAvatar avatar={entry.avatar} fill />
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-[#F8FAFC] truncate">
                        {entry.nickname}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono-num text-xs font-bold shrink-0 tabular-nums">
                      <span className="text-[#E5B869] inline-flex items-center gap-1">
                        <AppleEmoji emoji="🏆" />
                        <span>{entry.wins}</span>
                      </span>
                      <span className="text-neutral-400 inline-flex items-center gap-1">
                        <AppleEmoji emoji="🎮" />
                        <span>{entry.gamesPlayed}</span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {subTab === 'matches' && (
            <div className="space-y-1.5">
              {!data?.recentMatches || data.recentMatches.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-[#12151E]/70 border border-white/[0.08] text-xs text-neutral-400">
                  История матчей пока пуста.
                </div>
              ) : (
                data.recentMatches.map((m) => {
                  const modeTitle = MODE_INFO[m.mode as GameMode]?.title || m.mode;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#12151E]/90 border border-white/[0.08] text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#F8FAFC] truncate inline-flex items-center gap-1.5">
                          <AppleEmoji emoji="🏆" />
                          <span>{m.winnerNames}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono-num">
                          #{m.roomCode} · {modeTitle}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono-num font-bold text-neutral-300 tabular-nums shrink-0">
                        {m.rounds} р. · {formatDuration(m.durationSec)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
