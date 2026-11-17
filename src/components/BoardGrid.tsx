import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BOARD_CELLS,
  getCellGridPosition,
  INDUSTRIES,
  isBuyableCell,
} from '../../shared/boardData.ts';
import {
  calculateDisplayRent,
  canBuildBranch,
  canMortgageCell,
  canSellBranch,
  canUnmortgageCell,
  getMortgageValue,
  getTokenWalkDurationMs,
  getUnmortgageCost,
  txt,
} from '../../shared/rules.ts';
import { BoardCellDef, RoomState, TradeSide } from '../../shared/types.ts';
import { useCockpitMode } from '../hooks/useCockpitMode.ts';
import { soundEngine } from '../utils/soundEngine.ts';
import { AppleEmoji } from './AppleEmoji.tsx';
import { BoardTokensLayer } from './BoardTokensLayer.tsx';
import { CellArtwork } from './CellArtwork.tsx';
import { CenterStage, TradeDraftState } from './CenterStage.tsx';

const formatDollar = (value: number): string =>
  value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');

function getCategoryBadge(
  groupId?: string,
  cellType?: BoardCellDef['type']
): { icon: string; label: string } {
  switch (groupId) {
    case 'food':
      return { icon: '🌯', label: 'Дешманский хавчик' };
    case 'clothes':
      return { icon: '🧥', label: 'Скам и паль' };
    case 'cars':
      return { icon: '🚗', label: 'Транспортные активы' };
    case 'scam':
      return { icon: '📣', label: 'Инфоцыгане и прогрев' };
    case 'booze':
      return { icon: '💨', label: 'Тяжёлый дофамин' };
    case 'delivery':
      return { icon: '📦', label: 'Рабский труд' };
    case 'gaming':
      return { icon: '🧠', label: 'Брейнрот и задроты' };
    case 'it':
      return { icon: '🔒', label: 'Цифровой концлагерь' };
    case 'realty':
      return { icon: '🪳', label: 'Убитая недвижка' };
    case 'gadgets':
      return { icon: '⛓️', label: 'Тяжёлый люкс в долг' };
    default:
      if (cellType === 'CAR') return { icon: '🚗', label: 'Транспортные активы' };
      if (cellType === 'IT_UTILITY') return { icon: '🔒', label: 'Цифровой концлагерь' };
      return { icon: '🏷️', label: 'Отрасль' };
  }
}

const MiniDicePair: React.FC = () => (
  <svg
    width="28"
    height="16"
    viewBox="0 0 28 16"
    fill="none"
    aria-hidden="true"
    className="inline-block shrink-0"
  >
    <g transform="translate(7, 8) rotate(-12)">
      <rect x="-5.5" y="-5.5" width="11" height="11" rx="2.2" fill="#f4f4f5" />
      <circle cx="-2.4" cy="-2.4" r="1.05" fill="#18181b" />
      <circle cx="0" cy="0" r="1.05" fill="#18181b" />
      <circle cx="2.4" cy="2.4" r="1.05" fill="#18181b" />
    </g>
    <g transform="translate(20, 8) rotate(10)">
      <rect x="-5.5" y="-5.5" width="11" height="11" rx="2.2" fill="#e4e4e7" />
      <circle cx="-2.4" cy="-2.4" r="1.05" fill="#18181b" />
      <circle cx="2.4" cy="-2.4" r="1.05" fill="#18181b" />
      <circle cx="0" cy="0" r="1.05" fill="#18181b" />
      <circle cx="-2.4" cy="2.4" r="1.05" fill="#18181b" />
      <circle cx="2.4" cy="2.4" r="1.05" fill="#18181b" />
    </g>
  </svg>
);

function getSpecialPopoverMeta(
  def: BoardCellDef,
  censored: boolean,
  retro: boolean,
  russianRoulette?: boolean
): { headerHex: string; title: string; subtitle: string; description: string } {
  if (retro) {
    if (def.type === 'JACKPOT') {
      return {
        headerHex: '#b45309',
        title: 'Парк отдыха',
        subtitle: 'Зона отдыха',
        description: 'Спокойная остановка без штрафов и ловушек.',
      };
    }
    if (def.type === 'PORTAL') {
      return {
        headerHex: '#0284c7',
        title: 'Бонус +$1 500',
        subtitle: 'Особое поле',
        description: 'Попав на это поле, вы получаете +$1 500.',
      };
    }
    if (def.type === 'CHANCE') {
      const isBon = def.id === 2 || def.id === 22;
      return {
        headerHex: '#65a30d',
        title: isBon ? 'Бонус +$1 000' : 'Штраф -$1 000',
        subtitle: 'Ретро-событие',
        description: isBon
          ? 'Вы получаете +$1 000 из банка.'
          : 'Вы платите $1 000 в банк.',
      };
    }
  }

  const title = txt(def.name, def.cleanName, censored);
  const description = txt(def.description || def.subtitle, def.cleanDescription || def.cleanSubtitle, censored);

  switch (def.type) {
    case 'START':
      return { headerHex: '#E5B869', title, subtitle: 'Старт · Получка +$2 000', description };
    case 'JAIL':
      return { headerHex: '#F43F5E', title, subtitle: 'Полигон · Учебка', description };
    case 'POLICE':
      return { headerHex: '#F43F5E', title, subtitle: 'Рейд ТЦК · Бусификация', description };
    case 'CHANCE':
      return { headerHex: '#10B981', title, subtitle: 'VIP-Лутбокс Фортуны', description };
    case 'TAX':
      return { headerHex: '#F43F5E', title, subtitle: 'Опасный сектор · Списание', description };
    case 'PORTAL':
      return { headerHex: '#A855F7', title, subtitle: 'Квантовая червоточина', description };
    case 'JACKPOT':
      if (russianRoulette) {
        return {
          headerHex: '#F43F5E',
          title: 'Русская рулетка',
          subtitle: 'Смертельный барабан',
          description:
            'Выберите 1–5 патронников: холостой даёт награду, пуля выводит из игры и освобождает все клетки.',
        };
      }
      return { headerHex: '#E5B869', title, subtitle: 'Хайроллер Джекпот 777', description };
    default:
      return { headerHex: '#64748B', title, subtitle: 'Поле доски', description };
  }
}

export interface BoardGridProps {
  roomState: RoomState;
  myPlayerId: string;
  selectedCellId: number | null;
  onSelectCell: (id: number | null) => void;
  onChooseSpeedTarget: (id: number) => void;
  censored: boolean;
  onToggleCensor: () => void;
  nowMs: number;
  onRoll: () => void;
  onPayJail: () => void;
  onBuy: () => void;
  onDeclineBuy: () => void;
  onPayDebt: () => void;
  onEndTurn: () => void;
  onBuildBranch: (cellId: number) => void;
  onSellBranch: (cellId: number) => void;
  onMortgage: (cellId: number) => void;
  onUnmortgage: (cellId: number) => void;
  onAuctionMortgaged: (cellId: number) => void;
  onDuelRestart: () => void;
  onSurrender: () => void;
  onLeaveRoom: () => void;
  onSendChat: (msg: string) => void;
  onReactLog: (logId: string, emoji: string) => void;
  onOpenCredit: () => void;
  onBidAuction: (step: number) => void;
  onPassAuction: () => void;
  onPortalAdd: () => void;
  onPortalJump: (targetCellId?: number) => void;
  onPlayJackpot: (payload: { skip?: boolean; mode?: 'DICE' | 'ROULETTE'; faces?: number[] }) => void;
  tradeDraft: TradeDraftState;
  onChangeTradeDraft: React.Dispatch<React.SetStateAction<TradeDraftState>>;
  onProposeTrade: (
    toPlayerId: string,
    offer: TradeSide,
    request: TradeSide,
    onDone?: () => void
  ) => void;
  onRespondTrade: (accept: boolean) => void;
  onCastKickVote: (approve: boolean) => void;
}

export const BoardGrid: React.FC<BoardGridProps> = (props) => {
  const {
    roomState,
    myPlayerId,
    selectedCellId,
    onSelectCell,
    onChooseSpeedTarget,
    censored,
    onLeaveRoom,
    tradeDraft,
    onChangeTradeDraft,
  } = props;

  const [walkTick, setWalkTick] = useState(0);
  useEffect(() => {
    const ld = roomState.lastDice;
    if (!ld) return;
    const walkMs = getTokenWalkDurationMs(ld) + 220;
    const remaining = ld.timestamp + walkMs - Date.now();
    if (remaining <= 0) return;
    const t = setTimeout(() => setWalkTick((v) => v + 1), remaining + 25);
    return () => clearTimeout(t);
  }, [roomState.lastDice]);

  const isWalkingAfterRoll = Boolean(
    roomState.lastDice &&
      roomState.phase !== 'CHOOSE_SPEED_TARGET' &&
      Date.now() - roomState.lastDice.timestamp < getTokenWalkDurationMs(roomState.lastDice) + 220 &&
      walkTick >= 0
  );

  const curPlayer = roomState.players[roomState.currentPlayerIndex];
  const isChoosingTarget =
    roomState.phase === 'CHOOSE_SPEED_TARGET' && curPlayer?.id === myPlayerId;
  const isChoosingPortalTarget =
    !isWalkingAfterRoll &&
    roomState.phase === 'PORTAL' &&
    (curPlayer?.id === myPlayerId || roomState.portal?.playerId === myPlayerId);
  const portalHighlightSet = new Set(roomState.portal?.candidateCells || []);
  const retro = roomState.settings.retroRules || roomState.settings.mode === 'retro';
  const isPopoverOpen =
    selectedCellId !== null && !tradeDraft.open && !isChoosingTarget && !isChoosingPortalTarget;

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    cellId: number;
    left: number;
    top: number;
  } | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [boardShake, setBoardShake] = useState(false);
  const [policeFlash, setPoliceFlash] = useState(false);
  const [flyTransfer, setFlyTransfer] = useState<{
    id: string;
    label: string;
    isPositive: boolean;
    xPct: number;
    yPct: number;
  } | null>(null);
  const lastDiceTsRef = useRef<number>(0);
  const lastArrestTsRef = useRef<number>(0);
  const lastTransferIdRef = useRef<string | null>(null);
  const activeTurnPlayerId = curPlayer?.id ?? '';
  const { isCockpit, isCompactHeight } = useCockpitMode();
  const isMobileView = !isCockpit;

  // Автозакрытие поповера строго при СМЕНЕ фазы на важную фазу действия (не при каждом изменении кэша/филиалов)
  useEffect(() => {
    const isMyActionPhase =
      activeTurnPlayerId === myPlayerId &&
      ['BUY_DECISION', 'CHANCE', 'JACKPOT', 'PORTAL', 'CHOOSE_SPEED_TARGET', 'PENDING_DEBT'].includes(
        roomState.phase
      );
    if (isMyActionPhase || roomState.phase === 'AUCTION') {
      onSelectCell(null);
    }
  }, [roomState.phase, activeTurnPlayerId, myPlayerId, onSelectCell]);

  // Микро-тряска доски при дубле / трипле
  useEffect(() => {
    const ld = roomState.lastDice;
    if (!ld || ld.timestamp === lastDiceTsRef.current) return;
    lastDiceTsRef.current = ld.timestamp;
    if (ld.isDouble || ld.isTriple) {
      setBoardShake(true);
      const t = setTimeout(() => setBoardShake(false), 420);
      return () => clearTimeout(t);
    }
  }, [roomState.lastDice]);

  const [policeArrestFromCell, setPoliceArrestFromCell] = useState<number | null>(null);

  // Мигание сирены и звук при отправке в Изолятор полицией (синхронно с доходом фишки до клетки ареста)
  useEffect(() => {
    const ts = roomState.lastPoliceArrestAt;
    if (!ts || ts === lastArrestTsRef.current) return;
    lastArrestTsRef.current = ts;
    const arrestEvt = roomState.lastPoliceArrest;
    const delayMs =
      arrestEvt && arrestEvt.timestamp === ts
        ? Math.max(0, arrestEvt.walkDurationMs - 90)
        : 0;
    const startTimer = setTimeout(() => {
      soundEngine.playSiren();
      setPoliceFlash(true);
      setBoardShake(true);
      setPoliceArrestFromCell(arrestEvt?.fromCell ?? 30);
    }, delayMs);
    const endTimer = setTimeout(() => {
      setPoliceFlash(false);
      setBoardShake(false);
      setPoliceArrestFromCell(null);
    }, delayMs + 2800);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [roomState.lastPoliceArrestAt, roomState.lastPoliceArrest]);

  // Летящий кэш-трансфер прямо над клеткой события (строго ПОСЛЕ прихода фишки на клетку, не паля цель заранее)
  useEffect(() => {
    const tr = roomState.lastTransfer;
    if (!tr || tr.id === lastTransferIdRef.current) return;
    lastTransferIdRef.current = tr.id;
    const pos = getCellGridPosition(tr.cellId);
    const xPct = ((pos.col - 0.5) / 11) * 100;
    const yPct = ((pos.row - 0.5) / 11) * 100;
    const isIncomeForMe = tr.toId === myPlayerId;
    const isLossForMe = tr.fromId === myPlayerId;
    const prefix = isIncomeForMe ? '+' : isLossForMe ? '-' : tr.fromId === 'BANK' ? '+' : '💸 ';
    const ld = roomState.lastDice;
    const delayMs =
      ld && Date.now() - ld.timestamp < 1500
        ? Math.max(0, ld.timestamp + getTokenWalkDurationMs(ld) - Date.now())
        : 0;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(() => {
      setFlyTransfer({
        id: tr.id,
        label: `${prefix}$${formatDollar(tr.amount)}`,
        isPositive: tr.fromId === 'BANK' || isIncomeForMe,
        xPct: Math.min(88, Math.max(12, xPct)),
        yPct: Math.min(88, Math.max(12, yPct)),
      });
      hideTimer = setTimeout(() => setFlyTransfer(null), 1700);
    }, delayMs);
    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [roomState.lastTransfer, roomState.lastDice, myPlayerId]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectCell(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPopoverOpen, onSelectCell]);

  useLayoutEffect(() => {
    if (!isPopoverOpen || selectedCellId === null || isMobileView) {
      setPopoverPos(null);
      return;
    }

    const updatePosition = () => {
      const wrapEl = boardWrapRef.current;
      const popEl = popoverRef.current;
      if (!wrapEl || !popEl) return;
      const cellEl = wrapEl.querySelector<HTMLElement>(
        `[data-cell-id="${selectedCellId}"]`
      );
      if (!cellEl) return;

      const wrapRect = wrapEl.getBoundingClientRect();
      const cellRect = cellEl.getBoundingClientRect();
      const popW = popEl.offsetWidth || 312;
      const popH = popEl.offsetHeight || 320;
      const gap = 8;
      const pad = 10;

      const cLeft = cellRect.left;
      const cTop = cellRect.top;
      const cRight = cellRect.right;
      const cBottom = cellRect.bottom;
      const cMidX = cLeft + cellRect.width / 2;
      const cMidY = cTop + cellRect.height / 2;

      const pos = getCellGridPosition(selectedCellId);
      let x = cMidX - popW / 2;
      let y = cMidY - popH / 2;

      if (pos.side === 'top') {
        x = cMidX - popW / 2;
        y = cBottom + gap;
      } else if (pos.side === 'bottom') {
        x = cMidX - popW / 2;
        y = cTop - popH - gap;
      } else if (pos.side === 'left') {
        x = cRight + gap;
        y = cMidY - popH / 2;
      } else if (pos.side === 'right') {
        x = cLeft - popW - gap;
        y = cMidY - popH / 2;
      } else {
        if (selectedCellId === 0) {
          x = cLeft + pad;
          y = cBottom + gap;
        } else if (selectedCellId === 10) {
          x = cRight - popW - pad;
          y = cBottom + gap;
        } else if (selectedCellId === 20) {
          x = cRight - popW - pad;
          y = cTop - popH - gap;
        } else {
          x = cLeft + pad;
          y = cTop - popH - gap;
        }
      }

      const minXView = pad;
      const maxXView = Math.max(pad, window.innerWidth - popW - pad);
      const minYView = pad;
      const maxYView = Math.max(pad, window.innerHeight - popH - pad);

      const minXWrap = Math.max(minXView, wrapRect.left + pad);
      const maxXWrap = Math.min(maxXView, wrapRect.right - popW - pad);
      const minYWrap = Math.max(minYView, wrapRect.top + pad);
      const maxYWrap = Math.min(maxYView, wrapRect.bottom - popH - pad);

      const clampedX =
        minXWrap <= maxXWrap
          ? Math.min(Math.max(x, minXWrap), maxXWrap)
          : Math.min(Math.max(x, minXView), maxXView);
      const clampedY =
        minYWrap <= maxYWrap
          ? Math.min(Math.max(y, minYWrap), maxYWrap)
          : Math.min(Math.max(y, minYView), maxYView);

      setPopoverPos({
        cellId: selectedCellId,
        left: Math.round(clampedX),
        top: Math.round(clampedY),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isPopoverOpen, selectedCellId, isMobileView, roomState.cells, roomState.players]);

  const handleCellClick = (cellId: number) => {
    if (isChoosingTarget && roomState.validSpeedTargets.includes(cellId)) {
      onChooseSpeedTarget(cellId);
      return;
    }

    if (isChoosingPortalTarget) {
      if (portalHighlightSet.has(cellId)) {
        onSelectCell(null);
        props.onPortalJump(cellId);
      }
      return;
    }

    // В режиме Договора клик по полю на доске добавляет/убирает актив (1:1 референс M1)
    if (tradeDraft.open) {
      const rt = roomState.cells[cellId];
      if (rt && rt.branches === 0) {
        if (rt.ownerId === myPlayerId) {
          onChangeTradeDraft((prev) => ({
            ...prev,
            offerProps: prev.offerProps.includes(cellId)
              ? prev.offerProps.filter((x) => x !== cellId)
              : [...prev.offerProps, cellId],
          }));
          return;
        }
        if (rt.ownerId && rt.ownerId === tradeDraft.partnerId) {
          onChangeTradeDraft((prev) => ({
            ...prev,
            reqProps: prev.reqProps.includes(cellId)
              ? prev.reqProps.filter((x) => x !== cellId)
              : [...prev.reqProps, cellId],
          }));
          return;
        }
      }
      return;
    }

    onSelectCell(selectedCellId === cellId ? null : cellId);
  };

  return (
    <div
      className="board-outer-box flex items-center justify-center relative"
    >
      {/* Обёртка квадратной доски 11×11 — адаптивная под телефоны и десктопы с местом под внешние плашки цен */}
      <div
        ref={boardWrapRef}
        className="board-square-wrap relative shrink-0"
      >
        {/* Круглая кнопка выхода справа сверху у угла Тюрьмы (на мобильных перенесена в верхний бар) */}
        <button
          data-testid="board-leave-btn"
          onClick={onLeaveRoom}
          title="Покинуть комнату"
          className="show-in-cockpit-flex absolute -top-[20px] -right-[20px] xl:-top-[24px] xl:-right-[24px] w-7 h-7 rounded-full bg-[#12151F]/95 backdrop-blur-md border border-white/15 hover:border-[#F43F5E] hover:bg-[#F43F5E] text-neutral-300 hover:text-white text-xs font-bold items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.75)] transition cursor-pointer z-40"
        >
          ✕
        </button>

        {/* Сетка 11×11 (ровно 40 клеток + CenterStage = 41 элемент) */}
        <div
          id="monopoly-board"
          style={{
            gridTemplateColumns: 'minmax(0, 1.65fr) repeat(9, minmax(0, 1fr)) minmax(0, 1.65fr)',
            gridTemplateRows: 'minmax(0, 1.65fr) repeat(9, minmax(0, 1fr)) minmax(0, 1.65fr)',
          }}
          className={`w-full h-full grid gap-[1.5px] sm:gap-[2.5px] bg-[#0A0C11] p-[1.5px] sm:p-[2px] rounded-[12px] sm:rounded-[18px] ring-1 ring-[#E5B869]/22 shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_65px_rgba(229,184,105,0.06)] relative overflow-visible transition-transform ${
            boardShake ? 'animate-board-shake' : ''
          } ${policeFlash ? 'animate-police-flash' : ''}`}
        >
          {BOARD_CELLS.map((def) => {
            const pos = getCellGridPosition(def.id);
            const rt = roomState.cells[def.id];
            const owner = rt?.ownerId
              ? roomState.players.find((p) => p.id === rt.ownerId)
              : null;
            const group = def.groupId ? INDUSTRIES[def.groupId] : null;
            const buyable = isBuyableCell(def);

            const isValidSpeedTarget = roomState.validSpeedTargets.includes(def.id);
            const isPortalCandidate = portalHighlightSet.has(def.id);
            const isSelected = selectedCellId === def.id;

            // Статус поля в режиме конструктора Договора или активного обмена (без замыливания доски!)
            const activeTr = !tradeDraft.open ? roomState.activeTrade : null;
            const isTradableInDraft =
              tradeDraft.open &&
              rt &&
              rt.branches === 0 &&
              (rt.ownerId === myPlayerId ||
                (rt.ownerId !== null && rt.ownerId === tradeDraft.partnerId));
            const isTradeGive = tradeDraft.open
              ? tradeDraft.offerProps.includes(def.id)
              : activeTr
              ? activeTr.toPlayerId === myPlayerId
                ? activeTr.request.propertyIds.includes(def.id)
                : activeTr.offer.propertyIds.includes(def.id)
              : false;
            const isTradeReceive = tradeDraft.open
              ? tradeDraft.reqProps.includes(def.id)
              : activeTr
              ? activeTr.toPlayerId === myPlayerId
                ? activeTr.offer.propertyIds.includes(def.id)
                : activeTr.request.propertyIds.includes(def.id)
              : false;
            const tradeGiveLabel =
              activeTr && activeTr.toPlayerId !== myPlayerId && activeTr.fromPlayerId !== myPlayerId
                ? '📤 ОТДАЁТ'
                : '📤 ОТДАЮ';
            const tradeReceiveLabel =
              activeTr && activeTr.toPlayerId !== myPlayerId && activeTr.fromPlayerId !== myPlayerId
                ? '📥 ПОЛУЧАЕТ'
                : '📥 ПОЛУЧУ';

            // Внешняя цветная плашка: цена если поле свободно, стоимость наступления (рента) если куплено
            let outerTabText = '';
            let outerTabMobileText = '';
            if (buyable && group) {
              if (!owner) {
                const pr = def.price ?? 0;
                outerTabText = `$${pr}`;
                outerTabMobileText =
                  pr >= 1000 ? `$${Number((pr / 1000).toFixed(1))}k` : outerTabText;
              } else if (rt?.isMortgaged) {
                outerTabText = rt.mortgageRoundsLeft ? `🔒${rt.mortgageRoundsLeft}` : '🔒';
                outerTabMobileText = outerTabText;
              } else if (def.type === 'IT_UTILITY') {
                const bothOwned =
                  roomState.cells[12]?.ownerId === owner.id &&
                  roomState.cells[28]?.ownerId === owner.id &&
                  !roomState.cells[12]?.isMortgaged &&
                  !roomState.cells[28]?.isMortgaged;
                outerTabText = bothOwned ? '×250' : '×100';
                outerTabMobileText = outerTabText;
              } else {
                const rentVal = calculateDisplayRent(roomState.cells, def.id);
                outerTabText = `$${rentVal}`;
                outerTabMobileText =
                  rentVal >= 1000
                    ? `$${Number((rentVal / 1000).toFixed(1))}k`
                    : outerTabText;
              }
            }

            let displayShortName = txt(
              def.shortName || def.name,
              def.cleanShortName || def.cleanName,
              censored
            );
            if (retro) {
              if (def.type === 'JACKPOT') displayShortName = 'Парк отдыха';
              else if (def.type === 'PORTAL') displayShortName = 'Бонус +$1 500';
              else if (def.type === 'CHANCE') {
                const isBon = def.id === 2 || def.id === 22;
                displayShortName = isBon ? '+$1 000' : '-$1 000';
              }
            } else if (roomState.settings.russianRoulette && def.type === 'JACKPOT') {
              displayShortName = 'Рулетка';
            }

            // Скругление только на 4 внешних углах доски
            const cornerRadiusClass =
              def.id === 0
                ? 'rounded-tl-[10px] sm:rounded-tl-[15px]'
                : def.id === 10
                ? 'rounded-tr-[10px] sm:rounded-tr-[15px]'
                : def.id === 20
                ? 'rounded-br-[10px] sm:rounded-br-[15px]'
                : def.id === 30
                ? 'rounded-bl-[10px] sm:rounded-bl-[15px]'
                : 'rounded-[3px] sm:rounded-[4px]';

            const isGoldCorner =
              def.id === 0 || (def.id === 20 && !roomState.settings.russianRoulette);
            const isCarmineCorner =
              def.id === 10 || def.id === 30 || (def.id === 20 && !!roomState.settings.russianRoulette);
            const isDangerSector = def.type === 'TAX';
            const isPortalSector = def.type === 'PORTAL';
            const isTransportSector = !owner && def.type === 'CAR';
            const isUtilitySector = !owner && def.type === 'IT_UTILITY';
            const isChanceSector = def.type === 'CHANCE';
            const isHoveredGroup = Boolean(hoveredGroupId && group?.id === hoveredGroupId);

            // Тёмный графит #13161F вместо белого + благородный тинт владельца и единая подсветка спец-активов
            const cellBgStyle: React.CSSProperties = {
              gridRow: pos.row,
              gridColumn: pos.col,
            };
            if (owner) {
              if (rt?.isMortgaged) {
                cellBgStyle.background = `repeating-linear-gradient(-45deg, color-mix(in srgb, ${owner.color} 22%, #0e1017), color-mix(in srgb, ${owner.color} 22%, #0e1017) 6px, #161a26 6px, #161a26 12px)`;
              } else {
                cellBgStyle.background = `linear-gradient(165deg, color-mix(in srgb, ${owner.color} 34%, #151924) 0%, color-mix(in srgb, ${owner.color} 16%, #0e1118) 100%)`;
                cellBgStyle.boxShadow = `inset 0 0 18px color-mix(in srgb, ${owner.color} 26%, transparent), inset 0 1px 0 rgba(255,255,255,0.14)`;
              }
            } else if (isGoldCorner) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 48%, rgba(229, 184, 105, 0.16) 0%, #151823 66%, #0d0f16 100%)';
            } else if (isCarmineCorner) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 48%, rgba(244, 63, 94, 0.17) 0%, #171420 66%, #0d0f16 100%)';
            } else if (isChanceSector) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 42%, rgba(16, 185, 129, 0.2) 0%, #101918 68%, #0f131b 100%)';
            } else if (isDangerSector) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 42%, rgba(244, 63, 94, 0.2) 0%, #1b1219 68%, #11131c 100%)';
            } else if (isPortalSector) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 42%, rgba(168, 85, 247, 0.24) 0%, #171226 68%, #0f121c 100%)';
            } else if (isTransportSector) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 42%, rgba(126, 149, 184, 0.22) 0%, #141923 68%, #10131c 100%)';
            } else if (isUtilitySector) {
              cellBgStyle.background =
                'radial-gradient(circle at 50% 42%, rgba(6, 182, 212, 0.22) 0%, #101c22 68%, #10131c 100%)';
            }

            // При наведении на монополию принудительно задаём мощное двойное свечение в inline boxShadow,
            // чтобы оно НЕ перебивалось inline-тенью карточек, купленных другими игроками!
            if (isHoveredGroup && group && !isSelected) {
              cellBgStyle.boxShadow = `0 0 0 2px ${group.accentHex}, 0 0 0 3.5px rgba(243, 208, 130, 0.95), 0 0 26px ${group.accentHex}dd, 0 12px 26px rgba(0, 0, 0, 0.88), inset 0 0 22px ${group.accentHex}66`;
            }

            const medallionGlowHex = owner
              ? owner.color
              : group?.accentHex ??
                (isChanceSector
                  ? '#10B981'
                  : isDangerSector
                  ? '#F43F5E'
                  : isPortalSector
                  ? '#A855F7'
                  : '#E5B869');

            const cellSurfaceBorderClass = owner
              ? 'border border-white/15 border-t-white/25'
              : isGoldCorner
              ? 'border border-[#E5B869]/45 shadow-[inset_0_1px_0_rgba(243,208,130,0.25)]'
              : isCarmineCorner
              ? 'border border-[#F43F5E]/45 shadow-[inset_0_1px_0_rgba(244,63,94,0.22)]'
              : isChanceSector
              ? 'border border-[#10B981]/30 border-t-[#6EE7B7]/25 hover:brightness-110'
              : isDangerSector
              ? 'border border-[#F43F5E]/35 border-t-[#FDA4AF]/25 hover:brightness-110'
              : isPortalSector
              ? 'border border-[#A855F7]/40 border-t-[#67E8F9]/30 hover:brightness-110'
              : isTransportSector
              ? 'border border-[#64748B]/40 border-t-[#CBD5E1]/25 hover:brightness-110'
              : isUtilitySector
              ? 'border border-[#14B8A6]/38 border-t-[#5EEAD4]/25 hover:brightness-110'
              : 'bg-[#13161F] hover:bg-[#1A1E2B] border border-[#222736] border-t-white/10';

            // Позиционирование внешней плашки цены/ренты по 4 сторонам (LED-капсулы с JetBrains Mono)
            const outerTabPosClass =
              pos.side === 'top'
                ? '-top-[15px] sm:-top-[20px] xl:-top-[23px] left-[1px] right-[1px] h-[14px] sm:h-[19px] xl:h-[22px] rounded-t-[4px] sm:rounded-t-[7px]'
                : pos.side === 'bottom'
                ? '-bottom-[15px] sm:-bottom-[20px] xl:-bottom-[23px] left-[1px] right-[1px] h-[14px] sm:h-[19px] xl:h-[22px] rounded-b-[4px] sm:rounded-b-[7px]'
                : pos.side === 'left'
                ? '-left-[22px] sm:-left-[41px] lg:-left-[47px] xl:-left-[53px] top-[1px] bottom-[1px] w-[21px] sm:w-[40px] lg:w-[46px] xl:w-[52px] rounded-l-[4px] sm:rounded-l-[7px]'
                : '-right-[22px] sm:-right-[41px] lg:-right-[47px] xl:-right-[53px] top-[1px] bottom-[1px] w-[21px] sm:w-[40px] lg:w-[46px] xl:w-[52px] rounded-r-[4px] sm:rounded-r-[7px]';

            // Позиционирование звёзд филиалов на внутренней границе клетки, повернутой к чату
            const branchPosClass =
              pos.side === 'top'
                ? '-bottom-[8px] left-1/2 -translate-x-1/2 flex-row'
                : pos.side === 'bottom'
                ? '-top-[8px] left-1/2 -translate-x-1/2 flex-row'
                : pos.side === 'left'
                ? '-right-[8px] top-1/2 -translate-y-1/2 flex-col'
                : '-left-[8px] top-1/2 -translate-y-1/2 flex-col';

            const isHighlightingTargets =
              isChoosingTarget || isChoosingPortalTarget;
            const isDimmedForTarget =
              isHighlightingTargets && !isPortalCandidate && !isValidSpeedTarget;
            const isCurrentPlayerCell =
              !isWalkingAfterRoll &&
              roomState.status === 'PLAYING' &&
              !!curPlayer &&
              def.id === curPlayer.position;
            const isDimmedForHoverGroup = Boolean(
              hoveredGroupId &&
                !isHoveredGroup &&
                !isHighlightingTargets &&
                !tradeDraft.open &&
                !activeTr &&
                !isSelected
            );
            const isPoliceStrobeCell =
              policeFlash && (def.id === 10 || def.id === (policeArrestFromCell ?? 30));
            const groupStripPadClass =
              group && pos.side !== 'corner'
                ? pos.side === 'top'
                  ? 'pt-[6px] sm:pt-[8.5px] pb-[1.5px] sm:pb-[2.5px] px-[1.5px] sm:px-[2.5px]'
                  : pos.side === 'bottom'
                  ? 'pb-[6px] sm:pb-[8.5px] pt-[1.5px] sm:pt-[2.5px] px-[1.5px] sm:px-[2.5px]'
                  : pos.side === 'left'
                  ? 'pl-[6px] sm:pl-[8.5px] pr-[1.5px] sm:pr-[2.5px] py-[1.5px] sm:py-[2.5px]'
                  : 'pr-[6px] sm:pr-[8.5px] pl-[1.5px] sm:pl-[2.5px] py-[1.5px] sm:py-[2.5px]'
                : 'p-[1.5px] sm:p-[2.5px]';

            return (
              <div
                key={def.id}
                data-cell-id={def.id}
                style={cellBgStyle}
                onClick={() => handleCellClick(def.id)}
                onMouseEnter={() => group && setHoveredGroupId(group.id)}
                onMouseLeave={() => group && setHoveredGroupId((cur) => (cur === group.id ? null : cur))}
                title={displayShortName}
                className={`relative min-w-0 min-h-0 select-none cursor-pointer transition-all duration-200 overflow-visible ${cornerRadiusClass} ${cellSurfaceBorderClass} ${
                  tradeDraft.open && !isTradableInDraft
                    ? 'opacity-30 brightness-75'
                    : activeTr && !isTradeGive && !isTradeReceive
                    ? 'opacity-45 brightness-75'
                    : isDimmedForTarget
                    ? 'opacity-45 brightness-75'
                    : isDimmedForHoverGroup
                    ? 'opacity-50 brightness-75'
                    : ''
                } ${
                  isPoliceStrobeCell
                    ? 'ring-[3px] ring-[#F43F5E] shadow-[0_0_30px_rgba(244,63,94,0.95),0_0_24px_rgba(59,130,246,0.8)] z-30 scale-[1.04]'
                    : isValidSpeedTarget
                    ? 'ring-[3px] ring-fuchsia-400 shadow-[0_0_26px_rgba(232,121,249,0.9),inset_0_0_18px_rgba(217,70,239,0.45)] scale-[1.04] z-30'
                    : isChoosingPortalTarget && isPortalCandidate
                    ? portalHighlightSet.size <= 8
                      ? 'ring-[3px] ring-cyan-400 shadow-[0_0_26px_rgba(34,211,238,0.9),inset_0_0_18px_rgba(6,182,212,0.45)] scale-[1.04] z-30'
                      : 'ring-2 ring-cyan-400/90 shadow-[inset_0_0_12px_rgba(6,182,212,0.4)] hover:scale-[1.05] hover:z-30 z-10'
                    : isTradeGive
                    ? 'ring-[3px] ring-[#F43F5E] shadow-[0_0_24px_rgba(244,63,94,0.9)] z-30 scale-[1.05]'
                    : isTradeReceive
                    ? 'ring-[3px] ring-[#10B981] shadow-[0_0_24px_rgba(16,185,129,0.9)] z-30 scale-[1.05]'
                    : isSelected
                    ? 'ring-2 ring-[#E5B869] shadow-[0_0_24px_rgba(229,184,105,0.48),0_14px_28px_rgba(0,0,0,0.8)] z-30 scale-[1.06] -translate-y-1'
                    : isHoveredGroup
                    ? 'z-30 scale-[1.055] -translate-y-0.5 brightness-115'
                    : isCurrentPlayerCell
                    ? 'ring-2 ring-[#E5B869] shadow-[0_0_20px_rgba(229,184,105,0.35)] z-20 hover:scale-[1.03] hover:-translate-y-0.5'
                    : rt && rt.branches > 0
                    ? 'z-20 hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(0,0,0,0.65)]'
                    : 'hover:scale-[1.03] hover:-translate-y-0.5 hover:z-20 hover:shadow-[0_10px_22px_rgba(0,0,0,0.65)]'
                }`}
              >
                {/* Яркая внутренняя подсветка монополии при наведении (отлично читается даже поверх чужой заливки владельца!) */}
                {isHoveredGroup && group && (
                  <div
                    style={{
                      borderColor: group.accentHex,
                      background: `radial-gradient(circle at 50% 50%, ${group.accentHex}38 0%, transparent 72%)`,
                      boxShadow: `inset 0 0 16px ${group.accentHex}88`,
                    }}
                    className={`pointer-events-none absolute inset-0 z-25 border-2 ${cornerRadiusClass}`}
                  />
                )}
                {/* Чёткий неоновый маркер владельца на внутренней грани купленной клетки */}
                {owner && pos.side !== 'corner' && (
                  <div
                    style={{
                      backgroundColor: owner.color,
                      boxShadow: `0 0 10px ${owner.color}`,
                    }}
                    className={`pointer-events-none absolute z-15 ${
                      pos.side === 'top'
                        ? 'bottom-0 left-0 right-0 h-[3px]'
                        : pos.side === 'bottom'
                        ? 'top-0 left-0 right-0 h-[3px]'
                        : pos.side === 'left'
                        ? 'right-0 top-0 bottom-0 w-[3px]'
                        : 'left-0 top-0 bottom-0 w-[3px]'
                    }`}
                  />
                )}
                {/* Выразительная фрезерованная LED-плашка монополии (всегда хранит истинный цвет отрасли!) */}
                {group && pos.side !== 'corner' && (
                  <div
                    style={{
                      background:
                        pos.side === 'top' || pos.side === 'bottom'
                          ? `linear-gradient(180deg, color-mix(in srgb, ${group.accentHex} 84%, #ffffff) 0%, ${group.accentHex} 52%, color-mix(in srgb, ${group.accentHex} 76%, #05070c) 100%)`
                          : `linear-gradient(90deg, color-mix(in srgb, ${group.accentHex} 84%, #ffffff) 0%, ${group.accentHex} 52%, color-mix(in srgb, ${group.accentHex} 76%, #05070c) 100%)`,
                      boxShadow: isHoveredGroup
                        ? `0 0 14px ${group.accentHex}, inset 0 1px 0 rgba(255,255,255,0.75)`
                        : `0 0 10px ${group.accentHex}99, inset 0 1px 0 rgba(255,255,255,0.48)`,
                    }}
                    className={`pointer-events-none absolute z-20 transition-all ${
                      pos.side === 'top'
                        ? 'top-0 left-0 right-0 h-[5px] sm:h-[7px] rounded-t-[2.5px] sm:rounded-t-[3.5px] border-b border-[#06080D]/95'
                        : pos.side === 'bottom'
                        ? 'bottom-0 left-0 right-0 h-[5px] sm:h-[7px] rounded-b-[2.5px] sm:rounded-b-[3.5px] border-t border-[#06080D]/95'
                        : pos.side === 'left'
                        ? 'left-0 top-0 bottom-0 w-[5px] sm:w-[7px] rounded-l-[2.5px] sm:rounded-l-[3.5px] border-r border-[#06080D]/95'
                        : 'right-0 top-0 bottom-0 w-[5px] sm:w-[7px] rounded-r-[2.5px] sm:rounded-r-[3.5px] border-l border-[#06080D]/95'
                    }`}
                  />
                )}
                {/* Яркая пульсирующая подсветка и значок для целевых клеток Портала / Маршрутки */}
                {(isValidSpeedTarget || (isChoosingPortalTarget && isPortalCandidate)) && (
                  <>
                    <div
                      className={`pointer-events-none absolute inset-0 animate-pulse z-20 ${
                        isValidSpeedTarget
                          ? 'bg-fuchsia-400/22 ring-2 ring-inset ring-fuchsia-300'
                          : 'bg-cyan-400/18 ring-1 ring-inset ring-cyan-300/80'
                      }`}
                    />
                    {(isValidSpeedTarget || portalHighlightSet.size <= 8) && (
                      <span
                        className={`pointer-events-none absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center shadow-lg border border-white z-30 ${
                          isValidSpeedTarget ? 'bg-fuchsia-600' : 'bg-cyan-500'
                        }`}
                      >
                        {isValidSpeedTarget ? '⚡' : '🌀'}
                      </span>
                    )}
                  </>
                )}
                {/* Внешняя глянцевая LED-капсула цены (свободно) или ренты (куплено) */}
                {buyable && group && outerTabText && (() => {
                  const ledColor = rt?.isMortgaged
                    ? '#3f3f46'
                    : owner
                    ? owner.color
                    : group.accentHex;
                  return (
                    <div
                      key={`${def.id}_${outerTabText}`}
                      title={
                        rt?.isMortgaged
                          ? `Заложено (${rt.mortgageRoundsLeft ?? '?'}р)`
                          : owner
                          ? `Владелец: ${owner.name} · Рента: ${outerTabText}`
                          : `Свободно · Цена покупки: ${outerTabText}`
                      }
                      style={{
                        background: rt?.isMortgaged
                          ? 'linear-gradient(180deg, #3f3f46 0%, #27272a 100%)'
                          : `linear-gradient(180deg, color-mix(in srgb, ${ledColor} 88%, #ffffff) 0%, color-mix(in srgb, ${ledColor} 76%, #07090e) 100%)`,
                        boxShadow: isHoveredGroup
                          ? `0 0 0 1.5px ${group.accentHex}, 0 0 18px ${group.accentHex}, 0 4px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.65)`
                          : rt?.isMortgaged
                          ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.6)'
                          : `0 0 14px ${ledColor}55, 0 3px 8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.42)`,
                        textShadow: '0 1px 2px rgba(0,0,0,0.92), 0 0 2px rgba(0,0,0,0.95)',
                      }}
                      className={`pointer-events-none absolute ${outerTabPosClass} flex items-center justify-center gap-0.5 font-mono-num text-[6.5px] sm:text-[9.5px] lg:text-[10.5px] xl:text-[11.5px] font-bold text-[#F8FAFC] tracking-[-0.04em] sm:tracking-tight leading-none whitespace-nowrap animate-tab-flip transition-transform ${
                        isHoveredGroup ? 'scale-105 z-30' : ''
                      } ${
                        owner && !rt?.isMortgaged
                          ? 'border border-white/65 ring-1 ring-black/40'
                          : 'border border-white/25 opacity-95'
                      }`}
                    >
                      {owner && (
                        <span
                          style={{
                            backgroundColor: group.accentHex,
                            boxShadow: `0 0 5px ${group.accentHex}`,
                          }}
                          className="hidden sm:inline-block w-1.5 h-1.5 rounded-full border border-black/70 shrink-0"
                        />
                      )}
                      {outerTabMobileText !== outerTabText ? (
                        <>
                          <span className="sm:hidden">{outerTabMobileText}</span>
                          <span className="hidden sm:inline">{outerTabText}</span>
                        </>
                      ) : (
                        <span>{outerTabText}</span>
                      )}
                    </div>
                  );
                })()}

                {/* Звёзды/шевроны филиалов (1..4 яркие ★ или золотая корона-звезда ★ за полную застройку) */}
                {rt && rt.branches > 0 && (
                  <div
                    className={`pointer-events-none absolute ${branchPosClass} flex items-center justify-center gap-[0.5px] sm:gap-[1px] px-[3px] sm:px-1 py-[0.5px] rounded-full bg-[#090B10]/90 border border-[#E5B869]/55 shadow-[0_2px_8px_rgba(0,0,0,0.9),0_0_10px_rgba(229,184,105,0.35)] z-30`}
                  >
                    {rt.branches >= 5 ? (
                      <span
                        key={`${def.id}-star-5`}
                        style={{
                          textShadow: '0 0 8px rgba(243,208,130,0.9), 0 1px 2px rgba(0,0,0,0.95)',
                        }}
                        className="text-[9px] sm:text-[14px] xl:text-[15.5px] leading-none text-[#F3D082] font-black animate-pop-in"
                      >
                        ★
                      </span>
                    ) : (
                      Array.from({ length: rt.branches }).map((_, i) => (
                        <span
                          key={`${def.id}-star-${i}`}
                          style={{
                            textShadow: '0 0 6px rgba(229,184,105,0.65), 0 1px 2px rgba(0,0,0,0.95)',
                          }}
                          className="text-[6.5px] sm:text-[10px] xl:text-[11.5px] leading-none text-[#E5B869] font-black animate-pop-in"
                        >
                          ★
                        </span>
                      ))
                    )}
                  </div>
                )}

                {/* Бейдж залога прямо на клетке */}
                {rt?.isMortgaged && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                    <span className="bg-[#090B10]/90 backdrop-blur-sm border border-[#F43F5E]/45 text-[#FDA4AF] font-mono-num text-[7px] sm:text-[8.5px] font-bold px-1 sm:px-1.5 py-0.5 rounded shadow-lg">
                      🔒 {rt.mortgageRoundsLeft ? `${rt.mortgageRoundsLeft}р` : 'ЗАЛОГ'}
                    </span>
                  </div>
                )}

                {/* Чёткая подсветка что на что меняется в Договоре прямо поверх доски */}
                {isTradeGive && (
                  <div
                    data-testid="trade-cell-give"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
                  >
                    <span className="px-1 sm:px-1.5 py-0.5 rounded-md bg-[#F43F5E]/95 text-white text-[7px] sm:text-[9px] font-black tracking-tight shadow-lg border border-white/80 whitespace-nowrap">
                      {tradeGiveLabel}
                    </span>
                  </div>
                )}
                {isTradeReceive && (
                  <div
                    data-testid="trade-cell-receive"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
                  >
                    <span className="px-1 sm:px-1.5 py-0.5 rounded-md bg-[#10B981]/95 text-white text-[7px] sm:text-[9px] font-black tracking-tight shadow-lg border border-white/80 whitespace-nowrap">
                      {tradeReceiveLabel}
                    </span>
                  </div>
                )}

                {/* Крупная иллюстрация на всю клетку без текстовых подписей под карточками */}
                {pos.side === 'corner' ? (
                  <div
                    className={`w-full h-full p-0.5 sm:p-1 flex items-center justify-center overflow-hidden ${cornerRadiusClass}`}
                  >
                    <CellArtwork
                      cellId={def.id}
                      side="corner"
                      censored={censored}
                      russianRoulette={roomState.settings.russianRoulette}
                      className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)]"
                    />
                  </div>
                ) : (
                  /* Единый полноразмерный Dark Luxury слот иллюстрации для всех 36 боковых карточек */
                  <div className={`w-full h-full ${groupStripPadClass} flex items-center justify-center overflow-hidden min-w-0 min-h-0`}>
                    <div
                      style={{
                        boxShadow: `inset 0 2px 6px rgba(0,0,0,0.72), 0 1px 0 rgba(255,255,255,0.05)`,
                        background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${medallionGlowHex} 22%, #0c0e15) 0%, #090b10 86%)`,
                      }}
                      className="w-full h-full rounded-[3.5px] sm:rounded-[6px] border border-white/[0.07] flex items-center justify-center p-[1px] sm:p-[2px] overflow-hidden"
                    >
                      <div
                        style={{
                          filter: `drop-shadow(0 2px 5px ${medallionGlowHex}55)`,
                        }}
                        className="w-full h-full flex items-center justify-center"
                      >
                        <CellArtwork
                          cellId={def.id}
                          side={pos.side}
                          censored={censored}
                          className="max-w-full max-h-full w-[94%] h-[94%]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Центральная арена 9×9 с действиями, кубиками, договорами и чатом */}
          <CenterStage {...props} />
        </div>

        {/* Слой анимированных фишек поверх доски (с пошаговым скольжением, задним ходом и арестом в СИЗО) */}
        <BoardTokensLayer
          players={roomState.players}
          currentPlayerId={curPlayer?.id}
          isPlaying={roomState.status === 'PLAYING'}
          lastDice={roomState.lastDice}
          lastPoliceArrest={roomState.lastPoliceArrest}
        />

        {/* Летящий кэш-трансфер прямо над клеткой */}
        {flyTransfer && (
          <div
            key={flyTransfer.id}
            style={{ left: `${flyTransfer.xPct}%`, top: `${flyTransfer.yPct}%` }}
            className="pointer-events-none absolute z-40 -translate-x-1/2"
          >
            <div
              className={`animate-cash-fly px-2.5 py-1 rounded-full text-xs sm:text-sm font-black shadow-2xl border backdrop-blur-md whitespace-nowrap ${
                flyTransfer.isPositive
                  ? 'bg-emerald-500/90 text-white border-emerald-200/70'
                  : 'bg-rose-600/90 text-white border-rose-200/70'
              }`}
            >
              {flyTransfer.label}
            </div>
          </div>
        )}

        {/* Monopoly One тёмный поповер карточки при клике на клетку */}
        {isPopoverOpen &&
          selectedCellId !== null &&
          (() => {
            const selectedDef = BOARD_CELLS.find((c) => c.id === selectedCellId);
            if (!selectedDef) return null;

            const selectedRt = roomState.cells[selectedDef.id];
            const selectedOwner = selectedRt?.ownerId
              ? roomState.players.find((p) => p.id === selectedRt.ownerId) ?? null
              : null;
            const selectedGroup = selectedDef.groupId
              ? INDUSTRIES[selectedDef.groupId] ?? null
              : null;
            const selectedBuyable = isBuyableCell(selectedDef);
            const specialMeta = getSpecialPopoverMeta(
              selectedDef,
              censored,
              retro,
              roomState.settings.russianRoulette
            );

            const headerHex = selectedGroup?.accentHex ?? specialMeta.headerHex;
            const headerTitle = selectedGroup
              ? txt(selectedDef.name, selectedDef.cleanName, censored)
              : specialMeta.title;
            const headerSubtitle = selectedGroup
              ? txt(selectedGroup.name, selectedGroup.cleanName, censored)
              : specialMeta.subtitle;
            const catBadge = selectedGroup
              ? getCategoryBadge(selectedGroup.id, selectedDef.type)
              : null;
            const bodyDescription = txt(
              selectedDef.description || selectedDef.subtitle,
              selectedDef.cleanDescription || selectedDef.cleanSubtitle,
              censored
            );
            const mechanicsHint =
              selectedDef.type === 'CAR'
                ? 'Аренда растёт от количества авто в гараже.'
                : selectedDef.type === 'IT_UTILITY'
                ? 'Рента = сумма на кубиках × множитель.'
                : selectedDef.type === 'PROPERTY'
                ? 'Соберите всю группу, чтобы строить филиалы ★.'
                : null;

            const rents = selectedDef.rents ?? [];
            let activeRentIdx = -1;
            if (selectedOwner && !selectedRt?.isMortgaged) {
              if (selectedDef.type === 'PROPERTY') {
                activeRentIdx = Math.min(5, Math.max(0, selectedRt?.branches ?? 0));
              } else if (selectedDef.type === 'CAR' && selectedDef.groupId) {
                const ownedCars = BOARD_CELLS.filter(
                  (c) =>
                    c.groupId === selectedDef.groupId &&
                    roomState.cells[c.id]?.ownerId === selectedOwner.id &&
                    !roomState.cells[c.id]?.isMortgaged
                ).length;
                activeRentIdx = ownedCars > 0 ? Math.min(3, ownedCars - 1) : -1;
              } else if (selectedDef.type === 'IT_UTILITY' && selectedDef.groupId) {
                const ownedIt = BOARD_CELLS.filter(
                  (c) =>
                    c.groupId === selectedDef.groupId &&
                    roomState.cells[c.id]?.ownerId === selectedOwner.id &&
                    !roomState.cells[c.id]?.isMortgaged
                ).length;
                activeRentIdx = ownedIt >= 2 ? 1 : ownedIt === 1 ? 0 : -1;
              }
            }

            const carLabels = ['1 поле', '2 поля', '3 поля', '4 поля'];
            const itLabels = ['1 поле', '2 поля'];
            const propLabels = [
              'Базовая рента',
              '1 филиал',
              '2 филиала',
              '3 филиала',
              '4 филиала',
              'Монополия ★',
            ];

            const isMine = selectedBuyable && selectedRt?.ownerId === myPlayerId;
            const buildCheck = isMine
              ? canBuildBranch(roomState, myPlayerId, selectedDef.id)
              : null;
            const sellCheck = isMine
              ? canSellBranch(roomState, myPlayerId, selectedDef.id)
              : null;
            const mortgageCheck = isMine
              ? canMortgageCell(roomState, myPlayerId, selectedDef.id)
              : null;
            const unmortgageCheck = isMine
              ? canUnmortgageCell(roomState, myPlayerId, selectedDef.id)
              : null;
            const unmortgageCost = getUnmortgageCost(selectedDef.id);
            const canUnmortgage = Boolean(unmortgageCheck?.ok);
            const isMyTurn = curPlayer?.id === myPlayerId;
            const showAuctionBtn = roomState.settings.auctionsEnabled && !retro;
            const canAuctionMortgaged =
              showAuctionBtn &&
              isMyTurn &&
              roomState.phase === 'PRE_ROLL';

            const branchCostVal =
              selectedDef.branchCost ?? selectedGroup?.branchCost ?? 0;

            const cardContent = (
              <div
                ref={popoverRef}
                role="dialog"
                aria-label={headerTitle}
                onClick={(e) => e.stopPropagation()}
                style={
                  isMobileView
                    ? {
                        boxShadow: `0 32px 80px rgba(0,0,0,0.92), 0 0 34px ${headerHex}24, inset 0 1px 0 rgba(255,255,255,0.1)`,
                      }
                    : {
                        left:
                          popoverPos?.cellId === selectedDef.id
                            ? popoverPos.left
                            : 0,
                        top:
                          popoverPos?.cellId === selectedDef.id
                            ? popoverPos.top
                            : 0,
                        visibility:
                          popoverPos?.cellId === selectedDef.id
                            ? 'visible'
                            : 'hidden',
                        boxShadow: `0 32px 80px rgba(0,0,0,0.92), 0 0 34px ${headerHex}24, inset 0 1px 0 rgba(255,255,255,0.1)`,
                      }
                }
                className={
                  isMobileView
                    ? 'w-full max-w-[min(348px,94vw)] max-h-[88dvh] flex flex-col bg-gradient-to-b from-[#161922] to-[#0F1117] text-[#F1F5F9] rounded-2xl border border-white/[0.1] overflow-hidden animate-action-card'
                    : 'fixed w-[min(308px,92vw)] max-h-[calc(100dvh-16px)] flex flex-col bg-gradient-to-b from-[#161922] to-[#0F1117] text-[#F1F5F9] rounded-2xl border border-white/[0.08] overflow-hidden z-[65] animate-action-card'
                }
              >
                {/* Коллекционная VIP-шапка карточки с глубоким градиентом монополии, сеткой и крупным 3D-артом */}
                <div
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${headerHex} 54%, #0f1117) 0%, #141824 66%, #0f1117 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.45)`,
                  }}
                  className={`shrink-0 ${isCompactHeight ? 'px-3.5 py-2.5' : 'px-4 py-3'} relative border-b border-white/[0.08] overflow-hidden`}
                >
                  {/* Тонкая геометрическая сетка на фоне шапки */}
                  <svg
                    viewBox="0 0 308 128"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-35"
                  >
                    <defs>
                      <pattern
                        id={`pop-grid-${selectedDef.id}`}
                        width="14"
                        height="14"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 14 0 L 0 0 0 14"
                          fill="none"
                          stroke={headerHex}
                          strokeOpacity="0.28"
                          strokeWidth="0.6"
                        />
                      </pattern>
                    </defs>
                    <rect width="308" height="128" fill={`url(#pop-grid-${selectedDef.id})`} />
                    <circle
                      cx="264"
                      cy="26"
                      r="54"
                      fill="none"
                      stroke="#E5B869"
                      strokeOpacity="0.2"
                      strokeDasharray="3 3"
                    />
                  </svg>

                  <button
                    type="button"
                    onClick={() => onSelectCell(null)}
                    aria-label="Закрыть карточку"
                    className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-[#090B10]/70 hover:bg-[#F43F5E] border border-white/15 text-neutral-200 hover:text-white text-xs font-bold flex items-center justify-center cursor-pointer transition"
                  >
                    ✕
                  </button>

                  <div className="relative z-10">
                    <div className="pr-8 mb-2">
                      {catBadge ? (
                        <div className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#0A0C12]/90 to-[#161A26]/90 border border-[#E5B869]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] text-[10px] font-bold text-[#F3D082] leading-tight whitespace-normal break-words">
                          <span className="shrink-0 inline-flex items-center">
                            <AppleEmoji emoji={catBadge.icon} />
                          </span>
                          <span className="whitespace-normal break-words text-[#F8FAFC]">
                            {headerSubtitle}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center max-w-full px-2.5 py-1 rounded-xl bg-[#0A0C12]/85 border border-white/15 text-[10px] text-[#E5B869] font-bold uppercase tracking-wider leading-tight whitespace-normal break-words">
                          {headerSubtitle}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Крупная детализированная Dark Luxury 3D-витрина иллюстрации */}
                      <div
                        style={{
                          borderColor: `${headerHex}80`,
                          boxShadow: `0 0 24px ${headerHex}42, 0 10px 22px rgba(0,0,0,0.78), inset 0 2px 8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.18)`,
                          background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${headerHex} 28%, #151a28) 0%, #090B11 80%)`,
                        }}
                        className="relative w-[82px] h-[82px] rounded-2xl border p-1.5 shrink-0 flex items-center justify-center overflow-hidden"
                      >
                        <div className="pointer-events-none absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                        <div
                          style={{ filter: `drop-shadow(0 4px 10px ${headerHex}66)` }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <CellArtwork
                            cellId={selectedDef.id}
                            side="corner"
                            censored={censored}
                            russianRoulette={roomState.settings.russianRoulette}
                            className="w-full h-full"
                          />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div
                          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.65)' }}
                          className="font-display text-[14.5px] font-bold text-[#F8FAFC] leading-[1.22] whitespace-normal break-words"
                        >
                          {headerTitle}
                        </div>
                        {selectedBuyable && selectedDef.price !== undefined && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#090B10]/80 border border-white/10 text-[10.5px] font-semibold text-[#CBD5E1]">
                            <span>Цена:</span>
                            <span className="font-mono-num font-bold text-[#F3D082]">
                              ${formatDollar(selectedDef.price)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Прокручиваемое тело VIP-актива */}
                <div className="flex-1 min-h-0 overflow-y-auto chat-scrollbar px-4 py-3 text-[12px] space-y-2.5">
                  {/* Закрытый инсайд / мемная цитата */}
                  <div
                    style={{ borderLeftColor: '#E5B869' }}
                    className="relative overflow-hidden rounded-xl bg-[#0A0C12]/95 border border-white/[0.06] border-l-[3px] px-3 py-2 text-[11.5px] text-[#E2E8F0] leading-[1.45] shadow-inner"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none select-none absolute -top-2 right-2 font-serif text-[44px] leading-none text-[#E5B869]/12"
                    >
                      ”
                    </span>
                    <div className="relative z-10 italic text-[#F1F5F9]/95">
                      «{bodyDescription}»
                    </div>
                    {mechanicsHint && (
                      <div className="relative z-10 not-italic text-[10px] text-[#94A3B8] mt-1.5 pt-1.5 border-t border-white/[0.05] font-semibold">
                        ⚙️ {mechanicsHint}
                      </div>
                    )}
                  </div>

                  {/* Швейцарская таблица ренты */}
                  {selectedDef.type === 'CAR' && (
                    <div className="rounded-xl bg-[#0B0D14]/80 border border-white/[0.05] px-2.5 py-1 divide-y divide-white/[0.04]">
                      {carLabels.map((label, idx) => {
                        const active = activeRentIdx === idx;
                        const isTopTier = idx === carLabels.length - 1;
                        return (
                          <div
                            key={label}
                            className={`flex items-center justify-between gap-2 py-1.5 text-[11.5px] ${
                              active
                                ? 'px-2 -mx-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 shadow-[0_0_14px_rgba(16,185,129,0.18)] text-[#6EE7B7] font-bold'
                                : isTopTier
                                ? 'text-[#E5B869] font-semibold'
                                : 'text-[#CBD5E1]'
                            }`}
                          >
                            <span>{isTopTier ? `${label} ★` : label}</span>
                            <span
                              className={`font-mono-num font-bold ${
                                active
                                  ? 'text-[#6EE7B7]'
                                  : isTopTier
                                  ? 'text-[#E5B869]'
                                  : 'text-[#F8FAFC]'
                              }`}
                            >
                              <span className="opacity-55 mr-0.5">$</span>
                              {formatDollar(rents[idx] ?? 0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedDef.type === 'IT_UTILITY' && (
                    <div className="rounded-xl bg-[#0B0D14]/80 border border-white/[0.05] px-2.5 py-1 divide-y divide-white/[0.04]">
                      {itLabels.map((label, idx) => {
                        const active = activeRentIdx === idx;
                        const mult = rents[idx] ?? (idx === 0 ? 100 : 250);
                        const isTopTier = idx === 1;
                        return (
                          <div
                            key={label}
                            className={`flex items-center justify-between gap-2 py-1.5 text-[11.5px] ${
                              active
                                ? 'px-2 -mx-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 shadow-[0_0_14px_rgba(16,185,129,0.18)] text-[#6EE7B7] font-bold'
                                : isTopTier
                                ? 'text-[#E5B869] font-semibold'
                                : 'text-[#CBD5E1]'
                            }`}
                          >
                            <span>{isTopTier ? `${label} ★` : label}</span>
                            <span
                              className={`inline-flex items-center gap-1.5 font-mono-num font-bold ${
                                active
                                  ? 'text-[#6EE7B7]'
                                  : isTopTier
                                  ? 'text-[#E5B869]'
                                  : 'text-[#F8FAFC]'
                              }`}
                            >
                              <MiniDicePair />
                              <span>×{mult}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedDef.type === 'PROPERTY' && (
                    <div className="rounded-xl bg-[#0B0D14]/80 border border-white/[0.05] px-2.5 py-1 divide-y divide-white/[0.04]">
                      {propLabels.map((label, idx) => {
                        const active = activeRentIdx === idx;
                        const isMonopolyRow = idx === 5;
                        return (
                          <div
                            key={label}
                            className={`flex items-center justify-between gap-2 py-1 text-[11.5px] ${
                              active
                                ? 'px-2 -mx-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/45 shadow-[0_0_16px_rgba(16,185,129,0.22)] text-[#6EE7B7] font-bold'
                                : isMonopolyRow
                                ? 'text-[#E5B869] font-bold'
                                : idx % 2 === 1
                                ? 'bg-white/[0.015] text-[#CBD5E1]'
                                : 'text-[#CBD5E1]'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {active && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                              )}
                              <span>{label}</span>
                            </span>
                            <span
                              className={`font-mono-num font-bold ${
                                active
                                  ? 'text-[#6EE7B7]'
                                  : isMonopolyRow
                                  ? 'text-[#E5B869]'
                                  : 'text-[#F8FAFC]'
                              }`}
                            >
                              <span className="opacity-55 mr-0.5">$</span>
                              {formatDollar(rents[idx] ?? 0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Цены покупки / залога / выкупа / постройки */}
                  {selectedBuyable && (
                    <div className="rounded-xl bg-[#0B0D14]/55 border border-white/[0.04] px-2.5 py-1 divide-y divide-white/[0.04] text-[11.5px]">
                      <div className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[#94A3B8]">Покупка актива</span>
                        <span className="font-mono-num font-semibold text-[#F8FAFC]">
                          <span className="text-[#64748B] mr-0.5">$</span>
                          {formatDollar(selectedDef.price ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[#94A3B8]">Залог в банк</span>
                        <span className="font-mono-num font-semibold text-[#F8FAFC]">
                          <span className="text-[#64748B] mr-0.5">$</span>
                          {formatDollar(getMortgageValue(selectedDef.id))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[#94A3B8]">Выкуп залога</span>
                        <span className="font-mono-num font-semibold text-[#F8FAFC]">
                          <span className="text-[#64748B] mr-0.5">$</span>
                          {formatDollar(unmortgageCost)}
                        </span>
                      </div>
                      {selectedDef.type === 'PROPERTY' && branchCostVal > 0 && (
                        <div className="flex items-center justify-between gap-2 py-1">
                          <span className="text-[#94A3B8]">Постройка филиала ★</span>
                          <span className="font-mono-num font-semibold text-[#E5B869]">
                            <span className="opacity-65 mr-0.5">$</span>
                            {formatDollar(branchCostVal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Размер налога для налоговых клеток */}
                  {!selectedBuyable &&
                    selectedDef.type === 'TAX' &&
                    selectedDef.taxAmount !== undefined && (
                      <div className="rounded-xl bg-[#F43F5E]/10 border border-[#F43F5E]/30 px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[#FDA4AF] font-semibold">Штраф / Списание</span>
                        <span className="font-mono-num font-bold text-[#F43F5E] text-sm">
                          -${formatDollar(selectedDef.taxAmount)}
                        </span>
                      </div>
                    )}
                </div>

                {/* Закреплённый нижний футер: статус владельца и кнопки управления активом (всегда видны на мобильном и ПК) */}
                <div className="shrink-0 border-t border-white/10 bg-[#11141D]/98 px-4 py-2.5 text-[12px] space-y-2">
                  {selectedBuyable ? (
                    selectedOwner ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/25"
                            style={{ backgroundColor: selectedOwner.color }}
                          />
                          <span className="break-words font-semibold text-white">
                            {selectedOwner.name}
                          </span>
                        </span>
                        {selectedRt?.isMortgaged && (
                          <span className="shrink-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            🔒{' '}
                            {selectedRt.mortgageRoundsLeft
                              ? `${selectedRt.mortgageRoundsLeft} р.`
                              : 'В залоге'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                        <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                        <span>Свободное поле</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: headerHex }}
                      />
                      <span>Специальная клетка</span>
                    </div>
                  )}

                  {isMine && selectedRt && (
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      {!selectedRt.isMortgaged ? (
                        <>
                          {selectedDef.type === 'PROPERTY' && (
                            <button
                              type="button"
                              data-testid="prop-build-btn"
                              disabled={!buildCheck?.ok}
                              title={
                                buildCheck?.reason ??
                                `Построить филиал ($ ${formatDollar(branchCostVal)})`
                              }
                              onClick={() => {
                                soundEngine.playBuild();
                                props.onBuildBranch(selectedDef.id);
                              }}
                              className="btn-emerald-3d px-2.5 py-2 rounded-xl text-[11.5px] font-bold transition cursor-pointer"
                            >
                              + Филиал ★
                            </button>
                          )}
                          {selectedDef.type === 'PROPERTY' &&
                            selectedRt.branches > 0 && (
                              <button
                                type="button"
                                data-testid="prop-sell-branch-btn"
                                disabled={!sellCheck?.ok}
                                title={
                                  sellCheck?.reason ??
                                  'Продать филиал (50% стоимости)'
                                }
                                onClick={() => props.onSellBranch(selectedDef.id)}
                                className="px-2.5 py-2 rounded-xl text-[11.5px] font-bold bg-[#E5B869]/20 hover:bg-[#E5B869]/35 border border-[#E5B869]/50 text-[#F3D082] transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                              >
                                - Филиал
                              </button>
                            )}
                          <button
                            type="button"
                            data-testid="prop-mortgage-btn"
                            disabled={!mortgageCheck?.ok}
                            title={
                              mortgageCheck?.reason ??
                              `Заложить за $ ${formatDollar(
                                getMortgageValue(selectedDef.id)
                              )}`
                            }
                            onClick={() => props.onMortgage(selectedDef.id)}
                            className={`px-2.5 py-2 rounded-xl text-[11.5px] font-bold leading-tight bg-[#E5B869]/15 hover:bg-[#E5B869]/28 border border-[#E5B869]/55 text-[#F3D082] hover:text-white shadow-sm transition cursor-pointer disabled:bg-white/5 disabled:border-white/10 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed ${
                              selectedDef.type !== 'PROPERTY' ||
                              selectedRt.branches > 0
                                ? 'col-span-2'
                                : ''
                            }`}
                          >
                            🔒 Заложить (<span className="font-mono-num">+${formatDollar(getMortgageValue(selectedDef.id))}</span>)
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid="prop-unmortgage-btn"
                            disabled={!canUnmortgage}
                            title={
                              unmortgageCheck?.reason ??
                              `Выкупить за $ ${formatDollar(unmortgageCost)}`
                            }
                            onClick={() => props.onUnmortgage(selectedDef.id)}
                            className={`btn-emerald-3d px-2.5 py-2 rounded-xl text-[11.5px] font-bold transition cursor-pointer ${
                              showAuctionBtn ? '' : 'col-span-2'
                            }`}
                          >
                            Выкупить
                          </button>
                          {showAuctionBtn && (
                            <button
                              type="button"
                              data-testid="prop-auction-btn"
                              disabled={!canAuctionMortgaged}
                              title={
                                canAuctionMortgaged
                                  ? 'Выставить заложенное поле на аукцион'
                                  : 'Аукцион доступен в свой ход до броска кубиков'
                              }
                              onClick={() => {
                                props.onAuctionMortgaged(selectedDef.id);
                                onSelectCell(null);
                              }}
                              className="px-2.5 py-2 rounded-xl text-[11.5px] font-bold bg-indigo-600/85 hover:bg-indigo-500 text-white transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              Аукцион
                            </button>
                          )}
                        </>
                      )}
                      {!selectedRt.isMortgaged &&
                        selectedDef.type === 'PROPERTY' &&
                        !buildCheck?.ok &&
                        buildCheck?.reason && (
                          <div className="col-span-2 text-[10.5px] text-emerald-300/85 leading-snug pt-0.5">
                            🏗️ {buildCheck.reason}
                          </div>
                        )}
                      {!selectedRt.isMortgaged &&
                        !mortgageCheck?.ok &&
                        mortgageCheck?.reason && (
                          <div className="col-span-2 text-[10.5px] text-amber-300/85 leading-snug pt-0.5">
                            ℹ️ {mortgageCheck.reason}
                          </div>
                        )}
                      {selectedRt.isMortgaged &&
                        !canUnmortgage &&
                        unmortgageCheck?.reason && (
                          <div className="col-span-2 text-[10.5px] text-amber-300/85 leading-snug pt-0.5">
                            ℹ️ {unmortgageCheck.reason}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            );

            if (typeof document === 'undefined') return null;

            return createPortal(
              isMobileView ? (
                <div
                  className="fixed inset-0 z-[65] bg-black/68 backdrop-blur-[2px] flex items-center justify-center p-3"
                  onClick={() => onSelectCell(null)}
                >
                  {cardContent}
                </div>
              ) : (
                <>
                  <div
                    className="fixed inset-0 z-[64]"
                    onClick={() => onSelectCell(null)}
                    aria-hidden="true"
                  />
                  {cardContent}
                </>
              ),
              document.body
            );
          })()}
      </div>
    </div>
  );
};
