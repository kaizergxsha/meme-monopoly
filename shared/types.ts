export type GameMode =
  | 'classic'
  | 'speed'
  | 'team2v2'
  | 'rasklad'
  | 'duel_restart'
  | 'retro';

export type DiceSkin = 'classic' | 'neon' | 'gopnik' | 'gold' | 'comic';

export type SpeedDieFace = 1 | 2 | 3 | 'BUS' | 'M1';

export type CellType =
  | 'START'
  | 'PROPERTY'
  | 'CAR'
  | 'IT_UTILITY'
  | 'CHANCE'
  | 'TAX'
  | 'PORTAL'
  | 'JAIL'
  | 'JACKPOT'
  | 'POLICE';

export type TurnPhase =
  | 'PRE_ROLL'
  | 'CHOOSE_SPEED_TARGET'
  | 'BUY_DECISION'
  | 'AUCTION'
  | 'CHANCE'
  | 'PORTAL'
  | 'JACKPOT'
  | 'PENDING_DEBT'
  | 'POST_ROLL'
  | 'GAME_OVER';

export interface RoomSettings {
  mode: GameMode;
  maxPlayers: number; // 2..5 (fixed 4 for team2v2, 3 for rasklad, 2 for duel_restart)
  isPrivate: boolean;
  password?: string;
  turnTimerSec: 0 | 45 | 75 | 120; // 0 = no timer
  startingCash: number; // in k, e.g. 15000 = 15.000k
  creditEnabled: boolean;
  auctionsEnabled: boolean;
  rentTaxEnabled: boolean;
  fairTradeLimit: boolean; // ±50% filter
  censored: boolean; // false = Хардкор (с матом), true = Цензура (лайт)
  retroRules: boolean; // Retro modifier
  russianRoulette?: boolean; // Replace Jackpot casino with 6-chamber lethal Russian Roulette
  mortgageLimitRounds: number; // 0 = unlimited, 15 classic, 7 speed
}

export interface IndustryGroup {
  id: string;
  name: string;
  cleanName: string;
  color: string;
  accentHex: string;
  branchCost: number; // 0 for CAR and IT_UTILITY
  size: number;
  raskladBasket: 1 | 2 | 3;
}

export interface BoardCellDef {
  id: number; // 0..39
  type: CellType;
  groupId?: string;
  name: string;
  cleanName: string;
  shortName?: string;
  cleanShortName?: string;
  subtitle: string;
  cleanSubtitle: string;
  icon: string;
  price?: number; // in k
  branchCost?: number; // in k
  rents?: number[]; // [base, 1br, 2br, 3br, 4br, bigStar] or for CAR [1,2,3,4] or IT [1mult, 2mult]
  taxAmount?: number; // for TAX cells
}

export interface CellRuntimeState {
  id: number;
  ownerId: string | null;
  branches: number; // 0..4, 5 = Big Star (★)
  isMortgaged: boolean;
  mortgageRoundsLeft: number | null;
}

export interface CreditState {
  principal: number;
  paybackAmount: number;
  dueRound: number;
  takenAtRound?: number;
}

export interface KickVoteState {
  initiatorId: string;
  targetId: string;
  votes: Record<string, boolean>; // playerId -> true (за кик) | false (против)
  eligibleVoterIds: string[];
  expiresAt: number;
}

export interface RestartTracker {
  branchLocked: 'NONE' | 'EARLY_1_10' | 'LATE_11_20';
  usedCount: number;
}

export interface PlayerStats {
  cellsBought: number;
  monopoliesCollected: number;
  rouletteDeaths: number;
  casinoWins: number;
  wins: number;
  bankruptcies: number;
}

export interface PlayerState {
  id: string; // stable player session id
  socketId: string | null;
  name: string;
  avatar: string;
  color: string;
  diceSkin: DiceSkin;
  isBot: boolean;
  isConnected: boolean;
  team?: 0 | 1; // for 2x2 mode (seat 0,2 => 0; seat 1,3 => 1)
  cash: number; // in k
  position: number; // 0..39
  inJail: boolean;
  jailTurns: number; // 0..3
  skipTurns: number;
  shields: number; // «Крыша от братков» (Скам-иммунитет)
  doublesStreak: number;
  isBankrupt: boolean;
  extraTimeSec: number; // bonus reserve time
  credit: CreditState | null;
  creditCooldownUntilRound: number;
  restarts: RestartTracker;
  lastTauntAt: number;
  stats: PlayerStats;
}

export interface DiceRollResult {
  die1: number;
  die2: number;
  speedDie: SpeedDieFace | null;
  isDouble: boolean;
  isTriple: boolean;
  totalSteps: number;
  rolledBy: string;
  timestamp: number;
}

export interface AuctionState {
  cellId: number;
  isMortgagedAuction: boolean;
  sellerId: string | null; // non-null if owner auctioned mortgaged property
  currentBid: number;
  highestBidderId: string | null;
  currentBidderId: string | null;
  activeParticipantIds: string[];
  passedIds: string[];
  endsAt: number; // epoch ms
}

export interface TradeSide {
  cash: number;
  propertyIds: number[];
  shields: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offer: TradeSide;
  request: TradeSide;
  createdAt: number;
  expiresAt: number;
}

export interface PortalState {
  playerId: string;
  candidateCells: number[]; // starts with 3 free random cells, can add up to 8 (+500k each)
  extraDirectionsBought: number;
}

export interface JackpotResult {
  mode: 'DICE' | 'ROULETTE';
  rolledFace: number;
  chosenFaces?: number[];
  won: boolean;
  payoutDelta: number;
  quote: string;
  cleanQuote: string;
}

export interface PendingDebt {
  debtorId: string;
  creditorId: string | 'BANK';
  amount: number;
  reason: string;
  cleanReason: string;
}

export interface ChanceCardDef {
  id: string;
  kind: 'PENALTY' | 'BONUS' | 'SHIELD' | 'COLLECT_ALL' | 'GOTO_START' | 'GOTO_JAIL' | 'SKIP_TURN' | 'BRANCH_TAX';
  title: string;
  cleanTitle: string;
  description: string;
  cleanDescription: string;
  amount?: number; // in k
  perBranchAmount?: number;
  icon: string;
}

export interface ActiveCardPopup {
  card: ChanceCardDef;
  playerId: string;
  cellId: number;
  timestamp: number;
  walkDurationMs: number;
  effectLabel: string;
  cleanEffectLabel: string;
  tone: 'good' | 'bad' | 'move' | 'special';
}

export interface TauntDef {
  id: string;
  text: string;
  cleanText: string;
  emoji: string;
  sound: 'laugh' | 'fiasco' | 'trombone' | 'rage' | 'pressf';
}

export interface TauntEvent {
  id: string;
  playerId: string;
  playerName: string;
  tauntId: string;
  timestamp: number;
}

export interface BankruptcyAnimationEvent {
  style: 'eralash' | 'curb' | 'wasted';
  loserName: string;
  loserAvatar: string;
  winnerName: string;
  reason: string;
  cleanReason: string;
  timestamp: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'SYSTEM' | 'DICE' | 'RENT' | 'BUY' | 'AUCTION' | 'TRADE' | 'CHANCE' | 'CHAT' | 'BANKRUPT' | 'TAUNT';
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  text: string;
  cleanText: string;
  reactions?: Record<string, number>;
}

export interface RoomState {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  settings: RoomSettings;
  players: PlayerState[];
  cells: CellRuntimeState[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  round: number;
  startedAt: number | null;
  turnStartedAt: number | null;
  turnDeadlineAt: number | null;
  hasExtraTurn: boolean;
  mortgagedThisTurn: boolean;
  builtGroupsThisTurn: string[];
  tradesProposedThisTurn?: number;
  lastDice: DiceRollResult | null;
  speedTargetMode: 'NONE' | 'TRIPLE' | 'BUS';
  validSpeedTargets: number[];
  auction: AuctionState | null;
  activeTrade: TradeOffer | null;
  activeKickVote?: KickVoteState | null;
  portal: PortalState | null;
  lastJackpotResult: JackpotResult | null;
  pendingDebt: PendingDebt | null;
  lastCardPopup: ActiveCardPopup | null;
  winnerIds: string[];
  winnerTeam: 0 | 1 | null;
  logs: GameLogEntry[];
  serverNow?: number;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  hasPassword: boolean;
  censored: boolean;
  playerIds?: string[];
  playerNames?: string[];
  hasDisconnectedHumans?: boolean;
}

export interface PlayerProfileData {
  playerId: string;
  nickname: string;
  avatar: string;
  color: string;
  diceSkin: DiceSkin;
  gamesPlayed: number;
  wins: number;
  createdAt: number;
  updatedAt: number;
  isRegistered: boolean;
  stats: PlayerStats;
}

export interface AuthAccount {
  email: string;
  playerId: string;
  profile: PlayerProfileData;
}

export interface LeaderboardEntry {
  playerId?: string;
  nickname: string;
  avatar: string;
  gamesPlayed: number;
  wins: number;
}

export interface RecentMatchSummary {
  id: number;
  roomCode: string;
  mode: string;
  winnerNames: string;
  rounds: number;
  durationSec: number;
  finishedAt: number;
}
