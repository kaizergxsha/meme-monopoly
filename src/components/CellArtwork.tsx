import React from 'react';

export interface CellArtworkProps {
  cellId: number;
  side: 'top' | 'right' | 'bottom' | 'left' | 'corner';
  censored?: boolean;
  russianRoulette?: boolean;
  className?: string;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const Sparkle: React.FC<{ cx: number | string; cy: number | string; r?: number; fill?: string }> = ({
  cx,
  cy,
  r = 5,
  fill = '#fde047',
}) => {
  const nx = Number(cx);
  const ny = Number(cy);
  return (
    <path
      d={`M ${nx} ${ny - r} Q ${nx} ${ny} ${nx + r} ${ny} Q ${nx} ${ny} ${nx} ${ny + r} Q ${nx} ${ny} ${nx - r} ${ny} Q ${nx} ${ny} ${nx} ${ny - r} Z`}
      fill={fill}
    />
  );
};

const ChanceMark: React.FC<{ gid: string }> = ({ gid }) => (
  <g>
    <defs>
      <radialGradient id={`${gid}-chance-aura`} cx="50%" cy="48%" r="50%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.42" />
        <stop offset="58%" stopColor="#059669" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#041510" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${gid}-chance-vault`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0b2e23" />
        <stop offset="55%" stopColor="#061d16" />
        <stop offset="100%" stopColor="#03100c" />
      </linearGradient>
      <linearGradient id={`${gid}-chance-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#e5b869" />
        <stop offset="100%" stopColor="#b47d27" />
      </linearGradient>
    </defs>
    {/* Radial emerald VIP lootbox aura */}
    <circle cx="50" cy="50" r="46" fill={`url(#${gid}-chance-aura)`} />
    {/* Octagonal dark-emerald VIP lootbox medallion */}
    <polygon
      points="30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30"
      fill={`url(#${gid}-chance-vault)`}
      stroke="#10b981"
      strokeOpacity="0.65"
      strokeWidth="2.2"
    />
    <polygon
      points="33,15 67,15 85,33 85,67 67,85 33,85 15,67 15,33"
      fill="none"
      stroke="#e5b869"
      strokeOpacity="0.42"
      strokeWidth="1"
      strokeDasharray="4 3"
    />
    {/* Corner gold rivets */}
    <circle cx="31" cy="14" r="1.6" fill="#e5b869" />
    <circle cx="69" cy="14" r="1.6" fill="#e5b869" />
    <circle cx="31" cy="86" r="1.6" fill="#e5b869" />
    <circle cx="69" cy="86" r="1.6" fill="#e5b869" />

    {/* Deep shadow behind ? */}
    <g transform="translate(2, 3.5)" opacity="0.65">
      <path
        d="M 36 34 C 36 18, 66 18, 66 35 C 66 46, 50 47, 50 57"
        fill="none"
        stroke="#020806"
        strokeWidth="13.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="74" r="7.5" fill="#020806" />
    </g>
    {/* Neon emerald outer glow ring on ? */}
    <path
      d="M 36 34 C 36 18, 66 18, 66 35 C 66 46, 50 47, 50 57"
      fill="none"
      stroke="#10b981"
      strokeOpacity="0.45"
      strokeWidth="15.5"
      strokeLinecap="round"
    />
    {/* Sculpted Champagne-Gold ? */}
    <path
      d="M 36 34 C 36 18, 66 18, 66 35 C 66 46, 50 47, 50 57"
      fill="none"
      stroke={`url(#${gid}-chance-gold)`}
      strokeWidth="11.5"
      strokeLinecap="round"
    />
    <circle cx="50" cy="74" r="7" fill={`url(#${gid}-chance-gold)`} />
    {/* Specular highlight */}
    <path
      d="M 38.5 30 C 41 22, 59 22, 62.5 30.5"
      fill="none"
      stroke="#fffbeb"
      strokeWidth="2.8"
      strokeLinecap="round"
      opacity="0.9"
    />
    <circle cx="48" cy="72" r="2.2" fill="#fffbeb" opacity="0.9" />
    {/* VIP sparkles */}
    <Sparkle cx={22} cy={27} r={4.8} fill="#e5b869" />
    <Sparkle cx={78} cy={28} r={4.2} fill="#34d399" />
    <Sparkle cx={24} cy={72} r={3.8} fill="#34d399" />
    <Sparkle cx={77} cy={71} r={4.8} fill="#fde047" />
  </g>
);

export const CellArtwork: React.FC<CellArtworkProps> = ({
  cellId,
  censored = false,
  russianRoulette = false,
  className = '',
}) => {
  const rawUid = React.useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '');
  const gid = `ca-${cellId}-${uid}`;

  const renderArtwork = (): React.ReactNode => {
    switch (cellId) {
      // 0: Получка до списаний! (Старт — Dark Luxury Gold Bastion)
      case 0:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-start-glow`} cx="50%" cy="44%" r="52%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.42" />
                <stop offset="58%" stopColor="#e5b869" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-gold-rim`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="48%" stopColor="#e5b869" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id={`${gid}-phone-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#090d16" />
              </linearGradient>
            </defs>
            {/* Bastion frame */}
            <rect x="6" y="6" width="88" height="88" rx="14" fill="#0b0e16" stroke={`url(#${gid}-gold-rim)`} strokeWidth="2.3" />
            <rect x="10" y="10" width="80" height="80" rx="10" fill={`url(#${gid}-start-glow)`} stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />

            {/* Fanning 3D emerald dollar stacks */}
            <g transform="rotate(-19 26 52)">
              <rect x="12" y="43" width="30" height="17" rx="3" fill="#064e3b" stroke="#022c22" strokeWidth="1.5" transform="translate(1.5,2)" />
              <rect x="12" y="43" width="30" height="17" rx="3" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.2" />
              <circle cx="27" cy="51.5" r="4.5" fill="#047857" />
              <text x="27" y="54.5" textAnchor="middle" fontFamily={FONT} fontSize="7.8" fontWeight="900" fill="#ecfdf5">$</text>
            </g>
            <g transform="rotate(18 74 52)">
              <rect x="58" y="43" width="30" height="17" rx="3" fill="#064e3b" stroke="#022c22" strokeWidth="1.5" transform="translate(1.5,2)" />
              <rect x="58" y="43" width="30" height="17" rx="3" fill="#059669" stroke="#6ee7b7" strokeWidth="1.2" />
              <circle cx="73" cy="51.5" r="4.5" fill="#10b981" />
              <text x="73" y="54.5" textAnchor="middle" fontFamily={FONT} fontSize="7.8" fontWeight="900" fill="#ecfdf5">$</text>
            </g>

            {/* 3D Smartphone receiving +$2 000 push */}
            <rect x="31" y="15" width="38" height="53" rx="7" fill="#030712" opacity="0.65" transform="translate(2, 3)" />
            <rect x="31" y="15" width="38" height="53" rx="7" fill={`url(#${gid}-phone-glass)`} stroke="#94a3b8" strokeWidth="1.8" />
            <rect x="44" y="18" width="12" height="2.6" rx="1.3" fill="#020617" />
            {/* Push notification card */}
            <rect x="26" y="25" width="48" height="20" rx="5" fill="#064e3b" stroke="#34d399" strokeWidth="1.6" />
            <text x="50" y="33.5" textAnchor="middle" fontFamily={FONT} fontSize="6" fontWeight="800" fill="#a7f3d0" letterSpacing="0.4">
              ЗАЧИСЛЕНИЕ ЗП
            </text>
            <text x="50" y="42" textAnchor="middle" fontFamily={FONT} fontSize="10.2" fontWeight="900" fill="#fef08a">
              +$2 000
            </text>
            {/* Red auto-debit warning claw reaching from bottom */}
            <rect x="35" y="49" width="30" height="11" rx="3" fill="#450a0a" stroke="#f43f5e" strokeWidth="1.1" />
            <text x="50" y="56.8" textAnchor="middle" fontFamily={FONT} fontSize="5.8" fontWeight="900" fill="#fda4af">
              МФО СПИШЕТ ЧЕРЕЗ 3..2..
            </text>

            {/* Gold coins */}
            <circle cx="21" cy="31" r="5" fill={`url(#${gid}-gold-rim)`} stroke="#78350f" strokeWidth="1.3" />
            <circle cx="79" cy="30" r="4.6" fill={`url(#${gid}-gold-rim)`} stroke="#78350f" strokeWidth="1.3" />

            {/* Bottom Champagne-Gold СТАРТ +$2K plaque */}
            <rect x="13" y="72" width="74" height="16" rx="5" fill="#121622" stroke={`url(#${gid}-gold-rim)`} strokeWidth="1.7" />
            <text x="50" y="83" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#fef08a" letterSpacing="0.8">
              СТАРТ +$2K
            </text>
            <Sparkle cx={24} cy={19} r={4.4} fill="#fef08a" />
            <Sparkle cx={77} cy={19} r={4} fill="#34d399" />
          </g>
        );

      // 1: Шаурма у вокзала
      case 1:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-shaurma-aura`} cx="48%" cy="52%" r="50%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.38" />
                <stop offset="65%" stopColor="#84cc16" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-lavash`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="52%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id={`${gid}-foil`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="45%" stopColor="#94a3b8" />
                <stop offset="78%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="45" fill={`url(#${gid}-shaurma-aura)`} />
            {/* Hot toxic steam curls */}
            <path d="M 30 26 Q 25 17 31 10" fill="none" stroke="#bef264" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
            <path d="M 44 22 Q 40 13 47 7" fill="none" stroke="#fde68a" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />

            {/* Cheeky street pigeon in top-right with tiny halo */}
            <g transform="translate(62, 10)">
              <ellipse cx="14" cy="4" rx="7" ry="2.2" fill="none" stroke="#fde047" strokeWidth="1.5" />
              <path d="M 6 24 C 4 15, 9 9, 15 9 C 20 9, 23 13, 23 18 C 28 19, 31 24, 28 28 L 8 28 Z" fill="#64748b" stroke="#0f172a" strokeWidth="1.7" />
              <path d="M 11 16 Q 16 14 19 18" fill="none" stroke="#a855f7" strokeWidth="2" opacity="0.75" />
              <path d="M 10 18 Q 15 16 18 20" fill="none" stroke="#22c55e" strokeWidth="1.6" opacity="0.75" />
              <circle cx="13" cy="13.5" r="2" fill="#f97316" />
              <circle cx="13" cy="13.5" r="0.9" fill="#090b10" />
              <polygon points="8,14 2,16 8,17.5" fill="#fde047" stroke="#0f172a" strokeWidth="0.9" />
            </g>

            {/* Volumetric tilted grilled Shawarma wrap */}
            <g transform="rotate(-26 46 54)">
              {/* Drop shadow */}
              <rect x="27" y="18" width="34" height="72" rx="15" fill="#05070c" opacity="0.6" transform="translate(3, 4)" />
              {/* Top toasted lavash cylinder */}
              <rect x="28" y="18" width="32" height="54" rx="13" fill={`url(#${gid}-lavash)`} stroke="#451a03" strokeWidth="2.2" />
              {/* Rich open filling top (meat, tomato, cabbage, garlic mayo) */}
              <ellipse cx="44" cy="24" rx="15" ry="7.5" fill="#7c2d12" stroke="#451a03" strokeWidth="1.8" />
              <circle cx="37" cy="23" r="4.2" fill="#dc2626" />
              <circle cx="49" cy="22" r="4.5" fill="#9a3412" />
              <path d="M 33 25 Q 42 19 54 25" fill="none" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
              {/* Dripping white garlic & toxic green sauce */}
              <path d="M 35 25 C 35 34, 39 36, 38 42 C 37 45, 41 45, 41 39 C 41 34, 46 31, 49 36 C 51 39, 54 37, 52 26 Z" fill="#fffbeb" stroke="#cbd5e1" strokeWidth="0.9" />
              <circle cx="38" cy="47" r="2.1" fill="#bef264" />
              {/* Dark grill sear stripes */}
              <line x1="32" y1="36" x2="55" y2="33" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" opacity="0.78" />
              <line x1="31" y1="43" x2="56" y2="40" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" opacity="0.78" />
              <line x1="32" y1="50" x2="55" y2="47" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" opacity="0.78" />
              {/* Crinkled 3D silver foil bottom wrapper */}
              <path d="M 26 51 L 62 49 L 59 86 C 58 91, 30 91, 29 86 Z" fill={`url(#${gid}-foil)`} stroke="#1e293b" strokeWidth="2.1" strokeLinejoin="round" />
              {/* Foil crinkle facet lines */}
              <path d="M 30 56 L 44 63 L 58 55 M 31 70 L 46 66 L 57 75 M 35 82 L 48 77" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
              <path d="M 33 61 L 45 69 L 55 62" fill="none" stroke="#334155" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
            </g>

            {/* Sauce drips at bottom left */}
            <circle cx="21" cy="79" r="3.4" fill="#fefce8" stroke="#ca8a04" strokeWidth="1" />
            <circle cx="29" cy="85" r="2.4" fill="#a3e635" />
          </g>
        );

      // 2, 17, 22, 33, 36: Шанс
      case 2:
      case 17:
      case 22:
      case 33:
      case 36:
        return <ChanceMark gid={gid} />;

      // 3: Мивина всухую
      case 3:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-noodle-glow`} cx="50%" cy="52%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.36" />
                <stop offset="65%" stopColor="#ef4444" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-pack-red`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="55%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
              <linearGradient id={`${gid}-noodle-briq`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="55%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="45" fill={`url(#${gid}-noodle-glow)`} />

            {/* Torn open crimson-gold wrapper on left */}
            <g transform="rotate(-11 36 56)">
              <path
                d="M 10 27 L 16 23 L 22 28 L 29 22 L 36 28 L 43 22 L 50 27 L 55 23 L 57 84 L 10 84 Z"
                fill="#04070d"
                opacity="0.55"
                transform="translate(2.5, 3)"
              />
              <path
                d="M 10 27 L 16 23 L 22 28 L 29 22 L 36 28 L 43 22 L 50 27 L 55 23 L 57 84 L 10 84 Z"
                fill={`url(#${gid}-pack-red)`}
                stroke="#fde047"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="14" y="54" width="38" height="16" rx="3.5" fill="#7f1d1d" stroke="#fde047" strokeWidth="1.2" />
              <text x="33" y="65" textAnchor="middle" fontFamily={FONT} fontSize="7.6" fontWeight="900" fill="#fef08a">
                ВСУХУЮ!
              </text>
            </g>

            {/* 3D Dry wavy golden noodle brick sticking out */}
            <g transform="rotate(8 56 48)">
              <rect x="33" y="23" width="44" height="44" rx="7" fill="#713f12" transform="translate(3, 3.5)" />
              <rect x="33" y="23" width="44" height="44" rx="7" fill={`url(#${gid}-noodle-briq)`} stroke="#854d0e" strokeWidth="2.1" />
              {/* Wavy dry ramen strands */}
              {[29, 36, 43, 50, 57, 62].map((y) => (
                <path
                  key={y}
                  d={`M 36 ${y} Q 41 ${y - 3} 46 ${y} T 56 ${y} T 66 ${y} T 74 ${y}`}
                  fill="none"
                  stroke="#a16207"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
              ))}
              {/* Bite corner & flying crunchy crumbs */}
              <circle cx="75" cy="25" r="7" fill="#0d111a" />
            </g>

            {/* Torn silver seasoning sachet pouring glowing spice dust */}
            <g transform="rotate(-24 72 20)">
              <rect x="59" y="8" width="24" height="18" rx="2" fill="#cbd5e1" stroke="#334155" strokeWidth="1.6" />
              <rect x="62" y="11" width="18" height="6" fill="#ea580c" />
              <text x="71" y="23" textAnchor="middle" fontFamily={FONT} fontSize="5.4" fontWeight="900" fill="#0f172a">E621</text>
            </g>
            {/* Glowing orange chili/MSG spice stream */}
            <circle cx="61" cy="29" r="2" fill="#fb923c" />
            <circle cx="57" cy="35" r="1.8" fill="#ef4444" />
            <circle cx="64" cy="37" r="1.6" fill="#fde047" />
            <circle cx="53" cy="41" r="1.9" fill="#ea580c" />
            {/* Crunchy noodle crumbs at bottom right */}
            <path d="M 67 77 Q 72 74 76 79" fill="none" stroke="#fde047" strokeWidth="3" strokeLinecap="round" />
            <path d="M 79 72 Q 84 70 86 75" fill="none" stroke="#facc15" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="72" cy="85" r="2.2" fill="#fde047" />
            <circle cx="83" cy="83" r="1.8" fill="#fb923c" />
          </g>
        );

      // 4: Ночной додеп в 3:00 (Tax -$2000)
      case 4:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-dodep-glow`} cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.44" />
                <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-flame`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="55%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-dodep-glow)`} />

            {/* Burning emerald dollar bill behind phone */}
            <g transform="rotate(-18 28 38)">
              <path d="M 10 24 C 14 10, 24 8, 26 20 C 31 10, 40 14, 38 28 Z" fill={`url(#${gid}-flame)`} />
              <rect x="10" y="26" width="32" height="17" rx="2.5" fill="#059669" stroke="#6ee7b7" strokeWidth="1.3" />
              <text x="24" y="37.5" textAnchor="middle" fontFamily={FONT} fontSize="8.5" fontWeight="900" fill="#ecfdf5">$$$</text>
            </g>

            {/* Dark smartphone glowing at 03:14 AM */}
            <rect x="26" y="13" width="48" height="74" rx="8" fill="#020617" opacity="0.7" transform="translate(2.5, 3)" />
            <rect x="26" y="13" width="48" height="74" rx="8" fill="#0f172a" stroke="#f43f5e" strokeWidth="2.1" />
            <rect x="30" y="18" width="40" height="63" rx="5" fill="#090b12" />
            {/* 03:14 AM clock */}
            <text x="50" y="28" textAnchor="middle" fontFamily={FONT} fontSize="8.6" fontWeight="900" fill="#94a3b8" letterSpacing="0.8">
              03:14
            </text>
            {/* Bloodshot sleep-deprived eye reflection */}
            <ellipse cx="50" cy="39" rx="13" ry="7.5" fill="#fff1f2" stroke="#e11d48" strokeWidth="1.4" />
            <path d="M 39 38 L 43 39 M 61 38 L 57 39 M 41 42 L 44 40.5 M 59 42 L 56 40.5" stroke="#ef4444" strokeWidth="0.9" />
            <circle cx="50" cy="39" r="4.2" fill="#dc2626" />
            <circle cx="50" cy="39" r="1.9" fill="#020617" />
            <circle cx="48.6" cy="37.6" r="1" fill="#ffffff" />

            {/* Balance $0.00 */}
            <rect x="33" y="50" width="34" height="13" rx="3" fill="#450a0a" stroke="#ef4444" strokeWidth="1.2" />
            <text x="50" y="59.2" textAnchor="middle" fontFamily={FONT} fontSize="8.6" fontWeight="900" fill="#fca5a5">
              $0.00
            </text>

            {/* Glowing crimson -$2 000 tax badge */}
            <rect x="16" y="68" width="68" height="17" rx="5" fill="#dc2626" stroke="#fde047" strokeWidth="1.7" />
            <text x="50" y="79.5" textAnchor="middle" fontFamily={FONT} fontSize="10" fontWeight="900" fill="#ffffff" letterSpacing="0.5">
              -$2 000
            </text>
            <Sparkle cx={82} cy={25} r={4.2} fill="#fb923c" />
          </g>
        );

      // 5: Ржавая Жига без дна
      case 5:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-zhiga-glow`} cx="50%" cy="54%" r="50%">
                <stop offset="0%" stopColor="#ea580c" stopOpacity="0.34" />
                <stop offset="65%" stopColor="#64748b" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-zhiga-paint`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="55%" stopColor="#991b1b" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="45" fill={`url(#${gid}-zhiga-glow)`} />

            {/* Black exhaust smoke puffs on left */}
            <circle cx="13" cy="54" r="6.5" fill="#1e293b" opacity="0.85" />
            <circle cx="8" cy="44" r="5" fill="#334155" opacity="0.7" />
            <circle cx="14" cy="36" r="3.8" fill="#475569" opacity="0.55" />

            {/* Asphalt road line + bright orange friction sparks */}
            <line x1="8" y1="84" x2="92" y2="84" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            <path d="M 42 83 L 31 76 M 45 83 L 35 72 M 58 83 L 49 75" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />

            {/* Driver's legs & striped sneakers sticking out through missing floorboard! */}
            <rect x="44" y="65" width="5.5" height="14" rx="2" fill="#1d4ed8" stroke="#090b10" strokeWidth="1.2" transform="rotate(-10 46 72)" />
            <path d="M 41 77 L 53 77 C 56 77, 57 83, 53 83 L 40 83 Z" fill="#0f172a" stroke="#f8fafc" strokeWidth="1.3" />
            <line x1="45" y1="78" x2="47" y2="82" stroke="#ffffff" strokeWidth="1.2" />
            <rect x="57" y="65" width="5.5" height="14" rx="2" fill="#1e40af" stroke="#090b10" strokeWidth="1.2" transform="rotate(-12 59 72)" />
            <path d="M 54 77 L 66 77 C 69 77, 70 83, 66 83 L 53 83 Z" fill="#0f172a" stroke="#f8fafc" strokeWidth="1.3" />
            <line x1="58" y1="78" x2="60" y2="82" stroke="#ffffff" strokeWidth="1.2" />

            {/* Classic boxy Zhiga sedan silhouette with rusted bottom gap */}
            <rect x="33" y="22" width="30" height="7" rx="1.5" fill="#78350f" stroke="#090b10" strokeWidth="1.4" />
            <line x1="37" y1="22" x2="37" y2="29" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="59" y1="22" x2="59" y2="29" stroke="#cbd5e1" strokeWidth="1.5" />
            <path
              d="M 11 54 L 25 49 L 33 30 L 66 30 L 75 48 L 91 52 L 90 67 L 69 67 L 64 62 L 39 63 L 34 67 L 12 67 Z"
              fill={`url(#${gid}-zhiga-paint)`}
              stroke="#090b10"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Windows */}
            <polygon points="35,33 49,33 49,47 29,47" fill="#38bdf8" fillOpacity="0.45" stroke="#090b10" strokeWidth="1.5" />
            <polygon points="52,33 64,33 71,47 52,47" fill="#38bdf8" fillOpacity="0.38" stroke="#090b10" strokeWidth="1.5" />
            {/* Jagged rust holes & blue duct tape */}
            <polygon points="38,54 48,51 54,56 46,61" fill="#78350f" />
            <polygon points="55,53 64,51 67,58 58,60" fill="#92400e" />
            <rect x="74" y="49" width="11" height="4" rx="1" fill="#2563eb" transform="rotate(18 79 51)" />
            {/* Twin round Zhiga headlight glow */}
            <circle cx="88" cy="57" r="3.6" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2" />
            {/* Wheels (tilted rear wheel) */}
            <circle cx="24" cy="68" r="8.8" fill="#090b10" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="24" cy="68" r="3.4" fill="#cbd5e1" />
            <circle cx="77" cy="68" r="8.8" fill="#090b10" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="77" cy="68" r="3.4" fill="#cbd5e1" />
          </g>
        );

      // 6: Паленый Stone Island
      case 6:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-stone-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.34" />
                <stop offset="65%" stopColor="#eab308" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-sleeve`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="55%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-stone-glow)`} />

            {/* 3D synthetic jacket sleeve with folds & static sparks */}
            <path
              d="M 14 14 L 78 18 L 70 88 L 12 84 Z"
              fill={`url(#${gid}-sleeve)`}
              stroke="#64748b"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M 22 20 Q 34 45 20 76 M 66 24 Q 56 52 64 82" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
            {/* Empty button & dangling white loose thread */}
            <circle cx="24" cy="40" r="3.5" fill="#090b10" stroke="#94a3b8" strokeWidth="1.2" />
            <path d="M 24 40 C 22 48, 29 50, 26 57" fill="none" stroke="#f8fafc" strokeWidth="1.6" strokeLinecap="round" />

            {/* Crooked counterfeit patch hanging diagonally on 1 button + safety pin */}
            <g transform="rotate(17 50 54)">
              <rect x="21" y="38" width="56" height="28" rx="4" fill="#020617" opacity="0.65" transform="translate(2.5, 3.5)" />
              <rect x="21" y="38" width="56" height="28" rx="4" fill="#09090b" stroke="#eab308" strokeWidth="1.7" />
              <rect x="24" y="41" width="50" height="22" rx="2" fill="none" stroke="#eab308" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="2.5 2" />
              {/* Right button attached */}
              <circle cx="69" cy="52" r="3.4" fill="#27272a" stroke="#a1a1aa" strokeWidth="1.1" />
              {/* Crooked 3-pointed fake star instead of 4-point compass */}
              <circle cx="49" cy="52" r="9.2" fill="#14532d" stroke="#22c55e" strokeWidth="1.6" />
              <polygon points="49,43.5 52,51 57.5,56.5 49,54 40.5,56.5 46,51" fill="#fde047" />
              <circle cx="49" cy="52" r="1.8" fill="#09090b" />
            </g>

            {/* Chrome safety pin holding left corner */}
            <path d="M 20 44 L 35 34 C 38 32, 40 36, 37 38 L 24 47" fill="none" stroke="#e2e8f0" strokeWidth="2.1" strokeLinecap="round" />
            <circle cx="20" cy="44" r="2.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="1" />

            {/* Synthetic static electricity sparks + ПАЛЬ 100% price tag */}
            <path d="M 79 31 L 86 27 L 82 35 L 89 33" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <g transform="rotate(-10 68 79)">
              <rect x="44" y="70" width="46" height="17" rx="4" fill="#fde047" stroke="#090b10" strokeWidth="1.8" />
              <text x="67" y="81.5" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#b91c1c">
                ПАЛЬ 100%
              </text>
            </g>
          </g>
        );

      // 7: Ебаный квантовый телепорт (PORTAL — Glowing purple-cyan vortex + flying rubber slipper & platzkart)
      case 7:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-portal-core`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ecfeff" />
                <stop offset="28%" stopColor="#22d3ee" />
                <stop offset="62%" stopColor="#a855f7" />
                <stop offset="88%" stopColor="#4c1d95" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-portal-ring`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#e879f9" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {/* Outer cosmic glow */}
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-portal-core)`} />

            {/* Multi-layered 3D swirling vortex rings */}
            <ellipse cx="50" cy="50" rx="39" ry="34" fill="none" stroke={`url(#${gid}-portal-ring)`} strokeWidth="3.2" strokeDasharray="14 6" transform="rotate(-22 50 50)" />
            <ellipse cx="50" cy="50" rx="30" ry="25" fill="none" stroke="#67e8f9" strokeWidth="2.6" strokeDasharray="10 5" transform="rotate(28 50 50)" />
            <ellipse cx="50" cy="50" rx="20" ry="17" fill="#090418" fillOpacity="0.55" stroke="#f0abfc" strokeWidth="2.2" />
            <circle cx="50" cy="50" r="9.5" fill="#ecfeff" opacity="0.92" />

            {/* Quantum lightning arcs */}
            <path d="M 14 32 L 24 37 L 19 44 L 30 48" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 86 64 L 75 60 L 79 53 L 69 50" fill="none" stroke="#e879f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Floating mini platzkart carriage window/berth sucked into top-right of vortex */}
            <g transform="rotate(21 71 26)">
              <rect x="55" y="13" width="32" height="22" rx="4" fill="#1e3a8a" stroke="#facc15" strokeWidth="1.8" />
              <rect x="59" y="17" width="10" height="9" rx="1.5" fill="#bae6fd" />
              <rect x="73" y="17" width="10" height="9" rx="1.5" fill="#fde047" />
              <line x1="56" y1="30" x2="86" y2="30" stroke="#facc15" strokeWidth="2" />
            </g>

            {/* Iconic striped blue rubber slipper (тапок) flying out of quantum portal! */}
            <g transform="rotate(-28 32 69)">
              {/* Sole shadow */}
              <ellipse cx="32" cy="71" rx="18" ry="8.5" fill="#020617" opacity="0.65" transform="translate(2, 2.5)" />
              {/* Textured blue rubber sole */}
              <ellipse cx="32" cy="71" rx="18" ry="8.5" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.8" />
              {/* Classic white-striped strap across instep */}
              <path d="M 24 63 C 28 57, 38 57, 41 63 L 39 78 C 35 74, 28 74, 24 78 Z" fill="#1e40af" stroke="#eff6ff" strokeWidth="1.4" />
              <line x1="27" y1="62" x2="26" y2="76" stroke="#ffffff" strokeWidth="2" />
              <line x1="32.5" y1="60.5" x2="31.5" y2="75.5" stroke="#ffffff" strokeWidth="2" />
              <line x1="38" y1="62" x2="37" y2="76" stroke="#ffffff" strokeWidth="2" />
            </g>

            <Sparkle cx={20} cy={20} r={4.8} fill="#22d3ee" />
            <Sparkle cx={82} cy={78} r={4.5} fill="#f0abfc" />
          </g>
        );

      // 8: Мамонт-фишинг
      case 8:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-mammoth-glow`} cx="50%" cy="52%" r="50%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.38" />
                <stop offset="65%" stopColor="#a855f7" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-fur`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b45309" />
                <stop offset="55%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="45" fill={`url(#${gid}-mammoth-glow)`} />

            {/* Phishing smartphone screen at top */}
            <rect x="46" y="8" width="44" height="23" rx="4.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
            <text x="68" y="18" textAnchor="middle" fontFamily={FONT} fontSize="6.2" fontWeight="900" fill="#38bdf8">
              ВВЕДИТЕ CVV
            </text>
            <rect x="52" y="21" width="32" height="6.5" rx="2" fill="#1e293b" stroke="#22d3ee" strokeWidth="1" />
            <text x="68" y="26.2" textAnchor="middle" fontFamily={FONT} fontSize="6.5" fontWeight="900" fill="#fde047">
              * * *
            </text>

            {/* Glowing neon fishing line & chrome hook */}
            <line x1="68" y1="31" x2="68" y2="54" stroke="#22d3ee" strokeWidth="2" strokeDasharray="3 2" />
            <path d="M 68 53 L 68 65 C 68 73, 57 73, 57 65 C 57 62, 60 60, 62 62" fill="none" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" />

            {/* 3D Woolly Mammoth head & trunk reaching for the hook + clown nose */}
            <g>
              {/* Ears */}
              <ellipse cx="18" cy="54" rx="8" ry="12" fill="#451a03" stroke="#090b10" strokeWidth="1.8" />
              {/* Shaggy dome & body */}
              <path
                d="M 14 84 L 14 50 C 14 33, 44 31, 48 48 L 49 62 C 52 67, 60 67, 61 61 L 67 63 C 66 76, 49 78, 43 70 L 43 84 Z"
                fill={`url(#${gid}-fur)`}
                stroke="#090b10"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Shaggy hair tuft */}
              <path d="M 25 36 L 29 29 L 33 35 L 38 30 L 40 37" fill="#92400e" stroke="#090b10" strokeWidth="1.5" strokeLinejoin="round" />
              {/* Curved ivory tusks */}
              <path d="M 41 64 C 49 74, 62 74, 66 64" fill="none" stroke="#fefce8" strokeWidth="4.4" strokeLinecap="round" />
              <path d="M 41 64 C 49 74, 62 74, 66 64" fill="none" stroke="#ca8a04" strokeWidth="1" strokeLinecap="round" />
              {/* Naive wide eye */}
              <circle cx="37" cy="50" r="4.5" fill="#ffffff" stroke="#090b10" strokeWidth="1.3" />
              <circle cx="38.5" cy="50" r="2.1" fill="#090b10" />
              <circle cx="37.8" cy="49" r="0.9" fill="#ffffff" />
              {/* Shiny red clown nose on mammoth! */}
              <circle cx="48" cy="56" r="4.8" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.3" />
              <circle cx="46.5" cy="54.5" r="1.4" fill="#ffffff" opacity="0.85" />
            </g>
            <Sparkle cx={79} cy={52} r={4.2} fill="#22d3ee" />
          </g>
        );

      // 9: Арбитраж трафика
      case 9:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-arb-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.36" />
                <stop offset="62%" stopColor="#10b981" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-funnel`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-arb-glow)`} />

            {/* 3D Open MacBook / Dark Affiliate Laptop at bottom */}
            <rect x="18" y="45" width="64" height="36" rx="4.5" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
            <rect x="22" y="49" width="56" height="28" rx="2.5" fill="#060913" />
            {/* Affiliate ROI graph inside screen */}
            <rect x="26" y="64" width="6" height="10" rx="1" fill="#38bdf8" />
            <rect x="35" y="59" width="6" height="15" rx="1" fill="#818cf8" />
            <rect x="44" y="54" width="6" height="20" rx="1" fill="#34d399" />
            <path d="M 27 62 L 38 56 L 48 51 L 68 53" fill="none" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
            {/* Laptop base */}
            <polygon points="10,81 90,81 84,88 16,88" fill="#334155" stroke="#94a3b8" strokeWidth="1.4" strokeLinejoin="round" />

            {/* Glowing 3D Traffic Funnel floating above screen */}
            <polygon
              points="23,16 77,16 57,39 57,51 43,51 43,39"
              fill={`url(#${gid}-funnel)`}
              fillOpacity="0.88"
              stroke="#ecfeff"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <ellipse cx="50" cy="16" rx="27" ry="5.5" fill="#0ea5e9" stroke="#bae6fd" strokeWidth="1.5" />
            <text x="50" y="32" textAnchor="middle" fontFamily={FONT} fontSize="7.4" fontWeight="900" fill="#ffffff">
              ROI +999%
            </text>

            {/* Flying gold $ coins & click arrows */}
            <circle cx="67" cy="64" r="6.5" fill="#fde047" stroke="#92400e" strokeWidth="1.5" />
            <text x="67" y="67" textAnchor="middle" fontFamily={FONT} fontSize="8.2" fontWeight="900" fill="#78350f">$</text>
            <Sparkle cx={18} cy={28} r={4} fill="#38bdf8" />
            <Sparkle cx={83} cy={31} r={4.4} fill="#34d399" />
          </g>
        );

      // 10: Учебка (Custom Dark Luxury Bastion Icon)
      case 10:
        return (
          <g>
            <defs>
              <clipPath id={`${gid}-uchebka-clip`}>
                <rect x="2" y="2" width="96" height="96" rx="14" />
              </clipPath>
            </defs>
            <rect x="2" y="2" width="96" height="96" rx="14" fill="#0b0e15" />
            <image
              href="/art/corner_uchebka.png"
              x="-10"
              y="-10"
              width="120"
              height="120"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${gid}-uchebka-clip)`}
            />
          </g>
        );

      // 11: Курс «Успешный успех»
      case 11:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-info-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#d946ef" stopOpacity="0.42" />
                <stop offset="62%" stopColor="#f59e0b" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-gold-horn`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-info-glow)`} />

            {/* Cardboard Lambo cutout with wooden prop stick & tape */}
            <g transform="translate(0, 6)">
              <line x1="25" y1="54" x2="17" y2="74" stroke="#78350f" strokeWidth="2.8" strokeLinecap="round" />
              <path
                d="M 10 68 L 22 57 L 48 54 L 68 62 L 86 64 L 88 73 L 10 73 Z"
                fill="#ca8a04"
                stroke="#fef08a"
                strokeWidth="1.6"
                strokeDasharray="4 2"
                strokeLinejoin="round"
              />
              <text x="48" y="68" textAnchor="middle" fontFamily={FONT} fontSize="6.8" fontWeight="900" fill="#451a03">
                КАРТОНКА АРЕНДА
              </text>
              <circle cx="26" cy="74" r="6" fill="#18181b" stroke="#94a3b8" strokeWidth="1.5" />
              <circle cx="72" cy="74" r="6" fill="#18181b" stroke="#94a3b8" strokeWidth="1.5" />
            </g>

            {/* Golden paper crown */}
            <polygon
              points="18,32 15,17 26,24 34,13 42,24 52,17 49,32"
              fill={`url(#${gid}-gold-horn)`}
              stroke="#451a03"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="34" cy="22" r="2.2" fill="#d946ef" />

            {/* 3D Golden Infogypsy Megaphone blasting hype */}
            <g transform="rotate(-16 58 43)">
              <polygon points="38,40 74,24 74,58 38,48" fill={`url(#${gid}-gold-horn)`} stroke="#451a03" strokeWidth="2" strokeLinejoin="round" />
              <ellipse cx="74" cy="41" rx="5.5" ry="17" fill="#78350f" stroke="#fde047" strokeWidth="1.6" />
              <rect x="31" y="40" width="8" height="9" rx="2" fill="#e879f9" stroke="#4a044e" strokeWidth="1.5" />
              <rect x="41" y="48" width="6" height="12" rx="2" fill="#c026d3" stroke="#4a044e" strokeWidth="1.4" transform="rotate(18 44 54)" />
            </g>

            {/* Neon VIP TARIFF pill */}
            <rect x="16" y="77" width="68" height="14" rx="4.5" fill="#701a75" stroke="#f0abfc" strokeWidth="1.5" />
            <text x="50" y="86.8" textAnchor="middle" fontFamily={FONT} fontSize="7.8" fontWeight="900" fill="#fdf4ff" letterSpacing="0.4">
              VIP ПОТОК • Х100
            </text>
            <Sparkle cx={84} cy={20} r={4.6} fill="#f0abfc" />
          </g>
        );

      // 12: Блэкаут на 18 часов
      case 12:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-candle-halo`} cx="44%" cy="38%" r="48%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.48" />
                <stop offset="48%" stopColor="#f97316" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#04070d" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-wax`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="55%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Pitch-black blackout chamber frame */}
            <rect x="8" y="8" width="84" height="84" rx="13" fill="#060911" stroke="#14b8a6" strokeOpacity="0.55" strokeWidth="2" />
            <circle cx="44" cy="40" r="38" fill={`url(#${gid}-candle-halo)`} />

            {/* Severed sparking power cable at top-right */}
            <path d="M 88 16 C 74 16, 71 24, 66 28" fill="none" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 65 28 L 58 25 M 66 29 L 61 35 M 67 28 L 71 34" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />

            {/* Dead 0% red battery badge */}
            <g transform="translate(54, 43)">
              <rect x="0" y="0" width="30" height="16" rx="3" fill="#18181b" stroke="#ef4444" strokeWidth="1.8" />
              <rect x="30" y="4.5" width="3" height="7" rx="1" fill="#ef4444" />
              <rect x="2.5" y="2.5" width="4" height="11" rx="1" fill="#dc2626" />
              <text x="16" y="11" textAnchor="middle" fontFamily={FONT} fontSize="7.6" fontWeight="900" fill="#fca5a5">
                0%
              </text>
            </g>

            {/* Volumetric melting wax candle */}
            <ellipse cx="36" cy="81" rx="20" ry="5.5" fill="#92400e" stroke="#451a03" strokeWidth="1.4" />
            <rect x="26" y="44" width="20" height="37" rx="3" fill={`url(#${gid}-wax)`} stroke="#78350f" strokeWidth="1.8" />
            {/* Wax drips */}
            <path d="M 26 46 C 26 57, 30 58, 30 52 C 30 62, 35 64, 35 55 C 35 49, 41 53, 41 60 C 41 64, 46 61, 46 46 Z" fill="#fffbeb" />
            {/* Wick & 3-layer glowing flame */}
            <line x1="36" y1="44" x2="36" y2="39" stroke="#1e293b" strokeWidth="2" />
            <path d="M 36 18 C 44 27, 43 38, 36 40 C 29 38, 28 27, 36 18 Z" fill="#f97316" />
            <path d="M 36 23 C 41 29, 40 37, 36 39 C 32 37, 31 29, 36 23 Z" fill="#fde047" />
            <circle cx="36" cy="35" r="2.5" fill="#ffffff" />

            {/* 18 ЧАСОВ badge */}
            <rect x="49" y="67" width="37" height="15" rx="4" fill="#0f172a" stroke="#14b8a6" strokeWidth="1.5" />
            <text x="67.5" y="77.2" textAnchor="middle" fontFamily={FONT} fontSize="7.6" fontWeight="900" fill="#5eead4">
              18 ЧАСОВ
            </text>
          </g>
        );

      // 13: Фьючерсы с плечом x125
      case 13:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-liq-glow`} cx="50%" cy="54%" r="52%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#d946ef" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-red-candle`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="46" fill={`url(#${gid}-liq-glow)`} />

            {/* Dark crypto terminal screen */}
            <rect x="10" y="12" width="80" height="62" rx="8" fill="#090d16" stroke="#475569" strokeWidth="2" />
            <line x1="14" y1="32" x2="86" y2="32" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="14" y1="52" x2="86" y2="52" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

            {/* Tiny green bait candles before the nuke */}
            <line x1="22" y1="40" x2="22" y2="56" stroke="#10b981" strokeWidth="1.8" />
            <rect x="18.5" y="44" width="7" height="9" rx="1" fill="#10b981" />
            <line x1="35" y1="30" x2="35" y2="47" stroke="#10b981" strokeWidth="1.8" />
            <rect x="31.5" y="34" width="7" height="10" rx="1" fill="#34d399" />
            <line x1="48" y1="22" x2="48" y2="38" stroke="#10b981" strokeWidth="1.8" />
            <rect x="44.5" y="25" width="7" height="9" rx="1" fill="#10b981" />

            {/* GIANT 3D Crimson Liquidation Candle crashing straight through bottom bezel! */}
            <line x1="68" y1="17" x2="68" y2="93" stroke="#fda4af" strokeWidth="2.8" />
            <rect x="59" y="24" width="18" height="62" rx="3" fill="#04060c" opacity="0.65" transform="translate(2.5, 3)" />
            <rect x="59" y="24" width="18" height="62" rx="3" fill={`url(#${gid}-red-candle)`} stroke="#fecdd3" strokeWidth="1.6" />
            <polygon points="68,95 57,82 79,82" fill="#e11d48" stroke="#fecdd3" strokeWidth="1.3" strokeLinejoin="round" />

            {/* Shatter cracks where candle breaks bottom frame */}
            <path d="M 53 74 L 47 80 M 82 74 L 88 81" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" />

            {/* Neon x125 LIQ badge + mini skull */}
            <rect x="12" y="64" width="44" height="19" rx="4.5" fill="#701a75" stroke="#f0abfc" strokeWidth="1.7" />
            <text x="34" y="76.8" textAnchor="middle" fontFamily={FONT} fontSize="10.2" fontWeight="900" fill="#fef08a">
              x125
            </text>
          </g>
        );

      // 14: Тапалка с листингом
      case 14:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-tap-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#eab308" stopOpacity="0.42" />
                <stop offset="60%" stopColor="#d946ef" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-hamster-coin`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="48%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-tap-glow)`} />

            {/* Concentric neon tap shockwave rings */}
            <circle cx="48" cy="46" r="37" fill="none" stroke="#e879f9" strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="5 4" />
            <circle cx="48" cy="46" r="31" fill="none" stroke="#fde047" strokeOpacity="0.55" strokeWidth="1.8" />

            {/* 3D Golden Tap Coin with manic hamster face */}
            <circle cx="48" cy="46" r="25" fill="#451a03" transform="translate(2.5, 3.5)" />
            <circle cx="48" cy="46" r="25" fill={`url(#${gid}-hamster-coin)`} stroke="#fef9c3" strokeWidth="2.2" />
            <circle cx="48" cy="46" r="20.5" fill="none" stroke="#78350f" strokeWidth="1.4" strokeDasharray="3 2" />

            {/* Cute-manic hamster ears, cheeks, buck tooth */}
            <circle cx="35" cy="31" r="5.5" fill="#d97706" stroke="#451a03" strokeWidth="1.6" />
            <circle cx="61" cy="31" r="5.5" fill="#d97706" stroke="#451a03" strokeWidth="1.6" />
            <ellipse cx="48" cy="48" rx="14.5" ry="13" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
            <circle cx="38" cy="51" r="4.5" fill="#fde68a" opacity="0.8" />
            <circle cx="58" cy="51" r="4.5" fill="#fde68a" opacity="0.8" />
            {/* Wide bloodshot tap-addicted eyes */}
            <circle cx="42.5" cy="45" r="3.6" fill="#ffffff" stroke="#451a03" strokeWidth="1.2" />
            <circle cx="53.5" cy="45" r="3.6" fill="#ffffff" stroke="#451a03" strokeWidth="1.2" />
            <circle cx="42.5" cy="45" r="1.6" fill="#090b10" />
            <circle cx="53.5" cy="45" r="1.6" fill="#090b10" />
            {/* Nose & buck teeth */}
            <ellipse cx="48" cy="50" rx="2.4" ry="1.6" fill="#be185d" />
            <rect x="45.8" y="52.5" width="4.4" height="4" rx="0.8" fill="#ffffff" stroke="#451a03" strokeWidth="0.9" />

            {/* Screen glass crack lines from furious tapping */}
            <path d="M 48 46 L 61 36 L 69 38 M 48 46 L 36 58 L 28 62" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />

            {/* Pathetic listing payout tag $0.42 */}
            <g transform="rotate(-7 64 80)">
              <rect x="37" y="71" width="54" height="17" rx="4.5" fill="#0f172a" stroke="#f0abfc" strokeWidth="1.8" />
              <text x="64" y="82.5" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#fde047">
                ДРОП $0.42
              </text>
            </g>
            <Sparkle cx={18} cy={24} r={4.4} fill="#fde047" />
          </g>
        );

      // 15: Катафалк на бляхах
      case 15:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-hearse-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.35" />
                <stop offset="65%" stopColor="#e11d48" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-hearse-body`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="45%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-hearse-glow)`} />

            {/* Crooked EU-style foreign plate at top */}
            <g transform="rotate(-4 50 19)">
              <rect x="18" y="9" width="64" height="18" rx="3" fill="#f8fafc" stroke="#090b10" strokeWidth="2" />
              <rect x="19.5" y="10.5" width="12" height="15" rx="1.5" fill="#1d4ed8" />
              <text x="25.5" y="21.5" textAnchor="middle" fontFamily={FONT} fontSize="6.5" fontWeight="900" fill="#ffffff">LT</text>
              <text x="56" y="22" textAnchor="middle" fontFamily={FONT} fontSize="10.5" fontWeight="900" fill="#090b10" letterSpacing="0.8">
                RIP 666
              </text>
            </g>

            {/* Dark diesel smoke cloud */}
            <circle cx="11" cy="64" r="6" fill="#334155" opacity="0.8" />
            <circle cx="7" cy="55" r="4.5" fill="#475569" opacity="0.6" />

            {/* Elongated 3D Luxury Black Hearse wagon */}
            <path
              d="M 10 68 L 12 40 C 12 36, 16 34, 21 34 L 62 34 L 74 49 L 91 52 L 91 68 Z"
              fill={`url(#${gid}-hearse-body)`}
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Long panoramic rear window with crimson velvet drapes */}
            <rect x="16" y="38" width="34" height="14" rx="2" fill="#1e1b4b" stroke="#cbd5e1" strokeWidth="1.3" />
            <path d="M 16 38 Q 23 45 18 52 L 16 52 Z M 50 38 Q 43 45 48 52 L 50 52 Z" fill="#be123c" />
            {/* Decorative chrome Landau S-bar on rear pillar & gold wreath */}
            <circle cx="33" cy="45" r="4.8" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="2.5 1.2" />
            {/* Front window */}
            <polygon points="54,38 61,38 70,50 54,50" fill="#38bdf8" fillOpacity="0.35" stroke="#cbd5e1" strokeWidth="1.2" />
            {/* Chrome trim line & yellow fog headlight */}
            <line x1="12" y1="57" x2="89" y2="57" stroke="#e2e8f0" strokeWidth="1.4" />
            <rect x="86" y="54" width="5" height="5" rx="1" fill="#fde047" />

            {/* Whitewall tires */}
            <circle cx="26" cy="70" r="8.5" fill="#090b10" stroke="#e2e8f0" strokeWidth="2.2" />
            <circle cx="26" cy="70" r="3.5" fill="#94a3b8" />
            <circle cx="75" cy="70" r="8.5" fill="#090b10" stroke="#e2e8f0" strokeWidth="2.2" />
            <circle cx="75" cy="70" r="3.5" fill="#94a3b8" />
          </g>
        );

      // 16: Жижа со вкусом гудрона
      case 16:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-tar-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#78350f" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-pod-metal`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="50%" stopColor="#c2410c" />
                <stop offset="100%" stopColor="#431407" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-tar-glow)`} />

            {/* Thick swirling black-amber tar vapor clouds */}
            <circle cx="62" cy="20" r="11" fill="#1e293b" stroke="#fb923c" strokeOpacity="0.45" strokeWidth="1.4" />
            <circle cx="76" cy="27" r="9" fill="#0f172a" stroke="#f97316" strokeOpacity="0.4" strokeWidth="1.2" />
            <circle cx="48" cy="17" r="7.5" fill="#334155" opacity="0.8" />

            {/* Chubby Gorilla dark e-liquid bottle with dripping black tar */}
            <g transform="rotate(-7 34 54)">
              <polygon points="30,17 34,9 38,17" fill="#cbd5e1" stroke="#090b10" strokeWidth="1.4" />
              <rect x="25" y="17" width="18" height="8" rx="2" fill="#09090b" stroke="#fb923c" strokeWidth="1.4" />
              <rect x="19" y="25" width="30" height="58" rx="7" fill="#090b10" stroke="#94a3b8" strokeWidth="2" />
              {/* Orange hazard label + skull */}
              <rect x="21" y="39" width="26" height="31" rx="2.5" fill="#ea580c" />
              <circle cx="34" cy="50" r="6" fill="#fffbeb" />
              <circle cx="31.8" cy="49.5" r="1.4" fill="#090b10" />
              <circle cx="36.2" cy="49.5" r="1.4" fill="#090b10" />
              <text x="34" y="65.5" textAnchor="middle" fontFamily={FONT} fontSize="6.6" fontWeight="900" fill="#090b10">
                ГУДРОН
              </text>
              {/* Black tar drip oozing from bottle neck */}
              <path d="M 24 26 C 24 35, 28 36, 28 31 C 28 39, 33 39, 33 26 Z" fill="#020617" stroke="#f97316" strokeWidth="0.8" />
            </g>

            {/* Sleek 3D Pod Vape Stick on right with burnt red-orange coil glow */}
            <g transform="rotate(13 68 58)">
              <path d="M 61 32 L 75 32 L 77 42 L 59 42 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.6" />
              <rect x="59" y="42" width="18" height="44" rx="4" fill={`url(#${gid}-pod-metal)`} stroke="#fed7aa" strokeWidth="1.7" />
              {/* Burnt coil spark & LED */}
              <circle cx="68" cy="64" r="3" fill="#fef08a" stroke="#ef4444" strokeWidth="1.5" />
            </g>
          </g>
        );

      // 18: Три банки энергетика
      case 18:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-energy-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#84cc16" stopOpacity="0.38" />
                <stop offset="58%" stopColor="#f97316" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-energy-glow)`} />

            {/* Left Can (Toxic Orange, tilted left) */}
            <g transform="rotate(-14 26 53)">
              <rect x="13" y="25" width="24" height="54" rx="4" fill="#18181b" stroke="#fb923c" strokeWidth="1.8" />
              <rect x="15" y="22" width="20" height="4" rx="1.5" fill="#cbd5e1" />
              <polygon points="26,34 19,49 25,49 22,64 31,46 25,46" fill="#f97316" />
            </g>

            {/* Right Can (Neon Pink/Purple, tilted right) */}
            <g transform="rotate(14 74 53)">
              <rect x="63" y="25" width="24" height="54" rx="4" fill="#18181b" stroke="#e879f9" strokeWidth="1.8" />
              <rect x="65" y="22" width="20" height="4" rx="1.5" fill="#cbd5e1" />
              <polygon points="76,34 69,49 75,49 72,64 81,46 75,46" fill="#e879f9" />
            </g>

            {/* Center Hero Can (Acid Monster-Lime 3D) */}
            <rect x="35" y="16" width="30" height="64" rx="5" fill="#030712" opacity="0.7" transform="translate(2, 3)" />
            <rect x="35" y="16" width="30" height="64" rx="5" fill="#090d16" stroke="#a3e635" strokeWidth="2.2" />
            <rect x="37" y="13" width="26" height="4.5" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
            {/* Acid foam fizzing at top */}
            <circle cx="45" cy="12" r="3" fill="#bef264" />
            <circle cx="52" cy="10.5" r="2.3" fill="#ecfccb" />
            {/* Giant neon bolt */}
            <polygon points="52,24 42,44 49,44 45,64 58,41 51,41" fill="#a3e635" stroke="#ecfccb" strokeWidth="1" />

            {/* Glowing crimson 220 BPM tachycardia ECG spike across foreground */}
            <path
              d="M 8 74 L 28 74 L 34 62 L 41 86 L 49 52 L 56 84 L 63 68 L 70 74 L 92 74"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );

      // 19: Капельница от похмелья
      case 19:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-iv-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.38" />
                <stop offset="62%" stopColor="#10b981" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-saline`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-iv-glow)`} />

            {/* Chrome hospital IV stand pole & hook */}
            <line x1="22" y1="12" x2="22" y2="88" stroke="#cbd5e1" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 22 14 L 52 14 C 55 14, 55 19, 52 21" fill="none" stroke="#e2e8f0" strokeWidth="2.8" strokeLinecap="round" />

            {/* 3D Translucent IV Bag */}
            <rect x="33" y="21" width="38" height="48" rx="9" fill="#0f172a" fillOpacity="0.65" stroke="#bae6fd" strokeWidth="2.2" />
            {/* Healing cyan-emerald saline fluid inside */}
            <path d="M 35 37 Q 44 34 52 37 T 69 37 L 69 61 C 69 65, 65 67, 61 67 L 43 67 C 39 67, 35 65, 35 61 Z" fill={`url(#${gid}-saline)`} />
            {/* Bubbles & medical red/white cross */}
            <circle cx="43" cy="58" r="2.2" fill="#ecfeff" opacity="0.8" />
            <circle cx="59" cy="54" r="1.7" fill="#ecfeff" opacity="0.8" />
            <circle cx="52" cy="48" r="8.5" fill="#ffffff" />
            <rect x="50" y="42.5" width="4" height="11" rx="1" fill="#ef4444" />
            <rect x="46.5" y="46" width="11" height="4" rx="1" fill="#ef4444" />

            {/* Drip chamber & coiled neon tube */}
            <rect x="48" y="69" width="8" height="11" rx="3" fill="#1e293b" stroke="#bae6fd" strokeWidth="1.5" />
            <circle cx="52" cy="75" r="2" fill="#22d3ee" />
            <path d="M 52 80 C 52 90, 76 89, 78 76 C 80 65, 86 67, 86 82" fill="none" stroke="#67e8f9" strokeWidth="2.4" strokeLinecap="round" />

            {/* +100 HP badge */}
            <rect x="59" y="20" width="31" height="14" rx="4" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
            <text x="74.5" y="29.8" textAnchor="middle" fontFamily={FONT} fontSize="7.4" fontWeight="900" fill="#ecfdf5">
              +100 HP
            </text>
            <Sparkle cx={82} cy={45} r={4.4} fill="#34d399" />
          </g>
        );

      // 20: Казино 777 / Русская рулетка (Highroller Gold Bastion)
      case 20:
        if (russianRoulette) {
          return (
            <g>
              <rect x="6" y="6" width="88" height="88" rx="14" fill="#0d1017" stroke="#f43f5e" strokeOpacity="0.8" strokeWidth="2.2" />
              <circle cx="50" cy="50" r="32" fill="#1e2433" stroke="#e5b869" strokeWidth="3" />
              <circle cx="50" cy="50" r="9.5" fill="#090b10" stroke="#94a3b8" strokeWidth="1.6" />
              {[0, 60, 120, 180, 240, 300].map((deg, idx) => (
                <circle
                  key={deg}
                  cx={50 + 20 * Math.cos((deg * Math.PI) / 180)}
                  cy={50 + 20 * Math.sin((deg * Math.PI) / 180)}
                  r="5.8"
                  fill={idx === 0 ? '#f43f5e' : '#090b10'}
                  stroke="#e5b869"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          );
        }
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-cas-aura`} cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#e5b869" stopOpacity="0.34" />
                <stop offset="65%" stopColor="#e11d48" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-gold777`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#e5b869" />
                <stop offset="100%" stopColor="#9a6b21" />
              </linearGradient>
            </defs>
            {/* Heavy Gold-Rimmed Bastion */}
            <rect x="6" y="6" width="88" height="88" rx="14" fill="#0b0d15" stroke={`url(#${gid}-gold777)`} strokeWidth="2.3" />
            <circle cx="50" cy="48" r="40" fill={`url(#${gid}-cas-aura)`} />
            {/* Golden crown */}
            <polygon
              points="30,25 27,12 39,19 48,9 57,19 69,12 66,25"
              fill={`url(#${gid}-gold777)`}
              stroke="#451a03"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="48" cy="18" r="2.2" fill="#f43f5e" />
            {/* Chrome slot pull-arm with ruby knob on right */}
            <path d="M 81 56 L 87 56 L 87 30" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="87" cy="27" r="5" fill="#e11d48" stroke="#fda4af" strokeWidth="1.3" />
            {/* Dark Onyx VIP 777 slot machine */}
            <rect x="13" y="26" width="69" height="44" rx="9" fill="#171326" stroke={`url(#${gid}-gold777)`} strokeWidth="2.4" />
            {[22, 34.5, 47.5, 60.5, 73].map((x) => (
              <circle key={x} cx={x} cy="31" r="1.5" fill="#fef08a" />
            ))}
            {/* Three luxury dark-ivory 3D reels */}
            <rect x="18.5" y="35" width="16.5" height="26" rx="3" fill="#1f2433" stroke="#e5b869" strokeWidth="1.3" />
            <rect x="39.2" y="35" width="16.5" height="26" rx="3" fill="#1f2433" stroke="#e5b869" strokeWidth="1.3" />
            <rect x="60" y="35" width="16.5" height="26" rx="3" fill="#1f2433" stroke="#e5b869" strokeWidth="1.3" />
            <text x="26.7" y="54" textAnchor="middle" fontFamily={FONT} fontSize="16.5" fontWeight="900" fill="#fef08a">7</text>
            <text x="47.5" y="54" textAnchor="middle" fontFamily={FONT} fontSize="16.5" fontWeight="900" fill="#f43f5e">7</text>
            <text x="68.2" y="54" textAnchor="middle" fontFamily={FONT} fontSize="16.5" fontWeight="900" fill="#fef08a">7</text>
            {/* Highroller casino chips */}
            <circle cx="30" cy="79" r="8.5" fill="#e11d48" stroke="#f8fafc" strokeWidth="2" strokeDasharray="3.2 2.2" />
            <circle cx="48" cy="80" r="8.8" fill="#e5b869" stroke="#090b10" strokeWidth="2" strokeDasharray="3.2 2.2" />
            <circle cx="66" cy="79" r="8.5" fill="#10b981" stroke="#f8fafc" strokeWidth="2" strokeDasharray="3.2 2.2" />
            <Sparkle cx={17} cy={17} r={4.2} fill="#fef08a" />
            <Sparkle cx={81} cy={16} r={4.2} fill="#fef08a" />
          </g>
        );

      // 21: Ночная смена на складе
      case 21:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-wh-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.38" />
                <stop offset="62%" stopColor="#eab308" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-wh-glow)`} />

            {/* 3D Isometric Warehouse Cardboard Box */}
            <polygon points="14,43 44,32 70,43 40,54" fill="#fbbf24" stroke="#451a03" strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="14,43 40,54 40,85 14,74" fill="#d97706" stroke="#451a03" strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="40,54 70,43 70,74 40,85" fill="#92400e" stroke="#451a03" strokeWidth="1.8" strokeLinejoin="round" />
            {/* Barcode label on box */}
            <rect x="45" y="54" width="20" height="13" rx="1.5" fill="#f8fafc" transform="skewY(-20) translate(0, 18)" />
            <g transform="skewY(-20) translate(0, 18)" stroke="#090b10" strokeWidth="1.4">
              <line x1="48" y1="56" x2="48" y2="65" />
              <line x1="51" y1="56" x2="51" y2="65" />
              <line x1="55" y1="56" x2="55" y2="65" />
              <line x1="58" y1="56" x2="58" y2="65" />
              <line x1="62" y1="56" x2="62" y2="65" />
            </g>

            {/* Red Laser Scanner Gun + glowing crimson scan beam */}
            <polygon points="71,27 42,56 67,63" fill="#ef4444" opacity="0.34" />
            <line x1="71" y1="27" x2="45" y2="59" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" />
            <g transform="rotate(-18 76 26)">
              <path d="M 63 16 L 89 16 C 92 16, 92 27, 86 27 L 79 27 L 83 44 L 74 44 L 70 27 L 63 27 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round" />
              <rect x="61" y="18" width="4" height="7" rx="1" fill="#ef4444" />
            </g>

            {/* ШТРАФ 04:00 badge */}
            <rect x="11" y="13" width="46" height="15" rx="4" fill="#450a0a" stroke="#f87171" strokeWidth="1.5" />
            <text x="34" y="23.2" textAnchor="middle" fontFamily={FONT} fontSize="7.4" fontWeight="900" fill="#fecaca">
              ПИК-ПИК 04:15
            </text>
          </g>
        );

      // 23: Темка с дропами
      case 23:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-drop-glow`} cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.38" />
                <stop offset="60%" stopColor="#6366f1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-drop-glow)`} />

            {/* Dark anonymous hood silhouette */}
            <path d="M 22 60 C 22 20, 78 20, 78 60 L 84 86 L 16 86 Z" fill="#0f172a" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 33 52 C 33 28, 67 28, 67 52 C 60 58, 40 58, 33 52 Z" fill="#020617" />
            {/* Glowing sinister eyes under hood */}
            <ellipse cx="43" cy="43" rx="3.2" ry="1.6" fill="#22d3ee" />
            <ellipse cx="57" cy="43" rx="3.2" ry="1.6" fill="#22d3ee" />

            {/* Three fanned burner DROP bank cards */}
            <g transform="rotate(-18 35 70)">
              <rect x="16" y="57" width="38" height="24" rx="3.5" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.4" />
              <rect x="20" y="63" width="7" height="5" rx="1" fill="#fde047" />
            </g>
            <g transform="rotate(16 65 70)">
              <rect x="46" y="57" width="38" height="24" rx="3.5" fill="#059669" stroke="#a7f3d0" strokeWidth="1.4" />
              <rect x="50" y="63" width="7" height="5" rx="1" fill="#fde047" />
            </g>
            <g>
              <rect x="29" y="56" width="42" height="26" rx="4" fill="#18181b" stroke="#f43f5e" strokeWidth="1.8" />
              <rect x="34" y="62" width="8" height="6" rx="1" fill="#eab308" />
              <text x="54" y="77" textAnchor="middle" fontFamily={FONT} fontSize="7.6" fontWeight="900" fill="#fda4af" letterSpacing="0.8">
                УК СТ.187
              </text>
            </g>

            {/* Red police laser target crosshair */}
            <circle cx="67" cy="27" r="7" fill="none" stroke="#ef4444" strokeWidth="1.6" />
            <circle cx="67" cy="27" r="2" fill="#ef4444" />
          </g>
        );

      // 24: Доставка в ливень
      case 24:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-rain-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.34" />
                <stop offset="60%" stopColor="#ef4444" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-bag-red`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-rain-glow)`} />

            {/* Storm cloud & lightning bolt at top */}
            <path d="M 22 25 C 14 25, 13 15, 21 14 C 24 8, 36 8, 40 13 C 47 10, 56 15, 54 23 Z" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <polygon points="38,22 31,34 37,34 33,45 44,31 38,31" fill="#fde047" />

            {/* Heavy diagonal neon rain streaks */}
            <g stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" opacity="0.75">
              <line x1="18" y1="32" x2="12" y2="46" />
              <line x1="66" y1="14" x2="59" y2="30" />
              <line x1="82" y1="20" x2="75" y2="36" />
              <line x1="88" y1="42" x2="81" y2="57" />
              <line x1="21" y1="56" x2="14" y2="71" />
            </g>

            {/* Dark puddle splash at bottom */}
            <ellipse cx="48" cy="84" rx="34" ry="6" fill="#0ea5e9" fillOpacity="0.32" stroke="#38bdf8" strokeWidth="1.3" />

            {/* Tilted 3D Isometric Courier Thermal Cube Bag */}
            <polygon points="24,44 54,35 74,45 44,55" fill="#fca5a5" stroke="#450a0a" strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="24,44 44,55 44,83 24,72" fill="#b91c1c" stroke="#450a0a" strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="44,55 74,45 74,73 44,83" fill={`url(#${gid}-bag-red)`} stroke="#450a0a" strokeWidth="1.8" strokeLinejoin="round" />
            {/* Reflective silver courier stripes */}
            <line x1="46" y1="62" x2="72" y2="53" stroke="#e2e8f0" strokeWidth="3" />

            {/* Angry 1★ customer rating badge */}
            <rect x="57" y="67" width="32" height="16" rx="4.5" fill="#0f172a" stroke="#fde047" strokeWidth="1.6" />
            <text x="73" y="78" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#fde047">
              1 ★ ЧАЙ $0
            </text>
          </g>
        );

      // 25: Маршрутка в ад
      case 25:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-hellbus-glow`} cx="50%" cy="54%" r="52%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.48" />
                <stop offset="58%" stopColor="#f97316" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-hellbus-paint`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="55%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="46" fill={`url(#${gid}-hellbus-glow)`} />

            {/* Roaring 3D hellfire flames licking up behind minibus */}
            <path
              d="M 8 76 C 6 52, 17 44, 18 28 C 24 40, 29 22, 36 14 C 41 29, 52 20, 50 10 C 59 22, 67 16, 71 27 C 79 18, 89 32, 92 76 Z"
              fill="#dc2626"
              opacity="0.72"
            />
            <path
              d="M 14 78 C 14 58, 24 50, 29 36 C 36 48, 46 34, 52 25 C 58 38, 69 34, 76 46 C 83 54, 86 64, 86 78 Z"
              fill="#f97316"
              opacity="0.75"
            />

            {/* Devil horns on roof */}
            <path d="M 27 26 C 21 16, 25 11, 32 18 Z" fill="#ef4444" stroke="#450a0a" strokeWidth="1.4" />
            <path d="M 73 26 C 79 16, 75 11, 68 18 Z" fill="#ef4444" stroke="#450a0a" strokeWidth="1.4" />

            {/* Scorched front-facing Minibus hurtling straight at viewer */}
            <rect x="16" y="24" width="68" height="52" rx="9" fill={`url(#${gid}-hellbus-paint)`} stroke="#090b10" strokeWidth="2.3" />
            {/* Split dark windshield + glowing route 666 В АД */}
            <rect x="21" y="30" width="27" height="20" rx="2.5" fill="#1e1b4b" stroke="#090b10" strokeWidth="1.6" />
            <rect x="52" y="30" width="27" height="20" rx="2.5" fill="#1e1b4b" stroke="#090b10" strokeWidth="1.6" />
            <rect x="47" y="33" width="30" height="12" rx="2" fill="#090b10" stroke="#ef4444" strokeWidth="1.3" />
            <text x="62" y="41.8" textAnchor="middle" fontFamily={FONT} fontSize="7.4" fontWeight="900" fill="#fde047">
              666 В АД
            </text>
            {/* Angry demonic red headlights & jagged grille */}
            <polygon points="20,57 34,60 32,66 19,64" fill="#fef08a" stroke="#dc2626" strokeWidth="1.6" />
            <polygon points="80,57 66,60 68,66 81,64" fill="#fef08a" stroke="#dc2626" strokeWidth="1.6" />
            <rect x="37" y="59" width="26" height="9" rx="2" fill="#090b10" stroke="#78350f" strokeWidth="1.4" />
            <path d="M 39 60 L 43 67 L 47 60 L 51 67 L 55 60 L 59 67 L 61 60" fill="none" stroke="#f97316" strokeWidth="1.3" />
            {/* Heavy tires */}
            <rect x="20" y="75" width="13" height="10" rx="3" fill="#090b10" stroke="#475569" strokeWidth="1.4" />
            <rect x="67" y="75" width="13" height="10" rx="3" fill="#090b10" stroke="#475569" strokeWidth="1.4" />
          </g>
        );

      // 26: Треш-стрим в TikTok
      case 26:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-tt-glow`} cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-ringlight`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-tt-glow)`} />

            {/* Glowing LED Ring-Light Halo & Tripod */}
            <line x1="50" y1="78" x2="50" y2="92" stroke="#64748b" strokeWidth="3.5" />
            <line x1="34" y1="92" x2="66" y2="92" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="46" r="34" fill="none" stroke={`url(#${gid}-ringlight)`} strokeWidth="5.5" />
            <circle cx="50" cy="46" r="34" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.85" />

            {/* Vertical Smartphone inside Ring Light */}
            <rect x="33" y="19" width="34" height="56" rx="6" fill="#090d16" stroke="#94a3b8" strokeWidth="1.8" />
            {/* LIVE red badge */}
            <rect x="37" y="23" width="20" height="9" rx="2.5" fill="#e11d48" />
            <text x="47" y="29.6" textAnchor="middle" fontFamily={FONT} fontSize="5.8" fontWeight="900" fill="#ffffff">
              LIVE
            </text>

            {/* Cracked raw egg yolk dripping down streamer screen! */}
            <path d="M 38 35 C 38 44, 43 46, 43 41 C 43 49, 49 51, 49 43 C 49 38, 56 45, 58 36 Z" fill="#fef9c3" opacity="0.92" />
            <circle cx="48" cy="39" r="5" fill="#f59e0b" stroke="#fde047" strokeWidth="1" />

            {/* Buzzing electric hair clipper on right + DONATE $5 badge */}
            <g transform="rotate(-26 76 58)">
              <rect x="66" y="45" width="14" height="26" rx="4" fill="#334155" stroke="#e2e8f0" strokeWidth="1.6" />
              <rect x="67" y="41" width="12" height="5" rx="1" fill="#cbd5e1" />
              <line x1="69" y1="41" x2="69" y2="45" stroke="#090b10" strokeWidth="1" />
              <line x1="73" y1="41" x2="73" y2="45" stroke="#090b10" strokeWidth="1" />
              <line x1="77" y1="41" x2="77" y2="45" stroke="#090b10" strokeWidth="1" />
            </g>

            {/* Floating gift heart/rose bubble */}
            <circle cx="23" cy="62" r="9.5" fill="#be185d" stroke="#fbcfe8" strokeWidth="1.5" />
            <text x="23" y="65.5" textAnchor="middle" fontFamily={FONT} fontSize="8.5" fontWeight="900" fill="#ffffff">
              +$5
            </text>
          </g>
        );

      // 27: Потная катка в Доту
      case 27:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-dota-glow`} cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.44" />
                <stop offset="62%" stopColor="#eab308" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-dota-glow)`} />

            {/* Curved Gaming Monitor with molten crimson border */}
            <rect x="10" y="14" width="68" height="48" rx="6" fill="#090b10" stroke="#ef4444" strokeWidth="2.4" />
            <rect x="14" y="18" width="60" height="40" rx="3" fill="#14080c" />
            <rect x="38" y="62" width="12" height="12" fill="#334155" />
            <rect x="25" y="74" width="38" height="6" rx="2.5" fill="#475569" />

            {/* Stylized Ancient / River diagonal battle map inside screen */}
            <rect x="20" y="22" width="24" height="24" rx="3" fill="#290d0d" stroke="#f97316" strokeWidth="1.5" />
            <line x1="23" y1="25" x2="41" y2="43" stroke="#ef4444" strokeWidth="3.2" strokeLinecap="round" />
            <polygon points="24,38 29,38 24,33" fill="#f97316" />
            <polygon points="40,26 35,26 40,31" fill="#f97316" />

            {/* -30 MMR defeat badge + screen crack */}
            <rect x="46" y="25" width="25" height="15" rx="3" fill="#dc2626" stroke="#fde047" strokeWidth="1.2" />
            <text x="58.5" y="35.2" textAnchor="middle" fontFamily={FONT} fontSize="8" fontWeight="900" fill="#ffffff">
              -30 MMR
            </text>
            <path d="M 48 44 L 56 50 L 52 56 M 56 50 L 66 48" fill="none" stroke="#f8fafc" strokeWidth="1.6" strokeLinecap="round" />

            {/* Flying blue sweat drops + smashed RGB mouse on right */}
            <path d="M 83 22 C 87 28, 87 33, 83 33 C 79 33, 79 28, 83 22 Z" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1" />
            <path d="M 88 37 C 91 42, 91 46, 88 46 C 85 46, 85 42, 88 37 Z" fill="#38bdf8" />
            <g transform="rotate(16 79 71)">
              <rect x="69" y="57" width="19" height="28" rx="9.5" fill="#1e293b" stroke="#a3e635" strokeWidth="1.8" />
              <line x1="78.5" y1="57" x2="78.5" y2="68" stroke="#a3e635" strokeWidth="1.5" />
            </g>
          </g>
        );

      // 28: Блок от Финмониторинга
      case 28:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-finmon-glow`} cx="50%" cy="50%" r="52%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.42" />
                <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-ice-block`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.58" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-finmon-glow)`} />

            {/* Bank card frozen inside 3D cyan ice block */}
            <g transform="rotate(-8 50 48)">
              <rect x="14" y="27" width="72" height="44" rx="7" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
              <rect x="21" y="37" width="11" height="8" rx="1.5" fill="#eab308" />
              <rect x="21" y="53" width="38" height="4" rx="2" fill="#475569" />
              {/* Translucent faceted ice cube encasing the card */}
              <polygon
                points="10,23 86,20 90,71 14,75"
                fill={`url(#${gid}-ice-block)`}
                stroke="#a5f3fc"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Ice frost shards */}
              <line x1="18" y1="29" x2="34" y2="26" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            </g>

            {/* Criss-cross heavy brushed-steel chains */}
            <line x1="12" y1="24" x2="88" y2="74" stroke="#090b10" strokeWidth="7" strokeLinecap="round" opacity="0.65" />
            <line x1="12" y1="24" x2="88" y2="74" stroke="#cbd5e1" strokeWidth="4.4" strokeDasharray="7 4" strokeLinecap="round" />
            <line x1="88" y1="24" x2="12" y2="74" stroke="#090b10" strokeWidth="7" strokeLinecap="round" opacity="0.65" />
            <line x1="88" y1="24" x2="12" y2="74" stroke="#94a3b8" strokeWidth="4.4" strokeDasharray="7 4" strokeLinecap="round" />

            {/* Heavy glowing padlock stamped 115-ФЗ in center */}
            <path d="M 41 44 L 41 34 A 9 9 0 0 1 59 34 L 59 44" fill="none" stroke="#e2e8f0" strokeWidth="4.2" />
            <rect x="34" y="43" width="32" height="27" rx="5" fill="#dc2626" stroke="#fde047" strokeWidth="2" />
            <text x="50" y="59.5" textAnchor="middle" fontFamily={FONT} fontSize="7.8" fontWeight="900" fill="#ffffff">
              115-ФЗ
            </text>
          </g>
        );

      // 29: Брейнрот-лента 24/7
      case 29:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-rot-glow`} cx="50%" cy="50%" r="52%">
                <stop offset="0%" stopColor="#eab308" stopOpacity="0.38" />
                <stop offset="55%" stopColor="#ec4899" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-brain-pink`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9a8d4" />
                <stop offset="55%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#9d174d" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-rot-glow)`} />

            {/* Split-screen Brainrot Smartphone */}
            <rect x="24" y="11" width="52" height="78" rx="8" fill="#090d16" stroke="#fde047" strokeWidth="2.1" />
            {/* Top half: endless runner rails */}
            <rect x="28" y="16" width="44" height="33" rx="4" fill="#1e1b4b" />
            <line x1="36" y1="48" x2="44" y2="20" stroke="#38bdf8" strokeWidth="2" />
            <line x1="64" y1="48" x2="56" y2="20" stroke="#38bdf8" strokeWidth="2" />
            {/* Bottom half: neon green ASMR slime */}
            <rect x="28" y="51" width="44" height="33" rx="4" fill="#14532d" />
            <path d="M 28 58 Q 39 65 50 57 T 72 60 L 72 84 L 28 84 Z" fill="#4ade80" opacity="0.7" />

            {/* Glossy 3D Pink Brain literally melting down out of the screen! */}
            <path
              d="M 28 43 C 23 31, 35 23, 45 27 C 50 21, 65 22, 69 32 C 77 35, 76 48, 68 51 L 68 62 C 68 66, 63 66, 63 59 C 63 53, 56 56, 56 67 C 56 72, 50 72, 50 63 C 50 56, 42 57, 42 65 C 42 70, 36 69, 36 59 L 33 51 C 26 50, 25 46, 28 43 Z"
              fill={`url(#${gid}-brain-pink)`}
              stroke="#500724"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Brain sulcus folds */}
            <path d="M 38 34 Q 46 39 50 31 M 53 38 Q 61 34 64 42 M 36 44 Q 45 48 52 43" fill="none" stroke="#831843" strokeWidth="1.8" strokeLinecap="round" />

            {/* Hypnotic spiral eyes on melting brain */}
            <circle cx="42" cy="45" r="5.2" fill="#ffffff" stroke="#090b10" strokeWidth="1.2" />
            <circle cx="42" cy="45" r="2.2" fill="#eab308" />
            <circle cx="58" cy="45" r="5.2" fill="#ffffff" stroke="#090b10" strokeWidth="1.2" />
            <circle cx="58" cy="45" r="2.2" fill="#22d3ee" />
          </g>
        );

      // 30: Попался к ТЦК! (Custom Dark Luxury Bastion Icon)
      case 30:
        return (
          <g>
            <defs>
              <clipPath id={`${gid}-tck-clip`}>
                <rect x="2" y="2" width="96" height="96" rx="14" />
              </clipPath>
            </defs>
            <rect x="2" y="2" width="96" height="96" rx="14" fill="#0b0e16" />
            <image
              href="/art/corner_tck.png"
              x="-4"
              y="-4"
              width="108"
              height="108"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${gid}-tck-clip)`}
            />
          </g>
        );

      // 31: Клоповник у метро
      case 31:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-klop-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.34" />
                <stop offset="62%" stopColor="#991b1b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-klop-glow)`} />

            {/* Grimy apartment wall with peeling green wallpaper & exposed brick */}
            <rect x="11" y="12" width="78" height="74" rx="7" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {/* Exposed brick patch top-left */}
            <rect x="16" y="17" width="22" height="14" rx="1.5" fill="#7c2d12" />
            <line x1="16" y1="24" x2="38" y2="24" stroke="#451a03" strokeWidth="1.4" />
            <line x1="27" y1="17" x2="27" y2="24" stroke="#451a03" strokeWidth="1.4" />

            {/* Glowing green Metro 'M' sign outside window top-right */}
            <rect x="57" y="16" width="26" height="20" rx="3" fill="#090d16" stroke="#34d399" strokeWidth="1.6" />
            <path d="M 62 32 L 66 20 L 70 28 L 74 20 L 78 32" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* Iconic crimson-gold Soviet wall rug */}
            <rect x="16" y="42" width="68" height="38" rx="2.5" fill="#7f1d1d" stroke="#facc15" strokeWidth="1.8" />
            <rect x="20" y="46" width="60" height="30" fill="none" stroke="#fde047" strokeWidth="1" strokeDasharray="3 2" />
            <polygon points="50,49 61,61 50,73 39,61" fill="#991b1b" stroke="#fde047" strokeWidth="1.5" />

            {/* Giant plump 3D Bedbug wearing a tiny gold crown! */}
            <g transform="rotate(-18 48 61)">
              {/* Legs */}
              <path d="M 38 56 L 32 52 M 37 61 L 30 61 M 38 66 L 32 70 M 58 56 L 64 52 M 59 61 L 66 61 M 58 66 L 64 70" stroke="#291205" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="48" cy="62" rx="10.5" ry="12.5" fill="#451a03" stroke="#fde047" strokeWidth="1.2" />
              <line x1="40" y1="60" x2="56" y2="60" stroke="#78350f" strokeWidth="1.3" />
              <line x1="41" y1="65" x2="55" y2="65" stroke="#78350f" strokeWidth="1.3" />
              <circle cx="48" cy="49" r="5" fill="#291205" />
              {/* Tiny king crown on bedbug */}
              <polygon points="44,46 43,41 48,44 53,41 52,46" fill="#fde047" />
            </g>
          </g>
        );

      // 32: Студия 11 квадратов
      case 32:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-studio-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.36" />
                <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill={`url(#${gid}-studio-glow)`} />

            {/* Isometric cramped 11 m² micro-cube cutaway room */}
            <polygon points="50,15 86,32 86,74 50,90 14,74 14,32" fill="#0f172a" stroke="#34d399" strokeWidth="2.1" strokeLinejoin="round" />
            <line x1="50" y1="15" x2="50" y2="56" stroke="#334155" strokeWidth="1.6" />
            <polygon points="50,56 86,74 50,90 14,74" fill="#1e293b" stroke="#475569" strokeWidth="1.4" />

            {/* White porcelain Toilet on left side of tiny cube */}
            <rect x="23" y="40" width="11" height="15" rx="2" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
            <ellipse cx="33" cy="58" rx="9" ry="5.5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
            <path d="M 26 58 L 40 58 L 37 69 L 28 69 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />

            {/* Kitchen stove + sizzling frying pan RIGHT NEXT TO TOILET! */}
            <rect x="49" y="46" width="26" height="23" rx="2.5" fill="#334155" stroke="#94a3b8" strokeWidth="1.6" />
            <rect x="53" y="54" width="18" height="11" rx="1.5" fill="#090b10" />
            {/* Frying pan with fried egg on top of stove */}
            <ellipse cx="61" cy="45" rx="9.5" ry="4.2" fill="#090b10" stroke="#cbd5e1" strokeWidth="1.3" />
            <line x1="69" y1="44" x2="79" y2="40" stroke="#94a3b8" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="61" cy="45" rx="5" ry="2.2" fill="#ffffff" />
            <circle cx="61" cy="44.8" r="2" fill="#f59e0b" />

            {/* Blueprint 11 М² pill at top */}
            <rect x="29" y="10" width="42" height="15" rx="4" fill="#065f46" stroke="#6ee7b7" strokeWidth="1.6" />
            <text x="50" y="20.4" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#ecfdf5">
              11 М² ЛЮКС
            </text>
          </g>
        );

      // 34: Заброшка на окраине
      case 34:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-ruin-glow`} cx="50%" cy="44%" r="52%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.34" />
                <stop offset="60%" stopColor="#64748b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-ruin-glow)`} />

            {/* Eerie pale crescent moon */}
            <circle cx="75" cy="21" r="8.5" fill="#fef9c3" opacity="0.88" />
            <circle cx="78.5" cy="19" r="7.5" fill="#0d131f" />

            {/* Exposed rusted rebar rods sticking out of unfinished roof */}
            <g stroke="#92400e" strokeWidth="2" strokeLinecap="round">
              <line x1="24" y1="28" x2="22" y2="14" />
              <line x1="34" y1="25" x2="36" y2="12" />
              <line x1="48" y1="26" x2="48" y2="14" />
              <line x1="59" y1="30" x2="63" y2="18" />
            </g>

            {/* Jagged brutalist concrete skeleton building */}
            <polygon
              points="14,86 14,27 38,24 44,30 64,29 72,39 84,41 84,86"
              fill="#334155"
              stroke="#090b10"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            {/* Hollow broken window voids */}
            <rect x="21" y="35" width="13" height="14" rx="1" fill="#090b10" />
            <rect x="41" y="36" width="13" height="14" rx="1" fill="#090b10" />
            <rect x="21" y="56" width="13" height="14" rx="1" fill="#090b10" />
            {/* Structural cracks */}
            <path d="M 60 32 L 56 44 L 62 51" fill="none" stroke="#090b10" strokeWidth="1.8" strokeLinecap="round" />

            {/* Neon toxic-green spray-paint graffiti "ЛОФТ" across concrete wall */}
            <g transform="rotate(-8 60 68)">
              <rect x="38" y="58" width="46" height="19" rx="4" fill="#064e3b" stroke="#4ade80" strokeWidth="1.8" />
              <text x="61" y="71" textAnchor="middle" fontFamily={FONT} fontSize="10.2" fontWeight="900" fill="#4ade80" letterSpacing="1">
                ЛОФТ
              </text>
            </g>
          </g>
        );

      // 35: Тонированный бусик
      case 35:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-van-glow`} cx="50%" cy="54%" r="52%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.36" />
                <stop offset="58%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-van-black`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="42%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52" r="46" fill={`url(#${gid}-van-glow)`} />

            {/* Menacing 3D Pitch-Black Cargo Van */}
            <path
              d="M 9 69 L 11 31 C 11 26, 15 24, 21 24 L 65 24 L 79 44 L 91 49 L 91 69 Z"
              fill="#020617"
              opacity="0.7"
              transform="translate(2, 3.5)"
            />
            <path
              d="M 9 69 L 11 31 C 11 26, 15 24, 21 24 L 65 24 L 79 44 L 91 49 L 91 69 Z"
              fill={`url(#${gid}-van-black)`}
              stroke="#64748b"
              strokeWidth="2.1"
              strokeLinejoin="round"
            />

            {/* 100% Bunker-Tinted Glossy Pitch-Black Windows with diagonal white reflection */}
            <rect x="16" y="29" width="24" height="15" rx="2" fill="#02040a" stroke="#475569" strokeWidth="1.2" />
            <line x1="21" y1="42" x2="30" y2="31" stroke="#ffffff" strokeWidth="1.6" opacity="0.35" />
            <polygon points="62,29 66,29 76,44 62,44" fill="#02040a" stroke="#475569" strokeWidth="1.2" />

            {/* Slightly ajar sliding side door spilling sinister crimson light! */}
            <rect x="43" y="28" width="15" height="36" rx="1.5" fill="#05070e" stroke="#f43f5e" strokeWidth="1.5" />
            <rect x="43" y="29" width="4" height="34" fill="#ef4444" opacity="0.85" />

            {/* Blinding ice-blue Xenon headlight beam */}
            <polygon points="88,52 98,46 98,62" fill="#38bdf8" opacity="0.45" />
            <rect x="85" y="51" width="6" height="5" rx="1.2" fill="#ecfeff" stroke="#38bdf8" strokeWidth="1.2" />

            {/* Matte black rims */}
            <circle cx="25" cy="71" r="9" fill="#090b10" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="25" cy="71" r="3.6" fill="#475569" />
            <circle cx="75" cy="71" r="9" fill="#090b10" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="75" cy="71" r="3.6" fill="#475569" />
          </g>
        );

      // 37: Айфон в микрозайм
      case 37:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-mfo-phone-glow`} cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.42" />
                <stop offset="60%" stopColor="#ef4444" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-ti`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e7e5e4" />
                <stop offset="50%" stopColor="#a8a29e" />
                <stop offset="100%" stopColor="#57534e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-mfo-phone-glow)`} />

            {/* 3D Titanium Flagship Phone */}
            <g transform="rotate(-7 38 48)">
              <rect x="16" y="10" width="44" height="75" rx="8.5" fill={`url(#${gid}-ti)`} stroke="#1c1917" strokeWidth="2.3" />
              {/* Triple Pro camera plateau */}
              <rect x="20" y="14" width="22" height="22" rx="5" fill="#78716c" stroke="#292524" strokeWidth="1.4" />
              <circle cx="26" cy="20" r="3.8" fill="#090b10" stroke="#e2e8f0" strokeWidth="1.1" />
              <circle cx="26" cy="30" r="3.8" fill="#090b10" stroke="#e2e8f0" strokeWidth="1.1" />
              <circle cx="35" cy="25" r="3.8" fill="#090b10" stroke="#e2e8f0" strokeWidth="1.1" />
            </g>

            {/* Steel chain shackling the phone to a heavy cast-iron 365% ball! */}
            <path d="M 14 54 L 62 50" stroke="#090b10" strokeWidth="6" strokeLinecap="round" />
            <path d="M 14 54 L 62 50" stroke="#cbd5e1" strokeWidth="3.8" strokeDasharray="6 4" strokeLinecap="round" />
            <path d="M 55 52 Q 66 56 71 64" fill="none" stroke="#cbd5e1" strokeWidth="3.6" strokeDasharray="5 3" strokeLinecap="round" />

            {/* Heavy 3D Prisoner Iron Ball stamped 365% */}
            <circle cx="72" cy="72" r="18" fill="#020617" opacity="0.65" transform="translate(2, 2.5)" />
            <circle cx="72" cy="72" r="18" fill="#1e293b" stroke="#f43f5e" strokeWidth="2.2" />
            <circle cx="66" cy="66" r="4" fill="#64748b" opacity="0.5" />
            <text x="72" y="75.5" textAnchor="middle" fontFamily={FONT} fontSize="8.8" fontWeight="900" fill="#fda4af">
              365%
            </text>
          </g>
        );

      // 38: Коллекторы из МФО (Tax -$1000)
      case 38:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-col-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.44" />
                <stop offset="65%" stopColor="#eab308" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-col-glow)`} />

            {/* Heavy iron apartment door plate with keyhole */}
            <rect x="14" y="11" width="58" height="76" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="2.2" />
            <circle cx="34" cy="43" r="5" fill="#090b10" />
            <polygon points="31,45 37,45 38,56 30,56" fill="#090b10" />

            {/* Expanding yellow mounting foam sprayed into the keyhole! */}
            <circle cx="34" cy="48" r="7.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1.4" />
            <circle cx="40" cy="44" r="5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.2" />
            <circle cx="28" cy="52" r="4.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />

            {/* Red-painted steel Crowbar (фомка) prying the door */}
            <path
              d="M 79 14 L 62 64 C 59 73, 47 72, 49 63"
              fill="none"
              stroke="#dc2626"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <path d="M 79 14 L 86 11" stroke="#cbd5e1" strokeWidth="6.5" strokeLinecap="round" />

            {/* Crimson -$1 000 collector demand plaque */}
            <rect x="18" y="69" width="66" height="17" rx="4.5" fill="#dc2626" stroke="#fde047" strokeWidth="1.7" />
            <text x="51" y="80.5" textAnchor="middle" fontFamily={FONT} fontSize="10" fontWeight="900" fill="#ffffff">
              -$1 000
            </text>
          </g>
        );

      // 39: Додеп последней хаты
      case 39:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-allin-glow`} cx="50%" cy="50%" r="52%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.44" />
                <stop offset="55%" stopColor="#eab308" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#090b10" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${gid}-gold-slot`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill={`url(#${gid}-allin-glow)`} />

            {/* Glowing Casino Bill Acceptor Slot at bottom */}
            <rect x="12" y="54" width="76" height="34" rx="7" fill="#0f172a" stroke={`url(#${gid}-gold-slot)`} strokeWidth="2.3" />
            <rect x="20" y="60" width="60" height="7" rx="3" fill="#020617" stroke="#22c55e" strokeWidth="1.6" />
            <text x="50" y="81" textAnchor="middle" fontFamily={FONT} fontSize="9.2" fontWeight="900" fill="#fde047" letterSpacing="0.8">
              ALL-IN 777
            </text>

            {/* Apartment Ownership Deed (ОРДЕР / ХАТА) sliding straight into the slot! */}
            <g transform="rotate(-5 46 38)">
              <rect x="23" y="13" width="46" height="49" rx="3" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
              {/* Mini house icon on deed */}
              <polygon points="46,20 34,30 58,30" fill="#2563eb" />
              <rect x="38" y="30" width="16" height="12" fill="#1d4ed8" />
              <rect x="44" y="34" width="4" height="8" fill="#fde047" />
              <text x="46" y="51" textAnchor="middle" fontFamily={FONT} fontSize="7.4" fontWeight="900" fill="#1e3a8a">
                ДОКУМЕНТЫ
              </text>
              <text x="46" y="58.5" textAnchor="middle" fontFamily={FONT} fontSize="6.8" fontWeight="900" fill="#dc2626">
                НА ХАТУ
              </text>
            </g>

            {/* Golden Brass House Key dangling on keyring */}
            <g transform="rotate(24 77 35)">
              <circle cx="76" cy="21" r="7" fill="none" stroke="#fde047" strokeWidth="3" />
              <line x1="76" y1="28" x2="76" y2="48" stroke="#fde047" strokeWidth="3.2" strokeLinecap="round" />
              <line x1="76" y1="42" x2="82" y2="42" stroke="#fde047" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="76" y1="47" x2="83" y2="47" stroke="#fde047" strokeWidth="2.8" strokeLinecap="round" />
            </g>
            <Sparkle cx={18} cy="24" r={4.5} fill="#fde047" />
          </g>
        );

      default:
        return <circle cx="50" cy="50" r="24" fill="#94a3b8" />;
    }
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full select-none pointer-events-none ${className}`.trim()}
      aria-hidden="true"
    >
      {renderArtwork()}
    </svg>
  );
};

export default CellArtwork;
