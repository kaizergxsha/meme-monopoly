import React, { useEffect, useRef, useState } from 'react';
import { getCellGridPosition } from '../../shared/boardData.ts';
import { PlayerState } from '../../shared/types.ts';

interface BoardTokensLayerProps {
  players: PlayerState[];
  currentPlayerId?: string;
  isPlaying: boolean;
}

const TOTAL_UNITS = 12.3; // 1.65 + 9 * 1.0 + 1.65

function trackCenterPct(track1Based: number): number {
  if (track1Based === 1) return (0.825 / TOTAL_UNITS) * 100;
  if (track1Based === 11) return (11.475 / TOTAL_UNITS) * 100;
  return ((1.65 + (track1Based - 2) + 0.5) / TOTAL_UNITS) * 100;
}

function getTokenBoardCoords(
  cellId: number,
  inJail: boolean,
  slotIdx: number,
  slotTotal: number
): { x: number; y: number } {
  // Клетка 10 (Тюрьма / Экскурсия): диагональное разделение как в Monopoly One
  if (cellId === 10) {
    const base = inJail
      ? { x: 90.3, y: 9.7 } // Нижний-левый треугольник с наручниками («На бутылке»)
      : { x: 96.1, y: 3.9 }; // Верхний-правый треугольник с пончиком («Экскурсия»)
    if (slotTotal <= 1) return base;
    const angle = (slotIdx / slotTotal) * Math.PI * 2;
    return {
      x: base.x + Math.cos(angle) * 1.45,
      y: base.y + Math.sin(angle) * 1.45,
    };
  }

  const pos = getCellGridPosition(cellId);
  const cx = trackCenterPct(pos.col);
  const cy = trackCenterPct(pos.row);

  if (slotTotal <= 1) return { x: cx, y: cy };

  // Разносим несколько фишек на одной клетке так, чтобы каждую было чётко видно
  const offsets: Array<[number, number]> =
    pos.side === 'top' || pos.side === 'bottom'
      ? [
          [-1.1, -1.6],
          [1.1, 1.6],
          [-1.1, 1.6],
          [1.1, -1.6],
          [0, 0],
        ]
      : pos.side === 'left' || pos.side === 'right'
      ? [
          [-1.6, -1.1],
          [1.6, 1.1],
          [-1.6, 1.1],
          [1.6, -1.1],
          [0, 0],
        ]
      : [
          [-2.0, -2.0],
          [2.0, 2.0],
          [-2.0, 2.0],
          [2.0, -2.0],
          [0, 0],
        ];

  const [dx, dy] = offsets[slotIdx % offsets.length];
  return { x: cx + dx, y: cy + dy };
}

interface LandingEffect {
  id: string;
  playerId: string;
  cellId: number;
  inJail: boolean;
  color: string;
}

interface StepTrailItem {
  id: string;
  cellId: number;
  inJail: boolean;
  color: string;
}

export const BoardTokensLayer: React.FC<BoardTokensLayerProps> = ({
  players,
  currentPlayerId,
  isPlaying,
}) => {
  const [visualPos, setVisualPos] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of players) init[p.id] = p.position;
    return init;
  });
  const [stepTick, setStepTick] = useState<Record<string, number>>({});
  const [movingMode, setMovingMode] = useState<Record<string, 'STEP' | 'WARP' | null>>({});
  const [landings, setLandings] = useState<LandingEffect[]>([]);
  const [stepTrails, setStepTrails] = useState<StepTrailItem[]>([]);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const auxTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const targetRef = useRef<Record<string, number>>({});
  const prevInJailRef = useRef<Record<string, boolean>>(
    Object.fromEntries(players.map((p) => [p.id, p.inJail]))
  );
  const playersRef = useRef<PlayerState[]>(players);
  playersRef.current = players;
  const visualRef = useRef<Record<string, number>>(visualPos);
  visualRef.current = visualPos;

  const playersMoveKey = players
    .map((p) => `${p.id}:${p.position}:${p.inJail ? 1 : 0}:${p.isBankrupt ? 1 : 0}`)
    .join('|');

  useEffect(() => {
    const stepTimers = timersRef.current;
    const auxTimers = auxTimersRef.current;
    return () => {
      Object.values(stepTimers).forEach(clearTimeout);
      auxTimers.forEach(clearTimeout);
      auxTimers.clear();
    };
  }, []);

  useEffect(() => {
    const curPlayers = playersRef.current;
    const aliveIds = new Set(curPlayers.map((p) => p.id));
    // Инициализируем новых игроков сразу на их стартовых клетках
    setVisualPos((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of curPlayers) {
        if (next[p.id] === undefined) {
          next[p.id] = p.position;
          targetRef.current[p.id] = p.position;
          prevInJailRef.current[p.id] = p.inJail;
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        if (!aliveIds.has(k)) {
          delete next[k];
          delete targetRef.current[k];
          delete prevInJailRef.current[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    for (const p of curPlayers) {
      if (p.isBankrupt) {
        if (timersRef.current[p.id]) {
          clearTimeout(timersRef.current[p.id]);
          delete timersRef.current[p.id];
          setMovingMode((m) => (m[p.id] ? { ...m, [p.id]: null } : m));
        }
        continue;
      }

      const curVis = visualRef.current[p.id] ?? p.position;
      const prevScheduledTarget = targetRef.current[p.id];
      const prevJail = prevInJailRef.current[p.id] ?? p.inJail;
      const jailChangedOnCell10 = p.position === 10 && prevJail !== p.inJail;
      prevInJailRef.current[p.id] = p.inJail;

      if (curVis === p.position && !jailChangedOnCell10 && !timersRef.current[p.id]) {
        targetRef.current[p.id] = p.position;
        continue;
      }
      if (prevScheduledTarget === p.position && !jailChangedOnCell10 && timersRef.current[p.id]) {
        continue;
      }

      if (timersRef.current[p.id]) {
        clearTimeout(timersRef.current[p.id]);
        delete timersRef.current[p.id];
      }
      targetRef.current[p.id] = p.position;

      const cwDist = (p.position - curVis + 40) % 40;
      const isDirectWarp =
        (p.position === 10 && p.inJail && curVis !== 10) || cwDist > 16 || cwDist === 0;

      if (isDirectWarp) {
        setMovingMode((m) => ({ ...m, [p.id]: 'WARP' }));
        setVisualPos((v) => ({ ...v, [p.id]: p.position }));
        timersRef.current[p.id] = setTimeout(() => {
          delete timersRef.current[p.id];
          setMovingMode((m) => ({ ...m, [p.id]: null }));
          const lid = `${p.id}_${Date.now()}`;
          setLandings((ls) => [
            ...ls.slice(-4),
            { id: lid, playerId: p.id, cellId: p.position, inJail: p.inJail, color: p.color },
          ]);
          const rmLand = setTimeout(() => {
            auxTimersRef.current.delete(rmLand);
            setLandings((ls) => ls.filter((x) => x.id !== lid));
          }, 700);
          auxTimersRef.current.add(rmLand);
        }, 380);
      } else {
        // Плавное пошаговое движение по клеткам периметра (125 мс на клетку)
        setMovingMode((m) => ({ ...m, [p.id]: 'STEP' }));
        const advanceOne = (fromCell: number) => {
          const nextCell = (fromCell + 1) % 40;
          setVisualPos((v) => ({ ...v, [p.id]: nextCell }));
          setStepTick((st) => ({ ...st, [p.id]: (st[p.id] ?? 0) + 1 }));

          const tid = `${p.id}_${nextCell}_${Date.now()}_${Math.random()}`;
          setStepTrails((tr) => [
            ...tr.slice(-10),
            { id: tid, cellId: fromCell, inJail: false, color: p.color },
          ]);
          const rmTrail = setTimeout(() => {
            auxTimersRef.current.delete(rmTrail);
            setStepTrails((tr) => tr.filter((x) => x.id !== tid));
          }, 420);
          auxTimersRef.current.add(rmTrail);

          if (nextCell === targetRef.current[p.id]) {
            timersRef.current[p.id] = setTimeout(() => {
              delete timersRef.current[p.id];
              setMovingMode((m) => ({ ...m, [p.id]: null }));
              const latestP = playersRef.current.find((x) => x.id === p.id) ?? p;
              const lid = `${p.id}_${Date.now()}`;
              setLandings((ls) => [
                ...ls.slice(-4),
                {
                  id: lid,
                  playerId: p.id,
                  cellId: nextCell,
                  inJail: latestP.inJail,
                  color: latestP.color,
                },
              ]);
              const rmLand = setTimeout(() => {
                auxTimersRef.current.delete(rmLand);
                setLandings((ls) => ls.filter((x) => x.id !== lid));
              }, 700);
              auxTimersRef.current.add(rmLand);
            }, 100);
          } else {
            timersRef.current[p.id] = setTimeout(() => advanceOne(nextCell), 85);
          }
        };
        // Небольшая задержка перед стартом шагов, чтобы игрок увидел бросок кубиков
        timersRef.current[p.id] = setTimeout(() => advanceOne(curVis), 80);
      }
    }
  }, [playersMoveKey]);

  const alivePlayers = players.filter((p) => !p.isBankrupt);

  // Группируем по текущей визуальной клетке (+ статус тюрьмы на 10-й клетке)
  const cellGroups = new Map<string, PlayerState[]>();
  for (const p of alivePlayers) {
    const vp = visualPos[p.id] ?? p.position;
    const key = vp === 10 ? `10_${p.inJail ? 'jail' : 'visit'}` : String(vp);
    const arr = cellGroups.get(key) || [];
    arr.push(p);
    cellGroups.set(key, arr);
  }

  return (
    <div
      id="board-tokens-layer"
      className="pointer-events-none absolute inset-0 z-30 overflow-visible"
    >
      {/* Светящийся след от шагов фишки по доске */}
      {stepTrails.map((t) => {
        const coords = getTokenBoardCoords(t.cellId, t.inJail, 0, 1);
        return (
          <div
            key={t.id}
            style={{
              left: `${coords.x}%`,
              top: `${coords.y}%`,
              backgroundColor: `${t.color}66`,
              boxShadow: `0 0 12px ${t.color}aa`,
            }}
            className="absolute w-5 h-5 rounded-full animate-token-trail pointer-events-none"
          />
        );
      })}

      {/* Волны приземления фишки на целевую клетку */}
      {landings.map((l) => {
        const coords = getTokenBoardCoords(l.cellId, l.inJail, 0, 1);
        return (
          <div
            key={l.id}
            style={{
              left: `${coords.x}%`,
              top: `${coords.y}%`,
              borderColor: l.color,
              boxShadow: `0 0 18px ${l.color}`,
            }}
            className="absolute w-10 h-10 rounded-full border-[3px] animate-token-land pointer-events-none"
          />
        );
      })}

      {/* Сами фишки игроков */}
      {alivePlayers.map((p) => {
        const vp = visualPos[p.id] ?? p.position;
        const groupKey = vp === 10 ? `10_${p.inJail ? 'jail' : 'visit'}` : String(vp);
        const sameCell = cellGroups.get(groupKey) || [p];
        const slotIdx = Math.max(0, sameCell.findIndex((x) => x.id === p.id));
        const coords = getTokenBoardCoords(vp, p.inJail && vp === 10, slotIdx, sameCell.length);

        const isActive = isPlaying && p.id === currentPlayerId;
        const mode = movingMode[p.id];
        const tick = stepTick[p.id] ?? 0;

        return (
          <div
            key={p.id}
            data-player-token={p.id}
            style={{
              left: `${coords.x}%`,
              top: `${coords.y}%`,
              transition:
                mode === 'WARP'
                  ? 'left 380ms cubic-bezier(0.22, 1, 0.36, 1), top 380ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'left 125ms cubic-bezier(0.22, 1, 0.36, 1), top 125ms cubic-bezier(0.22, 1, 0.36, 1)',
              zIndex: mode ? 45 : isActive ? 38 : 32 + slotIdx,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            {/* Пульсирующий ореол активного хода */}
            {isActive && (
              <span
                style={{
                  backgroundColor: `${p.color}55`,
                  border: `2px solid ${p.color}`,
                }}
                className="absolute -inset-1.5 rounded-full animate-token-halo pointer-events-none"
              />
            )}

            {/* Диск-фишка в стиле Monopoly One: сочный цвет, контрастный обод, глянцевое ядро и аватар */}
            <div
              key={mode === 'STEP' ? `hop_${tick}` : 'idle'}
              style={{
                backgroundColor: p.color,
                outline: '2.5px solid #09090b',
                boxShadow: isActive
                  ? `0 6px 18px rgba(0,0,0,0.85), 0 0 18px ${p.color}, inset 0 2px 3px rgba(255,255,255,0.6)`
                  : '0 6px 14px rgba(0,0,0,0.82), inset 0 2px 3px rgba(255,255,255,0.45)',
              }}
              className={`relative w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] md:w-[31px] md:h-[31px] rounded-full border-2 sm:border-[2.5px] border-white flex items-center justify-center select-none ${
                mode === 'STEP' ? 'animate-token-hop' : ''
              }`}
            >
              {/* Внутреннее контрастное кольцо M1 */}
              <span className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px] md:w-[21px] md:h-[21px] rounded-full bg-black/25 border border-black/30 flex items-center justify-center text-[9px] sm:text-[11px] md:text-[13px] leading-none shadow-inner">
                {p.avatar}
              </span>
            </div>

            {/* Плашка имени во время шагания фишки */}
            {mode && (
              <span
                style={{ backgroundColor: p.color }}
                className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white whitespace-nowrap shadow-md border border-white/60"
              >
                {p.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
