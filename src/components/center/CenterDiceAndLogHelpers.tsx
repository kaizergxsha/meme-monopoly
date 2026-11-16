import React, { useEffect, useState } from 'react';
import { BOARD_CELLS, INDUSTRIES } from '../../../shared/boardData.ts';
import { txt } from '../../../shared/rules.ts';
import { DiceSkin, PlayerState, SpeedDieFace } from '../../../shared/types.ts';
import { AppleEmoji, renderAppleEmojis } from '../AppleEmoji.tsx';
import { CellArtwork } from '../CellArtwork.tsx';
import { InlineSpeedDieChip, MiniStyledDie } from '../DiceSkinPreview.tsx';

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function formatClock(startedAt: number | null, nowMs: number): string {
  if (!startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const DiceDualIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 sm:w-5 sm:h-5' }) => (
  <svg viewBox="0 0 28 24" fill="none" className={`shrink-0 ${className}`} aria-hidden="true">
    <rect
      x="1.5"
      y="3.5"
      width="13"
      height="13"
      rx="3.2"
      transform="rotate(-8 1.5 3.5)"
      fill="rgba(255,255,255,0.96)"
      stroke="#064E3B"
      strokeWidth="1.2"
    />
    <circle cx="5.6" cy="7.2" r="1.2" fill="#065F46" />
    <circle cx="10.4" cy="11.2" r="1.2" fill="#065F46" />
    <rect
      x="12.5"
      y="6.5"
      width="13.5"
      height="13.5"
      rx="3.4"
      transform="rotate(7 12.5 6.5)"
      fill="#FFFFFF"
      stroke="#064E3B"
      strokeWidth="1.2"
    />
    <circle cx="16.4" cy="10.6" r="1.2" fill="#047857" />
    <circle cx="19.0" cy="13.6" r="1.25" fill="#10B981" />
    <circle cx="21.6" cy="16.6" r="1.2" fill="#047857" />
  </svg>
);

function parseAndRenderDiceBracket(
  rawToken: string,
  skin: DiceSkin,
  key: string
): React.ReactNode | null {
  const bracketMatch = rawToken.match(/\[([^\]]+)\]/);
  if (!bracketMatch) return null;
  const inside = bracketMatch[1].trim();
  const m = inside.match(/^([1-6])\s*[+:]\s*([1-6])(.*)$/);
  if (!m) return null;
  const d1 = Number(m[1]);
  const d2 = Number(m[2]);
  const rest = m[3].trim();

  let speedFace: SpeedDieFace | null = null;
  let totalVal: string | null = null;

  const eqMatch = rest.match(/=\s*(\d+)/);
  if (eqMatch) totalVal = eqMatch[1];

  if (/АВТОБУС/i.test(rest)) {
    speedFace = 'BUS';
  } else if (/ПОДЛЯНКА|ХАОС|М1|M1/i.test(rest)) {
    speedFace = 'M1';
  } else {
    const spNum = rest.match(/(?:⚡|:\s*)([1-3])/);
    if (spNum) speedFace = Number(spNum[1]) as 1 | 2 | 3;
  }

  const leadingPrefix = rawToken.slice(0, bracketMatch.index ?? 0).replace(/🎲/g, '').trim();

  return (
    <span
      key={key}
      className="inline-flex items-center gap-1 px-1.5 py-[2px] mx-0.5 rounded-lg bg-[#0B0E16]/95 border border-white/14 align-middle shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      {leadingPrefix ? (
        <span className="inline-flex items-center mr-0.5">
          {renderAppleEmojis(leadingPrefix, `${key}_pre`)}
        </span>
      ) : null}
      <MiniStyledDie value={d1} skin={skin} size={18} />
      <MiniStyledDie value={d2} skin={skin} size={18} />
      {speedFace !== null && <InlineSpeedDieChip face={speedFace} />}
      {totalVal !== null && (
        <span className="font-mono-num font-extrabold text-[10.5px] sm:text-[11.5px] text-[#F3D082] pl-0.5">
          = {totalVal}
        </span>
      )}
    </span>
  );
}

export const TradePropertyIconTile: React.FC<{
  cellId: number;
  censored: boolean;
  fallbackHex?: string;
  onRemove?: () => void;
}> = ({ cellId, censored, fallbackHex = '#E5B869', onRemove }) => {
  const cDef = BOARD_CELLS[cellId];
  const grp = cDef.groupId ? INDUSTRIES[cDef.groupId] : null;
  const accent = grp?.accentHex || fallbackHex;
  const label = txt(cDef.name, cDef.cleanName, censored);

  const inner = (
    <>
      <div
        style={{
          backgroundColor: accent,
          boxShadow: `0 1px 6px ${accent}88`,
        }}
        className="w-full h-[4px] shrink-0"
      />
      <div className="w-11 h-10 sm:w-12 sm:h-11 p-1 flex items-center justify-center bg-[#0B0E16] relative">
        <CellArtwork cellId={cellId} side="corner" censored={censored} className="w-full h-full" />
        {onRemove && (
          <span className="opacity-0 group-hover/tile:opacity-100 transition-opacity absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#F43F5E] text-white text-[8px] font-black flex items-center justify-center shadow">
            ✕
          </span>
        )}
      </div>
      {cDef.price ? (
        <div className="w-full bg-[#07090E] border-t border-white/[0.07] py-[1px] text-center font-mono-num font-extrabold text-[8.5px] text-[#F3D082] leading-tight">
          ${cDef.price}
        </div>
      ) : null}
    </>
  );

  if (onRemove) {
    return (
      <button
        type="button"
        onClick={onRemove}
        title={`${label}${cDef.price ? ` ($${cDef.price})` : ''} — нажмите, чтобы убрать`}
        style={{ borderColor: `${accent}66` }}
        className="group/tile inline-flex flex-col items-center rounded-lg bg-[#121622] hover:bg-[#191F30] border overflow-hidden shadow-md hover:scale-105 transition cursor-pointer shrink-0"
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      title={`${label}${cDef.price ? ` ($${cDef.price})` : ''}`}
      style={{ borderColor: `${accent}66` }}
      className="inline-flex flex-col items-center rounded-lg bg-[#121622] border overflow-hidden shadow-md shrink-0"
    >
      {inner}
    </div>
  );
};

function renderStylizedSegment(
  segment: string,
  keyPrefix: string,
  diceSkin: DiceSkin = 'classic'
): React.ReactNode {
  if (!segment) return null;
  const tokenRegex =
    /((?:(?:🔥|🚐|😈|🚨|🪖|📋)?\s*🎲\s*)?\[[1-6]\s*[+:]\s*[1-6][^\]]*\]|КАТКА НАЧАЛАСЬ!|ДУБЛЬ!|[+-]?\$[\d\s\u00A0]+)/gi;
  const chunks = segment.split(tokenRegex);

  return chunks.map((chunk, i) => {
    if (!chunk) return null;
    if (chunk.includes('[')) {
      const diceNode = parseAndRenderDiceBracket(chunk, diceSkin, `${keyPrefix}_dice_${i}`);
      if (diceNode) return diceNode;
    }
    if (/^(КАТКА НАЧАЛАСЬ!|ДУБЛЬ!)$/i.test(chunk)) {
      return (
        <span
          key={`${keyPrefix}_kw_${i}`}
          className="inline-flex items-center px-1.5 py-[1px] mx-0.5 rounded bg-[#E5B869]/18 border border-[#E5B869]/45 text-[#F3D082] font-display font-extrabold text-[9.5px] sm:text-[10.5px] tracking-wide shadow-[0_0_10px_rgba(229,184,105,0.2)]"
        >
          {chunk}
        </span>
      );
    }
    if (/^[+-]?\$[\d\s\u00A0]+$/.test(chunk)) {
      const trimmed = chunk.trim();
      const trailingSpace = chunk.endsWith(' ') ? ' ' : '';
      const isNeg = trimmed.startsWith('-');
      const isPos = trimmed.startsWith('+');
      const pillTone = isNeg
        ? 'bg-[#F43F5E]/16 border-[#F43F5E]/38 text-[#FDA4AF]'
        : isPos
        ? 'bg-[#10B981]/16 border-[#10B981]/38 text-[#6EE7B7]'
        : 'bg-white/[0.07] border-white/15 text-[#F8FAFC]';
      return (
        <React.Fragment key={`${keyPrefix}_m_${i}`}>
          <span
            className={`inline-flex items-center px-1.5 py-[0.5px] rounded border font-mono-num font-bold text-[10px] sm:text-[11.5px] leading-tight ${pillTone}`}
          >
            {trimmed}
          </span>
          {trailingSpace}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={`${keyPrefix}_t_${i}`}>
        {renderAppleEmojis(chunk, `${keyPrefix}_em_${i}`)}
      </React.Fragment>
    );
  });
}

export function renderColoredLogText(
  text: string,
  players: PlayerState[],
  diceSkin: DiceSkin = 'classic'
): React.ReactNode {
  const validPlayers = players
    .filter((p) => p.name && p.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  if (validPlayers.length === 0) return renderStylizedSegment(text, 'raw', diceSkin);

  const escaped = validPlayers.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const byName = new Map(validPlayers.map((p) => [p.name, p]));
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    const matched = byName.get(part);
    if (matched) {
      return (
        <span key={idx} style={{ color: matched.color }} className="font-extrabold">
          {part}
        </span>
      );
    }
    return (
      <React.Fragment key={idx}>
        {renderStylizedSegment(part, `seg_${idx}`, diceSkin)}
      </React.Fragment>
    );
  });
}

export const M1DieBox: React.FC<{ value: number; skin: DiceSkin; animKey: number }> = ({
  value,
  skin,
  animKey,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isTumbling, setIsTumbling] = useState(false);

  useEffect(() => {
    setIsTumbling(true);
    let ticks = 0;
    const iv = setInterval(() => {
      ticks += 1;
      setDisplayValue(((value + ticks * 2 + Math.floor(Math.random() * 5)) % 6) + 1);
      if (ticks >= 5) {
        clearInterval(iv);
        setDisplayValue(value);
        setIsTumbling(false);
      }
    }, 58);
    return () => clearInterval(iv);
  }, [animKey, value]);

  const pips = PIP_POSITIONS[displayValue] || [4];

  // Фирменные скины кубиков (включая геометрический неоново-фиолетовый скин из видео!)
  const skinStyle: React.CSSProperties =
    skin === 'neon'
      ? {
          background:
            'conic-gradient(from 90deg at 50% 50%, #7c3aed 0deg 90deg, #f43f8a 90deg 180deg, #7c3aed 180deg 270deg, #2dd4bf 270deg 360deg)',
          color: '#ffffff',
          boxShadow: '0 14px 32px rgba(124,58,237,0.45)',
        }
      : skin === 'gold'
      ? {
          background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)',
          color: '#171717',
          boxShadow: '0 14px 32px rgba(245,158,11,0.4)',
        }
      : skin === 'gopnik'
      ? {
          background: '#18181b',
          color: '#facc15',
          border: '2px solid #52525b',
          boxShadow: '0 14px 32px rgba(0,0,0,0.65)',
        }
      : skin === 'comic'
      ? {
          background: '#f43f5e',
          color: '#fef08a',
          border: '2.5px solid #171717',
          boxShadow: '5px 5px 0px #171717',
        }
      : {
          background: '#ffffff',
          color: '#171717',
          boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
        };

  return (
    <div
      key={animKey}
      style={skinStyle}
      className={`w-[44px] h-[44px] sm:w-[64px] sm:h-[64px] md:w-[74px] md:h-[74px] rounded-[8px] sm:rounded-[10px] p-1.5 sm:p-2.5 grid grid-cols-3 grid-rows-3 gap-0.5 sm:gap-1 ${
        isTumbling ? 'animate-dice-tumble' : 'animate-dice-roll'
      }`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-center">
          {pips.includes(idx) && (
            <span className="w-2 h-2 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full bg-current shadow-xs" />
          )}
        </div>
      ))}
    </div>
  );
};

export const SpeedDieBox: React.FC<{ face: SpeedDieFace; animKey: number }> = ({ face, animKey }) => (
  <div
    key={`sp_${animKey}_${String(face)}`}
    className="w-[44px] h-[44px] sm:w-[64px] sm:h-[64px] md:w-[74px] md:h-[74px] rounded-[8px] sm:rounded-[10px] bg-gradient-to-br from-fuchsia-600 to-indigo-700 border-2 border-fuchsia-300 text-white font-black flex flex-col items-center justify-center shadow-[0_14px_32px_rgba(217,70,239,0.5)] animate-dice-roll"
  >
    {face === 'BUS' ? (
      <>
        <span className="text-base sm:text-xl leading-none">
          <AppleEmoji emoji="🚐" />
        </span>
        <span className="text-[8px] sm:text-[10px] mt-0.5">БУС</span>
      </>
    ) : face === 'M1' ? (
      <>
        <span className="text-base sm:text-xl leading-none">
          <AppleEmoji emoji="😈" />
        </span>
        <span className="text-[7.5px] sm:text-[9.5px] mt-0.5">ХАОС</span>
      </>
    ) : (
      <>
        <span className="text-lg sm:text-2xl leading-none">+{face}</span>
        <span className="text-[8px] sm:text-[9px] uppercase opacity-80">Speed</span>
      </>
    )}
  </div>
);

