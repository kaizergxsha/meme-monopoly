# meme-monopoly — PROJECT_MAP

Краткий навигатор по проекту для быстрых правок. Визуальный дизайн и токены описаны в `DESIGN.md`.

## Стек
- Клиент: React + TypeScript + Vite + Tailwind CSS (`src/`).
- Сервер: Node.js + Express + Socket.IO + SQLite (`server/`).
- Общие типы, правила и данные поля: `shared/`.

## Карта файлов

### `shared/` (общая логика и данные)
| Файл | Строк | Назначение |
| :--- | :---: | :--- |
| `shared/types.ts` | ~392 | Типы состояния комнаты, игроков, клеток, трейдов, аукционов |
| `shared/rules.ts` | ~380 | Константы правил, таймеры, расчёт аренды и лимитов |
| `shared/boardData.ts` | ~827 | Описание всех клеток поля, цветов групп, цен |
| `shared/memeContent.ts` | ~714 | Тексты карточек шанса, мемов, реплик и таунтов |

### `server/` (бэкенд и движок игры)
| Файл | Строк | Назначение |
| :--- | :---: | :--- |
| `server/index.ts` | ~528 | Express + Socket.IO сервер, обработчики сокетов, HTTP-роуты |
| `server/db.ts` | ~670 | SQLite: профили, статистика, история матчей, лидерборд |
| `server/botAi.ts` | ~197 | Логика принятия решений ботами |
| `server/engine/engineUtils.ts` | ~115 | Типы `ServerRoom`, `RoomCallbacks`, `EngineHost`, `FULL_CHANCE_POOL`, генераторы ID/кубиков |
| `server/engine/auctionHandlers.ts` | ~315 | Покупка клетки, отказ и проведение аукционов (`buyProperty`, `declineProperty`, `placeAuctionBid`, `finalizeAuction`) |
| `server/engine/tradeHandlers.ts` | ~235 | Смарт-контракты и обмены (`extendTurnForTradeDraft`, `proposeTrade`, `respondTrade`) |
| `server/engine/kickVoteHandlers.ts` | ~125 | Голосования за кик игрока (`startKickVote`, `castKickVote`, `resolveKickVote`) |
| `server/gameEngine.ts` | ~2947 | Класс `GameManager`: комнаты (`createRoom`, `joinRoom`, `startGame`), ходы и кубики (`beginTurn`, `rollDice`, `resolveCellLanding`, `prepareChancePhase`), платежи (`chargePlayer`, `executePayment`), филиалы/залог (`buildBranch`, `mortgageProperty`), портал/джекпот/кредит (`activatePortal`, `playJackpot`, `takeCredit`), банкротство и победа (`executeBankruptcy`, `finishMatch`), таймеры (`tickTimers`) |

### `src/` (фронтенд)
| Файл | Строк | Назначение |
| :--- | :---: | :--- |
| `src/App.tsx` | ~667 | Корневой компонент, переключение Lobby / Game, верхняя панель |
| `src/hooks/useGameSocket.ts` | ~618 | Подключение Socket.IO, подписки на события и actions |
| `src/components/CenterStage.tsx` | ~1830 | Центральная область поля: кубики, действия хода, аукцион, шансы, джекпот |
| `src/components/center/CenterDiceAndLogHelpers.tsx` | ~338 | Вспомогательные компоненты центральной зоны: `M1DieBox`, `SpeedDieBox`, `DiceDualIcon`, `TradePropertyIconTile`, `renderColoredLogText`, `formatClock` |
| `src/components/BoardGrid.tsx` | ~1625 | Сетка игрового поля, клетки, поповеры свойств |
| `src/components/CellArtwork.tsx` | ~1799 | Визуальное оформление/арт клеток поля |
| `src/components/LobbyView.tsx` | ~1042 | Экран лобби, список комнат, настройки матча |
| `src/components/PlayersSidebar.tsx` | ~735 | Боковая панель игроков, балансы, статусы, кнопки действий |
| `src/components/ProfileModal.tsx` | ~703 | Модалка профиля игрока и статистики |
| `src/components/CardIllustration.tsx` | ~656 | Иллюстрации карточек |
| `src/components/Modals.tsx` | ~618 | Модальные окна (трейд, правила, подтверждения) |
| `src/components/BoardTokensLayer.tsx` | ~509 | Слой фишек игроков и анимация перемещения |
| `src/components/AvatarCreatorModal.tsx` | ~383 | Конструктор аватара |
| `src/components/BankruptcyOverlay.tsx` | ~150 | Оверлей банкротства |
| `src/components/ChatAndLog.tsx` | ~123 | Чат и лог событий матча |
| `src/components/AppleEmoji.tsx`, `DiceSkinPreview.tsx`, `PlayerAvatar.tsx` | ~41–136 | Мелкие UI-компоненты |

### `tests/`
| Файл | Строк | Назначение |
| :--- | :---: | :--- |
| `tests/qa_verify.ts` | ~1963 | Автоматическая QA-проверка игры |
