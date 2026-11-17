import React, { useEffect, useRef, useState } from 'react';
import { getCellGridPosition } from '../../shared/boardData.ts';
import { DiceRollResult, PlayerState, PoliceArrestEvent } from '../../shared/types.ts';
import { AppleEmoji } from './AppleEmoji.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface BoardTokensLayerProps {
  players: PlayerState[];
  currentPlayerId?: string;
  isPlaying: boolean;
  lastDice?: DiceRollResult | null;
  lastPoliceArrest?: PoliceArrestEvent | null;
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
      ? { x: 90.0, y: 10.0 } // Нижний-левый треугольник с наручниками («На бутылке»)
      : { x: 96.2, y: 3.8 }; // Верхний-правый треугольник с пончиком («Экскурсия»)
    if (slotTotal <= 1) return base;
    const angle = (slotIdx / slotTotal) * Math.PI * 2 - Math.PI / 4;
    return {
      x: base.x + Math.cos(angle) * 1.85,
      y: base.y + Math.sin(angle) * 1.85,
    };
  }

  const pos = getCellGridPosition(cellId);
  const cx = trackCenterPct(pos.col);
  const cy = trackCenterPct(pos.row);

  if (slotTotal <= 1) {
    // На боковых клетках слегка смещаем одиночную фишку к внутреннему краю (к центру поля),
    // чтобы крупная иллюстрация карточки оставалась отлично видна даже под фишкой
    if (pos.side === 'top') return { x: cx, y: cy + 1.65 };
    if (pos.side === 'bottom') return { x: cx, y: cy - 1.65 };
    if (pos.side === 'left') return { x: cx + 1.65, y: cy };
    if (pos.side === 'right') return { x: cx - 1.65, y: cy };
    return { x: cx, y: cy };
  }

  // Разносим несколько фишек по всей площади клетки без наложения друг на друга (особенно на телефонах)
  const offsets: Array<[number, number]> =
    pos.side === 'top' || pos.side === 'bottom'
      ? slotTotal === 2
        ? [
            [-1.4, -2.9],
            [1.4, 2.9],
          ]
        : [
            [-1.65, -3.3],
            [1.65, -3.3],
            [-1.65, 3.3],
            [1.65, 3.3],
            [0, 0],
          ]
      : pos.side === 'left' || pos.side === 'right'
      ? slotTotal === 2
        ? [
            [-2.9, -1.4],
            [2.9, 1.4],
          ]
        : [
            [-3.3, -1.65],
            [3.3, -1.65],
            [-3.3, 1.65],
            [3.3, 1.65],
            [0, 0],
          ]
      : slotTotal === 2
      ? [
          [-2.8, -2.4],
          [2.8, 2.4],
        ]
      : [
          [-3.2, -3.2],
          [3.2, -3.2],
          [-3.2, 3.2],
          [3.2, 3.2],
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

interface FlightArcState {
  id: string;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  x: number;
  y: number;
  lift: number;
  progress: number;
  color: string;
  isArrest: boolean;
  fading?: boolean;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeFlightControlPoint(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { cx: number; cy: number } {
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  // Тянем дугу к центру поля (50, 50) + добавляем перпендикулярный изгиб для диагональных полётов
  const pullX = (50 - midX) * 0.48;
  const pullY = (50 - midY) * 0.48;
  const perpScale = Math.min(22, Math.max(10, dist * 0.24));
  const nx = -dy / dist;
  const ny = dx / dist;
  const pullLen = Math.hypot(pullX, pullY);
  if (pullLen < 6) {
    return {
      cx: Math.min(90, Math.max(10, midX + nx * perpScale)),
      cy: Math.min(90, Math.max(10, midY + ny * perpScale)),
    };
  }
  return {
    cx: Math.min(90, Math.max(10, midX + pullX + nx * (perpScale * 0.35))),
    cy: Math.min(90, Math.max(10, midY + pullY + ny * (perpScale * 0.35))),
  };
}

type TokenMoveMode = 'STEP' | 'WARP' | 'ARREST_CUFF' | 'ARREST_HAUL' | null;

export const BoardTokensLayer: React.FC<BoardTokensLayerProps> = ({
  players,
  currentPlayerId,
  isPlaying,
  lastDice,
  lastPoliceArrest,
}) => {
  const [visualPos, setVisualPos] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of players) init[p.id] = p.position;
    return init;
  });
  const [stepTick, setStepTick] = useState<Record<string, number>>({});
  const [movingMode, setMovingMode] = useState<Record<string, TokenMoveMode>>({});
  const [landings, setLandings] = useState<LandingEffect[]>([]);
  const [stepTrails, setStepTrails] = useState<StepTrailItem[]>([]);
  const [activeFlights, setActiveFlights] = useState<Record<string, FlightArcState>>({});
  const [fadingArcs, setFadingArcs] = useState<FlightArcState[]>([]);
  const [jailSlam, setJailSlam] = useState<{ id: string; playerName: string } | null>(null);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rafIdsRef = useRef<Record<string, number>>({});
  const auxTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const targetRef = useRef<Record<string, number>>({});
  const handledArrestIdRef = useRef<string | null>(lastPoliceArrest?.id ?? null);
  const lastDiceRef = useRef<DiceRollResult | null | undefined>(lastDice);
  lastDiceRef.current = lastDice;
  const lastArrestRef = useRef<PoliceArrestEvent | null | undefined>(lastPoliceArrest);
  lastArrestRef.current = lastPoliceArrest;
  const prevInJailRef = useRef<Record<string, boolean>>(
    Object.fromEntries(players.map((p) => [p.id, p.inJail]))
  );
  const playersRef = useRef<PlayerState[]>(players);
  playersRef.current = players;
  const visualRef = useRef<Record<string, number>>(visualPos);
  visualRef.current = visualPos;

  const playersMoveKey = `${players
    .map((p) => `${p.id}:${p.position}:${p.inJail ? 1 : 0}:${p.isBankrupt ? 1 : 0}`)
    .join('|')}|${lastPoliceArrest?.id ?? ''}`;

  useEffect(() => {
    const stepTimers = timersRef.current;
    const rafIds = rafIdsRef.current;
    const auxTimers = auxTimersRef.current;
    return () => {
      Object.values(stepTimers).forEach(clearTimeout);
      Object.values(rafIds).forEach((id) => cancelAnimationFrame(id));
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
      if (rafIdsRef.current[p.id]) {
        cancelAnimationFrame(rafIdsRef.current[p.id]);
        delete rafIdsRef.current[p.id];
      }
      targetRef.current[p.id] = p.position;

      const cwDist = (p.position - curVis + 40) % 40;
      const ccwDist = (curVis - p.position + 40) % 40;
      const curDice = lastDiceRef.current;
      const isReverseRollForPlayer = Boolean(
        curDice &&
          curDice.rolledBy === p.id &&
          curDice.isReverse &&
          Date.now() - curDice.timestamp < 6000
      );
      const curArrest = lastArrestRef.current;
      const isFreshArrestForPlayer = Boolean(
        curArrest &&
          curArrest.playerId === p.id &&
          p.position === 10 &&
          p.inJail &&
          handledArrestIdRef.current !== curArrest.id &&
          Date.now() - curArrest.timestamp < 7000
      );

      const triggerArrivalLanding = (cellId: number, inJailFlag: boolean, colorHex: string) => {
        const lid = `${p.id}_${Date.now()}`;
        setLandings((ls) => [
          ...ls.slice(-4),
          { id: lid, playerId: p.id, cellId, inJail: inJailFlag, color: colorHex },
        ]);
        const rmLand = setTimeout(() => {
          auxTimersRef.current.delete(rmLand);
          setLandings((ls) => ls.filter((x) => x.id !== lid));
        }, 750);
        auxTimersRef.current.add(rmLand);
      };

      const launchCurvedFlight = (
        fromCellId: number,
        fromInJailFlag: boolean,
        toCellId: number,
        toInJailFlag: boolean,
        durationMs: number,
        flightColor: string,
        isArrestFlight: boolean,
        onComplete: () => void
      ) => {
        const startC = getTokenBoardCoords(fromCellId, fromInJailFlag, 0, 1);
        const endC = getTokenBoardCoords(toCellId, toInJailFlag, 0, 1);
        const { cx, cy } = computeFlightControlPoint(startC.x, startC.y, endC.x, endC.y);
        const flightId = `${p.id}_${Date.now()}_${Math.random()}`;
        const startTs = performance.now();

        // Вспышка отрыва на стартовой клетке
        triggerArrivalLanding(fromCellId, fromInJailFlag, flightColor);
        setVisualPos((v) => ({ ...v, [p.id]: toCellId }));

        const tickFlight = (nowTs: number) => {
          const rawT = Math.min(1, (nowTs - startTs) / durationMs);
          const eased = easeInOutCubic(rawT);
          const inv = 1 - eased;
          const x = inv * inv * startC.x + 2 * inv * eased * cx + eased * eased * endC.x;
          const y = inv * inv * startC.y + 2 * inv * eased * cy + eased * eased * endC.y;
          const lift = Math.sin(Math.PI * eased);

          const frameState: FlightArcState = {
            id: flightId,
            x0: startC.x,
            y0: startC.y,
            cx,
            cy,
            x1: endC.x,
            y1: endC.y,
            x,
            y,
            lift,
            progress: eased,
            color: flightColor,
            isArrest: isArrestFlight,
          };

          if (rawT < 1) {
            setActiveFlights((prev) => ({ ...prev, [p.id]: frameState }));
            rafIdsRef.current[p.id] = requestAnimationFrame(tickFlight);
          } else {
            delete rafIdsRef.current[p.id];
            setActiveFlights((prev) => {
              const next = { ...prev };
              delete next[p.id];
              return next;
            });
            setFadingArcs((prev) => [...prev.slice(-4), { ...frameState, progress: 1, fading: true }]);
            const rmArc = setTimeout(() => {
              auxTimersRef.current.delete(rmArc);
              setFadingArcs((prev) => prev.filter((a) => a.id !== flightId));
            }, 460);
            auxTimersRef.current.add(rmArc);
            onComplete();
          }
        };

        rafIdsRef.current[p.id] = requestAnimationFrame(tickFlight);
      };

      const triggerArrestHaulSequence = (cuffHoldMs: number, fromCellId: number) => {
        setMovingMode((m) => ({ ...m, [p.id]: 'ARREST_CUFF' }));
        timersRef.current[p.id] = setTimeout(() => {
          delete timersRef.current[p.id];
          setMovingMode((m) => ({ ...m, [p.id]: 'ARREST_HAUL' }));
          launchCurvedFlight(fromCellId, false, 10, true, 920, '#F43F5E', true, () => {
            setMovingMode((m) => ({ ...m, [p.id]: null }));
            triggerArrivalLanding(10, true, '#F43F5E');
            const slamId = `slam_${p.id}_${Date.now()}`;
            setJailSlam({ id: slamId, playerName: p.name });
            const rmSlam = setTimeout(() => {
              auxTimersRef.current.delete(rmSlam);
              setJailSlam((cur) => (cur?.id === slamId ? null : cur));
            }, 1500);
            auxTimersRef.current.add(rmSlam);
          });
        }, cuffHoldMs);
      };

      if (isFreshArrestForPlayer && curArrest) {
        handledArrestIdRef.current = curArrest.id;
        // Если арест произошёл из-за наступания на сектор #30 (Облава), сначала доходим до клетки 30!
        const cwTo30 = (30 - curVis + 40) % 40;
        const ccwTo30 = (curVis - 30 + 40) % 40;
        const stepTo30Delta = isReverseRollForPlayer ? -1 : 1;
        const distTo30 = isReverseRollForPlayer ? ccwTo30 : cwTo30;

        if (curArrest.reason === 'POLICE_CELL' && curVis !== 30 && distTo30 > 0 && distTo30 <= 18) {
          setMovingMode((m) => ({ ...m, [p.id]: 'STEP' }));
          const walkToPolice = (fromCell: number) => {
            const nextCell = (fromCell + stepTo30Delta + 40) % 40;
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

            if (nextCell === 30) {
              triggerArrivalLanding(30, false, '#F43F5E');
              triggerArrestHaulSequence(620, 30);
            } else {
              timersRef.current[p.id] = setTimeout(() => walkToPolice(nextCell), 95);
            }
          };
          timersRef.current[p.id] = setTimeout(() => walkToPolice(curVis), 80);
          continue;
        }

        // Для 3 дублей или Шанса: мигалки на текущей клетке игрока, затем плавный перелёт по дуге в Учебку #10
        triggerArrestHaulSequence(560, curVis);
        continue;
      }

      const useReverseStep =
        (isReverseRollForPlayer && ccwDist > 0 && ccwDist <= 18) ||
        (!isReverseRollForPlayer && cwDist > 22 && ccwDist > 0 && ccwDist <= 12 && !(p.position === 10 && p.inJail));
      const activeStepDist = useReverseStep ? ccwDist : cwDist;
      const stepDelta = useReverseStep ? -1 : 1;

      const isDirectWarp =
        (p.position === 10 && p.inJail && curVis !== 10) ||
        activeStepDist > 18 ||
        activeStepDist === 0;

      if (isDirectWarp) {
        setMovingMode((m) => ({ ...m, [p.id]: 'WARP' }));
        launchCurvedFlight(curVis, prevJail, p.position, p.inJail, 680, p.color, false, () => {
          setMovingMode((m) => ({ ...m, [p.id]: null }));
          triggerArrivalLanding(p.position, p.inJail, p.color);
        });
      } else {
        // Плавное пошаговое движение по клеткам периметра (вперёд или задом наперёд ⏪)
        setMovingMode((m) => ({ ...m, [p.id]: 'STEP' }));
        const advanceOne = (fromCell: number) => {
          const nextCell = (fromCell + stepDelta + 40) % 40;
          setVisualPos((v) => ({ ...v, [p.id]: nextCell }));
          setStepTick((st) => ({ ...st, [p.id]: (st[p.id] ?? 0) + 1 }));

          const tid = `${p.id}_${nextCell}_${Date.now()}_${Math.random()}`;
          setStepTrails((tr) => [
            ...tr.slice(-10),
            { id: tid, cellId: fromCell, inJail: false, color: useReverseStep ? '#C084FC' : p.color },
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
              triggerArrivalLanding(nextCell, latestP.inJail, latestP.color);
            }, 110);
          } else {
            timersRef.current[p.id] = setTimeout(() => advanceOne(nextCell), 95);
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
            className="absolute w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full animate-token-trail pointer-events-none"
          />
        );
      })}

      {/* Видимая светящаяся дуга-траектория полёта при телепорте / отправке в Учебку */}
      {(Object.values(activeFlights).length > 0 || fadingArcs.length > 0) && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 w-full h-full z-28 overflow-visible"
        >
          {[...fadingArcs, ...Object.values(activeFlights)].map((arc) => {
            const pathD = `M ${arc.x0} ${arc.y0} Q ${arc.cx} ${arc.cy} ${arc.x1} ${arc.y1}`;
            const dashOffset = Math.max(0, 100 - arc.progress * 100);
            return (
              <g key={arc.id} className={arc.fading ? 'animate-arc-fade' : ''}>
                {/* Мягкая направляющая траектория */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="0.65"
                  strokeDasharray="1.6 1.8"
                  strokeOpacity={arc.fading ? 0.2 : 0.35}
                />
                {/* Внешнее неоновое свечение луча */}
                <path
                  d={pathD}
                  pathLength={100}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={dashOffset}
                  strokeOpacity={0.35}
                />
                {/* Яркое ядро траектории */}
                <path
                  d={pathD}
                  pathLength={100}
                  fill="none"
                  stroke={arc.isArrest ? '#FDA4AF' : '#FFFFFF'}
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={dashOffset}
                  strokeOpacity={0.92}
                />
              </g>
            );
          })}
        </svg>
      )}

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
            className="absolute w-7 h-7 sm:w-10 sm:h-10 rounded-full border-2 sm:border-[3px] animate-token-land pointer-events-none"
          />
        );
      })}

      {/* Захлопывающиеся ворота КПП Учебки на клетке #10 после бусификации */}
      {jailSlam && (
        <div
          style={{ left: '90%', top: '10%' }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-col items-center animate-pop-in"
        >
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl border-2 border-[#F43F5E] bg-[#0B0F0C]/92 shadow-[0_0_28px_rgba(244,63,94,0.85)] overflow-hidden relative flex items-center justify-center">
            <span className="absolute inset-x-0 top-2 h-[2px] bg-amber-400/75" />
            <span className="absolute inset-x-0 bottom-2 h-[2px] bg-amber-400/75" />
            <span className="relative text-lg sm:text-xl drop-shadow">
              <AppleEmoji emoji="🪖" />
            </span>
          </div>
          <span className="mt-1 px-2 py-0.5 rounded-full bg-[#F43F5E] text-white font-display text-[8px] sm:text-[9.5px] font-extrabold uppercase tracking-wider shadow-lg border border-white/60 whitespace-nowrap">
            В УЧЕБКЕ!
          </span>
        </div>
      )}

      {/* Сами фишки игроков */}
      {alivePlayers.map((p) => {
        const vp = visualPos[p.id] ?? p.position;
        const groupKey = vp === 10 ? `10_${p.inJail ? 'jail' : 'visit'}` : String(vp);
        const sameCell = cellGroups.get(groupKey) || [p];
        const slotIdx = Math.max(0, sameCell.findIndex((x) => x.id === p.id));
        const isCrowdedCell = sameCell.length >= 2;
        const coords = getTokenBoardCoords(vp, p.inJail && vp === 10, slotIdx, sameCell.length);

        const flight = activeFlights[p.id];
        const renderX = flight ? flight.x : coords.x;
        const renderY = flight ? flight.y : coords.y;
        const flightScale = flight ? 1 + 0.42 * flight.lift : 1;

        const isActive = isPlaying && p.id === currentPlayerId;
        const mode = movingMode[p.id];
        const tick = stepTick[p.id] ?? 0;
        const isArrestMode = mode === 'ARREST_CUFF' || mode === 'ARREST_HAUL';

        return (
          <div
            key={p.id}
            data-player-token={p.id}
            style={{
              left: `${renderX}%`,
              top: `${renderY}%`,
              transform: `translate(-50%, -50%) scale(${flightScale.toFixed(3)})`,
              transition: flight
                ? 'none'
                : 'left 105ms cubic-bezier(0.25, 0.46, 0.45, 0.94), top 105ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 180ms ease-out',
              zIndex: flight || isArrestMode ? 55 : mode ? 45 : isActive ? 38 : 32 + slotIdx,
            }}
            className="absolute"
          >
            {/* Полицейские красно-синие мигалки вокруг фишки при аресте */}
            {isArrestMode && (
              <span
                className="absolute -inset-2 sm:-inset-3 rounded-full border-2 border-[#F43F5E] bg-gradient-to-r from-[#F43F5E]/45 to-[#3B82F6]/45 shadow-[0_0_24px_rgba(244,63,94,0.95),0_0_24px_rgba(59,130,246,0.9)] animate-ping pointer-events-none"
              />
            )}

            {/* Пульсирующий ореол активного хода */}
            {isActive && !isArrestMode && (
              <span
                style={{
                  backgroundColor: `${p.color}55`,
                  border: `2px solid ${p.color}`,
                }}
                className="absolute -inset-1 sm:-inset-1.5 rounded-full animate-token-halo pointer-events-none"
              />
            )}

            {/* Диск-фишка в стиле Monopoly One: компактная на телефоне без перекрытия арта и соседей */}
            <div
              key={mode === 'STEP' ? `hop_${tick}` : 'idle'}
              style={{
                backgroundColor: p.color,
                boxShadow: isArrestMode
                  ? '0 0 22px #F43F5E, 0 0 14px #3B82F6, 0 6px 16px rgba(0,0,0,0.9)'
                  : isActive
                  ? `0 5px 14px rgba(0,0,0,0.85), 0 0 14px ${p.color}, inset 0 1.5px 2.5px rgba(255,255,255,0.6)`
                  : '0 4px 10px rgba(0,0,0,0.82), inset 0 1.5px 2.5px rgba(255,255,255,0.45)',
              }}
              className={`relative ${
                isCrowdedCell
                  ? 'w-[15px] h-[15px] sm:w-[24px] sm:h-[24px] md:w-[28px] md:h-[28px]'
                  : 'w-[18px] h-[18px] sm:w-[26px] sm:h-[26px] md:w-[31px] md:h-[31px]'
              } rounded-full border-[1.5px] sm:border-[2.5px] ${
                isArrestMode ? 'border-[#FDA4AF] scale-115' : 'border-white'
              } outline outline-[1.5px] sm:outline-[2.5px] outline-[#09090b] flex items-center justify-center select-none transition-transform ${
                mode === 'STEP' ? 'animate-token-hop' : ''
              }`}
            >
              {/* Внутреннее контрастное кольцо M1 */}
              <span
                className={`${
                  isCrowdedCell
                    ? 'w-[10.5px] h-[10.5px] sm:w-[16.5px] sm:h-[16.5px] md:w-[19.5px] md:h-[19.5px] text-[7px] sm:text-[10px] md:text-[12px]'
                    : 'w-[13px] h-[13px] sm:w-[18px] sm:h-[18px] md:w-[21px] md:h-[21px] text-[8px] sm:text-[11px] md:text-[13px]'
                } rounded-full bg-black/25 border border-black/30 flex items-center justify-center leading-none shadow-inner overflow-hidden`}
              >
                <PlayerAvatar avatar={p.avatar} fill />
              </span>

              {/* Индикатор активного дебаффа «Задний ход ⏪» прямо на фишке */}
              {(p.reverseTurns ?? 0) > 0 && (
                <span
                  title={`Задний ход: ещё ${p.reverseTurns} бр.`}
                  className="absolute -bottom-1.5 -right-1.5 px-1 py-[0.5px] rounded-full bg-purple-600 border border-purple-200 text-[7px] sm:text-[8.5px] font-black text-white leading-none shadow-md"
                >
                  ⏪{p.reverseTurns}
                </span>
              )}
            </div>

            {/* Плашка при бусификации или шагании фишки */}
            {isArrestMode ? (
              <span className="absolute -top-6 sm:-top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8.5px] sm:text-[10px] font-extrabold text-white whitespace-nowrap shadow-[0_4px_14px_rgba(244,63,94,0.8)] border border-white/80 bg-gradient-to-r from-[#F43F5E] to-[#B45309] animate-pop-in inline-flex items-center gap-1">
                <AppleEmoji emoji={mode === 'ARREST_CUFF' ? '🚐' : '🪖'} />
                <span>{mode === 'ARREST_CUFF' ? 'БУСИФИКАЦИЯ!' : 'В УЧЕБКУ!'}</span>
              </span>
            ) : (
              mode && (
                <span
                  style={{ backgroundColor: p.color }}
                  className="hidden sm:inline-block absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white whitespace-nowrap shadow-md border border-white/60"
                >
                  {p.name}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};
