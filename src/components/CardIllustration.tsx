import React, { useId } from 'react';
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
    bgFrom: '#1f1104',
    bgTo: '#3d1c06',
    accent: '#A86523',
    badge: 'ДЕШМАНСКИЙ ХАВЧИК',
    decor: ['🌯', '🍜', '🔥'],
  },
  clothes: {
    bgFrom: '#071726',
    bgTo: '#0c2d48',
    accent: '#38BDF8',
    badge: 'СКАМ И ПАЛЬ',
    decor: ['🧥', '🦣', '💻'],
  },
  cars: {
    bgFrom: '#0f141e',
    bgTo: '#1e293b',
    accent: '#64748B',
    badge: 'ТРАНСПОРТНЫЕ АКТИВЫ',
    decor: ['🚗', '⚰️', '🚐'],
  },
  scam: {
    bgFrom: '#1d0728',
    bgTo: '#3b0c52',
    accent: '#D946EF',
    badge: 'ИНФОЦЫГАНЕ И ПРОГРЕВ',
    decor: ['📣', '📉', '🐹'],
  },
  booze: {
    bgFrom: '#210d05',
    bgTo: '#451907',
    accent: '#F97316',
    badge: 'ТЯЖЁЛЫЙ ДОФАМИН',
    decor: ['💨', '⚡', '💉'],
  },
  delivery: {
    bgFrom: '#240712',
    bgTo: '#4a0b21',
    accent: '#EF4444',
    badge: 'РАБСКИЙ ТРУД',
    decor: ['📦', '💳', '🌧️'],
  },
  gaming: {
    bgFrom: '#1a1404',
    bgTo: '#382a07',
    accent: '#EAB308',
    badge: 'БРЕЙНРОТ И ЗАДРОТЫ',
    decor: ['📱', '🎮', '🧠'],
  },
  it: {
    bgFrom: '#051a1c',
    bgTo: '#093330',
    accent: '#14B8A6',
    badge: 'ЦИФРОВОЙ КОНЦЛАГЕРЬ',
    decor: ['🕯️', '🔒', '🧊'],
  },
  realty: {
    bgFrom: '#051c13',
    bgTo: '#083625',
    accent: '#10B981',
    badge: 'УБИТАЯ НЕДВИЖКА',
    decor: ['🪳', '🚽', '🏚️'],
  },
  gadgets: {
    bgFrom: '#0a122e',
    bgTo: '#132459',
    accent: '#2563EB',
    badge: 'ТЯЖЁЛЫЙ ЛЮКС В ДОЛГ',
    decor: ['📱', '⛓️', '🎰'],
  },
};

export const IndustryCardBanner: React.FC<IndustryCardBannerProps> = ({
  groupId,
  cellType,
  cellId = 0,
  censored = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const theme = (groupId && GROUP_THEMES[groupId]) || {
    bgFrom: '#101420',
    bgTo: '#161922',
    accent: '#E5B869',
    badge: cellType || 'СПЕЦКЛЕТКА',
    decor: ['🎲', '💰', '✨'],
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${theme.bgFrom} 0%, #0F1117 58%, ${theme.bgTo} 100%)`,
        borderColor: `${theme.accent}55`,
        boxShadow: `0 14px 32px -8px rgba(0,0,0,0.82), 0 0 24px -8px ${theme.accent}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
      className={`relative w-full h-[108px] rounded-xl border overflow-hidden flex items-center justify-between px-3 sm:px-4 gap-2 select-none ${className}`}
    >
      {/* Декоративная неоновая сетка, радиальный блик и кольца */}
      <svg
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <pattern id={`grid-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke={theme.accent} strokeOpacity="0.11" strokeWidth="0.7" />
          </pattern>
          <radialGradient id={`glow-${uid}`} cx="84%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.34" />
            <stop offset="60%" stopColor={theme.accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="120" fill={`url(#grid-${uid})`} />
        <rect width="320" height="120" fill={`url(#glow-${uid})`} />
        <circle cx="262" cy="60" r="68" fill="none" stroke={theme.accent} strokeOpacity="0.22" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="262" cy="60" r="47" fill="none" stroke="#E5B869" strokeOpacity="0.14" strokeWidth="1" />
        <path d="M0 96 Q100 72 195 98 T320 84 L320 120 L0 120 Z" fill={theme.accent} fillOpacity="0.1" />
      </svg>

      {/* Верхний стеклянный блик */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent" />

      {/* Левая часть с премиальным неоновым тегом категории и тёмными слотами */}
      <div className="relative z-10 flex flex-col justify-center sm:justify-between h-full py-1 sm:py-2 min-w-0 flex-1">
        <span
          style={{
            background: 'linear-gradient(135deg, rgba(9, 11, 17, 0.92) 0%, rgba(20, 24, 36, 0.88) 100%)',
            borderColor: `${theme.accent}88`,
            color: theme.accent,
            boxShadow: `0 0 16px ${theme.accent}35, inset 0 1px 0 rgba(255,255,255,0.12)`,
            textShadow: `0 0 10px ${theme.accent}66`,
          }}
          className="inline-flex items-center gap-1.5 w-fit max-w-full px-2.5 sm:px-3 py-1 rounded-xl border text-[8.5px] sm:text-[9.5px] font-extrabold tracking-wider uppercase whitespace-normal break-words leading-tight"
        >
          <span
            style={{
              backgroundColor: theme.accent,
              boxShadow: `0 0 8px ${theme.accent}`,
            }}
            className="w-1.5 h-1.5 rounded-full shrink-0"
          />
          <span className="whitespace-normal break-words text-[#F8FAFC]">{theme.badge}</span>
        </span>
        <div className="hidden sm:flex items-center gap-1.5">
          {theme.decor.map((em, i) => (
            <span
              key={i}
              style={{
                borderColor: `${theme.accent}38`,
                boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.06)',
              }}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#0A0C12]/85 backdrop-blur-md border flex items-center justify-center text-xs sm:text-sm"
            >
              {em}
            </span>
          ))}
        </div>
      </div>

      {/* Правая иллюстрация на тёмном обсидиановом пьедестале вместо белого квадрата */}
      <div
        style={{
          borderColor: `${theme.accent}75`,
          boxShadow: `0 0 24px ${theme.accent}38, 0 10px 22px rgba(0,0,0,0.75), inset 0 2px 8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.14)`,
          background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${theme.accent} 24%, #151926) 0%, #0B0D14 78%)`,
        }}
        className="relative z-10 h-[calc(100%-8px)] max-h-[90px] aspect-square rounded-xl border flex items-center justify-center p-1 sm:p-1.5 shrink-0 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-1 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div
          style={{ filter: `drop-shadow(0 3px 8px ${theme.accent}55)` }}
          className="relative z-10 w-full h-full flex items-center justify-center"
        >
          <CellArtwork
            cellId={cellId}
            side="corner"
            censored={censored}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
};

export interface ChanceCardIllustrationProps {
  cardId: string;
  kind: string;
  className?: string;
}

interface ChanceSceneMeta {
  tag: string;
  bg1: string;
  bg2: string;
  accent: string;
  props: [string, string, string];
  cellId?: number;
}

const CHANCE_SCENE_META: Record<string, ChanceSceneMeta> = {
  pen_dodep_3am: {
    tag: 'НОЧНОЙ ДОДЕП В 03:14',
    bg1: '#230710',
    bg2: '#470a1d',
    accent: '#fb7185',
    props: ['🎰', '🔥', '💸'],
    cellId: 4,
  },
  pen_hamster_scam: {
    tag: 'ЛИСТИНГ ХОМЯКА $0.42',
    bg1: '#24080a',
    bg2: '#4a0c12',
    accent: '#f43f5e',
    props: ['🐹', '📉', '🤡'],
    cellId: 14,
  },
  pen_115fz_block: {
    tag: 'БЛОК КАРТ ПО 115-ФЗ',
    bg1: '#071d24',
    bg2: '#0f3842',
    accent: '#22d3ee',
    props: ['🧊', '🔒', '💳'],
    cellId: 28,
  },
  pen_stone_patch: {
    tag: 'СПРОСИЛИ ЗА ПАЛЁНЫЙ ПАТЧ',
    bg1: '#1c1129',
    bg2: '#361952',
    accent: '#c084fc',
    props: ['🧥', '🩹', '👊'],
    cellId: 6,
  },
  pen_mammoth_cvv: {
    tag: 'ВБИЛ CVV НА ФИШИНГ-САЙТЕ',
    bg1: '#19092b',
    bg2: '#331157',
    accent: '#a78bfa',
    props: ['🦣', '🎣', '📱'],
    cellId: 8,
  },
  pen_shawarma_poison: {
    tag: 'ШАУРМА С ВОКЗАЛА • РЕАНИМАЦИЯ',
    bg1: '#261205',
    bg2: '#4d2208',
    accent: '#fb923c',
    props: ['🌯', '🚑', '💉'],
    cellId: 1,
  },
  pen_dota_monitor: {
    tag: 'РАЗБИЛ МОНИТОР НА -30 MMR',
    bg1: '#26080b',
    bg2: '#4d0e15',
    accent: '#ef4444',
    props: ['🖥️', '🎮', '💥'],
    cellId: 27,
  },
  pen_mfo_iphone: {
    tag: 'ПРОСРОЧКА МФО 365% В ДЕНЬ',
    bg1: '#240709',
    bg2: '#4a0d12',
    accent: '#f87171',
    props: ['📱', '⛓️', '📜'],
    cellId: 37,
  },
  pen_futures_liq: {
    tag: 'ЛИКВИДАЦИЯ С ПЛЕЧОМ X125',
    bg1: '#240716',
    bg2: '#4a0d2e',
    accent: '#f472b6',
    props: ['📉', '💀', '💸'],
    cellId: 13,
  },
  pen_vape_lungs: {
    tag: 'ЗАТЯНУЛСЯ ГАРИКОМ С ГУДРОНОМ',
    bg1: '#241104',
    bg2: '#4a2208',
    accent: '#f97316',
    props: ['💨', '☠️', '🫁'],
    cellId: 16,
  },
  pen_warehouse_fines: {
    tag: 'ШТРАФЫ НА НОЧНОЙ СМЕНЕ',
    bg1: '#221304',
    bg2: '#472507',
    accent: '#f59e0b',
    props: ['📦', '🔫', '🧾'],
    cellId: 21,
  },
  pen_drop_jail: {
    tag: 'ПРИНЯЛИ ЗА ДРОП-КАРТЫ — В СИЗО!',
    bg1: '#08152b',
    bg2: '#112a54',
    accent: '#60a5fa',
    props: ['🚓', '💳', '🚨'],
    cellId: 23,
  },
  pen_brainrot_coma: {
    tag: 'БРЕЙНРОТ-КОМА НА 14 ЧАСОВ',
    bg1: '#180a29',
    bg2: '#311354',
    accent: '#e879f9',
    props: ['🧠', '📱', '💤'],
    cellId: 29,
  },
  pen_trash_donate_all: {
    tag: 'СЛИЛ ДОНАТЫ ВСЕМУ СТОЛУ',
    bg1: '#250712',
    bg2: '#4a0c23',
    accent: '#fb7185',
    props: ['📱', '🥚', '💸'],
    cellId: 26,
  },
  pen_bedbugs_compensation: {
    tag: 'ДЕЗИНСЕКЦИЯ КЛОПОВНИКА ВСЕМ',
    bg1: '#1f1404',
    bg2: '#422807',
    accent: '#fbbf24',
    props: ['🪳', '🧪', '🧾'],
    cellId: 31,
  },
  bon_tiktok_millions: {
    tag: 'РЕК В TIKTOK НА 15 МЛН',
    bg1: '#041f15',
    bg2: '#093d2a',
    accent: '#34d399',
    props: ['📱', '🔥', '💰'],
    cellId: 26,
  },
  bon_infogypsy_launch: {
    tag: 'ПРОГРЕВ VIP-ТАРИФА ЗАЛЕТЕЛ',
    bg1: '#041f15',
    bg2: '#093d2a',
    accent: '#34d399',
    props: ['📣', '👑', '💵'],
    cellId: 11,
  },
  bon_zhiga_metal: {
    tag: 'СДАЛ КАТАЛИЗАТОР И ЖИГУ',
    bg1: '#052110',
    bg2: '#0a421f',
    accent: '#4ade80',
    props: ['🚗', '🔩', '💵'],
    cellId: 5,
  },
  bon_shitcoin_pump: {
    tag: 'ЩИТКОИН ДАЛ ПАМП ИКС-20',
    bg1: '#052110',
    bg2: '#0a421f',
    accent: '#4ade80',
    props: ['🚀', '📈', '💰'],
    cellId: 9,
  },
  bon_grandma_mattress: {
    tag: 'НАШЁЛ ЗАНАЧКУ В МАТРАСЕ',
    bg1: '#211504',
    bg2: '#422907',
    accent: '#fbbf24',
    props: ['🛏️', '💵', '✨'],
    cellId: 32,
  },
  bon_shield_ksiva: {
    tag: 'ЛЕВАЯ КСИВА ОТ ОБЛАВЫ',
    bg1: '#051c24',
    bg2: '#083747',
    accent: '#22d3ee',
    props: ['🛡️', '🪪', '✨'],
  },
  bon_collect_stream: {
    tag: 'СТРИМ С БРИТЬЁМ БРОВЕЙ',
    bg1: '#052112',
    bg2: '#0a4224',
    accent: '#4ade80',
    props: ['🪒', '🌹', '🎉'],
    cellId: 26,
  },
  bon_collect_blackout: {
    tag: 'ПЛАТНАЯ ЗАРЯДКА В БЛЭКАУТ',
    bg1: '#052112',
    bg2: '#0a4224',
    accent: '#2dd4bf',
    props: ['🕯️', '🔋', '💵'],
    cellId: 12,
  },
  bon_hearse_start: {
    tag: 'КАТАФАЛК ДОЛЕТЕЛ НА ПОЛУЧКУ',
    bg1: '#1f1804',
    bg2: '#3f3006',
    accent: '#facc15',
    props: ['⚰️', '🏁', '💵'],
    cellId: 15,
  },
  bon_branch_cashback: {
    tag: 'ОТМЫВ ЧЕРЕЗ ТЕМКИ И ТОЧКИ',
    bg1: '#041f16',
    bg2: '#083d2b',
    accent: '#10b981',
    props: ['🌟', '🏪', '💰'],
    cellId: 9,
  },
  bon_triple_energy: {
    tag: '3 БАНКИ ЭНЕРГОСА • ТУРБО-ХОД',
    bg1: '#1e1704',
    bg2: '#3d2e06',
    accent: '#a3e635',
    props: ['⚡', '🎲', '🔥'],
    cellId: 18,
  },
  bon_phish_leader: {
    tag: 'СКАМАНУЛ БОГАТЕЙШЕГО МАМОНТА',
    bg1: '#051e1e',
    bg2: '#093b3b',
    accent: '#2dd4bf',
    props: ['🦣', '🎣', '💵'],
    cellId: 8,
  },
  bon_free_quantum: {
    tag: 'ХАЛЯВНЫЙ КВАНТОВЫЙ ПРЫЖОК',
    bg1: '#0d102b',
    bg2: '#1a1f54',
    accent: '#818cf8',
    props: ['🌀', '🩴', '⚡'],
    cellId: 7,
  },
  custom_p2p_triangle: {
    tag: 'ЧЁРНЫЙ ТРЕУГОЛЬНИК P2P',
    bg1: '#240710',
    bg2: '#4a0b1e',
    accent: '#fb7185',
    props: ['🔺', '💳', '🚨'],
    cellId: 28,
  },
  custom_dota_boost: {
    tag: 'ПРОДАЛ БУСТ АККАУНТА МАЖОРУ',
    bg1: '#1e1704',
    bg2: '#3d2f06',
    accent: '#facc15',
    props: ['🎮', '🏆', '💵'],
    cellId: 27,
  },
};

export const ChanceCardIllustration: React.FC<ChanceCardIllustrationProps> = ({
  cardId,
  kind,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const isBad =
    kind === 'PENALTY' ||
    kind === 'BRANCH_TAX' ||
    kind === 'PAY_ALL' ||
    kind === 'GOTO_JAIL' ||
    kind === 'SKIP_TURN';
  const scene: ChanceSceneMeta = CHANCE_SCENE_META[cardId] || {
    tag: isBad ? 'ШТРАФНОЙ ИВЕНТ' : 'БОНУСНЫЙ ИВЕНТ',
    bg1: isBad ? '#240710' : '#052113',
    bg2: isBad ? '#4a0c1e' : '#094025',
    accent: isBad ? '#fb7185' : '#34d399',
    props: isBad ? ['⚠️', '💸', '📉'] : ['🎉', '💵', '🍀'],
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${scene.bg1} 0%, ${scene.bg2} 100%)`,
        borderColor: `${scene.accent}66`,
        boxShadow: `0 12px 32px -8px rgba(0,0,0,0.75), 0 0 26px -6px ${scene.accent}48, inset 0 1px 0 rgba(255,255,255,0.16)`,
      }}
      className={`relative w-full h-[116px] rounded-2xl border overflow-hidden flex items-center justify-between px-4 gap-3 select-none ${className}`}
    >
      {/* Динамическая векторная графика: тех-сетка, радиальный блик и кривая тренда */}
      <svg
        viewBox="0 0 320 116"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <pattern id={`cgrid-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke={scene.accent} strokeOpacity="0.11" strokeWidth="0.7" />
          </pattern>
          <radialGradient id={`cglow-${uid}`} cx="82%" cy="50%" r="54%">
            <stop offset="0%" stopColor={scene.accent} stopOpacity="0.44" />
            <stop offset="55%" stopColor={scene.accent} stopOpacity="0.14" />
            <stop offset="100%" stopColor={scene.accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`carea-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scene.accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={scene.accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="320" height="116" fill={`url(#cgrid-${uid})`} />
        <rect width="320" height="116" fill={`url(#cglow-${uid})`} />
        <circle cx="258" cy="58" r="68" fill="none" stroke={scene.accent} strokeOpacity="0.24" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="258" cy="58" r="48" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />

        {isBad ? (
          <>
            <polygon
              points="12,30 68,45 112,33 165,78 214,96 214,116 12,116"
              fill={`url(#carea-${uid})`}
            />
            <polyline
              points="12,30 68,45 112,33 165,78 214,96"
              fill="none"
              stroke={scene.accent}
              strokeOpacity="0.6"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="214" cy="96" r="4.2" fill={scene.accent} />
          </>
        ) : (
          <>
            <polygon
              points="12,92 68,74 118,80 170,38 216,20 216,116 12,116"
              fill={`url(#carea-${uid})`}
            />
            <polyline
              points="12,92 68,74 118,80 170,38 216,20"
              fill="none"
              stroke={scene.accent}
              strokeOpacity="0.65"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="216" cy="20" r="4.2" fill={scene.accent} />
          </>
        )}
      </svg>

      {/* Верхний стеклянный блик */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" />

      <div className="relative z-10 flex flex-col justify-between h-full py-2.5 min-w-0 flex-1">
        <span
          style={{
            background: `linear-gradient(135deg, ${scene.accent}eb, ${scene.accent}99)`,
            borderColor: scene.accent,
            boxShadow: `0 0 16px ${scene.accent}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-black text-white tracking-wide uppercase w-fit max-w-full whitespace-normal break-words leading-tight"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isBad ? 'bg-rose-100 animate-pulse' : 'bg-emerald-100'
            }`}
          />
          <span className="whitespace-normal break-words">{scene.tag}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {scene.props.slice(1).map((em, idx) => (
            <span
              key={idx}
              style={{
                borderColor: `${scene.accent}44`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 10px rgba(0,0,0,0.35)',
              }}
              className="w-8 h-8 rounded-lg bg-white/[0.09] backdrop-blur-md border flex items-center justify-center text-base"
            >
              {em}
            </span>
          ))}
        </div>
      </div>

      {/* Главная сцена справа на тёмном обсидиановом пьедестале */}
      {scene.cellId !== undefined ? (
        <div
          style={{
            borderColor: `${scene.accent}77`,
            boxShadow: `0 0 24px ${scene.accent}42, 0 10px 22px rgba(0,0,0,0.75), inset 0 2px 8px rgba(0,0,0,0.85)`,
            background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${scene.accent} 24%, #151926) 0%, #090B10 80%)`,
          }}
          className="relative z-10 w-[88px] h-[88px] rounded-2xl border flex items-center justify-center p-1.5 shrink-0 overflow-hidden"
        >
          <div className="relative z-10 w-full h-full">
            <CellArtwork cellId={scene.cellId} side="corner" className="w-full h-full" />
          </div>
        </div>
      ) : (
        <div
          style={{
            borderColor: `${scene.accent}88`,
            boxShadow: `0 0 24px ${scene.accent}52, 0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22)`,
          }}
          className="relative z-10 w-[88px] h-[88px] rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-800/85 to-black/95 border-2 flex items-center justify-center shrink-0 overflow-hidden"
        >
          <svg
            viewBox="0 0 88 88"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
          >
            <circle cx="44" cy="44" r="32" fill={scene.accent} fillOpacity="0.18" />
            <circle cx="44" cy="44" r="34" fill="none" stroke={scene.accent} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
          </svg>
          <span
            style={{ filter: `drop-shadow(0 4px 12px ${scene.accent}88)` }}
            className="relative z-10 text-5xl leading-none"
          >
            {scene.props[0]}
          </span>
          <span
            style={{ borderColor: `${scene.accent}66` }}
            className="absolute bottom-1 right-1 z-10 w-6 h-6 rounded-lg bg-black/70 border text-xs flex items-center justify-center shadow-md"
          >
            {scene.props[2]}
          </span>
        </div>
      )}
    </div>
  );
};
