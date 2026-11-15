import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  getMortgageValue,
  getUnmortgageCost,
  txt,
} from '../../shared/rules.ts';
import { BoardCellDef, RoomState, TradeSide } from '../../shared/types.ts';
import { BoardTokensLayer } from './BoardTokensLayer.tsx';
import { CellArtwork } from './CellArtwork.tsx';
import { CenterStage, TradeDraftState } from './CenterStage.tsx';

const formatDollar = (value: number): string => value.toLocaleString('ru-RU');

function getCategoryBadge(
  groupId?: string,
  cellType?: BoardCellDef['type']
): { icon: string; label: string } {
  switch (groupId) {
    case 'food':
      return { icon: '🌯', label: 'Стритфуд' };
    case 'clothes':
      return { icon: '👕', label: 'Гардероб' };
    case 'cars':
      return { icon: '🚗', label: 'Автосеть' };
    case 'scam':
      return { icon: '📉', label: 'Инфобиз' };
    case 'booze':
      return { icon: '🍺', label: 'Бар' };
    case 'delivery':
      return { icon: '🛵', label: 'Логистика' };
    case 'gaming':
      return { icon: '🎮', label: 'Киберспорт' };
    case 'it':
      return { icon: '💻', label: 'IT-сеть' };
    case 'realty':
      return { icon: '🏢', label: 'Недвижимость' };
    case 'gadgets':
      return { icon: '📱', label: 'Техно-люкс' };
    default:
      if (cellType === 'CAR') return { icon: '🚗', label: 'Автосеть' };
      if (cellType === 'IT_UTILITY') return { icon: '💻', label: 'IT-сеть' };
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
        title: 'Бонус +1.5k',
        subtitle: 'Особое поле',
        description: 'Попав на это поле, вы получаете +1.500k.',
      };
    }
    if (def.type === 'CHANCE') {
      const isBon = def.id === 2 || def.id === 22;
      return {
        headerHex: '#65a30d',
        title: isBon ? 'Бонус +1.000k' : 'Штраф -1.000k',
        subtitle: 'Ретро-событие',
        description: isBon
          ? 'Вы получаете +1.000k из банка.'
          : 'Вы платите 1.000k в банк.',
      };
    }
  }

  const title = txt(def.name, def.cleanName, censored);
  const description = txt(def.subtitle, def.cleanSubtitle, censored);

  switch (def.type) {
    case 'START':
      return { headerHex: '#0f766e', title, subtitle: 'Старт', description };
    case 'JAIL':
      return { headerHex: '#64748b', title, subtitle: 'Особое поле', description };
    case 'POLICE':
      return { headerHex: '#64748b', title, subtitle: 'Нарушение правил', description };
    case 'CHANCE':
      return { headerHex: '#65a30d', title, subtitle: 'Случайное событие', description };
    case 'TAX':
      return { headerHex: '#0284c7', title, subtitle: 'Налог', description };
    case 'PORTAL':
      return { headerHex: '#0284c7', title, subtitle: 'Квантовый переход', description };
    case 'JACKPOT':
      if (russianRoulette) {
        return {
          headerHex: '#be123c',
          title: 'Русская рулетка',
          subtitle: 'Смертельный барабан',
          description:
            'Выберите 1–5 патронников: холостой даёт награду, пуля выводит из игры и освобождает все клетки.',
        };
      }
      return { headerHex: '#b45309', title, subtitle: 'Мини-игра', description };
    default:
      return { headerHex: '#475569', title, subtitle: 'Поле доски', description };
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

  const curPlayer = roomState.players[roomState.currentPlayerIndex];
  const isChoosingTarget =
    roomState.phase === 'CHOOSE_SPEED_TARGET' && curPlayer?.id === myPlayerId;
  const isChoosingPortalTarget =
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

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectCell(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPopoverOpen, onSelectCell]);

  useLayoutEffect(() => {
    if (!isPopoverOpen || selectedCellId === null) {
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
      const popW = popEl.offsetWidth || 252;
      const popH = popEl.offsetHeight || 280;
      const gap = 8;
      const pad = 8;

      const cLeft = cellRect.left - wrapRect.left;
      const cTop = cellRect.top - wrapRect.top;
      const cRight = cLeft + cellRect.width;
      const cBottom = cTop + cellRect.height;
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

      const minXWrap = pad;
      const maxXWrap = Math.max(pad, wrapRect.width - popW - pad);
      const minYWrap = pad;
      const maxYWrap = Math.max(pad, wrapRect.height - popH - pad);

      const minXView = pad - wrapRect.left;
      const maxXView = window.innerWidth - pad - popW - wrapRect.left;
      const minYView = pad - wrapRect.top;
      const maxYView = window.innerHeight - pad - popH - wrapRect.top;

      const minX = Math.max(minXWrap, minXView);
      const maxX = Math.min(maxXWrap, maxXView);
      const minY = Math.max(minYWrap, minYView);
      const maxY = Math.min(maxYWrap, maxYView);

      const clampedX =
        minX <= maxX
          ? Math.min(Math.max(x, minX), maxX)
          : Math.min(Math.max(x, minXView), Math.max(minXView, maxXView));
      const clampedY =
        minY <= maxY
          ? Math.min(Math.max(y, minY), maxY)
          : Math.min(Math.max(y, minYView), Math.max(minYView, maxYView));

      setPopoverPos({
        cellId: selectedCellId,
        left: Math.round(clampedX),
        top: Math.round(clampedY),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isPopoverOpen, selectedCellId, roomState.cells, roomState.players]);

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
      style={{ containerType: 'size' }}
      className="flex-1 w-full h-full flex items-center justify-center p-[4px] sm:p-[6px] overflow-hidden relative"
    >
      {/* Обёртка квадратной доски 11×11 — адаптивная под телефоны и десктопы с местом под внешние плашки цен */}
      <div
        ref={boardWrapRef}
        className="board-square-wrap relative shrink-0"
      >
        {/* Круглая кнопка выхода справа сверху у угла Тюрьмы (1:1 референс) */}
        <button
          data-testid="board-leave-btn"
          onClick={onLeaveRoom}
          title="Покинуть комнату"
          className="absolute -top-[18px] -right-[18px] sm:-top-[24px] sm:-right-[24px] w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#26272d] hover:bg-rose-600 text-neutral-300 hover:text-white text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-md transition cursor-pointer z-40"
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
          className="w-full h-full grid gap-[1px] sm:gap-[2px] bg-[#18191d] rounded-[12px] sm:rounded-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.65)] relative overflow-visible"
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
            if (buyable && group) {
              if (!owner) {
                outerTabText = `$${def.price ?? 0}`;
              } else if (rt?.isMortgaged) {
                outerTabText = rt.mortgageRoundsLeft ? `🔒${rt.mortgageRoundsLeft}` : '🔒';
              } else if (def.type === 'IT_UTILITY') {
                const bothOwned =
                  roomState.cells[12]?.ownerId === owner.id &&
                  roomState.cells[28]?.ownerId === owner.id &&
                  !roomState.cells[12]?.isMortgaged &&
                  !roomState.cells[28]?.isMortgaged;
                outerTabText = bothOwned ? '×250' : '×100';
              } else {
                outerTabText = `$${calculateDisplayRent(roomState.cells, def.id)}`;
              }
            }

            let displayShortName = txt(
              def.shortName || def.name,
              def.cleanShortName || def.cleanName,
              censored
            );
            if (retro) {
              if (def.type === 'JACKPOT') displayShortName = 'Парк отдыха';
              else if (def.type === 'PORTAL') displayShortName = 'Бонус +1.5k';
              else if (def.type === 'CHANCE') {
                const isBon = def.id === 2 || def.id === 22;
                displayShortName = isBon ? '+1.000k' : '-1.000k';
              }
            } else if (roomState.settings.russianRoulette && def.type === 'JACKPOT') {
              displayShortName = 'Рулетка';
            }

            // Скругление только на 4 внешних углах доски
            const cornerRadiusClass =
              def.id === 0
                ? 'rounded-tl-[10px] sm:rounded-tl-[16px]'
                : def.id === 10
                ? 'rounded-tr-[10px] sm:rounded-tr-[16px]'
                : def.id === 20
                ? 'rounded-br-[10px] sm:rounded-br-[16px]'
                : def.id === 30
                ? 'rounded-bl-[10px] sm:rounded-bl-[16px]'
                : '';

            // Полная заливка купленной клетки в стиле Monopoly One (логотип и текст остаются чёткими поверх заливки)
            const cellBgStyle: React.CSSProperties = {
              gridRow: pos.row,
              gridColumn: pos.col,
            };
            if (owner) {
              if (rt?.isMortgaged) {
                cellBgStyle.background = `repeating-linear-gradient(-45deg, color-mix(in srgb, ${owner.color} 42%, #cbd5e1), color-mix(in srgb, ${owner.color} 42%, #cbd5e1) 6px, #e2e8f0 6px, #e2e8f0 12px)`;
              } else {
                cellBgStyle.backgroundColor = `color-mix(in srgb, ${owner.color} 56%, #ffffff)`;
              }
            } else {
              cellBgStyle.backgroundColor = '#ffffff';
            }

            // Позиционирование внешней плашки цены/ренты по 4 сторонам (горизонтальный текст везде для лёгкого чтения)
            const outerTabPosClass =
              pos.side === 'top'
                ? '-top-[17px] sm:-top-[23px] left-0 right-0 h-[16px] sm:h-[22px] rounded-t-[4px] sm:rounded-t-[6px]'
                : pos.side === 'bottom'
                ? '-bottom-[17px] sm:-bottom-[23px] left-0 right-0 h-[16px] sm:h-[22px] rounded-b-[4px] sm:rounded-b-[6px]'
                : pos.side === 'left'
                ? '-left-[27px] sm:-left-[49px] xl:-left-[53px] top-0 bottom-0 w-[26px] sm:w-[48px] xl:w-[52px] rounded-l-[4px] sm:rounded-l-[6px]'
                : '-right-[27px] sm:-right-[49px] xl:-right-[53px] top-0 bottom-0 w-[26px] sm:w-[48px] xl:w-[52px] rounded-r-[4px] sm:rounded-r-[6px]';

            // Позиционирование звёзд филиалов на внутренней границе клетки, повернутой к чату (как в Monopoly One)
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
              roomState.status === 'PLAYING' && !!curPlayer && def.id === curPlayer.position;

            return (
              <div
                key={def.id}
                data-cell-id={def.id}
                style={cellBgStyle}
                onClick={() => handleCellClick(def.id)}
                title={displayShortName}
                className={`relative min-w-0 min-h-0 select-none cursor-pointer transition-all duration-200 overflow-visible ${cornerRadiusClass} ${
                  tradeDraft.open && !isTradableInDraft
                    ? 'opacity-30 brightness-75'
                    : activeTr && !isTradeGive && !isTradeReceive
                    ? 'opacity-45 brightness-75'
                    : isDimmedForTarget
                    ? 'opacity-45 brightness-75'
                    : ''
                } ${
                  isValidSpeedTarget
                    ? 'ring-[4px] ring-fuchsia-400 shadow-[0_0_26px_rgba(232,121,249,0.95),inset_0_0_18px_rgba(217,70,239,0.5)] scale-[1.04] z-30'
                    : isChoosingPortalTarget && isPortalCandidate
                    ? portalHighlightSet.size <= 8
                      ? 'ring-[4px] ring-cyan-400 shadow-[0_0_26px_rgba(34,211,238,0.95),inset_0_0_18px_rgba(6,182,212,0.5)] scale-[1.04] z-30'
                      : 'ring-2 ring-cyan-400/90 shadow-[inset_0_0_12px_rgba(6,182,212,0.4)] hover:scale-[1.06] hover:z-30 z-10'
                    : isTradeGive
                    ? 'ring-[4px] ring-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.95)] z-30 scale-[1.05]'
                    : isTradeReceive
                    ? 'ring-[4px] ring-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.95)] z-30 scale-[1.05]'
                    : isSelected
                    ? 'ring-[3.5px] ring-amber-400 shadow-[0_14px_28px_rgba(0,0,0,0.65),0_0_22px_rgba(251,191,36,0.85)] z-30 scale-[1.07] -translate-y-1'
                    : isCurrentPlayerCell
                    ? 'ring-2 ring-white/90 shadow-[0_0_16px_rgba(255,255,255,0.55)] z-20 hover:scale-[1.03] hover:-translate-y-0.5'
                    : rt && rt.branches > 0
                    ? 'z-20 hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,0,0,0.4)] hover:brightness-95'
                    : 'hover:scale-[1.03] hover:-translate-y-0.5 hover:z-20 hover:shadow-[0_8px_18px_rgba(0,0,0,0.4)] hover:brightness-95'
                }`}
              >
                {/* Полоска цвета отрасли на купленной клетке, чтобы видеть монополию */}
                {owner && group && pos.side !== 'corner' && (
                  <div
                    style={{ backgroundColor: group.accentHex }}
                    className={`pointer-events-none absolute z-10 ${
                      pos.side === 'top'
                        ? 'top-0 left-0 right-0 h-[3px]'
                        : pos.side === 'bottom'
                        ? 'bottom-0 left-0 right-0 h-[3px]'
                        : pos.side === 'left'
                        ? 'left-0 top-0 bottom-0 w-[3px]'
                        : 'right-0 top-0 bottom-0 w-[3px]'
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
                {/* Внешняя цветная плашка цены (свободно) или ренты (куплено) */}
                {buyable && group && outerTabText && (
                  <div
                    key={`${def.id}_${outerTabText}`}
                    style={{
                      backgroundColor: rt?.isMortgaged
                        ? '#52525b'
                        : owner
                        ? owner.color
                        : group.accentHex,
                      textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)',
                    }}
                    className={`pointer-events-none absolute ${outerTabPosClass} flex items-center justify-center text-[8px] sm:text-[11px] xl:text-[12.5px] font-black text-white tracking-normal tabular-nums leading-none whitespace-nowrap border border-black/25 shadow-md animate-tab-flip`}
                  >
                    {outerTabText}
                  </div>
                )}

                {/* Звёздочки филиалов (1..4 белые ★) или золотая ★ за полную застройку, повернутые к чату */}
                {rt && rt.branches > 0 && (
                  <div
                    className={`pointer-events-none absolute ${branchPosClass} flex items-center justify-center gap-[1px] z-30`}
                  >
                    {rt.branches >= 5 ? (
                      <span
                        style={{
                          textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.95)',
                        }}
                        className="text-[12px] sm:text-[15px] xl:text-[17px] leading-none text-amber-400 font-black"
                      >
                        ★
                      </span>
                    ) : (
                      Array.from({ length: rt.branches }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.95)',
                          }}
                          className="text-[9px] sm:text-[11px] xl:text-[13px] leading-none text-white font-black"
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
                    <span className="bg-neutral-900/85 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
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
                    <span className="px-1.5 py-0.5 rounded-md bg-rose-600/95 text-white text-[8px] sm:text-[9px] font-black tracking-tight shadow-lg border border-white/80 whitespace-nowrap">
                      {tradeGiveLabel}
                    </span>
                  </div>
                )}
                {isTradeReceive && (
                  <div
                    data-testid="trade-cell-receive"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
                  >
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-600/95 text-white text-[8px] sm:text-[9px] font-black tracking-tight shadow-lg border border-white/80 whitespace-nowrap">
                      {tradeReceiveLabel}
                    </span>
                  </div>
                )}

                {/* Внутренняя иллюстрация и подпись карточки */}
                {pos.side === 'corner' ? (
                  <div
                    className={`w-full h-full p-1 flex items-center justify-center overflow-hidden ${cornerRadiusClass}`}
                  >
                    {def.id === 0 ? (
                      <img
                        src="/art/corner_start.png"
                        alt={displayShortName}
                        className="w-full h-full object-contain mix-blend-multiply"
                      />
                    ) : def.id === 30 ? (
                      <img
                        src="/art/corner_police.png"
                        alt={displayShortName}
                        className="w-full h-full object-contain mix-blend-multiply"
                      />
                    ) : (
                      <CellArtwork
                        cellId={def.id}
                        side="corner"
                        censored={censored}
                        russianRoulette={roomState.settings.russianRoulette}
                        className="w-full h-full"
                      />
                    )}
                  </div>
                ) : (
                  /* Единый вертикальный стиль для всех 36 боковых карточек (покупаемых и спецполей) */
                  <div className="w-full h-full px-0.5 py-0.5 flex flex-col items-center justify-between overflow-hidden min-w-0 min-h-0">
                    <div className="flex-1 min-h-0 min-w-0 w-full flex items-center justify-center p-0.5 overflow-hidden">
                      <CellArtwork
                        cellId={def.id}
                        side={pos.side}
                        censored={censored}
                        className={
                          pos.side === 'left' || pos.side === 'right'
                            ? 'max-w-full max-h-full w-[62%] h-[88%]'
                            : 'max-w-full max-h-full w-[82%] h-[88%]'
                        }
                      />
                    </div>
                    <span className="shrink-0 w-full text-center text-[6px] sm:text-[8.5px] xl:text-[9.5px] font-extrabold text-neutral-900 leading-[1.05] pb-[1px] px-0.5 break-words line-clamp-2">
                      {displayShortName}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Центральная арена 9×9 с действиями, кубиками, договорами и чатом */}
          <CenterStage {...props} />
        </div>

        {/* Слой анимированных фишек поверх доски (с пошаговым скольжением и прыжками) */}
        <BoardTokensLayer
          players={roomState.players}
          currentPlayerId={curPlayer?.id}
          isPlaying={roomState.status === 'PLAYING'}
        />

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
            const bodyDescription =
              selectedDef.type === 'CAR'
                ? 'Аренда зависит от количества Автомобилей, которыми вы владеете.'
                : selectedDef.type === 'IT_UTILITY'
                ? 'Аренда зависит от суммы чисел на кубиках и от количества IT-компаний, которыми вы владеете.'
                : selectedDef.type === 'PROPERTY'
                ? 'Отрасль приносит повышенную ренту при сборе монополии и строительстве филиалов.'
                : specialMeta.description;

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
            const myPlayer = isMine
              ? roomState.players.find((p) => p.id === myPlayerId)
              : undefined;
            const buildCheck = isMine
              ? canBuildBranch(roomState, myPlayerId, selectedDef.id)
              : null;
            const sellCheck = isMine
              ? canSellBranch(roomState, myPlayerId, selectedDef.id)
              : null;
            const mortgageCheck = isMine
              ? canMortgageCell(roomState, myPlayerId, selectedDef.id)
              : null;
            const unmortgageCost = getUnmortgageCost(selectedDef.id);
            const canUnmortgage = (myPlayer?.cash ?? 0) >= unmortgageCost;
            const isMyTurn = curPlayer?.id === myPlayerId;
            const showAuctionBtn = roomState.settings.auctionsEnabled && !retro;
            const canAuctionMortgaged =
              showAuctionBtn &&
              isMyTurn &&
              roomState.phase === 'PRE_ROLL';

            const branchCostVal =
              selectedDef.branchCost ?? selectedGroup?.branchCost ?? 0;

            return (
              <>
                <div
                  className="fixed inset-0 z-30 max-sm:bg-black/60 max-sm:backdrop-blur-[2px]"
                  onClick={() => onSelectCell(null)}
                  aria-hidden="true"
                />
                <div
                  ref={popoverRef}
                  role="dialog"
                  aria-label={headerTitle}
                  onClick={(e) => e.stopPropagation()}
                  style={{
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
                  }}
                  className="absolute w-[252px] max-sm:!fixed max-sm:!left-1/2 max-sm:!top-1/2 max-sm:!-translate-x-1/2 max-sm:!-translate-y-1/2 max-sm:w-[min(92vw,310px)] max-sm:max-h-[82dvh] max-sm:overflow-y-auto bg-[#222327] text-[#e4e4e7] rounded-[14px] shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/10 overflow-hidden z-40 max-sm:z-50"
                >
                  {/* Цветная шапка карточки */}
                  <div
                    style={{ backgroundColor: headerHex }}
                    className="px-4 py-3 relative pr-9"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCell(null)}
                      aria-label="Закрыть карточку"
                      className="sm:hidden absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                    {catBadge ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/25 border border-white/25 text-[10.5px] font-bold text-white/95 mb-1.5 shadow-xs">
                        <span>{catBadge.icon}</span>
                        <span>{catBadge.label}</span>
                        <span className="opacity-60">•</span>
                        <span>{headerSubtitle}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-white/80 font-semibold uppercase tracking-wide mb-0.5">
                        {headerSubtitle}
                      </div>
                    )}
                    <div className="text-[15px] font-bold text-white leading-tight drop-shadow-xs">
                      {headerTitle}
                    </div>
                  </div>

                  {/* Тело карточки */}
                  <div className="px-4 py-3.5 text-[12px] space-y-3">
                    <p className="text-[#a1a1aa] leading-[1.35]">
                      {bodyDescription}
                    </p>

                    {/* Таблица ренты для покупаемых полей */}
                    {selectedDef.type === 'CAR' && (
                      <div className="space-y-1.5 text-[#d4d4d8]">
                        {carLabels.map((label, idx) => {
                          const active = activeRentIdx === idx;
                          return (
                            <div
                              key={label}
                              className={`flex items-center justify-between gap-2 ${
                                active ? 'text-lime-400 font-bold' : ''
                              }`}
                            >
                              <span>{label}</span>
                              <span className="tabular-nums">
                                <span
                                  className={`${
                                    active ? 'text-lime-400/75' : 'text-[#71717a]'
                                  } mr-1`}
                                >
                                  $
                                </span>
                                {formatDollar(rents[idx] ?? 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedDef.type === 'IT_UTILITY' && (
                      <div className="space-y-1.5 text-[#d4d4d8]">
                        {itLabels.map((label, idx) => {
                          const active = activeRentIdx === idx;
                          const mult = rents[idx] ?? (idx === 0 ? 100 : 250);
                          return (
                            <div
                              key={label}
                              className={`flex items-center justify-between gap-2 ${
                                active ? 'text-lime-400 font-bold' : ''
                              }`}
                            >
                              <span>{label}</span>
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <MiniDicePair />
                                <span>× {mult}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedDef.type === 'PROPERTY' && (
                      <div className="space-y-1.5 text-[#d4d4d8]">
                        {propLabels.map((label, idx) => {
                          const active = activeRentIdx === idx;
                          return (
                            <div
                              key={label}
                              className={`flex items-center justify-between gap-2 ${
                                active ? 'text-lime-400 font-bold' : ''
                              }`}
                            >
                              <span>{label}</span>
                              <span className="tabular-nums">
                                <span
                                  className={`${
                                    active ? 'text-lime-400/75' : 'text-[#71717a]'
                                  } mr-1`}
                                >
                                  $
                                </span>
                                {formatDollar(rents[idx] ?? 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Цены покупки / залога / выкупа / постройки */}
                    {selectedBuyable && (
                      <>
                        <div className="border-t border-white/10 my-2" />
                        <div className="space-y-1.5 text-[#d4d4d8]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#a1a1aa]">Покупка поля</span>
                            <span className="tabular-nums font-medium">
                              <span className="text-[#71717a] mr-1">$</span>
                              {formatDollar(selectedDef.price ?? 0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#a1a1aa]">Залог поля</span>
                            <span className="tabular-nums font-medium">
                              <span className="text-[#71717a] mr-1">$</span>
                              {formatDollar(getMortgageValue(selectedDef.id))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#a1a1aa]">Выкуп поля</span>
                            <span className="tabular-nums font-medium">
                              <span className="text-[#71717a] mr-1">$</span>
                              {formatDollar(unmortgageCost)}
                            </span>
                          </div>
                          {selectedDef.type === 'PROPERTY' && branchCostVal > 0 && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[#a1a1aa]">Постройка филиала</span>
                              <span className="tabular-nums font-medium">
                                <span className="text-[#71717a] mr-1">$</span>
                                {formatDollar(branchCostVal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Размер налога для налоговых клеток */}
                    {!selectedBuyable &&
                      selectedDef.type === 'TAX' &&
                      selectedDef.taxAmount !== undefined && (
                        <>
                          <div className="border-t border-white/10 my-2" />
                          <div className="flex items-center justify-between gap-2 text-[#d4d4d8]">
                            <span className="text-[#a1a1aa]">Размер налога</span>
                            <span className="tabular-nums font-semibold">
                              <span className="text-[#71717a] mr-1">$</span>
                              {formatDollar(selectedDef.taxAmount)}
                            </span>
                          </div>
                        </>
                      )}

                    {/* Статус владельца и кнопки управления своим активом */}
                    <div className="border-t border-white/10 pt-2.5 space-y-2">
                      {selectedBuyable ? (
                        selectedOwner ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/25"
                                style={{ backgroundColor: selectedOwner.color }}
                              />
                              <span className="truncate font-semibold text-white">
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
                                  disabled={!buildCheck?.ok}
                                  title={
                                    buildCheck?.reason ??
                                    `Построить филиал ($ ${formatDollar(branchCostVal)})`
                                  }
                                  onClick={() => props.onBuildBranch(selectedDef.id)}
                                  className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600/90 hover:bg-emerald-500 text-white transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                                >
                                  + Филиал
                                </button>
                              )}
                              {selectedDef.type === 'PROPERTY' &&
                                selectedRt.branches > 0 && (
                                  <button
                                    type="button"
                                    disabled={!sellCheck?.ok}
                                    title={
                                      sellCheck?.reason ??
                                      'Продать филиал (50% стоимости)'
                                    }
                                    onClick={() => props.onSellBranch(selectedDef.id)}
                                    className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600/85 hover:bg-amber-500 text-white transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                                  >
                                    - Филиал
                                  </button>
                                )}
                              <button
                                type="button"
                                disabled={!mortgageCheck?.ok}
                                title={
                                  mortgageCheck?.reason ??
                                  `Заложить за $ ${formatDollar(
                                    getMortgageValue(selectedDef.id)
                                  )}`
                                }
                                onClick={() => props.onMortgage(selectedDef.id)}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold leading-tight bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/75 text-amber-200 hover:text-white shadow-sm transition cursor-pointer disabled:bg-white/5 disabled:border-white/10 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed ${
                                  selectedDef.type !== 'PROPERTY' ||
                                  selectedRt.branches > 0
                                    ? 'col-span-2'
                                    : ''
                                }`}
                              >
                                🔒 Заложить (+${formatDollar(getMortgageValue(selectedDef.id))})
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={!canUnmortgage}
                                title={
                                  canUnmortgage
                                    ? `Выкупить за $ ${formatDollar(unmortgageCost)}`
                                    : `Недостаточно средств ($ ${formatDollar(
                                        unmortgageCost
                                      )})`
                                }
                                onClick={() => props.onUnmortgage(selectedDef.id)}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600/90 hover:bg-emerald-500 text-white transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed ${
                                  showAuctionBtn ? '' : 'col-span-2'
                                }`}
                              >
                                Выкупить
                              </button>
                              {showAuctionBtn && (
                                <button
                                  type="button"
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
                                  className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600/85 hover:bg-indigo-500 text-white transition cursor-pointer disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
      </div>
    </div>
  );
};
