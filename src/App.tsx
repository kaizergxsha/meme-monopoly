import React, { useEffect, useState } from 'react';
import { BOARD_CELLS } from '../shared/boardData.ts';
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
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#17181c] text-neutral-100 relative">
      {/* Всплывающий тост ошибки */}
      {errorToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-2xl border border-rose-300">
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
          <div className="lg:hidden flex items-center justify-between gap-2 bg-[#1f2026] border-b border-[#2c2e36] py-1.5 px-2.5 shrink-0">
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
                      ? 'bg-[#8fce00] text-neutral-950 shadow-sm'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-bold text-neutral-400 tabular-nums shrink-0">
              #{roomState.code} · {roomState.round}р
            </span>
          </div>

          {/* Мобильная компактная полоса игроков поверх поля (< 1024px) */}
          {mobileTab === 'BOARD' && (
            <div
              data-testid="mobile-players-strip"
              className="lg:hidden flex items-center gap-1.5 px-2 py-1.5 bg-[#18191f] border-b border-[#262831] overflow-x-auto chat-scrollbar shrink-0"
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
                        ? { backgroundColor: p.color, borderColor: '#d9f99d' }
                        : { borderLeftColor: p.color }
                    }
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-left transition cursor-pointer ${
                      p.isBankrupt
                        ? 'bg-[#1e1f24] border-[#282a30] opacity-55 text-neutral-500'
                        : isActive
                        ? 'text-white shadow-md ring-1 ring-lime-300'
                        : 'bg-[#222328] border-[#2e3038] border-l-4 text-neutral-100'
                    }`}
                  >
                    <span className="text-sm leading-none shrink-0 inline-flex items-center">
                      <PlayerAvatar avatar={p.avatar} />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-[10px] font-bold truncate max-w-[68px] flex items-center gap-1">
                        <span>{p.name}</span>
                        {isActive && turnSec !== null && (
                          <span className="text-[9px] font-black opacity-90 tabular-nums">
                            {turnSec}с
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] font-extrabold tabular-nums">
                        {p.isBankrupt ? 'RIP' : formatMoney(p.cash)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Центрированная композиция 1:1 как в референсе Monopoly One: Слева карточки игроков + По центру доска 11×11 */}
          <div className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto flex items-center justify-center gap-3 xl:gap-6 px-1 sm:px-3 overflow-hidden">
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
              } lg:flex flex-1 min-w-0 h-full items-center justify-center overflow-hidden`}
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
              const tauntCooldownLeft = me
                ? Math.max(0, Math.ceil((me.lastTauntAt + 5000 - nowMs) / 1000))
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
                  className="lg:hidden bg-[#1b1c22] border-t border-[#2c2e36] px-2.5 py-2 space-y-1.5 shrink-0 z-20"
                >
                  {!tradeDraft.open &&
                  !isWalkingAfterRoll &&
                  roomState.status === 'PLAYING' &&
                  roomState.phase === 'AUCTION' &&
                  auc ? (
                    canIBidAuction ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-extrabold text-lime-300 text-center">
                          🎯 Ваша очередь на торгах (от ${auc.currentBid + 100})
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[100, 300, 500].map((step) => (
                            <button
                              key={step}
                              type="button"
                              disabled={(me?.cash ?? 0) < auc.currentBid + step}
                              onClick={() => actions.bidAuction(step)}
                              className="py-1.5 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] disabled:opacity-35 text-neutral-950 font-black text-xs cursor-pointer leading-tight"
                            >
                              <div>+${step}</div>
                              <div className="text-[9px] opacity-80">${auc.currentBid + step}</div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={actions.passAuction}
                            className="py-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-neutral-100 font-bold text-xs cursor-pointer"
                          >
                            Пас
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1 text-xs font-semibold text-neutral-300 truncate flex items-center justify-center gap-1">
                        <span>🔨 Ставка ${auc.highestBidderId ? auc.currentBid : auc.currentBid + 100} · Ход:</span>
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
                            className="flex-1 py-2.5 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-sm shadow-md cursor-pointer"
                          >
                            🎲 Бросить кубики
                          </button>
                          {me?.inJail && me.cash >= 500 && (
                            <button
                              type="button"
                              onClick={actions.payJail}
                              className="px-3 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs cursor-pointer shrink-0"
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
                            className="py-2.5 rounded-xl bg-[#8fce00] disabled:opacity-40 text-neutral-950 font-black text-xs cursor-pointer"
                          >
                            💰 Купить (${BOARD_CELLS[curPlayer.position].price ?? 0})
                          </button>
                          <button
                            type="button"
                            onClick={actions.declineProperty}
                            className="py-2.5 rounded-xl bg-white/10 border border-white/15 text-neutral-100 font-bold text-xs cursor-pointer"
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
                            className="w-full py-2.5 rounded-xl bg-[#8fce00] text-neutral-950 font-black text-xs cursor-pointer"
                          >
                            💸 Оплатить долг ${roomState.pendingDebt.amount}
                          </button>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCreditModalOpen(true)}
                              className="py-2.5 rounded-xl bg-amber-500 text-neutral-950 font-extrabold text-xs cursor-pointer"
                            >
                              🏦 Займ банка
                            </button>
                            <button
                              type="button"
                              onClick={actions.surrender}
                              className="py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
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
                                  className="shrink-0 px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/55 text-cyan-100 text-[11px] font-bold cursor-pointer"
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
                              className="py-2 rounded-xl bg-white/10 disabled:opacity-40 text-neutral-100 font-bold text-xs cursor-pointer"
                            >
                              + Точка ($500)
                            </button>
                            <button
                              type="button"
                              onClick={() => actions.portalJump()}
                              className="py-2 rounded-xl bg-[#8fce00] text-neutral-950 font-black text-xs cursor-pointer"
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
                          className="w-full py-2.5 rounded-xl bg-[#8fce00] hover:bg-[#7fb800] text-neutral-950 font-black text-xs shadow-md cursor-pointer"
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
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs">
                          <span className="text-neutral-200 font-semibold truncate">
                            {roomState.settings.russianRoulette
                              ? '🔫 Выберите патронники в центре'
                              : '🎰 Выберите грани в центре'}
                          </span>
                          <button
                            type="button"
                            onClick={() => actions.playJackpot({ skip: true })}
                            className="px-3 py-1 rounded-lg bg-white/15 text-white font-bold shrink-0 cursor-pointer"
                          >
                            Пас
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-1 text-xs font-semibold text-neutral-300 truncate flex items-center justify-center gap-1">
                      {tradeDraft.open ? (
                        '📄 Выберите поля на доске для договора'
                      ) : isWalkingAfterRoll ? (
                        '👣 Фишка шагает по полю...'
                      ) : curPlayer ? (
                        <>
                          <span>⏳ Ходит</span>
                          <PlayerAvatar avatar={curPlayer.avatar} />
                          <span>{curPlayer.name}</span>
                        </>
                      ) : (
                        'Ожидание...'
                      )}
                    </div>
                  )}

                  {me && !me.isBankrupt && roomState.status === 'PLAYING' && (
                    <div className="space-y-1.5 min-w-0">
                      <div className="grid grid-cols-2 gap-1.5 min-w-0">
                        <button
                          type="button"
                          data-testid="mobile-taunt-loh"
                          disabled={tauntCooldownLeft > 0}
                          onClick={() => actions.sendTaunt('loh')}
                          className="min-w-0 py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 disabled:opacity-35 text-amber-100 text-[10.5px] font-extrabold flex items-center justify-between gap-1 cursor-pointer"
                        >
                          <span className="truncate">
                            {censored ? '🤡 Ну ты и простофиля' : '🤡 Ебать ты лох'}
                          </span>
                          <span className="shrink-0 text-[11px] leading-none">🔊</span>
                        </button>
                        <button
                          type="button"
                          data-testid="mobile-taunt-rent-rage"
                          disabled={tauntCooldownLeft > 0}
                          onClick={() => actions.sendTaunt('rent_rage')}
                          className="min-w-0 py-1 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 disabled:opacity-35 text-rose-100 text-[10.5px] font-extrabold flex items-center justify-between gap-1 cursor-pointer"
                        >
                          <span className="truncate">
                            {censored
                              ? '😤 Сколько можно платить аренду'
                              : '🖕 Иди нахуй со своей арендой'}
                          </span>
                          <span className="shrink-0 text-[11px] leading-none">🔊</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => actions.sendTaunt('fiasco')}
                          disabled={tauntCooldownLeft > 0}
                          className="min-w-0 py-1 px-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 disabled:opacity-35 text-sky-100 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                        >
                          <span>🤦‍♂️ Фиаско</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => actions.sendTaunt('govno')}
                          disabled={tauntCooldownLeft > 0}
                          className="min-w-0 py-1 px-1.5 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-400/35 disabled:opacity-35 text-yellow-100 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                        >
                          <span>💩 {censored ? 'Инвест' : 'Говно'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => actions.sendTaunt('press_f')}
                          disabled={tauntCooldownLeft > 0}
                          className="min-w-0 py-1 px-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/35 disabled:opacity-35 text-purple-100 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                        >
                          <span>🕯️ Press F</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => setCreditModalOpen(true)}
                          className="py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-200 text-xs font-bold cursor-pointer truncate"
                        >
                          🏦 Кредит
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileTab('PLAYERS')}
                          className="py-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-200 text-xs font-bold cursor-pointer truncate"
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
