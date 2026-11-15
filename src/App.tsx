import React, { useEffect, useState } from 'react';
import { BOARD_CELLS } from '../shared/boardData.ts';
import { TAUNT_COOLDOWN_MS, TAUNTS } from '../shared/memeContent.ts';
import { formatMoney, getTokenWalkDurationMs, txt } from '../shared/rules.ts';
import { useGameSocket } from './hooks/useGameSocket.ts';
import { LobbyView } from './components/LobbyView.tsx';
import { PlayersSidebar } from './components/PlayersSidebar.tsx';
import { BoardGrid } from './components/BoardGrid.tsx';
import { TradeDraftState } from './components/CenterStage.tsx';
import { Modals } from './components/Modals.tsx';
import { BankruptcyOverlay } from './components/BankruptcyOverlay.tsx';
import { PlayerAvatar } from './components/PlayerAvatar.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { AvatarCreatorModal } from './components/AvatarCreatorModal.tsx';

export const App: React.FC = () => {
  const {
    connected,
    profile,
    authAccount,
    updateLocalProfile,
    registerAccount,
    loginAccount,
    logoutAccount,
    publicRooms,
    roomState,
    errorToast,
    activeTaunts,
    bankruptcyAnim,
    censored,
    clientCensorOverride,
    toggleClientCensor,
    actions,
  } = useGameSocket();

  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [profileModalPlayerId, setProfileModalPlayerId] = useState<string | null>(null);
  const [avatarCreatorOpen, setAvatarCreatorOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'BOARD' | 'PLAYERS'>('BOARD');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [tradeDraft, setTradeDraft] = useState<TradeDraftState>({
    open: false,
    partnerId: '',
    offerCash: 0,
    reqCash: 0,
    offerProps: [],
    reqProps: [],
    offerShields: 0,
    reqShields: 0,
  });

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const openTradeWith = (targetId?: string) => {
    if (!roomState) return;
    if ((roomState.tradesProposedThisTurn ?? 0) >= 3) return;
    const others = roomState.players.filter(
      (p) => !p.isBankrupt && p.id !== profile.playerId
    );
    const chosen = targetId || others[0]?.id || '';
    if (!chosen) return;
    const curPlayer = roomState.players[roomState.currentPlayerIndex];
    if (curPlayer?.id === profile.playerId) {
      actions.notifyTradeDraftOpen();
    }
    setSelectedCellId(null);
    setMobileTab('BOARD');
    setTradeDraft({
      open: true,
      partnerId: chosen,
      offerCash: 0,
      reqCash: 0,
      offerProps: [],
      reqProps: [],
      offerShields: 0,
      reqShields: 0,
    });
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#08090C] text-[#F1F5F9] relative">
      {/* Глубокий обсидиановый фон сцены с мягким радиальным золотым свечением из-под стола и тонким SVG-шумом */}
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at center, rgba(226, 184, 107, 0.06) 0%, transparent 70%)',
        }}
        className="pointer-events-none fixed inset-0 z-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-svg-noise opacity-[0.025] z-0"
      />

      {/* Всплывающий тост ошибки */}
      {errorToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-[#1A1016]/95 backdrop-blur-xl text-rose-100 px-4 py-2 rounded-2xl text-xs font-extrabold shadow-2xl border border-[#F43F5E]/55">
          ⚠️ {errorToast}
        </div>
      )}

      {!roomState || roomState.status === 'LOBBY' ? (
        <LobbyView
          connected={connected}
          profile={profile}
          authAccount={authAccount}
          onUpdateProfile={updateLocalProfile}
          onOpenProfile={(pid) => setProfileModalPlayerId(pid || profile.playerId)}
          onOpenAvatarCreator={() => setAvatarCreatorOpen(true)}
          publicRooms={publicRooms}
          roomState={roomState}
          censored={censored}
          clientCensorOverride={clientCensorOverride}
          onToggleClientCensor={toggleClientCensor}
          onCreateRoom={actions.createRoom}
          onJoinRoom={actions.joinRoom}
          onLeaveRoom={actions.leaveRoom}
          onUpdateSettings={actions.updateSettings}
          onAddBot={actions.addBot}
          onRemovePlayer={actions.removePlayer}
          onSwapSeat={actions.swapSeat}
          onStartGame={actions.startGame}
        />
      ) : (
        <>
          {/* Мобильный переключатель (< 1024px) */}
          <div className="lg:hidden relative z-10 flex items-center justify-between gap-2 bg-[#0F1117]/92 backdrop-blur-xl border-b border-white/[0.08] py-1.5 px-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'BOARD' as const, label: '🎲 Поле' },
                { id: 'PLAYERS' as const, label: `👥 Игроки (${roomState.players.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMobileTab(t.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    mobileTab === t.id
                      ? 'btn-emerald-3d text-white'
                      : 'bg-[#161922] border border-white/10 text-neutral-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono-num font-bold text-[#E5B869] shrink-0">
              #{roomState.code} · {roomState.round}р
            </span>
          </div>

          {/* Мобильная компактная полоса игроков поверх поля (< 1024px) */}
          {mobileTab === 'BOARD' && (
            <div
              data-testid="mobile-players-strip"
              className="lg:hidden relative z-10 flex items-center gap-1.5 px-2 py-1.5 bg-[#0C0E14]/90 backdrop-blur-xl border-b border-white/[0.07] overflow-x-auto chat-scrollbar shrink-0"
            >
              {roomState.players.map((p, idx) => {
                const isActive =
                  idx === roomState.currentPlayerIndex && roomState.status === 'PLAYING';
                const turnSec =
                  isActive && roomState.turnDeadlineAt
                    ? Math.max(0, Math.ceil((roomState.turnDeadlineAt - nowMs) / 1000))
                    : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMobileTab('PLAYERS')}
                    style={
                      p.isBankrupt
                        ? undefined
                        : isActive
                        ? {
                            borderLeftColor: p.color,
                            boxShadow: `0 0 14px ${p.color}4D, inset 0 1px 0 rgba(255,255,255,0.12)`,
                          }
                        : { borderLeftColor: p.color }
                    }
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-left transition cursor-pointer ${
                      p.isBankrupt
                        ? 'bg-[#0E1016] border-white/[0.06] opacity-50 text-neutral-500'
                        : isActive
                        ? 'bg-[#141720] border-[#E5B869]/55 border-l-[3.5px] text-[#F8FAFC]'
                        : 'bg-[#141720]/90 border-[#222736] border-l-[3.5px] text-neutral-200'
                    }`}
                  >
                    <span className="text-sm leading-none shrink-0 inline-flex items-center">
                      <PlayerAvatar avatar={p.avatar} />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-[10px] font-bold truncate max-w-[68px] flex items-center gap-1">
                        <span>{p.name}</span>
                        {isActive && turnSec !== null && (
                          <span className="text-[9px] font-mono-num font-bold text-[#E5B869]">
                            {turnSec}с
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] font-mono-num font-extrabold text-[#F8FAFC]">
                        {p.isBankrupt ? 'RIP' : formatMoney(p.cash)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Единый сбалансированный игровой кокпит без пустой дыры между HUD игроков и полем */}
          <div className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center gap-2 lg:gap-3 xl:gap-4 px-1 sm:px-3 overflow-hidden">
            <div
              className={`${
                mobileTab === 'PLAYERS' ? 'flex w-full justify-center' : 'hidden'
              } lg:flex h-full shrink-0 items-center`}
            >
              <PlayersSidebar
                roomState={roomState}
                myPlayerId={profile.playerId}
                activeTaunts={activeTaunts}
                censored={censored}
                nowMs={nowMs}
                onToggleCensor={toggleClientCensor}
                onOpenTradeWith={openTradeWith}
                onStartKickVote={actions.startKickVote}
                onOpenCredit={() => setCreditModalOpen(true)}
                onOpenProfile={(pid) => setProfileModalPlayerId(pid)}
                onSendTaunt={actions.sendTaunt}
                onSurrender={actions.surrender}
                onLeaveRoom={actions.leaveRoom}
              />
            </div>

            <div
              className={`${
                mobileTab === 'BOARD' ? 'flex' : 'hidden'
              } lg:flex flex-1 lg:flex-none min-w-0 h-full items-center justify-center overflow-hidden lg:overflow-visible`}
            >
              <BoardGrid
                roomState={roomState}
                myPlayerId={profile.playerId}
                selectedCellId={selectedCellId}
                onSelectCell={setSelectedCellId}
                onChooseSpeedTarget={actions.chooseSpeedTarget}
                censored={censored}
                onToggleCensor={toggleClientCensor}
                nowMs={nowMs}
                onRoll={actions.rollDice}
                onPayJail={actions.payJail}
                onBuy={actions.buyProperty}
                onDeclineBuy={actions.declineProperty}
                onPayDebt={actions.payDebt}
                onEndTurn={actions.endTurn}
                onBuildBranch={actions.buildBranch}
                onSellBranch={actions.sellBranch}
                onMortgage={actions.mortgage}
                onUnmortgage={actions.unmortgage}
                onAuctionMortgaged={actions.auctionMortgaged}
                onDuelRestart={actions.duelRestart}
                onSurrender={actions.surrender}
                onLeaveRoom={actions.leaveRoom}
                onSendChat={actions.sendChat}
                onReactLog={actions.reactToLog}
                onOpenCredit={() => setCreditModalOpen(true)}
                onBidAuction={actions.bidAuction}
                onPassAuction={actions.passAuction}
                onPortalAdd={actions.portalAddDirection}
                onPortalJump={actions.portalJump}
                onPlayJackpot={actions.playJackpot}
                tradeDraft={tradeDraft}
                onChangeTradeDraft={setTradeDraft}
                onProposeTrade={actions.proposeTrade}
                onRespondTrade={actions.respondTrade}
                onCastKickVote={actions.castKickVote}
              />
            </div>
          </div>

          {/* Мобильная нижняя панель быстрого управления под палец (< 1024px) */}
          {mobileTab === 'BOARD' &&
            (() => {
              const curPlayer = roomState.players[roomState.currentPlayerIndex];
              const isMyTurn = curPlayer?.id === profile.playerId;
              const me = roomState.players.find((p) => p.id === profile.playerId);
              const tauntCooldownLeft = roomState.lastTauntAt
                ? Math.max(0, Math.ceil((roomState.lastTauntAt + TAUNT_COOLDOWN_MS - nowMs) / 1000))
                : 0;
              const walkMs = getTokenWalkDurationMs(roomState.lastDice);
              const isWalkingToChance =
                roomState.phase === 'CHANCE' &&
                !!roomState.lastCardPopup &&
                nowMs - roomState.lastCardPopup.timestamp < roomState.lastCardPopup.walkDurationMs;
              const isWalkingAfterRoll =
                isWalkingToChance ||
                (!!roomState.lastDice &&
                  nowMs - roomState.lastDice.timestamp < walkMs &&
                  (roomState.phase !== 'PRE_ROLL' ||
                    roomState.lastDice.rolledBy === profile.playerId));
              const auc = roomState.auction;
              const canIBidAuction =
                !!auc &&
                roomState.phase === 'AUCTION' &&
                !isWalkingAfterRoll &&
                auc.currentBidderId === profile.playerId &&
                !auc.passedIds.includes(profile.playerId);
              const curAucBidder = auc?.currentBidderId
                ? roomState.players.find((p) => p.id === auc.currentBidderId)
                : null;

              return (
                <div
                  data-testid="mobile-action-dock"
                  className="lg:hidden bg-[#0F1117]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2.5 py-2 space-y-1.5 shrink-0 z-20"
                >
                  {!tradeDraft.open &&
                  !isWalkingAfterRoll &&
                  roomState.status === 'PLAYING' &&
                  roomState.phase === 'AUCTION' &&
                  auc ? (
                    canIBidAuction ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-extrabold text-[#6EE7B7] text-center">
                          🎯 Ваша очередь на торгах (от{' '}
                          <span className="font-mono-num">${auc.currentBid + 100}</span>)
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[100, 300, 500].map((step) => (
                            <button
                              key={step}
                              type="button"
                              disabled={(me?.cash ?? 0) < auc.currentBid + step}
                              onClick={() => actions.bidAuction(step)}
                              className="btn-emerald-3d active:translate-y-0.5 py-1.5 rounded-xl font-mono-num font-extrabold text-xs cursor-pointer leading-tight"
                            >
                              <div>+${step}</div>
                              <div className="text-[9px] opacity-85">${auc.currentBid + step}</div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={actions.passAuction}
                            className="py-1.5 rounded-xl bg-[#171B26] hover:bg-[#F43F5E] border border-white/12 text-neutral-100 font-bold text-xs cursor-pointer transition"
                          >
                            Пас
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1 text-xs font-semibold text-neutral-300 truncate flex items-center justify-center gap-1">
                        <span>
                          🔨 Ставка{' '}
                          <b className="font-mono-num text-[#E5B869]">
                            ${auc.highestBidderId ? auc.currentBid : auc.currentBid + 100}
                          </b>{' '}
                          · Ход:
                        </span>
                        <span style={{ color: curAucBidder?.color }} className="font-extrabold inline-flex items-center gap-1">
                          {curAucBidder ? (
                            <>
                              <PlayerAvatar avatar={curAucBidder.avatar} />
                              <span>{curAucBidder.name}</span>
                            </>
                          ) : (
                            '...'
                          )}
                        </span>
                      </div>
                    )
                  ) : !tradeDraft.open &&
                    !isWalkingAfterRoll &&
                    isMyTurn &&
                    roomState.status === 'PLAYING' &&
                    curPlayer ? (
                    <>
                      {roomState.phase === 'PRE_ROLL' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={actions.rollDice}
                            className="btn-emerald-3d active:translate-y-1 flex-1 py-2.5 rounded-xl font-display font-extrabold text-xs tracking-wider uppercase cursor-pointer"
                          >
                            🎲 БРОСИТЬ КУБИКИ
                          </button>
                          {me?.inJail && me.cash >= 500 && (
                            <button
                              type="button"
                              onClick={actions.payJail}
                              className="px-3 py-2.5 rounded-xl bg-[#162032] border border-sky-400/40 text-sky-100 font-mono-num font-bold text-xs cursor-pointer shrink-0"
                            >
                              🔓 $500
                            </button>
                          )}
                          {roomState.settings.mode === 'duel_restart' &&
                            roomState.round <= 20 && (
                              <button
                                type="button"
                                onClick={actions.duelRestart}
                                className="px-3 py-2.5 rounded-xl bg-fuchsia-600/80 text-white font-bold text-xs cursor-pointer shrink-0"
                              >
                                🔄 Рестарт
                              </button>
                            )}
                        </div>
                      )}

                      {roomState.phase === 'BUY_DECISION' && (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={
                              (me?.cash ?? 0) < (BOARD_CELLS[curPlayer.position].price ?? 0)
                            }
                            onClick={actions.buyProperty}
                            className="btn-emerald-3d active:translate-y-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                          >
                            Купить за{' '}
                            <span className="font-mono-num font-extrabold">
                              ${BOARD_CELLS[curPlayer.position].price ?? 0}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={actions.declineProperty}
                            className="py-2.5 rounded-xl bg-[#171B26] border border-white/12 text-neutral-100 font-bold text-xs cursor-pointer"
                          >
                            {roomState.settings.auctionsEnabled && !roomState.settings.retroRules
                              ? '🔨 На аукцион'
                              : 'Пропустить'}
                          </button>
                        </div>
                      )}

                      {roomState.phase === 'PENDING_DEBT' && roomState.pendingDebt && (
                        (me?.cash ?? 0) >= roomState.pendingDebt.amount ? (
                          <button
                            type="button"
                            onClick={actions.payDebt}
                            className="btn-emerald-3d active:translate-y-1 w-full py-2.5 rounded-xl font-display font-bold text-xs cursor-pointer"
                          >
                            💸 Оплатить долг{' '}
                            <span className="font-mono-num">${roomState.pendingDebt.amount}</span>
                          </button>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCreditModalOpen(true)}
                              className="btn-gold-3d py-2.5 rounded-xl font-display font-extrabold text-xs cursor-pointer"
                            >
                              🏦 Займ банка
                            </button>
                            <button
                              type="button"
                              onClick={actions.surrender}
                              className="py-2.5 rounded-xl bg-[#F43F5E] text-white font-bold text-xs cursor-pointer"
                            >
                              🏳️ Банкротство
                            </button>
                          </div>
                        )
                      )}

                      {roomState.phase === 'PORTAL' && roomState.portal && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 overflow-x-auto chat-scrollbar pb-0.5">
                            {roomState.portal.candidateCells.map((cid) => {
                              const cDef = BOARD_CELLS[cid];
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => actions.portalJump(cid)}
                                  className="shrink-0 px-2 py-1 rounded-full bg-[#131826] border border-[#E5B869]/45 text-[#F1F5F9] text-[11px] font-bold cursor-pointer"
                                >
                                  {cDef.icon}{' '}
                                  {txt(cDef.shortName || cDef.name, cDef.cleanShortName || cDef.cleanName, censored)}
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              disabled={
                                roomState.portal.candidateCells.length >= 8 ||
                                (me?.cash ?? 0) < 500
                              }
                              onClick={actions.portalAddDirection}
                              className="py-2 rounded-xl bg-[#171B26] border border-white/12 disabled:opacity-40 text-neutral-100 font-bold text-xs cursor-pointer"
                            >
                              + Точка (<span className="font-mono-num">$500</span>)
                            </button>
                            <button
                              type="button"
                              onClick={() => actions.portalJump()}
                              className="btn-emerald-3d active:translate-y-1 py-2 rounded-xl font-bold text-xs cursor-pointer"
                            >
                              🌀 Случайный прыжок
                            </button>
                          </div>
                        </div>
                      )}

                      {roomState.phase === 'CHANCE' && (
                        <button
                          type="button"
                          onClick={actions.ackChance}
                          className="btn-emerald-3d active:translate-y-1 w-full py-2.5 rounded-xl font-display font-bold text-xs cursor-pointer"
                        >
                          Применить Шанс 🃏
                        </button>
                      )}

                      {roomState.phase === 'CHOOSE_SPEED_TARGET' && (
                        <div className="text-center py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200 font-bold text-xs">
                          🚐 Нажмите на подсвеченную клетку на доске!
                        </div>
                      )}

                      {roomState.phase === 'JACKPOT' && (
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#161922] border border-white/10 px-3 py-1.5 text-xs">
                          <span className="text-neutral-200 font-semibold truncate">
                            {roomState.settings.russianRoulette
                              ? '🔫 Выберите патронники в центре'
                              : '🎰 Выберите грани в центре'}
                          </span>
                          <button
                            type="button"
                            onClick={() => actions.playJackpot({ skip: true })}
                            className="px-3 py-1 rounded-lg bg-white/12 text-white font-bold shrink-0 cursor-pointer"
                          >
                            Пас
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-1 text-xs font-semibold text-neutral-300 truncate flex items-center justify-center gap-1">
                      {tradeDraft.open ? (
                        '🤝 Выберите поля на доске для смарт-контракта'
                      ) : isWalkingAfterRoll ? (
                        '👣 Фишка шагает по полю...'
                      ) : curPlayer ? (
                        <>
                          <span>⏳ Ходит</span>
                          <PlayerAvatar avatar={curPlayer.avatar} />
                          <span style={{ color: curPlayer.color }} className="font-bold">
                            {curPlayer.name}
                          </span>
                        </>
                      ) : (
                        'Ожидание...'
                      )}
                    </div>
                  )}

                  {me && !me.isBankrupt && roomState.status === 'PLAYING' && (
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between px-0.5 text-[9px] uppercase tracking-[0.12em] text-neutral-500 font-bold">
                        <span>Soundpad Deck</span>
                        {tauntCooldownLeft > 0 ? (
                          <span className="font-mono-num text-[#E5B869] normal-case tracking-normal">
                            ⏳ {tauntCooldownLeft}с
                          </span>
                        ) : (
                          <span className="font-mono-num text-[#10B981]">LIVE</span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-1 min-w-0">
                        {TAUNTS.map((pad) => (
                          <button
                            key={pad.id}
                            type="button"
                            data-testid={`mobile-taunt-${pad.id}`}
                            disabled={tauntCooldownLeft > 0}
                            onClick={() => actions.sendTaunt(pad.id)}
                            className="streamdeck-pad min-w-0 py-1.5 pl-2 pr-1 rounded-lg overflow-hidden disabled:opacity-35 text-[#F1F5F9] text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer leading-[1.1]"
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                backgroundColor: pad.ledHex,
                                boxShadow: `0 0 6px ${pad.ledHex}aa`,
                              }}
                              className="pointer-events-none absolute left-0 inset-y-1 w-[2.5px] rounded-r-full"
                            />
                            <span className="min-w-0 whitespace-normal break-words text-center">
                              {pad.emoji} {pad.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => setCreditModalOpen(true)}
                          className="py-1.5 rounded-lg bg-[#10221E] border border-[#E5B869]/45 text-[#F3D082] font-display text-[10.5px] font-bold cursor-pointer truncate"
                        >
                          🏦 КРЕДИТ
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileTab('PLAYERS')}
                          className="py-1.5 rounded-lg bg-[#161922] border border-white/10 text-neutral-200 text-xs font-bold cursor-pointer truncate"
                        >
                          👥 Игроки / Договор
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          <Modals
            roomState={roomState}
            myPlayerId={profile.playerId}
            censored={censored}
            creditModalOpen={creditModalOpen}
            onCloseCreditModal={() => setCreditModalOpen(false)}
            onAckChance={actions.ackChance}
            onTakeCredit={actions.takeCredit}
            onRepayCredit={actions.repayCredit}
          />

          <BankruptcyOverlay
            anim={bankruptcyAnim}
            onDismissAnim={actions.dismissBankruptcyAnim}
            roomState={roomState}
            myPlayerId={profile.playerId}
            censored={censored}
            onRematch={actions.rematch}
            onLeaveRoom={actions.leaveRoom}
          />
        </>
      )}

      <ProfileModal
        open={profileModalPlayerId !== null}
        targetPlayerId={profileModalPlayerId}
        myProfile={profile}
        authAccount={authAccount}
        onClose={() => setProfileModalPlayerId(null)}
        onSelectPlayerId={(pid) => setProfileModalPlayerId(pid)}
        onOpenAvatarCreator={() => setAvatarCreatorOpen(true)}
        onUpdateProfile={updateLocalProfile}
        onRegister={registerAccount}
        onLogin={loginAccount}
        onLogout={logoutAccount}
      />

      <AvatarCreatorModal
        open={avatarCreatorOpen}
        initialName={profile.name}
        onClose={() => setAvatarCreatorOpen(false)}
        onSaveAvatar={(dataUrl) => updateLocalProfile({ avatar: dataUrl })}
      />
    </div>
  );
};
