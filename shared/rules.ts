import { BOARD_CELLS, isBuyableCell } from './boardData.ts';
import {
  CellRuntimeState,
  PlayerState,
  RoomSettings,
  RoomState,
  TradeSide,
} from './types.ts';

export function formatMoney(k: number): string {
  const sign = k < 0 ? '-' : '';
  const abs = Math.abs(Math.round(k));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}$${formatted}`;
}

export function txt(hard: string, clean: string, censored: boolean): string {
  return censored ? clean : hard;
}

export function isSpeedRulesMode(settings: RoomSettings): boolean {
  if (settings.retroRules || settings.mode === 'retro') return false;
  return (
    settings.mode === 'speed' ||
    settings.mode === 'team2v2' ||
    settings.mode === 'rasklad' ||
    settings.mode === 'duel_restart'
  );
}

export function getSpeedDieUnlockRound(settings: RoomSettings): number | null {
  if (!isSpeedRulesMode(settings)) return null;
  return settings.mode === 'duel_restart' ? 5 : 7;
}

export function isSpeedDieActive(state: RoomState): boolean {
  const unlock = getSpeedDieUnlockRound(state.settings);
  return unlock !== null && state.round >= unlock;
}

export function areAllies(
  p1: PlayerState | undefined,
  p2: PlayerState | undefined,
  settings: RoomSettings
): boolean {
  if (!p1 || !p2) return false;
  if (p1.id === p2.id) return true;
  if (settings.mode !== 'team2v2') return false;
  return p1.team !== undefined && p1.team === p2.team;
}

export function getGroupCellDefs(groupId: string) {
  return BOARD_CELLS.filter((c) => c.groupId === groupId);
}

export function ownsFullMonopoly(
  cells: CellRuntimeState[],
  ownerId: string,
  groupId: string
): boolean {
  const defs = getGroupCellDefs(groupId);
  if (defs.length === 0) return false;
  return defs.every((d) => cells[d.id]?.ownerId === ownerId);
}

export function getAntiStallStatus(
  state: RoomState,
  nowMs: number = Date.now()
): {
  elapsedMinutes: number;
  startBonusDisabled: boolean;
  rentTaxPercent: number;
} {
  if (!state.startedAt || !state.settings.rentTaxEnabled || state.settings.retroRules) {
    return { elapsedMinutes: 0, startBonusDisabled: false, rentTaxPercent: 0 };
  }
  const elapsedMinutes = Math.floor((nowMs - state.startedAt) / 60000);
  const speed = isSpeedRulesMode(state.settings);

  if (speed) {
    // Быстрая игра: отключение Старта на 30-й мин, 50% налог с 40-й мин (+10% каждые 10 мин до 99%)
    const startBonusDisabled = elapsedMinutes >= 30;
    let rentTaxPercent = 0;
    if (elapsedMinutes >= 40) {
      const steps = Math.floor((elapsedMinutes - 40) / 10);
      rentTaxPercent = Math.min(99, 50 + steps * 10);
    }
    return { elapsedMinutes, startBonusDisabled, rentTaxPercent };
  } else {
    // Классика: с 46-й мин откл Старта, с 61-й мин 50% налог, плавно растёт до 99%
    const startBonusDisabled = elapsedMinutes >= 46;
    let rentTaxPercent = 0;
    if (elapsedMinutes >= 61) {
      const extraMins = elapsedMinutes - 61;
      rentTaxPercent = Math.min(99, 50 + Math.floor(extraMins * 1.5));
    }
    return { elapsedMinutes, startBonusDisabled, rentTaxPercent };
  }
}

export function calculateDisplayRent(
  cells: CellRuntimeState[],
  cellId: number,
  diceSum: number = 7
): number {
  const def = BOARD_CELLS[cellId];
  const cell = cells[cellId];
  if (!def || !cell || !cell.ownerId || cell.isMortgaged || !def.rents) return 0;

  if (def.type === 'CAR' && def.groupId) {
    const ownedCars = getGroupCellDefs(def.groupId).filter(
      (d) => cells[d.id]?.ownerId === cell.ownerId && !cells[d.id]?.isMortgaged
    ).length;
    return def.rents[Math.max(0, Math.min(3, ownedCars - 1))] ?? 250;
  }

  if (def.type === 'IT_UTILITY' && def.groupId) {
    const ownedIt = getGroupCellDefs(def.groupId).filter(
      (d) => cells[d.id]?.ownerId === cell.ownerId && !cells[d.id]?.isMortgaged
    ).length;
    const mult = def.rents[ownedIt >= 2 ? 1 : 0] ?? 100;
    return mult * diceSum;
  }

  if (def.type === 'PROPERTY' && def.groupId) {
    if (cell.branches > 0) {
      return def.rents[Math.min(5, cell.branches)] ?? def.rents[0];
    }
    const hasMonopoly =
      ownsFullMonopoly(cells, cell.ownerId, def.groupId) &&
      getGroupCellDefs(def.groupId).every((d) => !cells[d.id]?.isMortgaged);
    return hasMonopoly ? def.rents[0] * 2 : def.rents[0];
  }

  return 0;
}

export function calculateRent(
  state: RoomState,
  payer: PlayerState,
  cellId: number,
  diceSum: number,
  nowMs: number = Date.now()
): {
  totalRent: number;
  ownerShare: number;
  taxShare: number;
  taxPercent: number;
  isAllyFree: boolean;
} {
  const cell = state.cells[cellId];
  if (!cell || !cell.ownerId || cell.isMortgaged) {
    return { totalRent: 0, ownerShare: 0, taxShare: 0, taxPercent: 0, isAllyFree: false };
  }
  const owner = state.players.find((p) => p.id === cell.ownerId);
  if (!owner || owner.isBankrupt || owner.id === payer.id) {
    return { totalRent: 0, ownerShare: 0, taxShare: 0, taxPercent: 0, isAllyFree: false };
  }
  if (areAllies(payer, owner, state.settings)) {
    return { totalRent: 0, ownerShare: 0, taxShare: 0, taxPercent: 0, isAllyFree: true };
  }

  const totalRent = calculateDisplayRent(state.cells, cellId, diceSum);
  const { rentTaxPercent } = getAntiStallStatus(state, nowMs);
  const taxShare = Math.floor((totalRent * rentTaxPercent) / 100);
  const ownerShare = Math.max(0, totalRent - taxShare);

  return {
    totalRent,
    ownerShare,
    taxShare,
    taxPercent: rentTaxPercent,
    isAllyFree: false,
  };
}

export function canBuildBranch(
  state: RoomState,
  playerId: string,
  cellId: number
): { ok: boolean; reason?: string } {
  const def = BOARD_CELLS[cellId];
  const cell = state.cells[cellId];
  const player = state.players.find((p) => p.id === playerId);
  if (!def || !cell || !player) return { ok: false, reason: 'Клетка не найдена' };
  if (state.players[state.currentPlayerIndex]?.id !== playerId) {
    return { ok: false, reason: 'Строить можно только в свой ход' };
  }
  if (def.type !== 'PROPERTY' || !def.groupId || !def.branchCost) {
    return { ok: false, reason: 'На этом поле нельзя строить филиалы' };
  }
  if (cell.ownerId !== playerId) return { ok: false, reason: 'Это не ваше поле' };
  if (!ownsFullMonopoly(state.cells, playerId, def.groupId)) {
    return { ok: false, reason: 'Соберите всю отрасль для постройки' };
  }
  if (!isSpeedRulesMode(state.settings) && state.builtGroupsThisTurn.includes(def.groupId)) {
    return { ok: false, reason: 'В этой монополии уже построен 1 филиал за этот ход' };
  }
  const groupDefs = getGroupCellDefs(def.groupId);
  if (groupDefs.some((d) => state.cells[d.id]?.isMortgaged)) {
    return { ok: false, reason: 'Выкупите заложенные поля в этой отрасли' };
  }
  if (cell.branches >= 5) {
    return { ok: false, reason: 'Уже построена Большая звезда ★' };
  }
  if (!isSpeedRulesMode(state.settings)) {
    // Равномерная постройка в классике
    const minBranches = Math.min(...groupDefs.map((d) => state.cells[d.id]?.branches ?? 0));
    if (cell.branches > minBranches) {
      return { ok: false, reason: 'В Классике стройка равномерная: подтяните соседние поля' };
    }
  }
  if (player.cash < def.branchCost) {
    return { ok: false, reason: `Не хватает бабла (${formatMoney(def.branchCost)})` };
  }
  return { ok: true };
}

export function canSellBranch(
  state: RoomState,
  playerId: string,
  cellId: number
): { ok: boolean; reason?: string } {
  const def = BOARD_CELLS[cellId];
  const cell = state.cells[cellId];
  if (!def || !cell || def.type !== 'PROPERTY' || !def.groupId || !def.branchCost) {
    return { ok: false, reason: 'Нет филиалов' };
  }
  if (cell.ownerId !== playerId) return { ok: false, reason: 'Не ваше поле' };
  if (cell.branches <= 0) return { ok: false, reason: 'Нечего продавать' };

  if (!isSpeedRulesMode(state.settings)) {
    const groupDefs = getGroupCellDefs(def.groupId);
    const maxBranches = Math.max(...groupDefs.map((d) => state.cells[d.id]?.branches ?? 0));
    if (cell.branches < maxBranches) {
      return { ok: false, reason: 'В Классике продажа филиалов тоже равномерная' };
    }
  }
  return { ok: true };
}

export function getMortgageValue(cellId: number): number {
  const price = BOARD_CELLS[cellId]?.price ?? 0;
  return Math.floor(price * 0.5);
}

export function getUnmortgageCost(cellId: number): number {
  const price = BOARD_CELLS[cellId]?.price ?? 0;
  return Math.ceil(price * 0.6);
}

export function canMortgageCell(
  state: RoomState,
  playerId: string,
  cellId: number
): { ok: boolean; reason?: string } {
  const def = BOARD_CELLS[cellId];
  const cell = state.cells[cellId];
  if (!def || !cell || !isBuyableCell(def)) return { ok: false, reason: 'Нельзя заложить' };
  if (cell.ownerId !== playerId) return { ok: false, reason: 'Не ваше поле' };
  if (cell.isMortgaged) return { ok: false, reason: 'Уже в залоге' };
  const isCoveringDebt =
    state.phase === 'PENDING_DEBT' &&
    state.pendingDebt?.debtorId === playerId &&
    (state.players.find((p) => p.id === playerId)?.cash ?? 0) < state.pendingDebt.amount;
  if (!isCoveringDebt) {
    if (state.players[state.currentPlayerIndex]?.id !== playerId) {
      return { ok: false, reason: 'Заложить поле можно только в свой ход' };
    }
  }
  if (def.groupId) {
    const hasAnyBranch = getGroupCellDefs(def.groupId).some(
      (d) => (state.cells[d.id]?.branches ?? 0) > 0
    );
    if (hasAnyBranch) {
      return { ok: false, reason: 'Сначала продайте все филиалы в этой отрасли' };
    }
  }
  return { ok: true };
}

export function evaluateTradeSide(cells: CellRuntimeState[], side: TradeSide): number {
  let val = Math.max(0, side.cash || 0);
  for (const id of side.propertyIds) {
    const def = BOARD_CELLS[id];
    const cell = cells[id];
    if (def?.price) {
      val += cell?.isMortgaged ? Math.floor(def.price * 0.5) : def.price;
    }
  }
  val += (side.shields || 0) * 1000;
  return val;
}

export function checkTradeFairness(
  cells: CellRuntimeState[],
  offer: TradeSide,
  request: TradeSide
): { fair: boolean; offerValue: number; requestValue: number; diffPercent: number } {
  const offerValue = evaluateTradeSide(cells, offer);
  const requestValue = evaluateTradeSide(cells, request);

  if (offerValue === 0 && requestValue === 0) {
    return { fair: false, offerValue: 0, requestValue: 0, diffPercent: 0 };
  }
  const maxVal = Math.max(offerValue, requestValue);
  const minVal = Math.min(offerValue, requestValue);
  if (minVal === 0) {
    return { fair: false, offerValue, requestValue, diffPercent: 100 };
  }
  // ±50% в правилах M1: разница не превышает 50% от большей стороны (или отношение <= 1.5x..2x)
  // Точная формула M1: minVal >= maxVal * 0.5 (разница <= 50% от большей оценки!)
  const diffPercent = Math.round(((maxVal - minVal) / maxVal) * 100);
  return {
    fair: diffPercent <= 50,
    offerValue,
    requestValue,
    diffPercent,
  };
}

export function calculateNetWorth(player: PlayerState, cells: CellRuntimeState[]): number {
  let total = player.cash;
  for (const c of cells) {
    if (c.ownerId === player.id) {
      const def = BOARD_CELLS[c.id];
      if (def?.price) {
        total += c.isMortgaged ? Math.floor(def.price * 0.5) : def.price;
      }
      if (c.branches > 0 && def?.branchCost) {
        total += c.branches * Math.floor(def.branchCost * 0.5);
      }
    }
  }
  return total;
}

export function calculateLiquidationPotential(
  player: PlayerState,
  cells: CellRuntimeState[]
): number {
  let cash = player.cash;
  for (const c of cells) {
    if (c.ownerId === player.id) {
      const def = BOARD_CELLS[c.id];
      if (c.branches > 0 && def?.branchCost) {
        cash += c.branches * Math.floor(def.branchCost * 0.5);
      }
      if (!c.isMortgaged && def?.price) {
        cash += Math.floor(def.price * 0.5);
      }
    }
  }
  return cash;
}

export function getTokenWalkDurationMs(
  lastDice?: { totalSteps?: number; timestamp?: number } | null
): number {
  if (!lastDice) return 0;
  const steps = Math.max(1, Math.min(16, lastDice.totalSteps || 6));
  return 180 + steps * 85;
}
