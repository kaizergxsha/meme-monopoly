import React from 'react';
import { CellArtwork } from './CellArtwork.tsx';

export interface IndustryCardBannerProps {
  groupId?: string;
  cellType?: string;
  cellId?: number;
  censored?: boolean;
  className?: string;
}

const GROUP_THEMES: Record<
  string,
  { bgFrom: string; bgTo: string; accent: string; badge: string; decor: string[] }
> = {
  food: {
    bgFrom: '#fffbeb',
    bgTo: '#fde68a',
    accent: '#d97706',
    badge: 'СТРИТ-ФУД ИМПЕРИЯ',
    decor: ['🌯', '🥟', '🔥'],
  },
  clothes: {
    bgFrom: '#f0f9ff',
    bgTo: '#bae6fd',
    accent: '#0284c7',
    badge: 'ЛЮКС С РЫНКА',
    decor: ['👟', '🧥', '🏷️'],
  },
  cars: {
    bgFrom: '#f8fafc',
    bgTo: '#cbd5e1',
    accent: '#475569',
    badge: 'АВТОПАРК МЕЧТЫ',
    decor: ['🚗', '💨', '🔧'],
  },
  scam: {
    bgFrom: '#fdf4ff',
    bgTo: '#f5d0fe',
    accent: '#c026d3',
    badge: 'КРИПТА & ТЕМКИ',
    decor: ['📈', '💎', '🚀'],
  },
  booze: {
    bgFrom: '#fff7ed',
    bgTo: '#fed7aa',
    accent: '#ea580c',
    badge: 'НОЧНОЙ ЛАРЁК 24/7',
    decor: ['🍺', '⚡', '🌙'],
  },
  delivery: {
    bgFrom: '#fff1f2',
    bgTo: '#fecdd3',
    accent: '#e11d48',
    badge: 'ЭКСПРЕСС-ДОСТАВКА',
    decor: ['🚖', '🛵', '📦'],
  },
  gaming: {
    bgFrom: '#fefce8',
    bgTo: '#fef08a',
    accent: '#ca8a04',
    badge: 'КИБЕР-АРЕНА',
    decor: ['🎮', '🖥️', '🔪'],
  },
  it: {
    bgFrom: '#ecfeff',
    bgTo: '#a5f3fc',
    accent: '#0891b2',
    badge: 'IT НА КОСТЫЛЯХ',
    decor: ['💻', '🔥', '🩼'],
  },
  realty: {
    bgFrom: '#ecfdf5',
    bgTo: '#a7f3d0',
    accent: '#059669',
    badge: 'ЭЛИТНЫЕ МЕТРЫ',
    decor: ['🏢', '🏙️', '🔑'],
  },
  gadgets: {
    bgFrom: '#eef2ff',
    bgTo: '#c7d2fe',
    accent: '#4f46e5',
    badge: 'ТЯЖЁЛЫЙ ТЕХНО-ЛЮКС',
    decor: ['📱', '⛏️', '₿'],
  },
};

export const IndustryCardBanner: React.FC<IndustryCardBannerProps> = ({
  groupId,
  cellType,
  cellId = 0,
  censored = false,
  className = '',
}) => {
  const theme = (groupId && GROUP_THEMES[groupId]) || {
    bgFrom: '#f8fafc',
    bgTo: '#e2e8f0',
    accent: '#334155',
    badge: cellType || 'СПЕЦКЛЕТКА',
    decor: ['🎲', '💰', '✨'],
  };

  const pngArt =
    cellId === 0
      ? '/art/corner_start.png'
      : cellId === 30
      ? '/art/corner_police.png'
      : groupId === 'delivery'
      ? '/art/ind_delivery.png'
      : null;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
        borderColor: `${theme.accent}33`,
      }}
      className={`relative w-full h-[108px] rounded-xl border overflow-hidden flex items-center justify-between px-4 select-none ${className}`}
    >
      {/* Декоративные лучи и круги на фоне карточки */}
      <svg
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
      >
        <circle cx="260" cy="60" r="78" fill={theme.accent} fillOpacity="0.14" />
        <circle cx="260" cy="60" r="52" fill="#ffffff" fillOpacity="0.65" />
        <path d="M0 95 Q95 65 190 105 T320 85 L320 120 L0 120 Z" fill={theme.accent} fillOpacity="0.1" />
      </svg>

      {/* Левая часть с бейджем категории и фоновыми эмодзи */}
      <div className="relative z-10 flex flex-col justify-between h-full py-2.5 max-w-[58%]">
        <span
          style={{ backgroundColor: theme.accent }}
          className="inline-block w-fit px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider text-white uppercase shadow-xs"
        >
          {theme.badge}
        </span>
        <div className="flex items-center gap-1.5 text-lg opacity-85">
          {theme.decor.map((em, i) => (
            <span
              key={i}
              className="w-7 h-7 rounded-lg bg-white/80 shadow-xs flex items-center justify-center text-sm"
            >
              {em}
            </span>
          ))}
        </div>
      </div>

      {/* Крупная правая иллюстрация самой карточки */}
      <div className="relative z-10 w-[92px] h-[92px] rounded-xl bg-white/90 shadow-md border border-white flex items-center justify-center p-1.5 shrink-0">
        {pngArt ? (
          <img
            src={pngArt}
            alt={theme.badge}
            className="w-full h-full object-contain mix-blend-multiply"
          />
        ) : (
          <CellArtwork
            cellId={cellId}
            side="corner"
            censored={censored}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  );
};

export interface ChanceCardIllustrationProps {
  cardId: string;
  kind: string;
  className?: string;
}

const CHANCE_SCENE_META: Record<
  string,
  { tag: string; bg1: string; bg2: string; accent: string; props: [string, string, string] }
> = {
  pen_shitcoin: {
    tag: 'SHITCOIN -99.9%',
    bg1: '#fff1f2',
    bg2: '#fecdd3',
    accent: '#e11d48',
    props: ['💩', '📉', '🪙'],
  },
  pen_futures: {
    tag: 'LIQUIDATED 50X',
    bg1: '#fef2f2',
    bg2: '#fca5a5',
    accent: '#dc2626',
    props: ['🕯️', '📉', '💀'],
  },
  pen_prod: {
    tag: 'FRIDAY DEPLOY 500',
    bg1: '#fff7ed',
    bg2: '#fdba74',
    accent: '#ea580c',
    props: ['🔥', '🖥️', '🚨'],
  },
  pen_simp: {
    tag: 'DONATION IGNORED',
    bg1: '#fdf2f8',
    bg2: '#fbcfe8',
    accent: '#db2777',
    props: ['💋', '💸', '🤡'],
  },
  pen_temshik: {
    tag: 'СКАМ-ТЕМКА ГОДА',
    bg1: '#f5f3ff',
    bg2: '#ddd6fe',
    accent: '#7c3aed',
    props: ['🦈', '🏎️', '💨'],
  },
  pen_mouse: {
    tag: 'TILT & RAGEQUIT',
    bg1: '#fef2f2',
    bg2: '#fecaca',
    accent: '#b91c1c',
    props: ['🖱️', '💥', '🤬'],
  },
  pen_trial: {
    tag: 'AUTO-RENEWAL -$500',
    bg1: '#f8fafc',
    bg2: '#cbd5e1',
    accent: '#475569',
    props: ['💳', '🔔', '😭'],
  },
  pen_fop: {
    tag: 'КАМЕРАЛЬНАЯ ПРОВЕРКА',
    bg1: '#fffbeb',
    bg2: '#fde68a',
    accent: '#b45309',
    props: ['🧾', '🏛️', '💼'],
  },
  pen_taxi: {
    tag: 'ТАРИФ «ДЛЯ ДУШИ» ×3',
    bg1: '#fefce8',
    bg2: '#fef08a',
    accent: '#ca8a04',
    props: ['🚖', '🗺️', '💸'],
  },
  pen_microloan: {
    tag: '365% ГОДОВЫХ',
    bg1: '#fef2f2',
    bg2: '#fca5a5',
    accent: '#991b1b',
    props: ['🚪', '👊', '📜'],
  },
  bon_viral: {
    tag: 'В РЕКОМЕНДАЦИЯХ 1M+',
    bg1: '#ecfdf5',
    bg2: '#a7f3d0',
    accent: '#059669',
    props: ['🚀', '📱', '💰'],
  },
  bon_atm: {
    tag: 'CASHBACK GLITCH',
    bg1: '#f0fdf4',
    bg2: '#bbf7d0',
    accent: '#16a34a',
    props: ['🏧', '💵', '😎'],
  },
  bon_babushka: {
    tag: 'БАБУШКИН ДОНАТ',
    bg1: '#fffbeb',
    bg2: '#fde68a',
    accent: '#d97706',
    props: ['👵', '🥧', '💵'],
  },
  bon_shield: {
    tag: 'СКАМ-ИММУНИТЕТ',
    bg1: '#ecfeff',
    bg2: '#a5f3fc',
    accent: '#0891b2',
    props: ['🛡️', '🤝', '✨'],
  },
  bon_hangover: {
    tag: 'БРАТСКИЙ СБОР',
    bg1: '#f0fdf4',
    bg2: '#dcfce7',
    accent: '#15803d',
    props: ['🍻', '💸', '🎉'],
  },
  bon_uber: {
    tag: 'ЭКСПРЕСС НА СТАРТ',
    bg1: '#fefce8',
    bg2: '#fde047',
    accent: '#a16207',
    props: ['🚕', '🏁', '💵'],
  },
  pen_jail_card: {
    tag: 'ПАКЕТ ЯРОВОЙ / БАН',
    bg1: '#eff6ff',
    bg2: '#bfdbfe',
    accent: '#1d4ed8',
    props: ['🚓', '⛓️', '🚨'],
  },
  pen_raiders: {
    tag: 'ПЕРЕРЫВ НА ПИВО',
    bg1: '#faf5ff',
    bg2: '#e9d5ff',
    accent: '#9333ea',
    props: ['🍺', '🛋️', '💤'],
  },
};

export const ChanceCardIllustration: React.FC<ChanceCardIllustrationProps> = ({
  cardId,
  kind,
  className = '',
}) => {
  const isBad =
    kind === 'PENALTY' || kind === 'BRANCH_TAX' || kind === 'GOTO_JAIL' || kind === 'SKIP_TURN';
  const scene = CHANCE_SCENE_META[cardId] || {
    tag: isBad ? 'ШТРАФНОЙ ИВЕНТ' : 'БОНУСНЫЙ ИВЕНТ',
    bg1: isBad ? '#fff1f2' : '#f0fdf4',
    bg2: isBad ? '#fecdd3' : '#bbf7d0',
    accent: isBad ? '#e11d48' : '#16a34a',
    props: isBad ? ['⚠️', '💸', '📉'] : ['🎉', '💵', '🍀'],
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${scene.bg1} 0%, ${scene.bg2} 100%)`,
        borderColor: `${scene.accent}40`,
      }}
      className={`relative w-full h-[112px] rounded-xl border overflow-hidden flex items-center justify-between px-4 select-none ${className}`}
    >
      {/* Динамическая векторная графика: график / лучи */}
      <svg
        viewBox="0 0 320 112"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <circle cx="255" cy="56" r="68" fill="#ffffff" fillOpacity="0.55" />
        {isBad ? (
          <polyline
            points="12,26 68,42 112,30 165,78 215,96"
            fill="none"
            stroke={scene.accent}
            strokeOpacity="0.28"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <polyline
            points="12,92 68,74 118,80 170,38 220,18"
            fill="none"
            stroke={scene.accent}
            strokeOpacity="0.32"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <div className="relative z-10 flex flex-col justify-between h-full py-2.5">
        <span
          style={{ backgroundColor: scene.accent }}
          className="px-2 py-0.5 rounded-md text-[9.5px] font-black text-white tracking-wider uppercase w-fit shadow-xs"
        >
          {scene.tag}
        </span>
        <div className="flex items-center gap-1.5">
          {scene.props.slice(1).map((em, idx) => (
            <span
              key={idx}
              className="w-8 h-8 rounded-lg bg-white/85 shadow-xs flex items-center justify-center text-base"
            >
              {em}
            </span>
          ))}
        </div>
      </div>

      {/* Главная сцена справа */}
      <div
        style={{ borderColor: `${scene.accent}55` }}
        className="relative z-10 w-[86px] h-[86px] rounded-2xl bg-white shadow-md border-2 flex items-center justify-center text-5xl"
      >
        {cardId === 'pen_jail_card' ? (
          <img
            src="/art/corner_police.png"
            alt="Police"
            className="w-full h-full object-contain p-1 mix-blend-multiply"
          />
        ) : cardId === 'bon_uber' ? (
          <img
            src="/art/ind_delivery.png"
            alt="Uber"
            className="w-full h-full object-contain p-1 mix-blend-multiply"
          />
        ) : (
          <span>{scene.props[0]}</span>
        )}
      </div>
    </div>
  );
};
