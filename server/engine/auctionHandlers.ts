import { BOARD_CELLS, isBuyableCell } from '../../shared/boardData.ts';
import { formatMoney, getMortgageValue } from '../../shared/rules.ts';
import { PlayerState } from '../../shared/types.ts';
import { EngineHost, logAvatarBadge, ServerRoom } from './engineUtils.ts';

export function buyProperty(host: EngineHost, room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'BUY_DECISION') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const cellId = player.position;
    const def = BOARD_CELLS[cellId];
    const cell = room.state.cells[cellId];
    if (!def?.price || cell.ownerId !== null) return;
    if (player.cash < def.price) return;

    player.cash -= def.price;
    cell.ownerId = player.id;
    host.bumpStat(player, 'cellsBought', 1);
    host.checkAndCreditMonopolies(room, player);

    host.addLog(
      room,
      'BUY',
      `🏷️ ${player.name} прикупил «${def.name}» за ${formatMoney(def.price)}!`,
      `🏷️ ${player.name} купил «${def.cleanName}» за ${formatMoney(def.price)}!`,
      player
    );
    host.finishPostRollOrAdvance(room);
    host.emitState(room);
  }

export function declineProperty(host: EngineHost, room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'BUY_DECISION') return;
    const player = room.state.players[room.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const cellId = player.position;
    const def = BOARD_CELLS[cellId];
    const retro = room.state.settings.retroRules || room.state.settings.mode === 'retro';

    if (!room.state.settings.auctionsEnabled || retro) {
      host.addLog(
        room,
        'BUY',
        `🙅‍♂️ ${player.name} прошёл мимо «${def.name}» (аукционы отключены).`,
        `🙅‍♂️ ${player.name} отказался от покупки «${def.cleanName}».`,
        player
      );
      host.finishPostRollOrAdvance(room);
      host.emitState(room);
      return;
    }

    const basePrice = def.price ?? 500;
    const startPrice = basePrice + 100;
    const n = room.state.players.length;
    const orderedPlayers: PlayerState[] = [];
    for (let offset = 1; offset <= n; offset++) {
      orderedPlayers.push(room.state.players[(room.state.currentPlayerIndex + offset) % n]);
    }
    const participants = orderedPlayers
      .filter((p) => !p.isBankrupt && p.cash >= startPrice)
      .map((p) => p.id);

    if (participants.length === 0) {
      host.addLog(
        room,
        'AUCTION',
        `😴 На «${def.name}» (от ${formatMoney(startPrice)}) ни у кого не хватило средств — лот снят.`,
        `😴 На «${def.cleanName}» (от ${formatMoney(startPrice)}) ни у кого не хватило средств — лот снят.`
      );
      host.finishPostRollOrAdvance(room);
      host.emitState(room);
      return;
    }

    const firstBidder = room.state.players.find((p) => p.id === participants[0]);
    room.state.auction = {
      cellId,
      isMortgagedAuction: false,
      sellerId: null,
      initiatorId: player.id,
      currentBid: basePrice,
      highestBidderId: null,
      currentBidderId: participants[0],
      activeParticipantIds: participants,
      passedIds: [],
      endsAt: Date.now() + 14000,
    };
    room.state.phase = 'AUCTION';
    host.addLog(
      room,
      'AUCTION',
      `🔨 АУКЦИОН! «${def.name}» выставлено на торги от ${formatMoney(startPrice)}! Первым торгуется ${firstBidder?.name ?? 'игрок'}.`,
      `🔨 Аукцион за «${def.cleanName}» от ${formatMoney(startPrice)}! Ход торгов: ${firstBidder?.name ?? 'игрок'}.`
    );
    host.emitState(room);
  }

  // Выставление собственного заложенного поля на аукцион (п. 4.1 ТЗ / обновление «Расклад»)
export function startMortgagedAuction(host: EngineHost, room: ServerRoom, playerId: string, cellId: number) {
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || cur.id !== playerId) return;
    if (room.state.phase !== 'PRE_ROLL') return;
    if (!room.state.settings.auctionsEnabled || room.state.settings.retroRules) return;

    const cell = room.state.cells[cellId];
    const def = BOARD_CELLS[cellId];
    if (!cell || !def?.price || cell.ownerId !== playerId || !cell.isMortgaged) return;

    const basePrice = def.price;
    const startBid = basePrice + 100;
    const n = room.state.players.length;
    const orderedPlayers: PlayerState[] = [];
    for (let offset = 1; offset <= n; offset++) {
      orderedPlayers.push(room.state.players[(room.state.currentPlayerIndex + offset) % n]);
    }
    const participants = orderedPlayers
      .filter((p) => !p.isBankrupt && p.id !== playerId && p.cash >= startBid)
      .map((p) => p.id);

    if (participants.length === 0) return;

    const firstBidder = room.state.players.find((p) => p.id === participants[0]);
    room.state.auction = {
      cellId,
      isMortgagedAuction: true,
      sellerId: playerId,
      currentBid: basePrice,
      highestBidderId: null,
      currentBidderId: participants[0],
      activeParticipantIds: participants,
      passedIds: [],
      endsAt: Date.now() + 14000,
    };
    room.state.phase = 'AUCTION';
    host.addLog(
      room,
      'AUCTION',
      `🔨 ЗАЛОГОВЫЙ АУКЦИОН! ${cur.name} выставил заложенное поле «${def.name}» от ${formatMoney(startBid)}! Первым торгуется ${firstBidder?.name ?? 'игрок'}.`,
      `🔨 ${cur.name} выставил заложенное поле «${def.cleanName}» на аукцион от ${formatMoney(startBid)}!`
    );
    host.emitState(room);
  }

function advanceAuctionTurn(host: EngineHost, room: ServerRoom, afterPlayerId: string) {
    const auc = room.state.auction;
    if (!auc) return;

    for (const pid of auc.activeParticipantIds) {
      if (auc.passedIds.includes(pid) || pid === auc.highestBidderId) continue;
      const p = room.state.players.find((pl) => pl.id === pid);
      if (!p || p.isBankrupt || p.cash < auc.currentBid + 100) {
        auc.passedIds.push(pid);
      }
    }

    const remaining = auc.activeParticipantIds.filter((id) => !auc.passedIds.includes(id));
    if (remaining.length === 0 || (remaining.length === 1 && auc.highestBidderId === remaining[0])) {
      finalizeAuction(host, room);
      return;
    }

    const total = auc.activeParticipantIds.length;
    const startIdx = Math.max(0, auc.activeParticipantIds.indexOf(afterPlayerId));
    let nextId: string | null = null;
    for (let offset = 1; offset <= total; offset++) {
      const candidate = auc.activeParticipantIds[(startIdx + offset) % total];
      if (!auc.passedIds.includes(candidate) && candidate !== auc.highestBidderId) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      nextId = remaining.find((id) => id !== auc.highestBidderId) ?? remaining[0] ?? null;
    }

    if (!nextId || (nextId === auc.highestBidderId && remaining.length <= 1)) {
      finalizeAuction(host, room);
      return;
    }

    auc.currentBidderId = nextId;
    auc.endsAt = Date.now() + 12000;
    host.emitState(room);
  }

export function placeAuctionBid(host: EngineHost, room: ServerRoom, playerId: string, stepAmount: number = 100) {
    if (room.state.phase !== 'AUCTION' || !room.state.auction) return;
    const auc = room.state.auction;
    if (!auc.activeParticipantIds.includes(playerId) || auc.passedIds.includes(playerId)) return;
    if (auc.currentBidderId && auc.currentBidderId !== playerId) return;
    if (auc.initiatorId === playerId && auc.highestBidderId && auc.highestBidderId !== playerId) {
      return;
    }

    const player = room.state.players.find((p) => p.id === playerId);
    const step = Math.max(100, Math.round(stepAmount / 100) * 100);
    const nextBid = auc.currentBid + step;
    if (!player || player.cash < nextBid) return;

    auc.currentBid = nextBid;
    auc.highestBidderId = playerId;

    host.addLog(
      room,
      'AUCTION',
      `💸 ${player.name} поднимает ставку до ${formatMoney(nextBid)}!`,
      `💸 ${player.name} ставит ${formatMoney(nextBid)}!`,
      player
    );

    // Игрок, выставивший карточку на аукцион, больше не может участвовать после того, как кто-то другой поставил ставку
    if (auc.initiatorId && playerId !== auc.initiatorId && !auc.passedIds.includes(auc.initiatorId)) {
      auc.passedIds.push(auc.initiatorId);
      const initiator = room.state.players.find((p) => p.id === auc.initiatorId);
      if (initiator) {
        host.addLog(
          room,
          'AUCTION',
          `🚫 ${initiator.name} выбывает из аукциона после чужой ставки.`,
          `🚫 ${initiator.name} не может участвовать в торгах после ставки соперника.`,
          initiator
        );
      }
    }

    advanceAuctionTurn(host, room, playerId);
  }

export function passAuction(host: EngineHost, room: ServerRoom, playerId: string) {
    if (room.state.phase !== 'AUCTION' || !room.state.auction) return;
    const auc = room.state.auction;
    if (!auc.activeParticipantIds.includes(playerId)) return;
    if (auc.currentBidderId && auc.currentBidderId !== playerId) return;

    if (!auc.passedIds.includes(playerId)) {
      auc.passedIds.push(playerId);
      const player = room.state.players.find((p) => p.id === playerId);
      const def = BOARD_CELLS[auc.cellId];
      if (player && def) {
        host.addLog(
          room,
          'AUCTION',
          `🏳️ ${player.name} пасует на торгах за «${def.name}».`,
          `🏳️ ${player.name} вышел из торгов за «${def.cleanName}».`,
          player
        );
      }
    }
    advanceAuctionTurn(host, room, playerId);
  }

export function finalizeAuction(host: EngineHost, room: ServerRoom) {
    const auc = room.state.auction;
    if (!auc) return;
    const def = BOARD_CELLS[auc.cellId];
    const cell = room.state.cells[auc.cellId];

    if (auc.highestBidderId) {
      const winner = room.state.players.find((p) => p.id === auc.highestBidderId);
      if (winner && winner.cash >= auc.currentBid) {
        winner.cash -= auc.currentBid;
        if (auc.isMortgagedAuction && auc.sellerId) {
          const seller = room.state.players.find((p) => p.id === auc.sellerId);
          const bankCut = def.price ? def.price - getMortgageValue(auc.cellId) : 0;
          const sellerProfit = Math.max(0, auc.currentBid - bankCut);
          if (seller) seller.cash += sellerProfit;
          cell.ownerId = winner.id;
          cell.isMortgaged = false;
          cell.mortgageRoundsLeft = null;
          host.bumpStat(winner, 'cellsBought', 1);
          host.checkAndCreditMonopolies(room, winner);
          host.addLog(
            room,
            'AUCTION',
            `🏆 ИТОГ АУКЦИОНА: ${winner.name} забрал «${def.name}» (выкуплено!) за ${formatMoney(
              auc.currentBid
            )}. Навар продавца: +${formatMoney(sellerProfit)}!`,
            `🏆 Итог аукциона: ${winner.name} выиграл «${def.cleanName}» за ${formatMoney(auc.currentBid)}.`,
            winner
          );
        } else {
          cell.ownerId = winner.id;
          host.bumpStat(winner, 'cellsBought', 1);
          host.checkAndCreditMonopolies(room, winner);
          host.addLog(
            room,
            'AUCTION',
            `🏆 ИТОГ АУКЦИОНА: ${winner.name} забрал «${def.name}» за ${formatMoney(auc.currentBid)}!`,
            `🏆 Итог аукциона: ${winner.name} купил «${def.cleanName}» за ${formatMoney(auc.currentBid)}!`,
            winner
          );
        }
      }
    } else {
      host.addLog(
        room,
        'AUCTION',
        `😴 На «${def.name}» никто не поставил ни копейки — лот снят.`,
        `😴 Торги за «${def.cleanName}» завершились без ставок.`
      );
    }

    room.state.auction = null;
    if (auc.isMortgagedAuction) {
      room.state.phase = 'PRE_ROLL';
      host.setPhaseDeadline(room);
    } else {
      host.finishPostRollOrAdvance(room);
    }
    host.emitState(room);
  }

  // ================== СТРОЙКА, ЗАЛОГ, ВЫКУП (НЕ СБРАСЫВАЮТ ТАЙМЕР ХОДА!) ==================

