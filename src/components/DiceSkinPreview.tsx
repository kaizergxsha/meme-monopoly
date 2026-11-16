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

export function getDiceSkinSurfaceStyle(skin: DiceSkin): React.CSSProperties {
  if (skin === 'neon') {
    return {
      background:
        'conic-gradient(from 90deg at 50% 50%, #7c3aed 0deg 90deg, #f43f8a 90deg 180deg, #7c3aed 180deg 270deg, #2dd4bf 270deg 360deg)',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.35)',
      boxShadow: '0 2px 8px rgba(124,58,237,0.5)',
    };
  }
  if (skin === 'gold') {
    return {
      background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)',
      color: '#171717',
      border: '1px solid rgba(254,240,138,0.8)',
      boxShadow: '0 2px 8px rgba(245,158,11,0.45)',
    };
  }
  if (skin === 'gopnik') {
    return {
      background: '#141418',
      color: '#facc15',
      border: '1.5px solid #52525b',
      boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
    };
  }
  if (skin === 'comic') {
    return {
      background: '#f43f5e',
      color: '#fef08a',
      border: '1.5px solid #09090b',
      boxShadow: '2px 2px 0px #09090b',
    };
  }
  return {
    background: '#ffffff',
    color: '#171717',
    border: '1px solid rgba(0,0,0,0.2)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
  };
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
              style={{ width: `${pipPx}px`, height: `${pipPx}px` }}
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
