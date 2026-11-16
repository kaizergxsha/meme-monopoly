import { BOARD_CELLS } from '../../shared/boardData.ts';
import { TRADE_PROPOSAL_TEMPLATES } from '../../shared/memeContent.ts';
import { areAllies, checkTradeFairness, formatMoney, getGroupCellDefs, isSpeedRulesMode } from '../../shared/rules.ts';
import { TradeOffer, TradeSide } from '../../shared/types.ts';
import { EngineHost, logAvatarBadge, pickRandom, randomId, ServerRoom } from './engineUtils.ts';

function groupHasAnyBranch(host: EngineHost, room: ServerRoom, cellId: number): boolean {
    const grp = BOARD_CELLS[cellId]?.groupId;
    if (!grp) return false;
    return getGroupCellDefs(grp).some((d) => (room.state.cells[d.id]?.branches ?? 0) > 0);
  }

export function extendTurnForTradeDraft(host: EngineHost, room: ServerRoom, playerId: string) {
    if (room.state.status !== 'PLAYING' || room.state.activeTrade) return;
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || cur.id !== playerId) return;
    if ((room.state.tradesProposedThisTurn ?? 0) >= 3 || room.tradeDraftExtensionsThisTurn >= 3) {
      return;
    }
    room.tradeDraftExtensionsThisTurn += 1;
    if (room.state.turnDeadlineAt !== null && room.state.settings.turnTimerSec > 0) {
      room.state.turnDeadlineAt += 20000;
      host.emitState(room);
    }
  }

export function proposeTrade(host: EngineHost, 
    room: ServerRoom,
    fromId: string,
    toId: string,
    offer: TradeSide,
    request: TradeSide
  ): { ok: boolean; error?: string } {
    if (room.state.status !== 'PLAYING' || room.state.activeTrade) {
      return { ok: false, error: 'Сейчас уже висит другой договор' };
    }
    const cur = room.state.players[room.state.currentPlayerIndex];
    if (!cur || cur.id !== fromId) {
      return { ok: false, error: 'Отправлять договор можно только в свой ход' };
    }
    if ((room.state.tradesProposedThisTurn ?? 0) >= 3) {
      return { ok: false, error: 'За ход можно предложить максимум 3 сделки' };
    }
    const fromP = room.state.players.find((p) => p.id === fromId);
    const toP = room.state.players.find((p) => p.id === toId);
    if (!fromP || !toP || toP.isBankrupt || fromId === toId) {
      return { ok: false, error: 'Некорректный получатель сделки' };
    }

    const cleanOffer: TradeSide = {
      cash: Math.max(0, Math.round(offer.cash || 0)),
      propertyIds: Array.from(new Set(offer.propertyIds || [])),
      shields: Math.max(0, Math.min(fromP.shields, offer.shields || 0)),
    };
    const cleanReq: TradeSide = {
      cash: Math.max(0, Math.round(request.cash || 0)),
      propertyIds: Array.from(new Set(request.propertyIds || [])),
      shields: Math.max(0, Math.min(toP.shields, request.shields || 0)),
    };

    if (fromP.cash < cleanOffer.cash || toP.cash < cleanReq.cash) {
      return { ok: false, error: 'У одной из сторон не хватает налички' };
    }

    // Проверка владения и отсутствия филиалов на обмениваемых полях (и в их отраслях)
    for (const cid of cleanOffer.propertyIds) {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== fromId || c.branches > 0 || groupHasAnyBranch(host, room, cid)) {
        return { ok: false, error: 'Нельзя обменивать чужие поля или поля из отраслей с филиалами' };
      }
    }
    for (const cid of cleanReq.propertyIds) {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== toId || c.branches > 0 || groupHasAnyBranch(host, room, cid)) {
        return { ok: false, error: 'На запрашиваемом поле (или в его отрасли) построены филиалы' };
      }
    }

    const fairness = checkTradeFairness(room.state.cells, cleanOffer, cleanReq);
    if (fairness.offerValue === 0 && fairness.requestValue === 0) {
      return { ok: false, error: 'Пустой договор отправлять нельзя' };
    }
    if (room.state.settings.fairTradeLimit && !fairness.fair) {
      return {
        ok: false,
        error: `Анти-абуз фильтр ±50%: перекос сделки ${fairness.diffPercent}% (${formatMoney(
          fairness.offerValue
        )} vs ${formatMoney(fairness.requestValue)})`,
      };
    }

    const trade: TradeOffer = {
      id: `tr_${randomId(6)}`,
      fromPlayerId: fromId,
      toPlayerId: toId,
      offer: cleanOffer,
      request: cleanReq,
      createdAt: Date.now(),
      expiresAt: Date.now() + 35000,
    };
    room.state.activeTrade = trade;
    room.state.tradesProposedThisTurn = (room.state.tradesProposedThisTurn ?? 0) + 1;
    if (room.state.turnDeadlineAt !== null && room.state.settings.turnTimerSec > 0) {
      room.state.turnDeadlineAt = Math.max(
        room.state.turnDeadlineAt + 25000,
        trade.expiresAt + 15000
      );
    }
    room.activeTradeMortgagedIds = new Set(
      [...cleanOffer.propertyIds, ...cleanReq.propertyIds].filter((cid) =>
        Boolean(room.state.cells[cid]?.isMortgaged)
      )
    );

    const tpl =
      TRADE_PROPOSAL_TEMPLATES[Math.floor(Math.random() * TRADE_PROPOSAL_TEMPLATES.length)];
    const hardMsg = tpl.hard.replace('{from}', fromP.name).replace('{to}', toP.name);
    const cleanMsg = tpl.clean.replace('{from}', fromP.name).replace('{to}', toP.name);

    host.addLog(room, 'TRADE', hardMsg, cleanMsg, fromP);
    host.emitState(room);
    return { ok: true };
  }

export function respondTrade(host: EngineHost, room: ServerRoom, playerId: string, accept: boolean) {
    const trade = room.state.activeTrade;
    if (!trade) return;
    if (playerId !== trade.toPlayerId && (accept || playerId !== trade.fromPlayerId)) return;

    const fromP = room.state.players.find((p) => p.id === trade.fromPlayerId);
    const toP = room.state.players.find((p) => p.id === trade.toPlayerId);
    const snapshotMortgaged = room.activeTradeMortgagedIds;
    room.state.activeTrade = null;
    room.activeTradeMortgagedIds = null;

    if (!accept || !fromP || !toP) {
      host.addLog(
        room,
        'TRADE',
        `❌ Договор между ${fromP?.name} и ${toP?.name} послан лесом!`,
        `❌ Предложение обмена отклонено.`
      );
      host.emitState(room);
      return;
    }

    // Повторная валидация перед передачей активов (защита от гонки стройки филиалов / залога / потери поля)
    const cashOrShieldsInvalid =
      fromP.isBankrupt ||
      toP.isBankrupt ||
      fromP.cash < trade.offer.cash ||
      toP.cash < trade.request.cash ||
      fromP.shields < trade.offer.shields ||
      toP.shields < trade.request.shields;

    const offerPropsInvalid = trade.offer.propertyIds.some((cid) => {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== fromP.id || c.branches > 0 || groupHasAnyBranch(host, room, cid)) {
        return true;
      }
      if (c.isMortgaged && !snapshotMortgaged?.has(cid)) {
        return true;
      }
      return false;
    });

    const reqPropsInvalid = trade.request.propertyIds.some((cid) => {
      const c = room.state.cells[cid];
      if (!c || c.ownerId !== toP.id || c.branches > 0 || groupHasAnyBranch(host, room, cid)) {
        return true;
      }
      if (c.isMortgaged && !snapshotMortgaged?.has(cid)) {
        return true;
      }
      return false;
    });

    if (cashOrShieldsInvalid || offerPropsInvalid || reqPropsInvalid) {
      host.addLog(
        room,
        'TRADE',
        `⚠️ Сделка между ${fromP.name} и ${toP.name} сорвалась: состав активов или филиалов изменился!`,
        `⚠️ Сделка между ${fromP.name} и ${toP.name} отменена: активы сторон изменились!`
      );
      host.emitState(room);
      return;
    }

    fromP.cash = fromP.cash - trade.offer.cash + trade.request.cash;
    toP.cash = toP.cash - trade.request.cash + trade.offer.cash;
    fromP.shields = fromP.shields - trade.offer.shields + trade.request.shields;
    toP.shields = toP.shields - trade.request.shields + trade.offer.shields;

    for (const cid of trade.offer.propertyIds) {
      room.state.cells[cid].ownerId = toP.id;
    }
    for (const cid of trade.request.propertyIds) {
      room.state.cells[cid].ownerId = fromP.id;
    }

    host.checkAndCreditMonopolies(room, fromP);
    host.checkAndCreditMonopolies(room, toP);

    const offerHard = formatTradeSideSummary(host, trade.offer, false);
    const requestHard = formatTradeSideSummary(host, trade.request, false);
    const offerClean = formatTradeSideSummary(host, trade.offer, true);
    const requestClean = formatTradeSideSummary(host, trade.request, true);

    host.addLog(
      room,
      'TRADE',
      `🤝 По рукам! ${fromP.name} отдал [${offerHard}] ⇄ ${toP.name} отдал [${requestHard}].`,
      `🤝 Сделка! ${fromP.name} отдал [${offerClean}] ⇄ ${toP.name} отдал [${requestClean}].`
    );
    host.emitState(room);
  }

function formatTradeSideSummary(host: EngineHost, side: TradeSide, clean = false): string {
    const parts: string[] = [];
    if (side.propertyIds.length > 0) {
      const propNames = side.propertyIds.map((cid) => {
        const def = BOARD_CELLS[cid];
        const label = clean ? def?.cleanName || def?.name : def?.name;
        return label || `#${cid}`;
      });
      parts.push(propNames.join(', '));
    }
    if (side.cash > 0) {
      parts.push(formatMoney(side.cash));
    }
    if (side.shields > 0) {
      parts.push(`🛡️×${side.shields}`);
    }
    return parts.length > 0 ? parts.join(' + ') : 'ничего';
  }

  // ================== ГОЛОСОВАНИЕ ЗА КИК ==================

