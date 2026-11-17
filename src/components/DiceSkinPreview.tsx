import React from 'react';
import { DiceSkin, SpeedDieFace } from '../../shared/types.ts';
import { AppleEmoji } from './AppleEmoji.tsx';

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function getDiceSkinSurfaceStyle(skin: DiceSkin | string): React.CSSProperties {
  switch (skin) {
    case 'obsidian_frost':
      return {
        background:
          'linear-gradient(145deg, rgba(30, 35, 50, 0.78) 0%, rgba(12, 15, 24, 0.88) 100%)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        color: '#E2E8F0',
        border: '1px solid rgba(255, 255, 255, 0.24)',
        boxShadow:
          '0 6px 18px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.32), inset 0 -3px 8px rgba(0, 0, 0, 0.45)',
      };
    case 'cyber_prism':
      return {
        background:
          'linear-gradient(135deg, rgba(56, 189, 248, 0.34) 0%, rgba(168, 85, 247, 0.32) 52%, rgba(236, 72, 153, 0.3) 100%)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.42)',
        boxShadow:
          '0 6px 20px rgba(168, 85, 247, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.65), inset 0 -3px 8px rgba(88, 28, 135, 0.28)',
      };
    case 'emerald_aero':
      return {
        background:
          'linear-gradient(145deg, rgba(16, 185, 129, 0.34) 0%, rgba(6, 182, 212, 0.22) 100%)',
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
        color: '#ECFDF5',
        border: '1px solid rgba(167, 243, 208, 0.48)',
        boxShadow:
          '0 6px 18px rgba(16, 185, 129, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.6), inset 0 -3px 8px rgba(6, 78, 59, 0.28)',
      };
    case 'crimson_pulse':
      return {
        background:
          'linear-gradient(145deg, rgba(244, 63, 94, 0.38) 0%, rgba(159, 18, 57, 0.28) 100%)',
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
        color: '#FFF1F2',
        border: '1px solid rgba(253, 164, 175, 0.48)',
        boxShadow:
          '0 6px 18px rgba(244, 63, 94, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.58), inset 0 -3px 8px rgba(136, 19, 55, 0.32)',
      };
    case 'arctic_pearl':
      return {
        background:
          'linear-gradient(145deg, rgba(147, 197, 253, 0.36) 0%, rgba(59, 130, 246, 0.22) 100%)',
        backdropFilter: 'blur(14px) saturate(165%)',
        WebkitBackdropFilter: 'blur(14px) saturate(165%)',
        color: '#F0F9FF',
        border: '1px solid rgba(191, 219, 254, 0.55)',
        boxShadow:
          '0 6px 18px rgba(59, 130, 246, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.7), inset 0 -3px 8px rgba(30, 58, 138, 0.25)',
      };
    case 'liquid_glass':
    default:
      return {
        background:
          'linear-gradient(145deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.08) 100%)',
        backdropFilter: 'blur(16px) saturate(170%)',
        WebkitBackdropFilter: 'blur(16px) saturate(170%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.48)',
        boxShadow:
          '0 6px 20px rgba(0, 0, 0, 0.38), inset 0 1.5px 1px rgba(255, 255, 255, 0.75), inset 0 -3px 8px rgba(15, 23, 42, 0.22)',
      };
  }
}

interface MiniStyledDieProps {
  value: number;
  skin?: DiceSkin;
  size?: 'xs' | 'sm' | 'md' | number;
  className?: string;
}

export const MiniStyledDie: React.FC<MiniStyledDieProps> = ({
  value,
  skin = 'classic',
  size = 'sm',
  className = '',
}) => {
  const clamped = Math.min(6, Math.max(1, Math.round(value) || 1));
  const pips = PIP_POSITIONS[clamped] || [4];

  const pxSize =
    typeof size === 'number'
      ? size
      : size === 'xs'
      ? 16
      : size === 'sm'
      ? 20
      : 26;
  const pipPx = Math.max(2.3, Number((pxSize * 0.165).toFixed(2)));
  const padPx = Math.max(1.8, Number((pxSize * 0.13).toFixed(2)));
  const radiusPx = Math.max(3, Number((pxSize * 0.22).toFixed(1)));

  return (
    <span
      style={{
        ...getDiceSkinSurfaceStyle(skin),
        width: `${pxSize}px`,
        height: `${pxSize}px`,
        padding: `${padPx}px`,
        borderRadius: `${radiusPx}px`,
      }}
      className={`inline-grid grid-cols-3 grid-rows-3 gap-[0.5px] shrink-0 align-middle select-none ${className}`}
      aria-label={`Кубик ${clamped}`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span key={idx} className="flex items-center justify-center">
          {pips.includes(idx) && (
            <span
              style={{
                width: `${pipPx}px`,
                height: `${pipPx}px`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
              className="rounded-full bg-current"
            />
          )}
        </span>
      ))}
    </span>
  );
};

export const DiceSkinPairPreview: React.FC<{
  skin: DiceSkin;
  size?: 'xs' | 'sm' | 'md' | number;
  className?: string;
}> = ({ skin, size = 'sm', className = '' }) => (
  <span className={`inline-flex items-center shrink-0 ${className}`}>
    <MiniStyledDie value={5} skin={skin} size={size} className="-rotate-6" />
    <MiniStyledDie value={6} skin={skin} size={size} className="rotate-6 -ml-1" />
  </span>
);

export const InlineSpeedDieChip: React.FC<{ face: SpeedDieFace }> = ({ face }) => (
  <span className="inline-flex items-center justify-center px-1.5 h-[16px] rounded-[4px] bg-gradient-to-br from-fuchsia-600 to-indigo-700 border border-fuchsia-300/80 text-white font-mono-num font-extrabold text-[9.5px] leading-none align-middle shadow-xs mx-0.5">
    {face === 'BUS' ? (
      <>
        <AppleEmoji emoji="🚐" className="mr-0.5" />
        БУС
      </>
    ) : face === 'M1' ? (
      <>
        <AppleEmoji emoji="😈" className="mr-0.5" />
        ХАОС
      </>
    ) : (
      `⚡${face}`
    )}
  </span>
);
