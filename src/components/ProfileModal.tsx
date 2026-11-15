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
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface ProfileModalProps {
  open: boolean;
  targetPlayerId: string | null;
  myProfile: LocalProfile;
  authAccount: AuthAccount | null;
  onClose: () => void;
  onSelectPlayerId: (playerId: string) => void;
  onOpenAvatarCreator: () => void;
  onUpdateProfile: (patch: Partial<LocalProfile>) => void;
  onRegister: (
    email: string,
    password: string
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

  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'stats' | 'leaderboard' | 'matches'>('stats');

  useEffect(() => {
    setNickDraft(myProfile.name);
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
    setNickSavedToast(false);
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
    if (!cleaned) return;
    onUpdateProfile({ name: cleaned });
    setNickSavedToast(true);
    setTimeout(() => setNickSavedToast(false), 2200);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthBusy(true);
    try {
      const res =
        authTab === 'register'
          ? await onRegister(email, password)
          : await onLogin(email, password);
      if (!res.ok) {
        setAuthError(res.error || 'Не удалось выполнить операцию');
      } else {
        setAuthSuccess(
          authTab === 'register'
            ? 'Аккаунт создан! Ник, аватар и статистика сохранены в базе.'
            : 'Успешный вход! Профиль и статистика загружены.'
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
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto chat-scrollbar rounded-2xl bg-[#111420]/85 backdrop-blur-2xl border border-white/20 shadow-[0_24px_90px_rgba(0,0,0,0.85)] p-4 sm:p-6 space-y-5 text-slate-100"
      >
        {/* Шапка модального окна */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                borderColor: displayColor,
                backgroundColor: `${displayColor}28`,
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] flex items-center justify-center text-3xl shrink-0 overflow-hidden shadow-lg"
            >
              <PlayerAvatar avatar={displayAvatar} fill />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white truncate">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-200 text-[10.5px] font-extrabold">
                  {rank.badge} {rank.title}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                {isOwnProfile ? (
                  authAccount ? (
                    <span className="text-emerald-300 font-bold">
                      ✅ Аккаунт: {authAccount.email}
                    </span>
                  ) : (
                    <span className="text-amber-300/90 font-semibold">
                      👤 Гостевой режим (зарегистрируйтесь, чтобы сохранить прогресс навсегда)
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-2">
                    <span>{profileData?.isRegistered ? '✅ Зарегистрированный игрок' : '👤 Гость'}</span>
                    <button
                      type="button"
                      onClick={() => onSelectPlayerId(myProfile.playerId)}
                      className="text-sky-300 hover:underline font-bold cursor-pointer"
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
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 font-black text-xs flex items-center justify-center cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Редактирование своего профиля + Регистрация/Вход */}
        {isOwnProfile && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Левая карточка: Никнейм, кастомная аватарка, цвет, кубики */}
            <div className="md:col-span-6 rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Настройка профиля
                </h3>
                <button
                  type="button"
                  data-testid="open-avatar-creator-btn"
                  onClick={onOpenAvatarCreator}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 hover:from-indigo-500 hover:to-fuchsia-500 border border-white/20 text-white text-[11px] font-black cursor-pointer transition shadow-md"
                >
                  🎨 Сделать / загрузить аватарку
                </button>
              </div>

              <form onSubmit={handleSaveNickname} className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">
                  Никнейм (сохраняется в базе, можно менять в любой момент)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={24}
                    data-testid="profile-nickname-input"
                    value={nickDraft}
                    onChange={(e) => setNickDraft(e.target.value)}
                    placeholder="Введите ник..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/35 border border-white/15 focus:border-amber-400 outline-none text-xs font-bold text-white"
                  />
                  <button
                    type="submit"
                    data-testid="profile-save-nick-btn"
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer transition shrink-0"
                  >
                    {nickSavedToast ? '✅ Сохранено' : '💾 Сохранить'}
                  </button>
                </div>
              </form>

              <div>
                <div className="text-[11px] font-bold text-slate-300 mb-1.5">
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
                          ? 'bg-amber-400/25 border-amber-300/80 scale-105'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.12]'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] font-bold text-slate-300 mb-1.5">Цвет фишки</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TOKEN_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        onClick={() => onUpdateProfile({ color: c.hex })}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded-lg border transition cursor-pointer ${
                          myProfile.color === c.hex
                            ? 'ring-2 ring-white border-white scale-110'
                            : 'border-white/25 opacity-80 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-300 mb-1.5">Скин кубиков</div>
                  <select
                    value={myProfile.diceSkin}
                    onChange={(e) =>
                      onUpdateProfile({ diceSkin: e.target.value as LocalProfile['diceSkin'] })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {DICE_SKINS.map((sk) => (
                      <option key={sk.id} value={sk.id} className="bg-[#141724]">
                        {sk.preview} {sk.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Правая карточка: Аккаунт (почта + пароль) */}
            <div className="md:col-span-6 rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-sky-300">
                Аккаунт и сохранение в базе
              </h3>

              {authAccount ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-3 space-y-1">
                    <div className="text-xs font-black text-emerald-200">
                      ✅ Вы вошли в аккаунт
                    </div>
                    <div className="text-xs text-slate-200 break-all">
                      Почта: <b>{authAccount.email}</b>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono">
                      ID игрока: {authAccount.playerId}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300/85 leading-relaxed">
                    Ваш ник, кастомная аватарка и вся статистика игр сохраняются в базе данных
                    сервера. Заходите с любого устройства по своей почте и паролю!
                  </p>

                  <button
                    type="button"
                    data-testid="auth-logout-btn"
                    onClick={onLogout}
                    className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 font-extrabold text-xs cursor-pointer transition"
                  >
                    🚪 Выйти из аккаунта
                  </button>
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
                      }}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                        authTab === 'register'
                          ? 'bg-sky-500/25 border-sky-300/75 text-sky-100'
                          : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      Регистрация
                    </button>
                    <button
                      type="button"
                      data-testid="auth-tab-login"
                      onClick={() => {
                        setAuthTab('login');
                        setAuthError(null);
                      }}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                        authTab === 'login'
                          ? 'bg-emerald-500/25 border-emerald-300/75 text-emerald-100'
                          : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      Вход
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Электронная почта
                      </label>
                      <input
                        type="email"
                        required
                        data-testid="auth-email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="player@example.com"
                        className="w-full px-3 py-2 rounded-xl bg-black/35 border border-white/15 focus:border-sky-400 outline-none text-xs font-semibold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Пароль (от 4 символов)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        data-testid="auth-password-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-black/35 border border-white/15 focus:border-sky-400 outline-none text-xs font-semibold text-white"
                      />
                    </div>
                  </div>

                  {authTab === 'register' && (
                    <div className="text-[10.5px] text-slate-400 leading-snug">
                      Текущий ник («<b className="text-slate-200">{myProfile.name}</b>»), аватарка и
                      гостевая статистика сразу привяжутся к новому аккаунту.
                    </div>
                  )}

                  {authError && (
                    <div
                      data-testid="auth-error-msg"
                      className="text-[11px] font-bold text-rose-200 bg-rose-500/20 border border-rose-400/50 rounded-xl px-3 py-2"
                    >
                      ⚠️ {authError}
                    </div>
                  )}
                  {authSuccess && (
                    <div
                      data-testid="auth-success-msg"
                      className="text-[11px] font-bold text-emerald-200 bg-emerald-500/20 border border-emerald-400/50 rounded-xl px-3 py-2"
                    >
                      {authSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authBusy}
                    data-testid="auth-submit-btn"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50 text-white font-black text-xs cursor-pointer transition shadow-lg"
                  >
                    {authBusy
                      ? '⏳ Загрузка...'
                      : authTab === 'register'
                      ? '🚀 Зарегистрироваться бесплатно'
                      : '🔑 Войти в аккаунт'}
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
                { id: 'stats' as const, label: '📊 Статистика игрока' },
                { id: 'leaderboard' as const, label: '🏆 Топ игроков' },
                { id: 'matches' as const, label: '🕒 Последние катки' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    subTab === t.id
                      ? 'bg-amber-400/20 border-amber-300/70 text-amber-200'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {loading && <span className="text-[11px] text-slate-400">Обновление...</span>}
          </div>

          {subTab === 'stats' && (
            <div
              data-testid="profile-stats-grid"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                    <span>{card.label}</span>
                    <span>{card.icon}</span>
                  </div>
                  <div className={`text-xl font-black mt-1 tabular-nums ${card.tone}`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {subTab === 'leaderboard' && (
            <div className="space-y-1.5">
              {!data?.leaderboard || data.leaderboard.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400">
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
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-center font-black text-xs text-amber-300 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg overflow-hidden shrink-0">
                        <PlayerAvatar avatar={entry.avatar} fill />
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-white truncate">
                        {entry.nickname}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold shrink-0 tabular-nums">
                      <span className="text-amber-300">🏆 {entry.wins}</span>
                      <span className="text-slate-400">🎮 {entry.gamesPlayed}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {subTab === 'matches' && (
            <div className="space-y-1.5">
              {!data?.recentMatches || data.recentMatches.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400">
                  История матчей пока пуста.
                </div>
              ) : (
                data.recentMatches.map((m) => {
                  const modeTitle = MODE_INFO[m.mode as GameMode]?.title || m.mode;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          🏆 {m.winnerNames}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          #{m.roomCode} · {modeTitle}
                        </div>
                      </div>
                      <div className="text-[11px] font-bold text-slate-300 tabular-nums shrink-0">
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
