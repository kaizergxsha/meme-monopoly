import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GameManager } from '../server/gameEngine.ts';
import { TOKEN_COLORS } from '../shared/memeContent.ts';
import { calculateRent, canBuildBranch, canMortgageCell } from '../shared/rules.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, '..');
const PORT = 3099;
const CDP_PORT = 9299;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function checkAudioHttp(url: string): Promise<{ status: number; length: number; contentType: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            length: buf.length,
            contentType: res.headers['content-type'] || '',
          });
        });
      })
      .on('error', reject);
  });
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

class CDPClient {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  public consoleErrors: string[] = [];
  public pageErrors: string[] = [];

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect() {
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', (e) => reject(e), { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const handler = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) handler.reject(new Error(msg.error.message));
        else handler.resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          this.consoleErrors.push(
            msg.params.args.map((a: any) => a.value || a.description || '').join(' ')
          );
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(msg.params.exceptionDetails?.text || 'Exception');
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async eval<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text}`);
    }
    return res.result?.value as T;
  }

  close() {
    this.ws.close();
  }
}

function testEngineMechanics() {
  if (TOKEN_COLORS.length !== 5) {
    throw new Error(`Expected exactly 5 token colors, got ${TOKEN_COLORS.length}`);
  }
  const colorNames = TOKEN_COLORS.map((c) => c.name);
  for (const reqColor of ['Красный', 'Фиолетовый', 'Зелёный', 'Синий', 'Оранжевый']) {
    if (!colorNames.includes(reqColor)) {
      throw new Error(`Missing required distinct token color "${reqColor}", got ${colorNames.join(', ')}`);
    }
  }

  const gm = new GameManager({
    onStateChange: () => {},
    onTaunt: () => {},
    onBankruptcyAnim: () => {},
  });

  // 1. Тест режима «Расклад» (3 корзины = все 28 полей розданы)
  const rRasklad = gm.createRoom(
    { playerId: 'p1', socketId: 's1', name: 'P1', avatar: '🐸', color: '#f43f5e', diceSkin: 'classic' },
    'rasklad'
  );
  gm.addBot(rRasklad, 'p1');
  gm.addBot(rRasklad, 'p1');
  const startRes = gm.startGame(rRasklad, 'p1');
  if (!startRes.ok) throw new Error('Rasklad failed to start: ' + startRes.error);
  const ownedTotal = rRasklad.state.cells.filter((c) => c.ownerId !== null).length;
  if (ownedTotal !== 28) throw new Error(`Rasklad expected 28 owned fields, got ${ownedTotal}`);

  // 2. Тест «Дуэли 1×1 с рестартами» (сохранение позиций фишек и передача хода)
  const rDuel = gm.createRoom(
    { playerId: 'd1', socketId: 'sd1', name: 'D1', avatar: '🦈', color: '#3b82f6', diceSkin: 'neon' },
    'duel_restart'
  );
  gm.addBot(rDuel, 'd1');
  gm.startGame(rDuel, 'd1');
  rDuel.state.players[0].position = 14;
  rDuel.state.players[1].position = 27;
  rDuel.state.cells[1].ownerId = 'd1';
  const restRes = gm.useDuelRestart(rDuel, 'd1');
  if (!restRes.ok) throw new Error('Duel restart failed: ' + restRes.error);
  if (rDuel.state.players[0].position !== 14 || rDuel.state.players[1].position !== 27) {
    throw new Error('Duel restart did not preserve token positions!');
  }
  if (rDuel.state.cells[1].ownerId !== null) {
    throw new Error('Duel restart did not reset owned properties!');
  }
  if (rDuel.state.players[0].cash !== 16500 || rDuel.state.players[1].cash !== 18500) {
    throw new Error('Duel restart fee transfer mismatch!');
  }

  // 3. Тест режима «2×2» + анти-абуз фильтр ±50% на договоры
  const r2v2 = gm.createRoom(
    { playerId: 't0', socketId: 'st0', name: 'T0', avatar: '🐸', color: '#10b981', diceSkin: 'gold' },
    'team2v2'
  );
  gm.joinRoom(r2v2.state.code, { playerId: 't1', socketId: 'st1', name: 'T1', avatar: '🤡', color: '#eab308', diceSkin: 'classic' });
  gm.joinRoom(r2v2.state.code, { playerId: 't2', socketId: 'st2', name: 'T2', avatar: '🍺', color: '#06b6d4', diceSkin: 'classic' });
  gm.joinRoom(r2v2.state.code, { playerId: 't3', socketId: 'st3', name: 'T3', avatar: '💀', color: '#a855f7', diceSkin: 'classic' });
  gm.startGame(r2v2, 't0');
  if (r2v2.state.players[0].team !== r2v2.state.players[2].team) {
    throw new Error('2x2 alternating teams mismatch');
  }
  const unfair = gm.proposeTrade(
    r2v2,
    't0',
    't1',
    { cash: 5000, propertyIds: [], shields: 0 },
    { cash: 100, propertyIds: [], shields: 0 }
  );
  if (unfair.ok) throw new Error('±50% trade anti-abuse filter failed to block unfair trade!');
  const fair = gm.proposeTrade(
    r2v2,
    't0',
    't1',
    { cash: 1200, propertyIds: [], shields: 0 },
    { cash: 1000, propertyIds: [], shields: 0 }
  );
  if (!fair.ok) throw new Error('Fair trade rejected: ' + fair.error);

  // 4. Тест IT-утилит («Прод на костылях» #12 и «Легаси код» #28): 1 поле = кубики×100, 2 поля = кубики×250
  const rRules = gm.createRoom(
    { playerId: 'u1', socketId: 'su1', name: 'U1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rRules, 'u1');
  gm.startGame(rRules, 'u1');
  const guest = rRules.state.players[1];
  rRules.state.cells[12].ownerId = 'u1';
  const rent1 = calculateRent(rRules.state, guest, 12, 5);
  if (rent1.totalRent !== 500) {
    throw new Error(`Expected IT rent with 1 owned & diceSum=5 to be 500, got ${rent1.totalRent}`);
  }
  rRules.state.cells[28].ownerId = 'u1';
  const rent2 = calculateRent(rRules.state, guest, 28, 5);
  if (rent2.totalRent !== 1250) {
    throw new Error(`Expected IT rent with 2 owned & diceSum=5 to be 1250, got ${rent2.totalRent}`);
  }

  // 5. Тест лимита 1 залог и 1 филиал на монополию за ход (2 монополии -> по 1 филиалу в каждой)
  rRules.state.currentPlayerIndex = 0;
  rRules.state.phase = 'PRE_ROLL';
  rRules.state.mortgagedThisTurn = false;
  rRules.state.builtGroupsThisTurn = [];
  rRules.state.players[0].cash = 50000;
  rRules.state.cells[1].ownerId = 'u1';
  rRules.state.cells[3].ownerId = 'u1';
  rRules.state.cells[6].ownerId = 'u1';
  rRules.state.cells[8].ownerId = 'u1';
  rRules.state.cells[9].ownerId = 'u1';
  gm.buildBranch(rRules, 'u1', 1);
  if (rRules.state.cells[1].branches !== 1) throw new Error('Expected 1st branch built on cell 1');
  if (canBuildBranch(rRules.state, 'u1', 3).ok) {
    throw new Error('Expected 2nd branch in same monopoly (food) in same turn to be blocked');
  }
  if (!canBuildBranch(rRules.state, 'u1', 6).ok) {
    throw new Error('Expected 1st branch in 2nd monopoly (marketplace) in same turn to be allowed');
  }
  gm.buildBranch(rRules, 'u1', 6);
  if (rRules.state.cells[6].branches !== 1) throw new Error('Expected 1st branch built on cell 6');
  if (canBuildBranch(rRules.state, 'u1', 8).ok) {
    throw new Error('Expected 2nd branch in 2nd monopoly (marketplace) in same turn to be blocked');
  }
  gm.mortgageProperty(rRules, 'u1', 12);
  if (!rRules.state.cells[12].isMortgaged) {
    throw new Error('Expected cell 12 mortgaged');
  }
  if (!canMortgageCell(rRules.state, 'u1', 28).ok) {
    throw new Error('Expected 2nd mortgage in same turn to be ALLOWED');
  }
  gm.mortgageProperty(rRules, 'u1', 28);
  if (!rRules.state.cells[28].isMortgaged) {
    throw new Error('Expected cell 28 to ALSO be mortgaged in the same turn');
  }

  // 6. Тест автоперехода хода без POST_ROLL после броска (дубль оставляет ход, не-дубль передаёт)
  const rTurn = gm.createRoom(
    { playerId: 'a1', socketId: 'sa1', name: 'A1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rTurn, 'a1');
  gm.startGame(rTurn, 'a1');
  let sawNonDoubleAdvance = false;
  let sawDoubleExtraTurn = false;
  for (let step = 0; step < 60 && rTurn.state.status === 'PLAYING'; step++) {
    const curIdx = rTurn.state.currentPlayerIndex;
    const curId = rTurn.state.players[curIdx].id;
    rTurn.state.players.forEach((p) => (p.cash = 50000));
    gm.rollDice(rTurn, curId);
    for (let guard = 0; guard < 5; guard++) {
      if ((rTurn.state.phase as string) === 'POST_ROLL') {
        throw new Error('POST_ROLL phase should never remain active after roll');
      }
      const pId = rTurn.state.players[rTurn.state.currentPlayerIndex].id;
      if (rTurn.state.phase === 'BUY_DECISION') gm.declineProperty(rTurn, pId);
      else if (rTurn.state.phase === 'AUCTION') gm.finalizeAuction(rTurn);
      else if (rTurn.state.phase === 'PORTAL') gm.activatePortal(rTurn, pId);
      else if (rTurn.state.phase === 'JACKPOT') gm.playJackpot(rTurn, pId, { skip: true });
      else if (rTurn.state.phase === 'CHOOSE_SPEED_TARGET') gm.chooseSpeedTarget(rTurn, pId, rTurn.state.validSpeedTargets[0]);
      else if (rTurn.state.phase === 'PENDING_DEBT') gm.payPendingDebt(rTurn, pId);
      else if (rTurn.state.phase === 'CHANCE') gm.acknowledgeChance(rTurn, pId);
      else break;
    }
    if (rTurn.state.status !== 'PLAYING') break;
    if (rTurn.state.phase !== 'PRE_ROLL') {
      throw new Error(`Expected PRE_ROLL after roll resolution, got ${rTurn.state.phase}`);
    }
    const last = rTurn.state.lastDice;
    if (last) {
      if (last.isDouble && rTurn.state.players[curIdx].doublesStreak > 0 && !rTurn.state.players[curIdx].inJail) {
        if (rTurn.state.currentPlayerIndex !== curIdx) {
          throw new Error('Expected double roll to grant extra PRE_ROLL to same player');
        }
        sawDoubleExtraTurn = true;
      } else if (!last.isDouble && !last.isTriple) {
        if (rTurn.state.currentPlayerIndex === curIdx) {
          throw new Error('Expected non-double roll to auto-advance turn to next player');
        }
        sawNonDoubleAdvance = true;
      }
    }
    if (sawNonDoubleAdvance && sawDoubleExtraTurn) break;
  }
  if (!sawNonDoubleAdvance) throw new Error('Never observed non-double auto-turn advance');

  // 7. Тест ручной оплаты аренды при попадании на чужую клетку (PENDING_DEBT + кнопка Оплатить)
  let verifiedManualRent = false;
  for (let attempt = 0; attempt < 10 && !verifiedManualRent; attempt++) {
    const rRent = gm.createRoom(
      { playerId: 'r1', socketId: 'sr1', name: 'R1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
      'classic'
    );
    gm.addBot(rRent, 'r1');
    gm.startGame(rRent, 'r1');
    const botPlayer = rRent.state.players[1];
    const p1 = rRent.state.players[0];
    p1.cash = 15000;
    botPlayer.cash = 15000;
    for (const cid of [1, 3, 5, 6, 8, 9, 11, 12]) {
      rRent.state.cells[cid].ownerId = botPlayer.id;
    }
    gm.rollDice(rRent, 'r1');
    if (rRent.state.cells[p1.position]?.ownerId === botPlayer.id) {
      if (rRent.state.phase !== 'PENDING_DEBT' || !rRent.state.pendingDebt) {
        throw new Error(`Expected PENDING_DEBT on owned cell landing, got ${rRent.state.phase}`);
      }
      if (p1.cash !== 15000) {
        throw new Error(`Expected cash NOT deducted before payPendingDebt button click, got ${p1.cash}`);
      }
      const debtAmt = rRent.state.pendingDebt.amount;
      gm.payPendingDebt(rRent, 'r1');
      if (p1.cash !== 15000 - debtAmt || botPlayer.cash !== 15000 + debtAmt) {
        throw new Error('payPendingDebt transfer mismatch!');
      }
      verifiedManualRent = true;
    }
  }
  if (!verifiedManualRent) {
    throw new Error('Could not trigger manual rent PENDING_DEBT across 10 rolls');
  }

  // 8. Тест накопительной статистики игроков (клетки, монополии, казино, русская рулетка, банкротство, победа)
  const sp1 = `bot_stat_p1_${Date.now()}`;
  const sp2 = `bot_stat_p2_${Date.now()}`;
  const rStats = gm.createRoom(
    { playerId: sp1, socketId: 'ss1', name: 'Stat1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.joinRoom(rStats.state.code, {
    playerId: sp2,
    socketId: 'ss2',
    name: 'Stat2',
    avatar: '🦈',
    color: '#3b82f6',
    diceSkin: 'neon',
  });
  gm.startGame(rStats, sp1);
  const stP1 = rStats.state.players[0];
  const stP2 = rStats.state.players[1];
  stP1.cash = 50000;

  // Покупка 1-й и 2-й клетки отрасли food -> +2 cellsBought, +1 monopoliesCollected
  stP1.position = 1;
  rStats.state.currentPlayerIndex = 0;
  rStats.state.phase = 'BUY_DECISION';
  gm.buyProperty(rStats, sp1);
  if (stP1.stats.cellsBought !== 1 || stP1.stats.monopoliesCollected !== 0) {
    throw new Error(`Expected cellsBought=1, monopolies=0, got ${JSON.stringify(stP1.stats)}`);
  }

  stP1.position = 3;
  rStats.state.currentPlayerIndex = 0;
  rStats.state.phase = 'BUY_DECISION';
  gm.buyProperty(rStats, sp1);
  if (stP1.stats.cellsBought !== 2 || stP1.stats.monopoliesCollected !== 1) {
    throw new Error(`Expected cellsBought=2, monopolies=1, got ${JSON.stringify(stP1.stats)}`);
  }

  // Выигрыш в казино (DICE mode)
  rStats.state.settings.russianRoulette = false;
  for (let i = 0; i < 60 && stP1.stats.casinoWins < 1; i++) {
    stP1.cash = 10000;
    rStats.state.currentPlayerIndex = 0;
    rStats.state.phase = 'JACKPOT';
    gm.playJackpot(rStats, sp1, { mode: 'DICE', faces: [1, 2, 3] });
  }
  if (stP1.stats.casinoWins < 1) {
    throw new Error('Expected casinoWins >= 1 after DICE casino rolls');
  }

  // Смерть в русской рулетке -> rouletteDeaths=1, bankruptcies=1, у соперника wins=1
  rStats.state.settings.russianRoulette = true;
  for (let i = 0; i < 60 && !stP1.isBankrupt; i++) {
    rStats.state.currentPlayerIndex = 0;
    rStats.state.phase = 'JACKPOT';
    gm.playJackpot(rStats, sp1, { mode: 'ROULETTE', faces: [1, 2, 3, 4, 5] });
  }
  if (!stP1.isBankrupt) {
    throw new Error('Expected player to die in Russian Roulette within 60 attempts');
  }
  if (
    stP1.stats.rouletteDeaths !== 1 ||
    stP1.stats.bankruptcies !== 1 ||
    stP2.stats.wins !== 1 ||
    (rStats.state.status as string) !== 'FINISHED'
  ) {
    throw new Error(
      `Russian roulette / match end stats mismatch: p1=${JSON.stringify(stP1.stats)}, p2=${JSON.stringify(stP2.stats)}`
    );
  }

  // 9. Тест выплаты на Старте: проход мимо = +2000, точная остановка на Старте = +3000 (2000 + 1000 бонус)
  //    + ручная оплата налога «Воздух $1000» (PENDING_DEBT)
  const rStart = gm.createRoom(
    { playerId: 'st1', socketId: 'sst1', name: 'Start1', avatar: '🐸', color: '#dc2626', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rStart, 'st1');
  gm.startGame(rStart, 'st1');
  const sp = rStart.state.players[0];
  sp.position = 38;
  const cashBeforeExact = sp.cash;
  (gm as any).moveClockwiseAndResolve(rStart, sp, 2);
  if (sp.position !== 0 || sp.cash !== cashBeforeExact + 3000) {
    throw new Error(`Expected +3000 (2000+1000) on exact Start landing, got cash diff ${sp.cash - cashBeforeExact} at pos ${sp.position}`);
  }
  sp.position = 38;
  const cashBeforePass = sp.cash;
  (gm as any).moveClockwiseAndResolve(rStart, sp, 3);
  if (sp.position !== 1 || sp.cash !== cashBeforePass + 2000) {
    throw new Error(`Expected +2000 on passing Start, got cash diff ${sp.cash - cashBeforePass} at pos ${sp.position}`);
  }
  // Попадание на налог (cell 4 — «Инвест-налог» $2000): деньги не списываются автоматически, выставляется PENDING_DEBT
  sp.position = 2;
  rStart.state.currentPlayerIndex = 0;
  rStart.state.phase = 'PRE_ROLL';
  const cashBeforeTax = sp.cash;
  (gm as any).moveClockwiseAndResolve(rStart, sp, 2);
  if (
    rStart.state.phase !== 'PENDING_DEBT' ||
    !rStart.state.pendingDebt ||
    rStart.state.pendingDebt.creditorId !== 'BANK' ||
    rStart.state.pendingDebt.amount !== 2000 ||
    sp.cash !== cashBeforeTax
  ) {
    throw new Error(`Expected manual PENDING_DEBT $2000 on TAX cell, got phase=${rStart.state.phase}, cash=${sp.cash}`);
  }
  gm.payPendingDebt(rStart, 'st1');
  if (sp.cash !== cashBeforeTax - 2000 || rStart.state.phase !== 'PRE_ROLL') {
    throw new Error(`Expected cash reduced by 2000 after manual payPendingDebt, got cash=${sp.cash}, phase=${rStart.state.phase}`);
  }

  // 10. Тест Портала (выбор любой клетки, напр. #39), поочерёдного Аукциона от цены +100 ($4100 для #39 за $4000), и лога сделки
  const rNew = gm.createRoom(
    { playerId: 'n1', socketId: 'sn1', name: 'N1', avatar: '🐸', color: '#dc2626', diceSkin: 'classic' },
    'classic'
  );
  gm.joinRoom(rNew.state.code, {
    playerId: 'n2',
    socketId: 'sn2',
    name: 'N2',
    avatar: '🦈',
    color: '#9333ea',
    diceSkin: 'classic',
  });
  gm.joinRoom(rNew.state.code, {
    playerId: 'n3',
    socketId: 'sn3',
    name: 'N3',
    avatar: '🍺',
    color: '#16a34a',
    diceSkin: 'classic',
  });
  gm.startGame(rNew, 'n1');
  rNew.state.currentPlayerIndex = 0;
  rNew.state.phase = 'PRE_ROLL';
  rNew.state.players[0].position = 5;
  (gm as any).moveClockwiseAndResolve(rNew, rNew.state.players[0], 2); // клетка 7 = PORTAL
  if (
    rNew.state.phase !== 'PORTAL' ||
    !rNew.state.portal ||
    rNew.state.portal.candidateCells.length !== 3 ||
    rNew.state.portal.candidateCells.includes(7) ||
    rNew.state.portal.candidateCells.includes(30)
  ) {
    throw new Error(`Expected PORTAL with 3 random cells (excluding 7 and 30), got ${JSON.stringify(rNew.state.portal)}`);
  }
  const cashBeforeExtraPortal = rNew.state.players[0].cash;
  gm.buyPortalDirection(rNew, 'n1');
  if (
    rNew.state.portal.candidateCells.length !== 4 ||
    rNew.state.players[0].cash !== cashBeforeExtraPortal - 500
  ) {
    throw new Error(`Expected +1 random portal cell for $500, got len=${rNew.state.portal.candidateCells.length}`);
  }
  const chosenPortalCell = rNew.state.portal.candidateCells[2];
  gm.activatePortal(rNew, 'n1', chosenPortalCell);
  if (rNew.state.players[0].position !== chosenPortalCell) {
    throw new Error(`Expected player teleported to chosen candidate ${chosenPortalCell}, got pos=${rNew.state.players[0].position}`);
  }

  // Переходим к тесту поочерёдного Аукциона на клетке #39 (цена 4000 -> старт 4100)
  rNew.state.currentPlayerIndex = 0;
  rNew.state.players[0].position = 39;
  rNew.state.cells[39].ownerId = null;
  rNew.state.phase = 'BUY_DECISION';
  gm.declineProperty(rNew, 'n1');
  const auc = rNew.state.auction;
  if (
    rNew.state.phase !== 'AUCTION' ||
    !auc ||
    auc.currentBid !== 4000 ||
    auc.currentBidderId !== 'n2'
  ) {
    throw new Error(`Expected AUCTION for cell 39 starting at 4000 (min bid 4100) with turn=n2, got ${JSON.stringify(auc)}`);
  }
  // Вне очереди n3 не может ставить
  gm.placeAuctionBid(rNew, 'n3', 100);
  if (rNew.state.auction?.currentBid !== 4000 || rNew.state.auction?.highestBidderId !== null) {
    throw new Error('Out-of-turn auction bid should be ignored!');
  }
  // В свою очередь n2 ставит +100 -> 4100, очередь переходит к n3
  gm.placeAuctionBid(rNew, 'n2', 100);
  if (rNew.state.auction?.currentBid !== 4100 || rNew.state.auction?.currentBidderId !== 'n3') {
    throw new Error(`Expected bid 4100 and turn=n3, got ${JSON.stringify(rNew.state.auction)}`);
  }
  gm.passAuction(rNew, 'n3');
  if (rNew.state.auction?.currentBidderId !== 'n1') {
    throw new Error(`Expected turn=n1 after n3 pass, got ${rNew.state.auction?.currentBidderId}`);
  }
  gm.passAuction(rNew, 'n1');
  if (rNew.state.cells[39].ownerId !== 'n2' || rNew.state.players[1].cash !== 15000 - 4100) {
    throw new Error(`Expected n2 to win cell 39 for 4100, owner=${rNew.state.cells[39].ownerId}, cash=${rNew.state.players[1].cash}`);
  }

  // 11. Тест секретных смешных уведомлений договоров
  rNew.state.cells[1].ownerId = 'n1';
  rNew.state.cells[3].ownerId = 'n2';
  rNew.state.currentPlayerIndex = 0;
  rNew.state.phase = 'PRE_ROLL';
  const tradeOffer = gm.proposeTrade(
    rNew,
    'n1',
    'n2',
    { cash: 1200, propertyIds: [1], shields: 0 },
    { cash: 1000, propertyIds: [3], shields: 0 }
  );
  if (!tradeOffer.ok) throw new Error('Trade propose failed: ' + tradeOffer.error);
  const proposeTradeLog = [...rNew.state.logs].reverse().find((l) => l.type === 'TRADE');
  if (!proposeTradeLog) throw new Error('Expected TRADE log on proposeTrade');
  if (
    proposeTradeLog.text.includes('1 200') ||
    proposeTradeLog.text.includes('1200') ||
    proposeTradeLog.text.includes('1.200') ||
    proposeTradeLog.text.includes('Шаурма') ||
    proposeTradeLog.text.includes('Донер') ||
    proposeTradeLog.text.includes('Майнинг')
  ) {
    throw new Error(`Expected NO trade details/amounts in propose log, got: ${proposeTradeLog.text}`);
  }
  const hasMemeProposal = [
    'мирный договор',
    'мутный договорняк',
    'за гаражами',
    'секретную темку',
    'порешать вопросики',
    'договор',
  ].some((kw) => proposeTradeLog.text.toLowerCase().includes(kw));
  if (!hasMemeProposal) {
    throw new Error(`Expected funny meme notification in trade proposal log, got: ${proposeTradeLog.text}`);
  }

  gm.respondTrade(rNew, 'n2', true);
  const acceptTradeLog = [...rNew.state.logs].reverse().find((l) => l.type === 'TRADE');
  if (!acceptTradeLog) throw new Error('Expected TRADE log on respondTrade');
  if (
    (!acceptTradeLog.text.includes('1 200') && !acceptTradeLog.text.includes('1.200') && !acceptTradeLog.text.includes('1200')) ||
    (!acceptTradeLog.text.includes('1 000') && !acceptTradeLog.text.includes('1.000') && !acceptTradeLog.text.includes('1000')) ||
    !acceptTradeLog.text.includes('Шаурма') ||
    !acceptTradeLog.text.includes('Чебуречная')
  ) {
    throw new Error(`Expected exact exchanged assets & cash in accept trade log, got: ${acceptTradeLog.text}`);
  }

  // 11b. Тест голосования за кик (цель не голосует) и takenAtRound кредита
  const rKick = gm.createRoom(
    { playerId: 'k1', socketId: 'sk1', name: 'KickHost', avatar: '🦈', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rKick, 'k1');
  gm.addBot(rKick, 'k1');
  gm.startGame(rKick, 'k1');
  const kPlayers = rKick.state.players;
  if (kPlayers.length < 3) throw new Error('Expected 3 players for kick vote test');
  rKick.state.round = 4;
  rKick.state.currentPlayerIndex = 0;
  const creditRes = gm.takeCredit(rKick, 'k1');
  if (!creditRes.ok || kPlayers[0].credit?.takenAtRound !== 4) {
    throw new Error(`Expected takeCredit to record takenAtRound=4, got ${JSON.stringify(kPlayers[0].credit)}`);
  }

  const targetId = kPlayers[1].id;
  const thirdVoterId = kPlayers[2].id;
  const startVoteRes = gm.startKickVote(rKick, 'k1', targetId);
  if (!startVoteRes.ok || !rKick.state.activeKickVote) {
    throw new Error(`Expected startKickVote to succeed: ${startVoteRes.error}`);
  }
  const targetVoteAttempt = gm.castKickVote(rKick, targetId, false);
  if (targetVoteAttempt.ok) {
    throw new Error('Expected target player of kick vote to be blocked from voting');
  }
  const thirdVoteAttempt = gm.castKickVote(rKick, thirdVoterId, true);
  if (!thirdVoteAttempt.ok) {
    throw new Error(`Expected 3rd player vote to succeed: ${thirdVoteAttempt.error}`);
  }
  if (!kPlayers[1].isBankrupt || rKick.state.activeKickVote !== null) {
    throw new Error('Expected majority kick vote to bankrupt/remove target player and close vote');
  }

  // 11c. Тест переподключения к активной игре (по playerId, по нику и к отключённому слоту)
  const rReconn = gm.createRoom(
    { playerId: 'rc_host', socketId: 'src1', name: 'МаксимТест', avatar: '😎', color: '#dc2626', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rReconn, 'rc_host');
  gm.startGame(rReconn, 'rc_host');
  rReconn.state.players[0].isConnected = false;
  const pubBeforeReconn = gm.getPublicRooms().find((r) => r.code === rReconn.state.code);
  if (!pubBeforeReconn || !pubBeforeReconn.hasDisconnectedHumans || !pubBeforeReconn.playerNames?.includes('МаксимТест')) {
    throw new Error(`Expected getPublicRooms to report disconnected human slot, got: ${JSON.stringify(pubBeforeReconn)}`);
  }
  const reconnByName = gm.joinRoom(rReconn.state.code, {
    playerId: 'rc_other_tab',
    socketId: 'src2',
    name: 'МаксимТест',
    avatar: '🐸',
    color: '#10b981',
    diceSkin: 'classic',
  });
  if (!reconnByName.ok || reconnByName.playerId !== 'rc_host' || !rReconn.state.players[0].isConnected) {
    throw new Error(`Expected reconnect by nickname to restore rc_host, got: ${JSON.stringify({ ok: reconnByName.ok, playerId: reconnByName.playerId })}`);
  }
  rReconn.state.players[0].isConnected = false;
  const reconnBySlot = gm.joinRoom(rReconn.state.code, {
    playerId: 'rc_fresh_browser',
    socketId: 'src3',
    name: 'ДругоеИмя',
    avatar: '👽',
    color: '#2563eb',
    diceSkin: 'classic',
  });
  if (!reconnBySlot.ok || reconnBySlot.playerId !== 'rc_host' || !rReconn.state.players[0].isConnected) {
    throw new Error(`Expected reconnect to disconnected human slot, got: ${JSON.stringify({ ok: reconnBySlot.ok, playerId: reconnBySlot.playerId })}`);
  }

  // 12. Тест двухэтапного Шанса (фаза 'CHANCE' -> показ плашки с effectLabel -> acknowledgeChance -> применение эффекта)
  const rChance = gm.createRoom(
    { playerId: 'ch1', socketId: 'sch1', name: 'Chance1', avatar: '🐸', color: '#dc2626', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rChance, 'ch1');
  gm.startGame(rChance, 'ch1');
  const chP = rChance.state.players[0];
  chP.position = 0;
  chP.cash = 15000;
  rChance.state.currentPlayerIndex = 0;
  rChance.state.phase = 'PRE_ROLL';
  (gm as any).moveClockwiseAndResolve(rChance, chP, 2);
  if (chP.position !== 2) {
    throw new Error(`Expected token on Chance cell #2, got pos=${chP.position}`);
  }
  if (rChance.state.phase !== 'CHANCE') {
    throw new Error(`Expected phase === 'CHANCE' before acknowledgement, got ${rChance.state.phase}`);
  }
  if (!rChance.state.lastCardPopup || !rChance.state.lastCardPopup.effectLabel) {
    throw new Error('Expected non-empty lastCardPopup.effectLabel during CHANCE phase');
  }
  if (chP.cash !== 15000) {
    throw new Error(`Expected cash unchanged ($15000) before acknowledgeChance, got ${chP.cash}`);
  }
  gm.acknowledgeChance(rChance, 'ch1');
  if (rChance.state.phase === 'CHANCE') {
    throw new Error('Expected phase to advance after acknowledgeChance');
  }

  // 13. Тест разрешения >1 филиала за ход в speed режиме
  const rSpeed = gm.createRoom(
    { playerId: 'sp1', socketId: 'ssp1', name: 'SP1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'speed'
  );
  gm.addBot(rSpeed, 'sp1');
  gm.startGame(rSpeed, 'sp1');
  rSpeed.state.currentPlayerIndex = 0;
  rSpeed.state.phase = 'PRE_ROLL';
  rSpeed.state.players[0].cash = 50000;
  rSpeed.state.cells[1].ownerId = 'sp1';
  rSpeed.state.cells[3].ownerId = 'sp1';
  rSpeed.state.builtGroupsThisTurn = ['food'];
  const speedBuildRes = canBuildBranch(rSpeed.state, 'sp1', 1);
  if (!speedBuildRes.ok) {
    throw new Error(`Expected canBuildBranch to allow >1 branch in speed mode, got: ${speedBuildRes.reason}`);
  }

  // 14. Тест 3-й неудачной попытки в тюрьме при cash < 500 и последующего резолва клетки
  const rJail = gm.createRoom(
    { playerId: 'j1', socketId: 'sj1', name: 'J1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.addBot(rJail, 'j1');
  gm.startGame(rJail, 'j1');
  const jP = rJail.state.players[0];
  for (let attempt = 0; attempt < 20; attempt++) {
    jP.inJail = true;
    jP.jailTurns = 2;
    jP.cash = 100;
    jP.position = 10;
    rJail.state.currentPlayerIndex = 0;
    rJail.state.phase = 'PRE_ROLL';
    rJail.state.pendingDebt = null;
    (rJail as any).postDebtLandingCellId = null;
    gm.rollDice(rJail, 'j1');
    if (rJail.state.phase === 'PENDING_DEBT') {
      break;
    }
  }
  if (rJail.state.phase !== 'PENDING_DEBT' || !rJail.state.pendingDebt) {
    throw new Error(`Expected PENDING_DEBT on 3rd jail fail with cash < 500, got phase=${rJail.state.phase}`);
  }
  if ((rJail as any).postDebtLandingCellId === null) {
    throw new Error('Expected postDebtLandingCellId to be set for landing cell');
  }
  const targetLanding = (rJail as any).postDebtLandingCellId;
  jP.cash = 1000;
  gm.payPendingDebt(rJail, 'j1');
  if ((rJail as any).postDebtLandingCellId !== null) {
    throw new Error('Expected postDebtLandingCellId reset to null after payment');
  }
  if (jP.position !== targetLanding) {
    throw new Error(`Expected player on target landing cell ${targetLanding}, got ${jP.position}`);
  }

  // 15. Тест продления таймера хода при сделке и лимита 3 сделки за ход
  const rTradeLim = gm.createRoom(
    { playerId: 'tl1', socketId: 'stl1', name: 'TL1', avatar: '🐸', color: '#10b981', diceSkin: 'classic' },
    'classic'
  );
  gm.joinRoom(rTradeLim.state.code, {
    playerId: 'tl2',
    socketId: 'stl2',
    name: 'TL2',
    avatar: '🦈',
    color: '#3b82f6',
    diceSkin: 'neon',
  });
  gm.startGame(rTradeLim, 'tl1');
  rTradeLim.state.currentPlayerIndex = 0;
  rTradeLim.state.phase = 'POST_ROLL';
  rTradeLim.state.players[0].cash = 5000;
  rTradeLim.state.players[1].cash = 5000;
  rTradeLim.state.cells[1].ownerId = 'tl1';
  rTradeLim.state.cells[3].ownerId = 'tl2';

  const d0 = rTradeLim.state.turnDeadlineAt!;
  gm.extendTurnForTradeDraft(rTradeLim, 'tl1');
  if (rTradeLim.state.turnDeadlineAt! !== d0 + 20000) {
    throw new Error(`Expected extendTurnForTradeDraft to add +20000ms, got ${rTradeLim.state.turnDeadlineAt! - d0}`);
  }
  gm.extendTurnForTradeDraft(rTradeLim, 'tl1');
  gm.extendTurnForTradeDraft(rTradeLim, 'tl1');
  const dAfter3Drafts = rTradeLim.state.turnDeadlineAt!;
  gm.extendTurnForTradeDraft(rTradeLim, 'tl1');
  if (rTradeLim.state.turnDeadlineAt! !== dAfter3Drafts) {
    throw new Error('Expected extendTurnForTradeDraft to stop extending after 3 times per turn');
  }

  for (let i = 1; i <= 3; i++) {
    const beforeSendDeadline = rTradeLim.state.turnDeadlineAt!;
    const propRes = gm.proposeTrade(
      rTradeLim,
      'tl1',
      'tl2',
      { cash: 0, propertyIds: [1], shields: 0 },
      { cash: 0, propertyIds: [3], shields: 0 }
    );
    if (!propRes.ok) {
      throw new Error(`Expected trade proposal #${i} to succeed, got: ${propRes.error}`);
    }
    if (rTradeLim.state.tradesProposedThisTurn !== i) {
      throw new Error(`Expected tradesProposedThisTurn=${i}, got ${rTradeLim.state.tradesProposedThisTurn}`);
    }
    if (rTradeLim.state.turnDeadlineAt! < beforeSendDeadline + 25000) {
      throw new Error('Expected proposeTrade to extend turnDeadlineAt by at least +25000ms');
    }
    // Пока висит активная сделка, tickTimers не должен авто-завершать ход игрока
    const prevIdx = rTradeLim.state.currentPlayerIndex;
    const savedDeadline = rTradeLim.state.turnDeadlineAt!;
    rTradeLim.state.turnDeadlineAt = Date.now() - 1000;
    gm.tickTimers(Date.now());
    if (rTradeLim.state.currentPlayerIndex !== prevIdx) {
      throw new Error('Expected tickTimers not to expire turn while activeTrade is pending');
    }
    rTradeLim.state.turnDeadlineAt = savedDeadline;

    gm.respondTrade(rTradeLim, 'tl2', false);
  }

  const prop4Res = gm.proposeTrade(
    rTradeLim,
    'tl1',
    'tl2',
    { cash: 0, propertyIds: [1], shields: 0 },
    { cash: 0, propertyIds: [3], shields: 0 }
  );
  if (prop4Res.ok) {
    throw new Error('Expected 4th proposeTrade in the same turn to be rejected');
  }

  gm.endTurn(rTradeLim, 'tl1');
  if ((rTradeLim.state.tradesProposedThisTurn ?? 0) !== 0) {
    throw new Error(`Expected tradesProposedThisTurn reset to 0 on next turn, got ${rTradeLim.state.tradesProposedThisTurn}`);
  }

  return 'ENGINE_ALL_MODES_OK';
}

async function main() {
  const engineStatus = testEngineMechanics();
  console.log('[QA] Engine unit tests:', engineStatus);

  const tsxCli = path.join(PROJECT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverProc = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: PROJECT_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });

  const userDataDir = fs.mkdtempSync(path.join(PROJECT_DIR, '.tmp-chrome-qa-'));
  let chromeProc: ReturnType<typeof spawn> | null = null;
  let chromeErr = '';

  try {
    let serverUp = false;
    for (let i = 0; i < 25; i++) {
      try {
        await fetchJson(`http://127.0.0.1:${PORT}/api/rooms`);
        serverUp = true;
        break;
      } catch {
        await sleep(300);
      }
    }
    if (!serverUp) throw new Error('Server did not start on port ' + PORT);

    // Проверка API регистрации, авторизации, смены ника, кастомной аватарки и профиля
    const apiBase = `http://127.0.0.1:${PORT}`;
    const testEmail = `qa_api_${Date.now()}@example.com`;
    const fakeDataAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const regResp = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'secret123',
        nickname: 'QA_Олигарх',
        avatar: fakeDataAvatar,
        color: '#2563eb',
        diceSkin: 'gold',
      }),
    });
    const regJson = (await regResp.json()) as any;
    if (!regResp.ok || !regJson.ok || !regJson.token || !regJson.account?.playerId) {
      throw new Error(`Expected /api/auth/register to succeed, got: ${JSON.stringify(regJson)}`);
    }
    const authToken = regJson.token as string;
    const regPlayerId = regJson.account.playerId as string;

    const meResp = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meJson = (await meResp.json()) as any;
    if (!meResp.ok || !meJson.ok || meJson.account.playerId !== regPlayerId) {
      throw new Error(`Expected /api/auth/me to match registered account, got: ${JSON.stringify(meJson)}`);
    }

    const unauthPutResp = await fetch(`${apiBase}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: regPlayerId, nickname: 'Хакер' }),
    });
    if (unauthPutResp.status !== 401) {
      throw new Error(`Expected unauthenticated PUT /api/profile for registered player to return 401, got ${unauthPutResp.status}`);
    }

    const updResp = await fetch(`${apiBase}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ nickname: 'QA_Король', avatar: fakeDataAvatar }),
    });
    const updJson = (await updResp.json()) as any;
    if (!updResp.ok || !updJson.ok || updJson.profile.nickname !== 'QA_Король') {
      throw new Error(`Expected PUT /api/profile to update nickname, got: ${JSON.stringify(updJson)}`);
    }

    const profResp = await fetch(`${apiBase}/api/profile/${encodeURIComponent(regPlayerId)}`);
    const profJson = (await profResp.json()) as any;
    if (
      !profResp.ok ||
      profJson.profile?.nickname !== 'QA_Король' ||
      profJson.profile?.avatar !== fakeDataAvatar ||
      !profJson.profile?.isRegistered
    ) {
      throw new Error(`Expected GET /api/profile/:id to return updated profile, got: ${JSON.stringify(profJson)}`);
    }

    const badLoginResp = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'wrong' }),
    });
    if (badLoginResp.status !== 401) {
      throw new Error(`Expected bad password login to return 401, got ${badLoginResp.status}`);
    }

    const goodLoginResp = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'secret123' }),
    });
    const goodLoginJson = (await goodLoginResp.json()) as any;
    if (!goodLoginResp.ok || !goodLoginJson.ok || goodLoginJson.account?.profile?.nickname !== 'QA_Король') {
      throw new Error(`Expected valid login to restore nickname & profile, got: ${JSON.stringify(goodLoginJson)}`);
    }
    console.log('[QA] Auth & Profile API checks: PASS');

    // Проверка доступности и размера всех 8 голосовых .wav файлов по HTTP
    const voiceWavFiles = [
      '/sounds/taunt_loh.wav',
      '/sounds/taunt_loh_clean.wav',
      '/sounds/taunt_rent_rage.wav',
      '/sounds/taunt_rent_rage_clean.wav',
      '/sounds/taunt_fiasco.wav',
      '/sounds/taunt_govno.wav',
      '/sounds/taunt_govno_clean.wav',
      '/sounds/taunt_press_f.wav',
    ];
    for (const wavPath of voiceWavFiles) {
      const audioRes = await checkAudioHttp(`http://127.0.0.1:${PORT}${wavPath}`);
      console.log(`[QA] Audio file check ${wavPath}: status=${audioRes.status}, size=${audioRes.length} bytes, type=${audioRes.contentType}`);
      if (audioRes.status !== 200) {
        throw new Error(`Expected HTTP 200 for ${wavPath}, got ${audioRes.status}`);
      }
      if (audioRes.length < 10000) {
        throw new Error(`Expected size >= 10000 bytes for ${wavPath}, got ${audioRes.length}`);
      }
    }

    chromeProc = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        `--user-data-dir=${userDataDir}`,
        `--remote-debugging-address=127.0.0.1`,
        `--remote-debugging-port=${CDP_PORT}`,
        '--window-size=1440,900',
        `http://127.0.0.1:${PORT}`,
      ],
      { stdio: 'pipe' }
    );
    chromeProc.stderr?.on('data', (d) => {
      chromeErr += String(d);
    });

    let targetPage: { webSocketDebuggerUrl: string; url: string } | undefined;
    for (let i = 0; i < 35; i++) {
      try {
        const list = await fetchJson<Array<{ type: string; url: string; webSocketDebuggerUrl: string }>>(
          `http://127.0.0.1:${CDP_PORT}/json/list`
        );
        targetPage = list.find((t) => t.type === 'page');
        if (targetPage) break;
      } catch {
        // wait
      }
      await sleep(300);
    }
    if (!targetPage) {
      throw new Error('Chrome CDP page target not found. Chrome stderr: ' + chromeErr.slice(0, 600));
    }

    const cdp = new CDPClient(targetPage.webSocketDebuggerUrl);
    await cdp.connect();
    if (!targetPage.url.includes(String(PORT))) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}` });
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(1200);

    const lobbyCheck = await cdp.eval(`(() => ({
      title: document.title,
      hasCreateBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('СОЗДАТЬ КОМНАТУ')),
      colorButtonsCount: document.querySelectorAll('[data-testid="home-color-picker"] button').length,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth
    }))()`);
    console.log('[QA] Lobby check:', JSON.stringify(lobbyCheck));
    if (!lobbyCheck.hasCreateBtn) throw new Error('Create Room button missing in Lobby');
    if (lobbyCheck.colorButtonsCount !== 5) {
      throw new Error(`Expected 5 color picker buttons on Home, got ${lobbyCheck.colorButtonsCount}`);
    }
    if (lobbyCheck.scrollW > lobbyCheck.innerW) {
      throw new Error(`Horizontal scroll in Lobby: ${lobbyCheck.scrollW} > ${lobbyCheck.innerW}`);
    }

    // Проверка мобильного лобби 390x844
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(300);
    const mobileLobbyCheck = await cdp.eval(`(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      colorButtonsCount: document.querySelectorAll('[data-testid="home-color-picker"] button').length,
    }))()`);
    console.log('[QA] Mobile 390x844 Lobby check:', JSON.stringify(mobileLobbyCheck));
    if (mobileLobbyCheck.scrollW > mobileLobbyCheck.innerW || mobileLobbyCheck.colorButtonsCount !== 5) {
      throw new Error(`Mobile lobby check failed: ${JSON.stringify(mobileLobbyCheck)}`);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);

    // E2E проверка окна профиля, конструктора аватарки, регистрации и смены ника в UI
    await cdp.eval(`(() => {
      const btn = document.querySelector('[data-testid="open-profile-btn"]');
      if (btn) btn.click();
    })()`);
    await sleep(350);
    const profileModalOpen = await cdp.eval(`(() => ({
      hasModal: !!document.querySelector('[data-testid="profile-modal"]'),
      statCardsCount: document.querySelectorAll('[data-testid="profile-stats-grid"] > div').length,
      hasEmailInput: !!document.querySelector('[data-testid="auth-email-input"]'),
    }))()`);
    console.log('[QA] Profile modal check:', JSON.stringify(profileModalOpen));
    if (!profileModalOpen.hasModal || profileModalOpen.statCardsCount !== 8 || !profileModalOpen.hasEmailInput) {
      throw new Error(`Profile modal UI check failed: ${JSON.stringify(profileModalOpen)}`);
    }

    // Открыть студию кастомной аватарки и сохранить сгенерированную аватарку
    await cdp.eval(`(() => {
      const btn = document.querySelector('[data-testid="open-avatar-creator-btn"]');
      if (btn) btn.click();
    })()`);
    await sleep(300);
    const avatarCreatorCheck = await cdp.eval(`(() => {
      const canvas = document.querySelector('[data-testid="avatar-creator-canvas"]');
      const rect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        hasModal: !!document.querySelector('[data-testid="avatar-creator-modal"]'),
        canvasW: Math.round(rect.width),
        canvasH: Math.round(rect.height),
      };
    })()`);
    console.log('[QA] Avatar creator modal check:', JSON.stringify(avatarCreatorCheck));
    if (!avatarCreatorCheck.hasModal || avatarCreatorCheck.canvasW <= 0 || avatarCreatorCheck.canvasH <= 0) {
      throw new Error(`Avatar creator modal check failed: ${JSON.stringify(avatarCreatorCheck)}`);
    }
    await cdp.eval(`(() => {
      const saveBtn = document.querySelector('[data-testid="avatar-save-btn"]');
      if (saveBtn) saveBtn.click();
    })()`);
    await sleep(300);
    const customAvatarSaved = await cdp.eval(`(() => {
      const av = localStorage.getItem('mm_avatar') || '';
      const imgCount = document.querySelectorAll('[data-testid="profile-modal"] img').length;
      return { startsWithDataImage: av.startsWith('data:image/'), imgCount };
    })()`);
    console.log('[QA] Custom avatar saved check:', JSON.stringify(customAvatarSaved));
    if (!customAvatarSaved.startsWithDataImage || customAvatarSaved.imgCount < 1) {
      throw new Error(`Expected custom canvas avatar to be saved and rendered as <img>: ${JSON.stringify(customAvatarSaved)}`);
    }

    // Смена ника и регистрация по почте и паролю через UI
    const uiEmail = `qa_ui_${Date.now()}@example.com`;
    await cdp.eval(`(() => {
      const setNative = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const nickInput = document.querySelector('[data-testid="profile-nickname-input"]');
      if (nickInput) setNative(nickInput, 'МемныйБосс');
      const saveNickBtn = document.querySelector('[data-testid="profile-save-nick-btn"]');
      if (saveNickBtn) saveNickBtn.click();
    })()`);
    await sleep(250);
    await cdp.eval(`(() => {
      const setNative = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const emailEl = document.querySelector('[data-testid="auth-email-input"]');
      const passEl = document.querySelector('[data-testid="auth-password-input"]');
      if (emailEl) setNative(emailEl, ${JSON.stringify(uiEmail)});
      if (passEl) setNative(passEl, 'pass1234');
      const submitBtn = document.querySelector('[data-testid="auth-submit-btn"]');
      if (submitBtn) submitBtn.click();
    })()`);
    await sleep(500);
    const uiAuthCheck = await cdp.eval(`(() => ({
      hasLogoutBtn: !!document.querySelector('[data-testid="auth-logout-btn"]'),
      hasToken: Boolean(localStorage.getItem('mm_auth_token')),
      savedNick: localStorage.getItem('mm_name'),
    }))()`);
    console.log('[QA] UI registration & nickname check:', JSON.stringify(uiAuthCheck));
    if (!uiAuthCheck.hasLogoutBtn || !uiAuthCheck.hasToken || uiAuthCheck.savedNick !== 'МемныйБосс') {
      throw new Error(`UI registration/nickname check failed: ${JSON.stringify(uiAuthCheck)}`);
    }

    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('[data-testid="profile-close-btn"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(250);

    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('СОЗДАТЬ КОМНАТУ'));
      btn.click();
    })()`);
    await sleep(600);

    await cdp.eval(`(() => {
      const botBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Добавить мем-бота'));
      if (botBtn) botBtn.click();
    })()`);
    await sleep(350);
    await cdp.eval(`(() => {
      const botBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Добавить мем-бота'));
      if (botBtn) botBtn.click();
    })()`);
    await sleep(400);

    await cdp.eval(`(() => {
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ЗАПУСТИТЬ КАТКУ'));
      if (startBtn) startBtn.click();
    })()`);
    await sleep(800);

    const boardMetrics = await cdp.eval(`(() => {
      const board = document.getElementById('monopoly-board');
      const rect = board ? board.getBoundingClientRect() : { width: 0, height: 0 };
      const tokensLayer = document.getElementById('board-tokens-layer');
      const tokenEls = Array.from(document.querySelectorAll('[data-player-token]'));
      const tokenSizes = tokenEls.map(el => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      const cellArtCount = Array.from(document.querySelectorAll('[data-cell-id]')).filter(
        el => el.querySelector('svg') || el.querySelector('img')
      ).length;
      const sidebars = Array.from(document.querySelectorAll('aside')).map(a => {
        const r = a.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      const c0 = document.querySelector('[data-cell-id="0"]')?.getBoundingClientRect();
      const c20 = document.querySelector('[data-cell-id="20"]')?.getBoundingClientRect();
      return {
        boardExists: !!board,
        boardWidth: Math.round(rect.width),
        boardHeight: Math.round(rect.height),
        cellCount: board ? board.children.length : 0,
        tokensLayerExists: !!tokensLayer,
        tokenCount: tokenEls.length,
        tokenSizes,
        cellArtCount,
        sidebars,
        cell0Top: c0 ? Math.round(c0.top) : -1,
        cell20Bottom: c20 ? Math.round(c20.bottom) : 99999,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      };
    })()`);
    console.log('[QA] Desktop 1440x900 board metrics:', JSON.stringify(boardMetrics));

    if (!boardMetrics.boardExists || boardMetrics.boardHeight <= 0 || boardMetrics.boardWidth <= 0) {
      throw new Error('Monopoly board height/width is 0px!');
    }
    if (boardMetrics.cell0Top < 0 || boardMetrics.cell20Bottom > boardMetrics.innerHeight) {
      throw new Error(
        `Board clipped outside viewport vertically: cell0Top=${boardMetrics.cell0Top}, cell20Bottom=${boardMetrics.cell20Bottom}, innerHeight=${boardMetrics.innerHeight}`
      );
    }
    if (boardMetrics.cellCount !== 41) {
      throw new Error(`Expected 41 grid elements (40 cells + CenterStage), got ${boardMetrics.cellCount}`);
    }
    if (!boardMetrics.tokensLayerExists || boardMetrics.tokenCount < 2) {
      throw new Error(`Expected >=2 visible player tokens in #board-tokens-layer, got ${boardMetrics.tokenCount}`);
    }
    if (boardMetrics.tokenSizes.some((t: { w: number; h: number }) => t.w < 20 || t.h < 20)) {
      throw new Error(`Token size too small: ${JSON.stringify(boardMetrics.tokenSizes)}`);
    }
    if (boardMetrics.cellArtCount !== 40) {
      throw new Error(`Expected all 40 board cells to render SVG/IMG artwork, got ${boardMetrics.cellArtCount}`);
    }
    if (boardMetrics.scrollWidth > boardMetrics.innerWidth) {
      throw new Error(`Horizontal scroll detected on desktop: ${boardMetrics.scrollWidth} > ${boardMetrics.innerWidth}`);
    }
    if (boardMetrics.scrollHeight > boardMetrics.innerHeight) {
      throw new Error(`Vertical page scroll detected on desktop: ${boardMetrics.scrollHeight} > ${boardMetrics.innerHeight}`);
    }

    const shotDir = path.join(PROJECT_DIR, '.qa-shots');
    fs.mkdirSync(shotDir, { recursive: true });
    const shotPre = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(path.join(shotDir, '01_pre_roll.jpg'), Buffer.from(shotPre.data, 'base64'));

    await cdp.eval(`(() => {
      const rollBtn = Array.from(document.querySelectorAll('button')).find(b => /бросить кубики/i.test(b.textContent || ''));
      if (rollBtn) rollBtn.click();
    })()`);
    await sleep(350);
    const shotRoll = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(path.join(shotDir, '02_dice_and_glide.jpg'), Buffer.from(shotRoll.data, 'base64'));
    await sleep(900);
    const shotLand = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(path.join(shotDir, '03_post_move.jpg'), Buffer.from(shotLand.data, 'base64'));

    // Отыгрываем ~6 секунд с 2 ботами (нажимаем доступные кнопки хода человека), проверяем 1920x1080, КРЕДИТ и цветные ники
    for (let step = 0; step < 6; step++) {
      await sleep(1000);
      await cdp.eval(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const actionBtn = btns.find(b =>
          !b.disabled &&
          /БРОСИТЬ КУБИКИ|Купить за|Выставить на аукцион|Пропустить|Оплатить|Прыгнуть!|Пас/i.test(b.textContent || '')
        );
        if (actionBtn) actionBtn.click();
      })()`);
    }

    // Проверка отсутствия статистики, отсутствия отдельной кнопки Сделки, наличия Договора и Кика в карточке игрока, фильтра Договоры и отчёта кредита
    await cdp.eval(`(() => {
      const cards = document.querySelectorAll('aside .cursor-pointer');
      if (cards[1]) cards[1].click();
      else if (cards[0]) cards[0].click();
    })()`);
    await sleep(300);
    const uiMenuCheck = await cdp.eval(`(() => {
      const statsPanel = document.querySelector('[data-testid="player-stats-panel"]');
      const standaloneDealBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => /Сделка \\(обмен\\)/i.test(b.textContent || '')
      );
      const cardTradeBtn = document.querySelector('[data-testid="card-trade-btn"]');
      const cardKickBtn = document.querySelector('[data-testid="card-kick-btn"]');
      const tradeFilterBtn = document.querySelector('[data-testid="log-filter-trade"]');
      return {
        statsRemoved: !statsPanel,
        standaloneDealRemoved: !standaloneDealBtn,
        cardTradeExists: !!cardTradeBtn,
        cardKickExists: !!cardKickBtn,
        tradeFilterExists: !!tradeFilterBtn,
      };
    })()`);
    console.log('[QA] UI menu/filter check:', JSON.stringify(uiMenuCheck));
    if (
      !uiMenuCheck.statsRemoved ||
      !uiMenuCheck.standaloneDealRemoved ||
      !uiMenuCheck.cardTradeExists ||
      !uiMenuCheck.cardKickExists ||
      !uiMenuCheck.tradeFilterExists
    ) {
      throw new Error(`UI menu/filter check failed: ${JSON.stringify(uiMenuCheck)}`);
    }
    await cdp.eval(`(() => {
      const cards = document.querySelectorAll('aside .cursor-pointer');
      if (cards[1]) cards[1].click();
    })()`);
    await sleep(200);

    // Проверка открытия визуального отчёта по кредиту
    await cdp.eval(`(() => {
      const creditBtn = document.querySelector('[data-testid="sidebar-credit-report"]');
      if (creditBtn) creditBtn.click();
    })()`);
    await sleep(250);
    const creditReportExists = await cdp.eval(`(() => !!document.querySelector('[data-testid="credit-visual-report"]'))()`);
    if (!creditReportExists) {
      throw new Error('Expected [data-testid="credit-visual-report"] modal to open on sidebar credit click');
    }
    await cdp.eval(`(() => {
      const report = document.querySelector('[data-testid="credit-visual-report"]');
      const closeBtn = report?.querySelector('button');
      if (closeBtn && (closeBtn.textContent || '').includes('✕')) closeBtn.click();
    })()`);
    await sleep(200);

    // Проверка кнопок озвучки (всех 5) на Desktop (1440x900)
    const desktopVoiceBtns = await cdp.eval(`(() => {
      const ids = ['taunt-voice-loh', 'taunt-voice-rent-rage', 'taunt-voice-fiasco', 'taunt-voice-govno', 'taunt-voice-press-f'];
      const out = {};
      for (const id of ids) {
        const el = document.querySelector('[data-testid="' + id + '"]');
        out[id] = el ? Math.round(el.getBoundingClientRect().width) : 0;
      }
      return out;
    })()`);
    console.log('[QA] Desktop voice taunt buttons check:', JSON.stringify(desktopVoiceBtns));
    for (const [id, w] of Object.entries(desktopVoiceBtns)) {
      if ((w as number) <= 0) {
        throw new Error(`Desktop [data-testid="${id}"] missing or width 0: ${JSON.stringify(desktopVoiceBtns)}`);
      }
    }
    await cdp.eval(`(() => {
      const btnLoh = document.querySelector('[data-testid="taunt-voice-loh"]');
      if (btnLoh) btnLoh.click();
    })()`);
    await sleep(200);

    for (const vp of [
      { width: 1920, height: 1080, mobile: false },
      { width: 1280, height: 720, mobile: false },
      { width: 390, height: 844, mobile: true },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });
      await sleep(400);
      const vpRes = await cdp.eval(`(() => {
        const b = document.getElementById('monopoly-board');
        const r = b ? b.getBoundingClientRect() : { width: 0, height: 0 };
        const creditBtn = Array.from(document.querySelectorAll('button')).find(btn => (btn.textContent || '').includes('КРЕДИТ'));
        const creditRect = creditBtn ? creditBtn.getBoundingClientRect() : { height: 0 };
        const coloredLogNames = Array.from(document.querySelectorAll('span[style*="color"]')).length;
        const mobileStrip = document.querySelector('[data-testid="mobile-players-strip"]');
        const mobileDock = document.querySelector('[data-testid="mobile-action-dock"]');
        return {
          boardW: Math.round(r.width),
          boardH: Math.round(r.height),
          creditBtnH: Math.round(creditRect.height),
          coloredLogNames,
          mobileStripH: mobileStrip ? Math.round(mobileStrip.getBoundingClientRect().height) : 0,
          mobileDockH: mobileDock ? Math.round(mobileDock.getBoundingClientRect().height) : 0,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      })()`);
      console.log(`[QA] Viewport ${vp.width}x${vp.height}:`, JSON.stringify(vpRes));
      if (vpRes.boardH <= 0 || vpRes.scrollW > vpRes.innerW) {
        throw new Error(`Viewport ${vp.width}x${vp.height} failed layout check: ${JSON.stringify(vpRes)}`);
      }
      if (vp.width === 390) {
        if (vpRes.boardW < 300 || vpRes.boardH < 300) {
          throw new Error(`Expected enlarged mobile board >= 300px at 390x844, got ${vpRes.boardW}x${vpRes.boardH}`);
        }
        if (vpRes.mobileStripH <= 0 || vpRes.mobileDockH <= 0) {
          throw new Error(`Expected mobile strip & action dock visible at 390x844, got ${JSON.stringify(vpRes)}`);
        }

        // Проверка мобильных кнопок озвучки
        const mobileVoiceBtns = await cdp.eval(`(() => {
          const btnLoh = document.querySelector('[data-testid="mobile-taunt-loh"]');
          const btnRage = document.querySelector('[data-testid="mobile-taunt-rent-rage"]');
          return {
            lohExists: !!btnLoh,
            lohWidth: btnLoh ? Math.round(btnLoh.getBoundingClientRect().width) : 0,
            rageExists: !!btnRage,
            rageWidth: btnRage ? Math.round(btnRage.getBoundingClientRect().width) : 0,
          };
        })()`);
        console.log('[QA] Mobile voice taunt buttons check:', JSON.stringify(mobileVoiceBtns));
        if (!mobileVoiceBtns.lohExists || mobileVoiceBtns.lohWidth <= 0) {
          throw new Error(`Mobile [data-testid="mobile-taunt-loh"] missing or width 0: ${JSON.stringify(mobileVoiceBtns)}`);
        }
        if (!mobileVoiceBtns.rageExists || mobileVoiceBtns.rageWidth <= 0) {
          throw new Error(`Mobile [data-testid="mobile-taunt-rent-rage"] missing or width 0: ${JSON.stringify(mobileVoiceBtns)}`);
        }
        await cdp.eval(`(() => {
          const btnRage = document.querySelector('[data-testid="mobile-taunt-rent-rage"]');
          if (btnRage) btnRage.click();
        })()`);
        await sleep(200);

        const shotMobile = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
        fs.writeFileSync(path.join(shotDir, '05_mobile_390x844.jpg'), Buffer.from(shotMobile.data, 'base64'));
      }
      if (vp.width === 1920) {
        if (vpRes.boardW < 950) {
          throw new Error(`Expected enlarged board >= 950px at 1920x1080, got ${vpRes.boardW}`);
        }
        if (vpRes.creditBtnH < 40) {
          throw new Error(`Expected enlarged Credit button >= 40px high, got ${vpRes.creditBtnH}`);
        }
        if (vpRes.coloredLogNames < 2) {
          throw new Error(`Expected colored player nickname spans in log, got ${vpRes.coloredLogNames}`);
        }
        const shot1080 = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
        fs.writeFileSync(path.join(shotDir, '04_after_turns_1080p.jpg'), Buffer.from(shot1080.data, 'base64'));
      }
    }

    // Возврат на 1440x900 и E2E проверка переподключения к активной игре из Лобби
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);
    await cdp.eval(`(() => {
      const leaveBtn = document.querySelector('[data-testid="board-leave-btn"]');
      if (leaveBtn) leaveBtn.click();
    })()`);
    await sleep(500);
    const reconnUiCheck = await cdp.eval(`(() => {
      const banner = document.querySelector('[data-testid="reconnect-active-banner"]');
      const roomBtn = document.querySelector('[data-testid="reconnect-room-btn"]');
      return {
        inLobby: !document.getElementById('monopoly-board'),
        hasBanner: !!banner,
        hasRoomReconnectBtn: !!roomBtn,
      };
    })()`);
    console.log('[QA] Lobby reconnect UI check:', JSON.stringify(reconnUiCheck));
    if (!reconnUiCheck.inLobby || !reconnUiCheck.hasBanner || !reconnUiCheck.hasRoomReconnectBtn) {
      throw new Error(`Lobby reconnect UI check failed: ${JSON.stringify(reconnUiCheck)}`);
    }
    await cdp.eval(`(() => {
      const roomBtn = document.querySelector('[data-testid="reconnect-room-btn"]');
      if (roomBtn) roomBtn.click();
    })()`);
    await sleep(600);
    const reconnectedToBoard = await cdp.eval(`(() => !!document.getElementById('monopoly-board'))()`);
    console.log('[QA] Reconnected back to board:', reconnectedToBoard);
    if (!reconnectedToBoard) {
      throw new Error('Expected clicking [data-testid="reconnect-room-btn"] to return to #monopoly-board');
    }

    if (cdp.consoleErrors.length > 0 || cdp.pageErrors.length > 0) {
      throw new Error(
        `Console/Page errors detected: ${JSON.stringify({
          consoleErrors: cdp.consoleErrors,
          pageErrors: cdp.pageErrors,
        })}`
      );
    }

    cdp.close();
    console.log('QA_STATUS: PASS');
  } finally {
    if (chromeProc) chromeProc.kill();
    serverProc.kill();
    await sleep(300);
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('QA_STATUS: FAIL', err);
  process.exit(1);
});
