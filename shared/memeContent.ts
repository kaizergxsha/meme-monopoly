import { ChanceCardDef, DiceSkin, GameMode, RoomSettings, TauntDef } from './types.ts';

export const MEME_AVATARS = [
  { id: 'pepe', emoji: '🐸', label: 'Крипто-Пепе' },
  { id: 'clown', emoji: '🤡', label: 'Инфоцыган' },
  { id: 'shark', emoji: '🦈', label: 'Темщик' },
  { id: 'beer', emoji: '🍺', label: 'Подпивас' },
  { id: 'cat', emoji: '😼', label: 'Наглый Кот' },
  { id: 'skull', emoji: '💀', label: 'Дед Инсайд' },
  { id: 'monke', emoji: '🦍', label: 'Лудоман' },
  { id: 'nerd', emoji: '🤓', label: 'Душнила Сеньор' },
  { id: 'goblin', emoji: '👺', label: 'Рейдер' },
  { id: 'doge', emoji: '🐕', label: 'Хомяк 50x' },
  { id: 'alien', emoji: '👽', label: 'Шизотеоретик' },
  { id: 'crown', emoji: '🤴', label: 'Сын маминой подруги' },
];

export const TOKEN_COLORS = [
  { hex: '#dc2626', name: 'Красный' },
  { hex: '#9333ea', name: 'Фиолетовый' },
  { hex: '#16a34a', name: 'Зелёный' },
  { hex: '#2563eb', name: 'Синий' },
  { hex: '#ff8800', name: 'Оранжевый' },
];

export const DICE_SKINS: { id: DiceSkin; name: string; preview: string }[] = [
  { id: 'classic', name: 'Классика падика', preview: '🎲' },
  { id: 'neon', name: 'Кибер-Неон', preview: '💠' },
  { id: 'gopnik', name: 'Чёткий Чёрный', preview: '🖤' },
  { id: 'gold', name: 'Золото Темщика', preview: '✨' },
  { id: 'comic', name: 'Комикс Бдыщь', preview: '💥' },
];

export const MODE_INFO: Record<
  GameMode,
  {
    title: string;
    badge: string;
    desc: string;
    defaults: Partial<RoomSettings>;
  }
> = {
  classic: {
    title: 'Классика M1',
    badge: '2–5 игроков',
    desc: 'Капитал $15 000, таймер 75с, равномерная стройка, залог 15 раундов, анти-затягивание с 46 мин.',
    defaults: {
      maxPlayers: 4,
      startingCash: 15000,
      turnTimerSec: 75,
      mortgageLimitRounds: 15,
      retroRules: false,
      auctionsEnabled: true,
      creditEnabled: true,
      rentTaxEnabled: true,
    },
  },
  speed: {
    title: 'Быстрая игра (Speed Die)',
    badge: '3-й кубик',
    desc: 'Капитал $17 500, 45с, неравномерная стройка сразу до Звезды, с 7-го раунда Быстрый кубик (Триплы, Автобус, М1).',
    defaults: {
      maxPlayers: 4,
      startingCash: 17500,
      turnTimerSec: 45,
      mortgageLimitRounds: 7,
      retroRules: false,
      auctionsEnabled: true,
      creditEnabled: true,
      rentTaxEnabled: true,
    },
  },
  team2v2: {
    title: 'Командный 2×2',
    badge: 'Союзники',
    desc: 'Строго 4 игрока через одного. Союзники не платят ренту друг другу, тактика прикрытия на кубике «М1».',
    defaults: {
      maxPlayers: 4,
      startingCash: 17500,
      turnTimerSec: 45,
      mortgageLimitRounds: 7,
      retroRules: false,
      auctionsEnabled: true,
      creditEnabled: true,
      rentTaxEnabled: true,
    },
  },
  rasklad: {
    title: 'Расклад (на троих)',
    badge: 'Автораздача',
    desc: 'Строго 3 игрока, капитал $25 000, быстрые правила. Все 28 полей делятся на 3 корзины и раздаются со старта!',
    defaults: {
      maxPlayers: 3,
      startingCash: 25000,
      turnTimerSec: 45,
      mortgageLimitRounds: 7,
      retroRules: false,
      auctionsEnabled: true,
      creditEnabled: true,
      rentTaxEnabled: true,
    },
  },
  duel_restart: {
    title: 'Дуэль 1×1 с рестартами',
    badge: '1 на 1',
    desc: 'Быстрая дуэль (3-й кубик с 5 раунда). До 2 рестартов в 1–10 раундах ($1 000) или 1 рестарт в 11–20 ($2 000).',
    defaults: {
      maxPlayers: 2,
      startingCash: 17500,
      turnTimerSec: 45,
      mortgageLimitRounds: 7,
      retroRules: false,
      auctionsEnabled: true,
      creditEnabled: true,
      rentTaxEnabled: true,
    },
  },
  retro: {
    title: 'Ретро-режим',
    badge: 'Олдскул',
    desc: 'Без аукционов, без сгорания залога, без бонуса остановки на Старте, прямые бонусы/штрафы и лавочка в Парке.',
    defaults: {
      maxPlayers: 4,
      startingCash: 15000,
      turnTimerSec: 75,
      mortgageLimitRounds: 0,
      retroRules: true,
      auctionsEnabled: false,
      creditEnabled: true,
      rentTaxEnabled: false,
    },
  },
};

export const CHANCE_DECK: ChanceCardDef[] = [
  // 10 Штрафов из п. 5.2
  {
    id: 'pen_shitcoin',
    kind: 'PENALTY',
    title: 'Инвестировал в говно',
    cleanTitle: 'Купил мем-токен на пике',
    description: 'Купил щиткоин на хаях или вложился в «гениальную» темку друга. Заплати банку $2 000.',
    cleanDescription: 'Вложился в «гениальную» идею друга. Заплати банку $2 000.',
    amount: 2000,
    icon: '💩',
  },
  {
    id: 'pen_futures',
    kind: 'PENALTY',
    title: 'Проебал всё на фьючерсах 50x',
    cleanTitle: 'Ликвидация на плече 50x',
    description: 'Ликвидация прошла успешно, свеча улетела в ад. Минус $1 500.',
    cleanDescription: 'Маржин-колл постучался мгновенно. Минус $1 500.',
    amount: 1500,
    icon: '📉',
  },
  {
    id: 'pen_prod',
    kind: 'PENALTY',
    title: 'Уронил прод в пятницу вечером',
    cleanTitle: 'Положил сервер в пятницу',
    description: 'Выходные накрылись пиздой, оплати экстренный хотфикс $1 200.',
    cleanDescription: 'Выходные отменены, оплати экстренный хотфикс $1 200.',
    amount: 1200,
    icon: '🔥',
  },
  {
    id: 'pen_simp',
    kind: 'PENALTY',
    title: 'Задонатил ебучей стримерше',
    cleanTitle: 'Донат равнодушной стримерше',
    description: 'Она даже не прочитала твой ник, зато списали $1 000.',
    cleanDescription: 'Она даже не заметила сообщение, зато списали $1 000.',
    amount: 1000,
    icon: '💋',
  },
  {
    id: 'pen_temshik',
    kind: 'PENALTY',
    title: 'Поверил темщику на слово',
    cleanTitle: 'Поверил партнёру без договора',
    description: 'Он уехал в закат на арендованном Ламбо, а ты остался без $1 500.',
    cleanDescription: 'Он удалил переписку в Телеграме, минус $1 500.',
    amount: 1500,
    icon: '🦈',
  },
  {
    id: 'pen_mouse',
    kind: 'PENALTY',
    title: 'Сгорела жопа с тиммейтов',
    cleanTitle: 'Сгорел в рейтинговой катке',
    description: 'Разбил мышку об стол после слитой катки, купи новую за $800.',
    cleanDescription: 'Разбил мышку об стол после поражения, купи новую за $800.',
    amount: 800,
    icon: '🖱️',
  },
  {
    id: 'pen_trial',
    kind: 'PENALTY',
    title: 'Забыл отменить подписку после триала',
    cleanTitle: 'Автопродление годовой подписки',
    description: 'Поздравляем, блядь, с карты тихо списано $500 за годовой тариф.',
    cleanDescription: 'Поздравляем, с карты списано $500 за ненужный сервис.',
    amount: 500,
    icon: '💳',
  },
  {
    id: 'pen_fop',
    kind: 'BRANCH_TAX',
    title: 'Налоговая доебалась до твоего ФОПа',
    cleanTitle: 'Внеплановая налоговая проверка',
    description: 'Отстегни государству $1 000 (или по $250 за каждый филиал, если больше!).',
    cleanDescription: 'Оплати сбор $1 000 (или по $250 за каждый филиал, если больше!).',
    amount: 1000,
    perBranchAmount: 250,
    icon: '🧾',
  },
  {
    id: 'pen_taxi',
    kind: 'PENALTY',
    title: 'Таксист наебал по счётчику',
    cleanTitle: 'Таксист включил ночной тариф',
    description: 'Поехал «короткой дорогой» через весь город и три пробки. Минус $700.',
    cleanDescription: 'Поехал «короткой дорогой» через объездную. Минус $700.',
    amount: 700,
    icon: '🚖',
  },
  {
    id: 'pen_microloan',
    kind: 'PENALTY',
    title: 'Взял микрозайм до зарплаты',
    cleanTitle: 'Быстрый займ под 365% годовых',
    description: 'Коллекторы уже стучат в дверь и пишут соседям, отдай $1 800.',
    cleanDescription: 'Проценты набежали быстрее скорости света, отдай $1 800.',
    amount: 1800,
    icon: '🚪',
  },
  // 8 Бонусов и спец-событий из п. 5.2
  {
    id: 'bon_viral',
    kind: 'BONUS',
    title: 'Залетел видос в рекомендации',
    cleanTitle: 'Ролик залетел в тренды',
    description: 'Стал звездой интернета на 15 минут, рекламодатели отсыпали +$2 000!',
    cleanDescription: 'Стал звездой интернета на 15 минут, получи +$2 000!',
    amount: 2000,
    icon: '🚀',
  },
  {
    id: 'bon_atm',
    kind: 'BONUS',
    title: 'Наебал систему',
    cleanTitle: 'Кэшбэк багнулся в твою пользу',
    description: 'Нашёл баг в банкомате и вовремя ушёл огородами. Забери +$1 500!',
    cleanDescription: 'Банковский сбой начислил двойной бонус. Забери +$1 500!',
    amount: 1500,
    icon: '🏧',
  },
  {
    id: 'bon_babushka',
    kind: 'BONUS',
    title: 'Бабушка передала котлету с баблом',
    cleanTitle: 'Посылка от бабушки',
    description: '«Кушай, внучек, ни в чём себе не отказывай!» +$1 000 в карман.',
    cleanDescription: '«Кушай, внучек, ни в чём себе не отказывай!» +$1 000.',
    amount: 1000,
    icon: '👵',
  },
  {
    id: 'bon_shield',
    kind: 'SHIELD',
    title: 'Крыша от братков (Скам-иммунитет)',
    cleanTitle: 'Юридическая броня (Иммунитет)',
    description: 'Карточка защиты: автоматически обнуляет следующий штраф или аренду до $3 000!',
    cleanDescription: 'Карточка защиты: обнуляет следующий штраф или аренду до $3 000!',
    amount: 3000,
    icon: '🛡️',
  },
  {
    id: 'bon_hangover',
    kind: 'COLLECT_ALL',
    title: 'Скинулись пацанами на опохмел',
    cleanTitle: 'Дружеский сбор на пиццу',
    description: 'Братва своих не бросает: каждый живой игрок переводит тебе по $300!',
    cleanDescription: 'Каждый активный игрок переводит тебе по $300!',
    amount: 300,
    icon: '🍻',
  },
  {
    id: 'bon_uber',
    kind: 'GOTO_START',
    title: 'Вызвал убер до хаты',
    cleanTitle: 'Экспресс-такси до Старта',
    description: 'Мгновенный телепорт на клетку «Старт» с получением зарплаты!',
    cleanDescription: 'Мгновенный перелёт на клетку «Старт» с получением бонуса!',
    icon: '🏠',
  },
  {
    id: 'pen_jail_card',
    kind: 'GOTO_JAIL',
    title: 'Пошёл нахуй в обезьянник',
    cleanTitle: 'Срочный вызов в отделение',
    description: 'Товарищ майор прочитал твои мемы. Моментально в Тюрьму без прохода Старта!',
    cleanDescription: 'Моментальная отправка в Тюрьму без бонуса за Старт!',
    icon: '🚓',
  },
  {
    id: 'pen_raiders',
    kind: 'SKIP_TURN',
    title: 'Твои активы отжали рейдеры (перерыв на пиво)',
    cleanTitle: 'Внезапный перерыв на шашлыки',
    description: 'Пока разгребаешь вопросики (или пьёшь пивас), пропускаешь следующий ход.',
    cleanDescription: 'Отдыхаешь и пропускаешь свой следующий ход.',
    icon: '🍺',
  },
];

export const TAUNTS: TauntDef[] = [
  {
    id: 'loh',
    text: 'Ебать ты лох! 🤡',
    cleanText: 'Ну ты и простофиля! 🤡',
    emoji: '🤡',
    sound: 'laugh',
  },
  {
    id: 'fiasco',
    text: 'Это фиаско, братан 🤦‍♂️',
    cleanText: 'Это фиаско, братан 🤦‍♂️',
    emoji: '🤦‍♂️',
    sound: 'fiasco',
  },
  {
    id: 'govno',
    text: 'Инвестировал в говно 💩🎺',
    cleanText: 'Гениальная инвестиция 💩🎺',
    emoji: '💩',
    sound: 'trombone',
  },
  {
    id: 'rent_rage',
    text: 'Иди нахуй со своей арендой! 🖕',
    cleanText: 'Да сколько можно платить аренду?! 😤',
    emoji: '🖕',
    sound: 'rage',
  },
  {
    id: 'press_f',
    text: 'Помянем... Press F 🕯️',
    cleanText: 'Помянем... Press F 🕯️',
    emoji: '🕯️',
    sound: 'pressf',
  },
];

export const TRADE_PROPOSAL_TEMPLATES: { hard: string; clean: string }[] = [
  {
    hard: '🤝 {from} предложил мирный договор игроку {to}.',
    clean: '🤝 {from} предложил мирный договор игроку {to}.',
  },
  {
    hard: '🕵️ {from} предложил мутный договорняк игроку {to}.',
    clean: '🕵️ {from} предложил хитрый договорняк игроку {to}.',
  },
  {
    hard: '💼 {from} позвал перетереть за гаражами игрока {to}.',
    clean: '💼 {from} позвал перетереть тет-а-тет игрока {to}.',
  },
  {
    hard: '🤫 {from} подкинул секретную темку игроку {to}.',
    clean: '🤫 {from} предложил тайный бартер игроку {to}.',
  },
  {
    hard: '🥂 {from} предложил порешать вопросики с игроком {to}.',
    clean: '🥂 {from} предложил деловой союз игроку {to}.',
  },
];

export const JACKPOT_QUOTES = [
  {
    hard: '«Последняя ставка, бля буду, отвечаю!»',
    clean: '«Последняя ставка, честно отвечаю!»',
  },
  {
    hard: '«Отыграюсь в следующем круге, зуб даю!»',
    clean: '«Отыграюсь в следующем круге, сто процентов!»',
  },
  {
    hard: '«99% лудоманов сливаются прямо перед ебейшим заносом!»',
    clean: '«99% игроков уходят прямо перед джекпотом!»',
  },
  {
    hard: '«Алло, мам, скинь косарь, тут верняковая схема!»',
    clean: '«Алло, тут беспроигрышная комбинация!»',
  },
];

export const BOT_PROFILES = [
  { name: 'Темщик Валера [БОТ]', avatar: '🦈' },
  { name: 'Подпивас Серёга [БОТ]', avatar: '🍺' },
  { name: 'Лудоман Артём [БОТ]', avatar: '🦍' },
  { name: 'Сеньор Душнила [БОТ]', avatar: '🤓' },
];
