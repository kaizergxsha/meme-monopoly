import { BOARD_CELLS, isBuyableCell } from '../shared/boardData.ts';
import { TAUNTS } from '../shared/memeContent.ts';
import {
  calculateLiquidationPotential,
  canBuildBranch,
  checkTradeFairness,
  getTokenWalkDurationMs,
  getUnmortgageCost,
} from '../shared/rules.ts';
import { GameManager, ServerRoom } from './gameEngine.ts';

export function tickBots(manager: GameManager) {
  const now = Date.now();
  for (const room of manager.rooms.values()) {
    if (room.state.status !== 'PLAYING') continue;

    // 0. Боты участвуют в голосовании за кик (через ~2 сек после старта голосования)
    if (room.state.activeKickVote) {
      const vote = room.state.activeKickVote;
      const elapsedMs = 30_000 - (vote.expiresAt - now);
      if (elapsedMs >= 1800) {
        const target = room.state.players.find((p) => p.id === vote.targetId);
        for (const vid of [...vote.eligibleVoterIds]) {
          if (vote.votes[vid] !== undefined) continue;
          const bot = room.state.players.find((p) => p.id === vid && p.isBot && !p.isBankrupt);
          if (!bot) continue;
          const approve = !target?.isConnected || Boolean(target?.isBot);
          manager.castKickVote(room, bot.id, approve);
          if (!room.state.activeKickVote) break;
        }
      }
    }

    // 1. Боты отвечают на входящие сделки
    if (room.state.activeTrade) {
      const target = room.state.players.find(
        (p) => p.id === room.state.activeTrade?.toPlayerId
      );
      if (target?.isBot) {
        const { offerValue, requestValue } = checkTradeFairness(
          room.state.cells,
          room.state.activeTrade.offer,
          room.state.activeTrade.request
        );
        // Бот соглашается, если ему дают хотя бы 95% от запрашиваемой оценки
        const accept = offerValue >= requestValue * 0.95;
        manager.respondTrade(room, target.id, accept);
        continue;
      }
    }

    // 2. Боты торгуются на аукционе
    if (room.state.phase === 'AUCTION' && room.state.auction) {
      handleBotAuction(manager, room);
      continue;
    }

    // 3. Ход активного бота
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || !cur.isBot || cur.isBankrupt) continue;

    // Небольшая задержка 1150мс между действиями бота для комфортной анимации
    if (room.state.turnStartedAt && Date.now() - room.state.turnStartedAt < 1150) {
      continue;
    }
    // Ждём завершения пошаговой анимации фишки после броска кубиков, чтобы эффекты и карточки не всплывали до приземления
    if (
      room.state.lastDice &&
      Date.now() - room.state.lastDice.timestamp < getTokenWalkDurationMs(room.state.lastDice) + 350
    ) {
      continue;
    }

    if (room.state.phase === 'PRE_ROLL') {
      if (cur.inJail && cur.cash >= 2500) {
        manager.payJailFine(room, cur.id);
      }
      // Выкупает залоги, если богат
      for (const c of room.state.cells) {
        if (c.ownerId === cur.id && c.isMortgaged) {
          const cost = getUnmortgageCost(c.id);
          if (cur.cash >= cost + 2000) {
            manager.unmortgageProperty(room, cur.id, c.id);
          }
        }
      }
      // Строит до 1 филиала на монополию при наличии запаса кэша
      for (const c of room.state.cells) {
        const def = BOARD_CELLS[c.id];
        if (
          c.ownerId === cur.id &&
          def?.branchCost &&
          cur.cash >= def.branchCost + 1500 &&
          canBuildBranch(room.state, cur.id, c.id).ok
        ) {
          manager.buildBranch(room, cur.id, c.id);
        }
      }
      // Иногда кидает мемную насмешку
      if (Math.random() < 0.12) {
        const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
        manager.sendTaunt(room, cur.id, t.id);
      }
      manager.rollDice(room, cur.id);
    } else if (room.state.phase === 'CHOOSE_SPEED_TARGET') {
      const targets = room.state.validSpeedTargets;
      // Предпочитает свободные покупаемые поля или Старт
      const freeBuyable = targets.find(
        (id) => isBuyableCell(BOARD_CELLS[id]) && room.state.cells[id].ownerId === null
      );
      const startTarget = targets.includes(0) ? 0 : undefined;
      const chosen = freeBuyable ?? startTarget ?? targets[Math.floor(Math.random() * targets.length)];
      if (chosen !== undefined) {
        manager.chooseSpeedTarget(room, cur.id, chosen);
      }
    } else if (room.state.phase === 'BUY_DECISION') {
      const def = BOARD_CELLS[cur.position];
      if (def?.price && cur.cash >= def.price + 400) {
        manager.buyProperty(room, cur.id);
      } else if (def?.price && cur.cash >= def.price && Math.random() < 0.75) {
        manager.buyProperty(room, cur.id);
      } else {
        manager.declineProperty(room, cur.id);
      }
    } else if (room.state.phase === 'CHANCE') {
      const popup = room.state.lastCardPopup;
      const waitMs = (popup?.walkDurationMs ?? 250) + 2200;
      if (popup && Date.now() - popup.timestamp < waitMs) {
        continue;
      }
      manager.acknowledgeChance(room, cur.id);
    } else if (room.state.phase === 'PORTAL') {
      const candidates = room.state.portal?.candidateCells ?? [];
      const freeBuyable = candidates.find(
        (id) => isBuyableCell(BOARD_CELLS[id]) && room.state.cells[id].ownerId === null
      );
      const startTarget = candidates.includes(0) ? 0 : undefined;
      const chosen = freeBuyable ?? startTarget ?? candidates[0];
      manager.activatePortal(room, cur.id, chosen);
    } else if (room.state.phase === 'JACKPOT') {
      if (room.state.settings.russianRoulette) {
        if (Math.random() < 0.65) {
          manager.playJackpot(room, cur.id, { mode: 'ROULETTE', faces: [1] });
        } else {
          manager.playJackpot(room, cur.id, { skip: true });
        }
      } else if (cur.cash >= 6000 && Math.random() < 0.65) {
        manager.playJackpot(room, cur.id, { mode: 'DICE', faces: [4, 5, 6] });
      } else {
        manager.playJackpot(room, cur.id, { skip: true });
      }
    } else if (room.state.phase === 'PENDING_DEBT' && room.state.pendingDebt) {
      const needed = room.state.pendingDebt.amount;
      if (cur.cash >= needed) {
        manager.payPendingDebt(room, cur.id);
      } else if (calculateLiquidationPotential(cur, room.state.cells) >= needed) {
        manager.autoLiquidateForDebt(room, cur, needed);
        manager.payPendingDebt(room, cur.id);
      } else {
        manager.surrenderOrBankrupt(room, cur.id);
      }
    } else if (room.state.phase === 'POST_ROLL') {
      manager.endTurn(room, cur.id);
    }
  }
}

function handleBotAuction(manager: GameManager, room: ServerRoom) {
  const auc = room.state.auction;
  if (!auc) return;
  const pid = auc.currentBidderId;
  if (!pid || auc.passedIds.includes(pid) || auc.highestBidderId === pid) return;

  const bot = room.state.players.find((p) => p.id === pid && p.isBot);
  if (!bot) return;

  const basePrice = BOARD_CELLS[auc.cellId]?.price ?? 1000;
  const maxWilling = Math.max(basePrice + 300, Math.floor(basePrice * 1.25));
  const nextBid = auc.currentBid + 100;
  if (nextBid <= maxWilling && bot.cash >= nextBid + 500) {
    manager.placeAuctionBid(room, bot.id, 100);
  } else {
    manager.passAuction(room, bot.id);
  }
}
