import React from 'react';

export interface CellArtworkProps {
  cellId: number;
  side: 'top' | 'right' | 'bottom' | 'left' | 'corner';
  censored?: boolean;
  russianRoulette?: boolean;
  className?: string;
}

const Sparkle: React.FC<{ cx: number; cy: number; r?: number; fill?: string }> = ({
  cx,
  cy,
  r = 5,
  fill = '#fde047',
}) => (
  <path
    d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
    fill={fill}
  />
);

const ChanceMark: React.FC<{ side?: CellArtworkProps['side'] }> = () => {
  return (
    <g transform="translate(15, 13) scale(0.70)">
      {/* Soft drop depth */}
      <g transform="translate(0, 3)" opacity="0.22">
        <path
          d="M 34 34 C 34 21, 67 20, 67 36 C 67 46, 50 48, 50 59"
          fill="none"
          stroke="#365314"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <circle cx="50" cy="78" r="8.5" fill="#365314" />
      </g>
      {/* Main lime question mark */}
      <path
        d="M 34 34 C 34 21, 67 20, 67 36 C 67 46, 50 48, 50 59"
        fill="none"
        stroke="#8fce00"
        strokeWidth="15"
        strokeLinecap="round"
      />
      {/* Specular highlight */}
      <path
        d="M 37 31 C 39 23, 60 22, 63 32"
        fill="none"
        stroke="#bef264"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Dot */}
      <circle cx="50" cy="78" r="8.5" fill="#8fce00" />
      <circle cx="47.5" cy="75.5" r="2.8" fill="#d9f99d" />
    </g>
  );
};

export const CellArtwork: React.FC<CellArtworkProps> = ({
  cellId,
  side,
  censored = false,
  russianRoulette = false,
  className = '',
}) => {
  const gid = `ca-${cellId}`;

  const renderArtwork = (): React.ReactNode => {
    switch (cellId) {
      // 0: START - Зарплата (Vibrant diagonal rocket launching from pink ringed planet + $ bills)
      case 0:
        return (
          <g>
            <defs>
              <linearGradient id={`${gid}-planet`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#db2777" />
              </linearGradient>
              <linearGradient id={`${gid}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            {/* Background stars */}
            <Sparkle cx={18} cy={22} r={5} fill="#fbbf24" />
            <Sparkle cx={82} cy={16} r={4} fill="#38bdf8" />
            <Sparkle cx={85} cy={76} r={4.5} fill="#fbbf24" />
            <circle cx={46} cy={14} r={2.2} fill="#f472b6" />

            {/* Pink ringed planet in bottom-left */}
            <g transform="translate(27, 74) rotate(-22)">
              <ellipse cx="0" cy="0" rx="23" ry="7" fill="none" stroke="#fbcfe8" strokeWidth="4" opacity="0.65" />
              <circle cx="0" cy="0" r="14" fill={`url(#${gid}-planet)`} />
              <circle cx="-4" cy="-4" r="3" fill="#fbcfe8" opacity="0.5" />
              <path
                d="M -23 0 A 23 7 0 0 0 23 0"
                fill="none"
                stroke="#f9a8d4"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
            </g>

            {/* Flying dollar bills */}
            <g transform="translate(19, 44) rotate(-28)">
              <rect x="-10" y="-6" width="20" height="12" rx="2" fill="#22c55e" stroke="#15803d" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="3.2" fill="#bbf7d0" />
              <text x="0" y="2.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#14532d">$</text>
            </g>
            <g transform="translate(76, 52) rotate(24)">
              <rect x="-10" y="-6" width="20" height="12" rx="2" fill="#4ade80" stroke="#15803d" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="3.2" fill="#dcfce7" />
              <text x="0" y="2.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#14532d">$</text>
            </g>

            {/* Diagonal launching rocket */}
            <g transform="translate(56, 44) rotate(42)">
              {/* Exhaust flame */}
              <path d="M -8 24 Q 0 45 8 24 Z" fill="#f97316" />
              <path d="M -4.5 24 Q 0 37 4.5 24 Z" fill="#fde047" />
              {/* Side fins */}
              <path d="M -11 10 L -21 24 L -9 22 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.2" />
              <path d="M 11 10 L 21 24 L 9 22 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.2" />
              {/* Fuselage */}
              <path
                d="M 0 -28 C 12 -14, 13 8, 10 23 L -10 23 C -13 8, -12 -14, 0 -28 Z"
                fill={`url(#${gid}-body)`}
                stroke="#334155"
                strokeWidth="2"
              />
              {/* Red nose cone */}
              <path d="M 0 -28 C 6 -21, 9 -14, 10 -9 L -10 -9 C -9 -14, -6 -21, 0 -28 Z" fill="#ef4444" />
              {/* Porthole window */}
              <circle cx="0" cy="3" r="6.5" fill="#0ea5e9" stroke="#334155" strokeWidth="2" />
              <circle cx="-2" cy="1" r="2" fill="#e0f2fe" />
              {/* Nozzle */}
              <rect x="-7" y="22" width="14" height="4" rx="1.5" fill="#475569" />
            </g>
          </g>
        );

      // 1: Шаурма у Ашота (Golden-wrapped shawarma roll + crown + ASHOT mark)
      case 1:
        return (
          <g>
            {/* Golden crown above */}
            <path
              d="M 35 21 L 39 11 L 50 18 L 61 11 L 65 21 Z"
              fill="#fbbf24"
              stroke="#b45309"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Tilted Shawarma Roll */}
            <g transform="translate(50, 52) rotate(-18)">
              {/* Filling peeking out top */}
              <circle cx="-6" cy="-26" r="6" fill="#22c55e" />
              <circle cx="5" cy="-27" r="5.5" fill="#ef4444" />
              <circle cx="0" cy="-23" r="6" fill="#d97706" />
              <path d="M -5 -25 Q 0 -31 6 -24" fill="none" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" />
              {/* Grilled upper lavash */}
              <rect x="-14" y="-23" width="28" height="26" rx="8" fill="#fcd34d" stroke="#b45309" strokeWidth="2.2" />
              {/* Grill marks */}
              <line x1="-9" y1="-15" x2="8" y2="-18" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="-9" y1="-8" x2="8" y2="-11" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" />
              {/* Red-white striped paper wrapper bottom */}
              <path
                d="M -15 -2 L 15 -2 L 12 24 C 12 28, -12 28, -12 24 Z"
                fill="#ef4444"
                stroke="#991b1b"
                strokeWidth="2"
              />
              <path d="M -14 5 L 14 5 L 13 11 L -13 11 Z" fill="#ffffff" />
              <path d="M -13 17 L 13 17 L 12.5 22 L -12.5 22 Z" fill="#ffffff" />
            </g>
            {/* Bold ASHOT ribbon pill */}
            <rect x="16" y="74" width="68" height="17" rx="5" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
            <text x="50" y="86" textAnchor="middle" fontSize="11" fontWeight="900" letterSpacing="1" fill="#fde047">
              ASHOT
            </text>
          </g>
        );

      // 2, 17, 22, 33, 36: CHANCE - Мемный Шанс
      case 2:
      case 17:
      case 22:
      case 33:
      case 36:
        return <ChanceMark side={side} />;

      // 3: Чебуречная «Привет, гастрит» (Crispy golden half-moon cheburek + steam waves)
      case 3:
        return (
          <g>
            {/* Hot wavy steam lines */}
            <path
              d="M 33 27 Q 29 20 33 14 Q 37 8 33 4"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M 50 23 Q 46 16 50 10 Q 54 4 50 0"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
              strokeLinecap="round"
              transform="translate(0, 3)"
            />
            <path
              d="M 67 27 Q 63 20 67 14 Q 71 8 67 4"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Crispy golden half-moon cheburek */}
            <g transform="translate(50, 58) rotate(-12)">
              {/* Crimped crust edge */}
              <path
                d="M -38 12 C -38 -28, 38 -28, 38 12 C 20 20, -20 20, -38 12 Z"
                fill="#f59e0b"
                stroke="#92400e"
                strokeWidth="2.5"
              />
              {/* Crimped fork teeth along arch */}
              <path
                d="M -33 8 C -31 -21, 31 -21, 33 8"
                fill="none"
                stroke="#fef3c7"
                strokeWidth="3"
                strokeDasharray="3 4"
                strokeLinecap="round"
              />
              {/* Puffy fried center belly */}
              <path
                d="M -28 10 C -26 -14, 26 -14, 28 10 C 14 16, -14 16, -28 10 Z"
                fill="#fbbf24"
              />
              {/* Crispy oil bubbles & gloss */}
              <circle cx="-11" cy="-1" r="4" fill="#fde68a" />
              <circle cx="8" cy="-3" r="5" fill="#fde68a" />
              <circle cx="0" cy="6" r="3" fill="#d97706" opacity="0.55" />
              <circle cx="-16" cy="6" r="2.5" fill="#d97706" opacity="0.55" />
              <circle cx="17" cy="5" r="2.8" fill="#fde68a" />
            </g>
          </g>
        );

      // 4: TAX - Инвестировал в говно (Crisp green stack of $ bills + brown plunge badge)
      case 4:
        return (
          <g>
            {/* Layered crisp green dollar stack */}
            <g transform="translate(46, 50) rotate(-10)">
              <rect x="-32" y="-12" width="60" height="34" rx="4" fill="#15803d" />
              <rect x="-32" y="-16" width="60" height="34" rx="4" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
              <rect x="-32" y="-20" width="60" height="34" rx="4" fill="#7ed321" stroke="#1e4620" strokeWidth="2.2" />
              {/* Inner bill border */}
              <rect x="-26" y="-15" width="48" height="24" rx="2" fill="none" stroke="#1e4620" strokeWidth="1.6" strokeDasharray="4 2" />
              {/* Paper strap */}
              <rect x="-10" y="-21" width="16" height="36" fill="#fef08a" stroke="#854d0e" strokeWidth="1.8" />
              <text x="-2" y="2" textAnchor="middle" fontSize="15" fontWeight="900" fill="#1e4620">$</text>
            </g>
            {/* Funny plunge / poop badge in bottom-right */}
            <g transform="translate(70, 68)">
              <circle cx="0" cy="0" r="17" fill="#fee2e2" stroke="#dc2626" strokeWidth="2.5" />
              {censored ? (
                <path
                  d="M -9 -6 L -2 1 L 2 -3 L 9 6 M 9 6 L 3 6 M 9 6 L 9 0"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <g transform="translate(0, 1)">
                  <ellipse cx="0" cy="7" rx="10" ry="4.5" fill="#78350f" />
                  <ellipse cx="0" cy="2" rx="7.5" ry="4" fill="#92400e" />
                  <path d="M -4 -1 Q 0 -10 3 -5 Q 5 -1 4 1 Z" fill="#b45309" />
                  <circle cx="-3" cy="2" r="1.3" fill="#ffffff" />
                  <circle cx="3" cy="2" r="1.3" fill="#ffffff" />
                </g>
              )}
            </g>
          </g>
        );

      // 5: Гнилая Жига (Classic boxy cherry-red Lada drifting + winged shield)
      case 5:
        return (
          <g>
            {/* Retro silver winged emblem top */}
            <path
              d="M 20 22 L 38 26 L 50 18 L 62 26 L 80 22 L 72 31 L 50 28 L 28 31 Z"
              fill="#cbd5e1"
              stroke="#475569"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Drift tire smoke cloud */}
            <circle cx="18" cy="72" r="8" fill="#cbd5e1" opacity="0.8" />
            <circle cx="27" cy="75" r="6" fill="#e2e8f0" opacity="0.85" />
            {/* Boxy Lada 2105 silhouette */}
            <g transform="translate(52, 57) rotate(-4)">
              {/* Roof luggage rack */}
              <line x1="-18" y1="-21" x2="12" y2="-21" stroke="#334155" strokeWidth="2" />
              <line x1="-14" y1="-21" x2="-14" y2="-17" stroke="#334155" strokeWidth="2" />
              <line x1="8" y1="-21" x2="8" y2="-17" stroke="#334155" strokeWidth="2" />
              {/* Cabin */}
              <path
                d="M -22 -4 L -16 -17 L 14 -17 L 22 -4 Z"
                fill="#dc2626"
                stroke="#7f1d1d"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Windows */}
              <polygon points="-18,-5 -14,-14 -2,-14 -2,-5" fill="#bae6fd" stroke="#1e293b" strokeWidth="1.4" />
              <polygon points="1,-5 1,-14 12,-14 18,-5" fill="#bae6fd" stroke="#1e293b" strokeWidth="1.4" />
              {/* Boxy lower body */}
              <path
                d="M -36 -4 L 36 -4 L 37 11 L -37 11 Z"
                fill="#ef4444"
                stroke="#7f1d1d"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Funny rust patches */}
              <ellipse cx="-8" cy="7" rx="6" ry="2.8" fill="#92400e" />
              <circle cx="15" cy="6" r="2.5" fill="#78350f" />
              {/* Square yellow headlight & chrome bumper */}
              <rect x="32" y="-1" width="5" height="6" rx="1" fill="#fde047" stroke="#854d0e" strokeWidth="1.2" />
              <rect x="-39" y="8" width="7" height="3.5" rx="1" fill="#94a3b8" />
              <rect x="33" y="8" width="7" height="3.5" rx="1" fill="#94a3b8" />
              {/* Wheels */}
              <circle cx="-22" cy="12" r="8" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
              <circle cx="-22" cy="12" r="3.5" fill="#cbd5e1" />
              <circle cx="22" cy="12" r="8" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
              <circle cx="22" cy="12" r="3.5" fill="#cbd5e1" />
            </g>
          </g>
        );

      // 6: Паль с Садовода (Iconic black 3-stripes slanted mountain ABIBAS parody logo)
      case 6:
        return (
          <g>
            {/* Three slanted mountain bars */}
            <g fill="#0f172a">
              <polygon points="22,60 32,60 41,44 31,44" />
              <polygon points="38,60 48,60 61,32 51,32" />
              <polygon points="54,60 64,60 81,20 71,20" />
            </g>
            {/* Subtle highlight accent */}
            <line x1="72" y1="22" x2="56" y2="58" stroke="#475569" strokeWidth="1.5" />
            {/* Bold parody wordmark */}
            <text
              x="50"
              y="79"
              textAnchor="middle"
              fontSize="18"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="-0.5"
              fill="#0f172a"
            >
              abibas
            </text>
          </g>
        );

      // 7: PORTAL - Квантовый пиздец (Glowing purple & cyan concentric swirl vortex + stars)
      case 7:
        return (
          <g>
            <defs>
              <radialGradient id={`${gid}-vortex`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="45%" stopColor="#8b5cf6" />
                <stop offset="85%" stopColor="#4c1d95" />
                <stop offset="100%" stopColor="#4c1d95" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="39" fill={`url(#${gid}-vortex)`} />
            {/* Swirl arms */}
            <path
              d="M 50 50 m 0 -6 a 8 8 0 1 1 -6 10 a 15 15 0 1 1 16 8 a 23 23 0 1 1 -26 -14 a 31 31 0 1 1 38 -16"
              fill="none"
              stroke="#67e8f9"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 50 50 m 4 4 a 11 11 0 1 1 -12 -6 a 19 19 0 1 1 20 12"
              fill="none"
              stroke="#f0abfc"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="6" fill="#ffffff" />
            <Sparkle cx={20} cy={22} r={5} fill="#22d3ee" />
            <Sparkle cx={82} cy={25} r={4.5} fill="#e879f9" />
            <Sparkle cx={78} cy={80} r={5} fill="#22d3ee" />
            <Sparkle cx={20} cy={78} r={4} fill="#c084fc" />
          </g>
        );

      // 8: Оверсайз с Вайлдберриз (Magenta-purple WB berry/hoodie badge)
      case 8:
        return (
          <g>
            <defs>
              <linearGradient id={`${gid}-wb`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#cb11ab" />
                <stop offset="100%" stopColor="#6b21a8" />
              </linearGradient>
            </defs>
            {/* Oversized drop-shoulder hoodie silhouette with WB badge */}
            <path
              d="M 34 20 C 39 14, 61 14, 66 20 L 87 35 L 79 52 L 69 47 L 69 81 L 31 81 L 31 47 L 21 52 L 13 35 Z"
              fill={`url(#${gid}-wb)`}
              stroke="#4a044e"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            {/* Hood opening */}
            <path d="M 39 21 Q 50 30 61 21" fill="#4a044e" />
            {/* Drawstrings */}
            <line x1="45" y1="26" x2="45" y2="38" stroke="#fbcfe8" strokeWidth="2" strokeLinecap="round" />
            <line x1="55" y1="26" x2="55" y2="38" stroke="#fbcfe8" strokeWidth="2" strokeLinecap="round" />
            {/* Bold white WB logo */}
            <text
              x="50"
              y="63"
              textAnchor="middle"
              fontSize="21"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              fill="#ffffff"
            >
              WB
            </text>
          </g>
        );

      // 9: Носки за 50 рублей (Pair of colorful striped socks + yellow 50₽ promo tag)
      case 9:
        return (
          <g>
            {/* Back sock */}
            <g transform="translate(40, 48) rotate(-14)">
              <path
                d="M -9 -26 L 9 -26 L 9 6 C 9 14, 22 14, 22 22 C 22 28, 10 30, -2 26 C -9 24, -9 16, -9 8 Z"
                fill="#2563eb"
                stroke="#1e3a8a"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <rect x="-9" y="-20" width="18" height="4" fill="#ffffff" />
              <rect x="-9" y="-13" width="18" height="4" fill="#ef4444" />
              <circle cx="17" cy="22" r="4.5" fill="#fca5a5" stroke="#991b1b" strokeWidth="1.2" />
            </g>
            {/* Front sock */}
            <g transform="translate(56, 52) rotate(8)">
              <path
                d="M -9 -26 L 9 -26 L 9 6 C 9 14, 23 14, 23 22 C 23 28, 11 30, -2 26 C -9 24, -9 16, -9 8 Z"
                fill="#3b82f6"
                stroke="#1e3a8a"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <rect x="-9" y="-20" width="18" height="4.5" fill="#fde047" />
              <rect x="-9" y="-12" width="18" height="4.5" fill="#ef4444" />
              {/* Red heel + funny toe hole */}
              <path d="M -9 10 A 8 8 0 0 1 -1 25 L -7 23 Q -9 18 -9 10 Z" fill="#ef4444" />
              <circle cx="18" cy="22" r="4.5" fill="#fecaca" stroke="#991b1b" strokeWidth="1.4" />
            </g>
            {/* Bright yellow 50₽ price tag */}
            <g transform="translate(29, 68) rotate(-8)">
              <rect x="-18" y="-11" width="36" height="22" rx="4" fill="#facc15" stroke="#854d0e" strokeWidth="2" />
              <circle cx="-12" cy="0" r="2" fill="#854d0e" />
              <text x="3" y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#713f12">50₽</text>
            </g>
          </g>
        );

      // 10: JAIL - Обезьянник (Monopoly One diagonal split corner: Donut top-right, Handcuffs bottom-left)
      case 10:
        return (
          <g>
            {/* Subtle diagonal split divider top-left to bottom-right */}
            <line
              x1="4"
              y1="4"
              x2="96"
              y2="96"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* TOP-RIGHT TRIANGLE: Pink glazed sprinkled Donut (Just Visiting) */}
            <g transform="translate(69, 30)">
              {/* Golden dough outer ring with transparent center hole */}
              <path
                fillRule="evenodd"
                d="M 0 -20 A 20 20 0 1 1 0 20 A 20 20 0 1 1 0 -20 Z M 0 -6.5 A 6.5 6.5 0 1 0 0 6.5 A 6.5 6.5 0 1 0 0 -6.5 Z"
                fill="#f59e0b"
                stroke="#92400e"
                strokeWidth="1.8"
              />
              {/* Pink wavy icing with transparent center hole */}
              <path
                fillRule="evenodd"
                d="M 0 -17 C 10 -17, 17 -10, 17 0 C 17 5, 14 9, 12 12 C 9 15, 4 17, 0 17 C -6 17, -11 14, -14 10 C -17 6, -17 -5, -15 -9 C -12 -14, -6 -17, 0 -17 Z M 0 -7.5 A 7.5 7.5 0 1 0 0 7.5 A 7.5 7.5 0 1 0 0 -7.5 Z"
                fill="#f472b6"
              />
              {/* Icing highlight */}
              <path d="M -9 -10 A 12 12 0 0 1 8 -11" fill="none" stroke="#fbcfe8" strokeWidth="2.5" strokeLinecap="round" />
              {/* Colorful sprinkles */}
              <line x1="-11" y1="-4" x2="-8" y2="-7" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="9" y1="-5" x2="12" y2="-2" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="7" y1="9" x2="11" y2="7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="-9" y1="8" x2="-5" y2="10" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="-2" y1="-12" x2="2" y2="-11" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="-1" y1="12" x2="3" y2="13" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
            </g>

            {/* BOTTOM-LEFT TRIANGLE: Dark metallic Handcuffs (In Jail) */}
            <g transform="translate(31, 70)">
              {/* Connecting chain links */}
              <ellipse cx="-2" cy="-5" rx="4.5" ry="2.5" transform="rotate(-35 -2 -5)" fill="none" stroke="#475569" strokeWidth="2.6" />
              <ellipse cx="3" cy="-5" rx="4.5" ry="2.5" transform="rotate(35 3 -5)" fill="none" stroke="#334155" strokeWidth="2.6" />
              {/* Left cuff */}
              <g transform="translate(-12, 5) rotate(-20)">
                <rect x="-4" y="-14" width="8" height="6" rx="1.5" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="11" fill="none" stroke="#334155" strokeWidth="4.5" />
                <circle cx="0" cy="0" r="11" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
                <circle cx="-2" cy="-11" r="1.2" fill="#0f172a" />
              </g>
              {/* Right cuff */}
              <g transform="translate(12, 6) rotate(22)">
                <rect x="-4" y="-14" width="8" height="6" rx="1.5" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="11" fill="none" stroke="#1e293b" strokeWidth="4.5" />
                <circle cx="0" cy="0" r="11" fill="none" stroke="#64748b" strokeWidth="1.4" />
                <circle cx="2" cy="-11" r="1.2" fill="#0f172a" />
              </g>
            </g>
          </g>
        );

      // 11: Крипто-пирамида (Golden pyramid with eye + red crash arrow)
      case 11:
        return (
          <g>
            {/* Golden pyramid */}
            <polygon points="50,15 16,76 84,76" fill="#fbbf24" stroke="#92400e" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Shaded right facet */}
            <polygon points="50,15 66,76 84,76" fill="#d97706" opacity="0.65" />
            {/* Brick tiers */}
            <line x1="30" y1="52" x2="70" y2="52" stroke="#92400e" strokeWidth="2" />
            <line x1="23" y1="64" x2="77" y2="64" stroke="#92400e" strokeWidth="2" />
            {/* All-seeing eye in capstone */}
            <path d="M 38 38 Q 50 28 62 38 Q 50 48 38 38 Z" fill="#ffffff" stroke="#78350f" strokeWidth="2" />
            <circle cx="50" cy="38" r="4.2" fill="#0284c7" />
            <circle cx="50" cy="38" r="1.8" fill="#0f172a" />
            {/* Jagged red crypto crash arrow */}
            <polyline
              points="16,30 34,46 46,38 78,78"
              fill="none"
              stroke="#ef4444"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points="84,84 68,81 81,68" fill="#ef4444" />
          </g>
        );

      // 12: Прод на костылях (Rockstar Games parody: Gold rounded square with П* and crutch)
      case 12:
        return (
          <g>
            {/* Rockstar-style gold rounded badge */}
            <rect
              x="14"
              y="14"
              width="72"
              height="72"
              rx="14"
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth="4"
            />
            <rect
              x="19"
              y="19"
              width="62"
              height="62"
              rx="10"
              fill="none"
              stroke="#fde68a"
              strokeWidth="1.8"
            />
            {/* Bold slanted Cyrillic П */}
            <g transform="skewX(-12) translate(7, 0)">
              <path
                d="M 28 68 L 28 30 L 58 30 L 58 68 L 48 68 L 48 39 L 38 39 L 38 68 Z"
                fill="#0f172a"
              />
            </g>
            {/* Iconic white 5-point star with black outline */}
            <polygon
              points="67,50 70.5,58 79,58.5 72.5,64 74.5,72.5 67,68 59.5,72.5 61.5,64 55,58.5 63.5,58"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Wooden/aluminum crutch leaning across */}
            <g transform="translate(62, 42) rotate(22)">
              <path d="M -8 -16 Q 0 -13 8 -16" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
              <line x1="-5" y1="-14" x2="0" y2="8" stroke="#f8fafc" strokeWidth="2.5" />
              <line x1="5" y1="-14" x2="0" y2="8" stroke="#f8fafc" strokeWidth="2.5" />
              <line x1="0" y1="8" x2="0" y2="24" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
        );

      // 13: Курс «Успешный Успех» (Golden crown + rising luxury balloon & sparkles)
      case 13:
        return (
          <g>
            <Sparkle cx={22} cy={26} r={5} fill="#fbbf24" />
            <Sparkle cx={80} cy={22} r={5.5} fill="#fbbf24" />
            <Sparkle cx={78} cy={66} r={4} fill="#f472b6" />
            {/* Rising crimson/gold hot-air money balloon */}
            <path
              d="M 50 18 C 30 18, 24 38, 34 55 L 42 66 L 58 66 L 66 55 C 76 38, 70 18, 50 18 Z"
              fill="#ec4899"
              stroke="#831843"
              strokeWidth="2.4"
            />
            <path
              d="M 50 18 C 41 18, 38 38, 44 66 L 56 66 C 62 38, 59 18, 50 18 Z"
              fill="#fde047"
            />
            {/* Golden Crown emblem on balloon */}
            <path
              d="M 37 45 L 40 33 L 50 40 L 60 33 L 63 45 Z"
              fill="#f59e0b"
              stroke="#78350f"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Basket */}
            <line x1="44" y1="66" x2="45" y2="73" stroke="#78350f" strokeWidth="2" />
            <line x1="56" y1="66" x2="55" y2="73" stroke="#78350f" strokeWidth="2" />
            <rect x="42" y="73" width="16" height="12" rx="3" fill="#b45309" stroke="#78350f" strokeWidth="2" />
          </g>
        );

      // 14: Сигналы от темщика (Blue Telegram paper plane + green/red candlesticks)
      case 14:
        return (
          <g>
            {/* Background candlesticks */}
            <g>
              <line x1="22" y1="48" x2="22" y2="82" stroke="#16a34a" strokeWidth="2.2" />
              <rect x="17" y="56" width="10" height="18" rx="1.5" fill="#22c55e" />

              <line x1="38" y1="38" x2="38" y2="76" stroke="#16a34a" strokeWidth="2.2" />
              <rect x="33" y="44" width="10" height="22" rx="1.5" fill="#22c55e" />

              <line x1="66" y1="46" x2="66" y2="84" stroke="#dc2626" strokeWidth="2.2" />
              <rect x="61" y="52" width="10" height="24" rx="1.5" fill="#ef4444" />

              <line x1="81" y1="58" x2="81" y2="88" stroke="#dc2626" strokeWidth="2.2" />
              <rect x="76" y="64" width="10" height="18" rx="1.5" fill="#ef4444" />
            </g>
            {/* Sky-blue Telegram badge & paper plane */}
            <circle cx="50" cy="39" r="24" fill="#2AABEE" stroke="#0369a1" strokeWidth="2.2" />
            <path d="M 35 39 L 62 27 L 56 52 L 47 45 L 42 49 L 43 42 Z" fill="#ffffff" />
            <path d="M 43 42 L 62 27 L 47 45 Z" fill="#bae6fd" />
          </g>
        );

      // 15: Ланос на газу (Silver-blue sedan + taxi checker roof sign + blue LPG gas tank)
      case 15:
        return (
          <g>
            {/* Blue propane LPG cylinder strapped on top */}
            <g transform="translate(50, 26)">
              <rect x="-18" y="-8" width="36" height="15" rx="7.5" fill="#0284c7" stroke="#0c4a6e" strokeWidth="2" />
              <rect x="18" y="-3" width="5" height="6" rx="1" fill="#ef4444" />
              <text x="0" y="3" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#e0f2fe">ГБО</text>
            </g>
            {/* Rounded Daewoo Lanos sedan */}
            <g transform="translate(50, 58)">
              {/* Taxi checker roof fin */}
              <rect x="-9" y="-22" width="18" height="6" rx="2" fill="#facc15" stroke="#713f12" strokeWidth="1.5" />
              <rect x="-6" y="-20" width="3" height="2.5" fill="#0f172a" />
              <rect x="0" y="-20" width="3" height="2.5" fill="#0f172a" />
              <rect x="4" y="-20" width="3" height="2.5" fill="#0f172a" />
              {/* Curved cabin */}
              <path
                d="M -24 -4 C -18 -17, -10 -17, 10 -17 C 18 -17, 24 -9, 27 -4 Z"
                fill="#64748b"
                stroke="#1e293b"
                strokeWidth="2.2"
              />
              <path d="M -18 -5 C -14 -14, -4 -14, -2 -14 L -2 -5 Z" fill="#bae6fd" />
              <path d="M 2 -5 L 2 -14 C 12 -14, 18 -10, 22 -5 Z" fill="#bae6fd" />
              {/* Body */}
              <path
                d="M -37 -4 L 35 -4 C 39 -2, 39 9, 35 11 L -36 11 C -39 8, -39 -1, -37 -4 Z"
                fill="#94a3b8"
                stroke="#1e293b"
                strokeWidth="2.2"
              />
              {/* Taxi checker stripe on door */}
              <rect x="-14" y="1" width="24" height="4" fill="#facc15" />
              <rect x="-12" y="1" width="4" height="4" fill="#0f172a" />
              <rect x="-4" y="1" width="4" height="4" fill="#0f172a" />
              <rect x="4" y="1" width="4" height="4" fill="#0f172a" />
              {/* Headlight & taillight */}
              <ellipse cx="34" cy="2" rx="3.5" ry="2.5" fill="#fef08a" />
              <rect x="-38" y="0" width="4" height="5" rx="1" fill="#ef4444" />
              {/* Wheels */}
              <circle cx="-22" cy="12" r="8" fill="#1e293b" />
              <circle cx="-22" cy="12" r="3.5" fill="#e2e8f0" />
              <circle cx="22" cy="12" r="8" fill="#1e293b" />
              <circle cx="22" cy="12" r="3.5" fill="#e2e8f0" />
            </g>
          </g>
        );

      // 16: Пивнуха 24/7 (Frothy amber beer mug + bold 24/7 badge)
      case 16:
        return (
          <g>
            {/*Mug handle */}
            <path
              d="M 64 38 L 76 38 C 81 38, 81 66, 76 66 L 64 66"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <path
              d="M 64 38 L 76 38 C 81 38, 81 66, 76 66 L 64 66"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Mug glass body */}
            <rect x="24" y="29" width="42" height="52" rx="6" fill="#f59e0b" stroke="#78350f" strokeWidth="2.5" />
            {/* Vertical beer glass flutes */}
            <line x1="35" y1="38" x2="35" y2="73" stroke="#fde68a" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
            <line x1="45" y1="38" x2="45" y2="73" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
            <line x1="55" y1="38" x2="55" y2="73" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
            {/* Overflowing fluffy white foam */}
            <g fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.8">
              <circle cx="31" cy="26" r="9" />
              <circle cx="45" cy="22" r="11" />
              <circle cx="59" cy="26" r="9" />
              <path d="M 25 27 L 65 27 L 65 34 Q 56 38 52 33 Q 48 42 43 34 Q 34 38 25 33 Z" stroke="none" />
            </g>
            {/* Bold neon-red 24/7 badge */}
            <rect x="38" y="64" width="46" height="20" rx="5" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
            <text x="61" y="78" textAnchor="middle" fontSize="12.5" fontWeight="900" fill="#fde047">
              24/7
            </text>
          </g>
        );

      // 18: Ягуар из 2007-го (Hot-pink & black JAGUAR can + claw slashes + 2007)
      case 18:
        return (
          <g>
            {/* Aluminum can */}
            <rect x="27" y="13" width="46" height="74" rx="7" fill="#0f172a" stroke="#334155" strokeWidth="2.2" />
            {/* Silver rims */}
            <ellipse cx="50" cy="15" rx="21" ry="3.5" fill="#cbd5e1" />
            <rect x="29" y="82" width="42" height="4" rx="2" fill="#94a3b8" />
            {/* Hot-pink diagonal slash */}
            <polygon points="28,36 72,22 72,56 28,70" fill="#ec4899" />
            {/* Three black/white claw marks */}
            <path d="M 35 32 L 62 58" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 43 28 L 66 50" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 33 42 L 54 62" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            {/* Bold JAGUAR / 2007 text */}
            <text x="50" y="51" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8">
              JAGUAR
            </text>
            <text x="50" y="77" textAnchor="middle" fontSize="11" fontWeight="900" fill="#f472b6">
              2007
            </text>
          </g>
        );

      // 19: Дешёвый энергетик по акции (Black & neon-green lightning bolt can + yellow sale tag)
      case 19:
        return (
          <g>
            {/* Tall matte-black energy can */}
            <rect x="28" y="12" width="44" height="76" rx="7" fill="#18181b" stroke="#84cc16" strokeWidth="2.2" />
            <ellipse cx="50" cy="14" rx="20" ry="3" fill="#a3e635" />
            {/* Neon green electric lightning bolt */}
            <polygon
              points="55,22 36,50 49,50 43,78 65,46 51,46"
              fill="#84cc16"
              stroke="#ecfccb"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Yellow promo price sticker */}
            <g transform="translate(66, 70) rotate(-10)">
              <rect x="-17" y="-10" width="34" height="19" rx="4" fill="#facc15" stroke="#713f12" strokeWidth="1.8" />
              <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="900" fill="#dc2626">-50%</text>
            </g>
          </g>
        );

      // 20: JACKPOT - Ебучий Додеп / Русская рулетка
      case 20:
        if (russianRoulette) {
          return (
            <g>
              {/* Crimson danger aura */}
              <circle cx="50" cy="50" r="39" fill="#450a0a" opacity="0.14" />

              {/* Revolver cylinder outer body with flutes */}
              <circle cx="50" cy="48" r="32" fill="#334155" stroke="#0f172a" strokeWidth="3" />
              <circle cx="50" cy="48" r="28" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" opacity="0.85" />

              {/* Center extractor pin */}
              <circle cx="50" cy="48" r="6.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.6" />
              <circle cx="50" cy="48" r="2.2" fill="#94a3b8" />

              {/* 6 Chambers arranged around center (50, 48) at radius 17 */}
              {/* Top (50, 31) — LOADED BULLET */}
              <circle cx="50" cy="31" r="6.8" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="50" cy="31" r="4.6" fill="#d97706" />
              <circle cx="50" cy="31" r="2" fill="#dc2626" />

              {/* Top-right (64.7, 39.5) — Empty */}
              <circle cx="64.7" cy="39.5" r="6.8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="64.7" cy="39.5" r="4.2" fill="#020617" />

              {/* Bottom-right (64.7, 56.5) — Empty */}
              <circle cx="64.7" cy="56.5" r="6.8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="64.7" cy="56.5" r="4.2" fill="#020617" />

              {/* Bottom (50, 65) — Empty */}
              <circle cx="50" cy="65" r="6.8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="50" cy="65" r="4.2" fill="#020617" />

              {/* Bottom-left (35.3, 56.5) — Empty */}
              <circle cx="35.3" cy="56.5" r="6.8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="35.3" cy="56.5" r="4.2" fill="#020617" />

              {/* Top-left (35.3, 39.5) — Empty */}
              <circle cx="35.3" cy="39.5" r="6.8" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
              <circle cx="35.3" cy="39.5" r="4.2" fill="#020617" />

              {/* Bottom crimson ribbon */}
              <rect x="14" y="75" width="72" height="16" rx="4" fill="#be123c" stroke="#881337" strokeWidth="1.8" />
              <text x="50" y="86.5" textAnchor="middle" fontSize="9.5" fontWeight="900" letterSpacing="0.5" fill="#ffffff">
                РУЛЕТКА
              </text>
            </g>
          );
        }
        return (
          <g>
            {/* Right-side pull lever */}
            <path d="M 78 62 L 88 62 L 88 34" fill="none" stroke="#64748b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="88" cy="29" r="7" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
            <circle cx="86" cy="27" r="2.2" fill="#fca5a5" />

            {/* Slot cabinet */}
            <rect x="12" y="22" width="68" height="66" rx="9" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2.5" />
            {/* Gold marquee header */}
            <path d="M 16 28 C 16 14, 76 14, 76 28 L 76 35 L 16 35 Z" fill="#facc15" stroke="#92400e" strokeWidth="2.2" />
            <text x="46" y="29" textAnchor="middle" fontSize="10" fontWeight="900" letterSpacing="0.6" fill="#7f1d1d">
              JACKPOT
            </text>

            {/* 3 White spinning reels frame */}
            <rect x="18" y="40" width="56" height="28" rx="4" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
            <rect x="21" y="43" width="15" height="22" rx="2" fill="#ffffff" />
            <rect x="38.5" y="43" width="15" height="22" rx="2" fill="#ffffff" />
            <rect x="56" y="43" width="15" height="22" rx="2" fill="#ffffff" />

            {/* Reel 1: Cherry */}
            <path d="M 26 56 Q 28 49 32 48" fill="none" stroke="#15803d" strokeWidth="1.8" />
            <circle cx="26.5" cy="57.5" r="3.5" fill="#ef4444" />
            <circle cx="31.5" cy="57.5" r="3.5" fill="#dc2626" />
            {/* Reel 2: Lucky 7 */}
            <text x="46" y="60" textAnchor="middle" fontSize="17" fontWeight="900" fill="#dc2626">7</text>
            {/* Reel 3: Blue Diamond */}
            <polygon points="63.5,47 69,53 63.5,61 58,53" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />

            {/* Coin payout tray + spilling gold coins */}
            <rect x="24" y="73" width="44" height="10" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            <circle cx="36" cy="79" r="4" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
            <circle cx="46" cy="80" r="4" fill="#fde047" stroke="#b45309" strokeWidth="1" />
            <circle cx="55" cy="79" r="4" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
          </g>
        );

      // 21: Таксист «Для души» (Yellow-black diagonal taxi shield & steering wheel)
      case 21:
        return (
          <g>
            <defs>
              <clipPath id={`${gid}-shield`}>
                <path d="M 50 13 L 82 24 L 78 58 C 75 74, 50 87, 50 87 C 50 87, 25 74, 22 58 L 18 24 Z" />
              </clipPath>
            </defs>
            {/* Yandex-Go parody diagonal yellow/white/black shield */}
            <g clipPath={`url(#${gid}-shield)`}>
              <rect x="10" y="10" width="80" height="80" fill="#facc15" />
              <polygon points="10,90 90,25 90,90" fill="#18181b" />
              <polygon points="10,10 62,10 10,55" fill="#fef08a" />
            </g>
            <path
              d="M 50 13 L 82 24 L 78 58 C 75 74, 50 87, 50 87 C 50 87, 25 74, 22 58 L 18 24 Z"
              fill="none"
              stroke="#0f172a"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Steering wheel */}
            <circle cx="50" cy="50" r="17" fill="none" stroke="#ffffff" strokeWidth="5.5" />
            <circle cx="50" cy="50" r="17" fill="none" stroke="#0f172a" strokeWidth="3" />
            <circle cx="50" cy="50" r="5" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
            <line x1="34" y1="48" x2="66" y2="48" stroke="#0f172a" strokeWidth="3.2" />
            <line x1="50" y1="50" x2="50" y2="66" stroke="#0f172a" strokeWidth="3.2" />
          </g>
        );

      // 23: Курьер в ливень (Bright yellow square delivery bag + rain & lightning bolt)
      case 23:
        return (
          <g>
            {/* Slanted rain streaks */}
            <line x1="22" y1="14" x2="14" y2="30" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="50" y1="11" x2="43" y2="25" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="84" y1="15" x2="76" y2="31" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="86" y1="54" x2="79" y2="68" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />

            {/* Iconic square yellow courier backpack */}
            <rect
              x="22"
              y="26"
              width="54"
              height="56"
              rx="8"
              fill="#facc15"
              stroke="#713f12"
              strokeWidth="2.6"
            />
            {/* Top flap */}
            <path d="M 22 36 Q 49 42 76 36" fill="none" stroke="#854d0e" strokeWidth="2.4" />
            {/* Silver reflective strips */}
            <rect x="26" y="68" width="46" height="6" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
            {/* Speed lightning bolt emblem */}
            <polygon
              points="53,39 39,56 49,56 45,69 61,51 51,51"
              fill="#0f172a"
            />
          </g>
        );

      // 24: Посылка в ебеня (Crushed cardboard parcel box with crooked tape & arrows)
      case 24:
        return (
          <g>
            {/* Dented isometric/squashed kraft box */}
            <polygon
              points="20,34 52,18 83,31 79,73 48,85 17,70"
              fill="#d97706"
              stroke="#78350f"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Top flaps (dented inward) */}
            <polygon points="20,34 52,18 83,31 50,45" fill="#f59e0b" stroke="#78350f" strokeWidth="2" />
            {/* Shaded right side */}
            <polygon points="50,45 83,31 79,73 48,85" fill="#b45309" stroke="#78350f" strokeWidth="2" />
            {/* Crooked tan packing tape strips */}
            <polygon points="33,26 67,39 61,44 28,30" fill="#fde68a" opacity="0.9" />
            <rect x="23" y="51" width="24" height="7" transform="rotate(18 35 55)" fill="#fde68a" opacity="0.9" />
            {/* Chaotic direction arrows on side */}
            <path d="M 60 55 L 60 68 M 56 59 L 60 54 L 64 59" fill="none" stroke="#fef3c7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 71 66 L 71 53 M 67 62 L 71 67 L 75 62" fill="none" stroke="#fef3c7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      // 25: БМВ без поворотников (Crisp black-ringed blue/white quartered roundel parody + crossed blinkers)
      case 25:
        return (
          <g>
            {/* Outer silver & black Bavarian roundel */}
            <circle cx="50" cy="50" r="35" fill="#0f172a" stroke="#cbd5e1" strokeWidth="3" />
            <circle cx="50" cy="50" r="23" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.8" />
            {/* Blue & white propeller quarters */}
            <path d="M 50 50 L 50 27 A 23 23 0 0 0 27 50 Z" fill="#0ea5e9" />
            <path d="M 50 50 L 50 73 A 23 23 0 0 0 73 50 Z" fill="#0ea5e9" />
            <line x1="27" y1="50" x2="73" y2="50" stroke="#0f172a" strokeWidth="1.8" />
            <line x1="50" y1="27" x2="50" y2="73" stroke="#0f172a" strokeWidth="1.8" />
            {/* Top parody letters */}
            <text x="50" y="23" textAnchor="middle" fontSize="8.5" fontWeight="900" letterSpacing="2" fill="#ffffff">
              БМВ
            </text>
            {/* Crossed-out green blinker badge in bottom-right */}
            <g transform="translate(74, 74)">
              <circle cx="0" cy="0" r="12" fill="#1e293b" stroke="#ef4444" strokeWidth="2.5" />
              <polygon points="-7,0 -1,-5 -1,-2 2,-2 2,-5 8,0 2,5 2,2 -1,2 -1,5" fill="#22c55e" />
              <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ef4444" strokeWidth="2.8" />
            </g>
          </g>
        );

      // 26: Комп. клуб со школьниками (Glowing neon PC monitor + crosshair + RGB gaming mouse)
      case 26:
        return (
          <g>
            {/* Monitor stand */}
            <path d="M 43 68 L 57 68 L 62 79 L 38 79 Z" fill="#334155" />
            <line x1="32" y1="79" x2="68" y2="79" stroke="#ec4899" strokeWidth="3.5" strokeLinecap="round" />
            {/* Widescreen RGB gaming monitor */}
            <rect
              x="14"
              y="20"
              width="66"
              height="48"
              rx="6"
              fill="#0f172a"
              stroke="#22d3ee"
              strokeWidth="2.8"
            />
            <rect x="19" y="25" width="56" height="38" rx="3" fill="#1e1b4b" />
            {/* Neon FPS crosshair on screen */}
            <circle cx="47" cy="44" r="11" fill="none" stroke="#4ade80" strokeWidth="2.2" />
            <line x1="32" y1="44" x2="62" y2="44" stroke="#4ade80" strokeWidth="2" />
            <line x1="47" y1="29" x2="47" y2="59" stroke="#4ade80" strokeWidth="2" />
            <circle cx="47" cy="44" r="2.2" fill="#ef4444" />
            {/* RGB Gaming Mouse on right */}
            <g transform="translate(77, 70)">
              <rect x="-9" y="-13" width="18" height="25" rx="9" fill="#1e293b" stroke="#a855f7" strokeWidth="2.2" />
              <line x1="0" y1="-12" x2="0" y2="-3" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          </g>
        );

      // 27: Тиммейты-долбоёбы (Соло-ку) (DOTA parody: Red square MOBA river-slash + two ancients)
      case 27:
        return (
          <g>
            {/* Crimson MOBA rounded square */}
            <rect
              x="16"
              y="16"
              width="68"
              height="68"
              rx="12"
              fill="#b91c1c"
              stroke="#450a0a"
              strokeWidth="3"
            />
            <rect x="21" y="21" width="58" height="58" rx="8" fill="#dc2626" />
            {/* Iconic diagonal MOBA river slash */}
            <path
              d="M 25 27 L 33 23 L 76 72 L 67 77 Z"
              fill="#fef2f2"
            />
            {/* Top-right & bottom-left Ancient fortresses */}
            <polygon points="60,27 73,27 73,41" fill="#fef2f2" />
            <polygon points="27,59 27,73 41,73" fill="#fef2f2" />
            {/* Funny -30 MMR badge */}
            <rect x="48" y="67" width="38" height="17" rx="5" fill="#0f172a" stroke="#fca5a5" strokeWidth="1.6" />
            <text x="67" y="79" textAnchor="middle" fontSize="10.5" fontWeight="900" fill="#f87171">
              -30
            </text>
          </g>
        );

      // 28: Легаси-код без комментов (Tangled spaghetti noodles overflowing from { } code screen)
      case 28:
        return (
          <g>
            {/* Dark code terminal window */}
            <rect x="15" y="16" width="70" height="54" rx="7" fill="#1e293b" stroke="#475569" strokeWidth="2.4" />
            <circle cx="24" cy="24" r="2.5" fill="#ef4444" />
            <circle cx="32" cy="24" r="2.5" fill="#facc15" />
            <circle cx="40" cy="24" r="2.5" fill="#22c55e" />
            {/* Code braces */}
            <text x="29" y="49" textAnchor="middle" fontSize="22" fontWeight="900" fill="#38bdf8">{'{'}</text>
            <text x="71" y="49" textAnchor="middle" fontSize="22" fontWeight="900" fill="#38bdf8">{'}'}</text>

            {/* Tangled golden spaghetti noodles pouring out + red bug meatballs */}
            <path
              d="M 36 42 C 42 28, 58 28, 62 44 C 66 58, 28 54, 30 68 C 32 82, 70 84, 72 68 C 73 58, 44 60, 48 82"
              fill="none"
              stroke="#facc15"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <path
              d="M 42 38 C 52 50, 36 66, 56 76 C 68 82, 62 56, 44 54"
              fill="none"
              stroke="#fde047"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Marinara meatballs / bugs */}
            <circle cx="44" cy="60" r="5.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
            <circle cx="61" cy="70" r="5.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
          </g>
        );

      // 29: Казино-рулетка со скинами (Curved purple-magenta Doppler Karambit knife + star)
      case 29:
        return (
          <g>
            <defs>
              <linearGradient id={`${gid}-doppler`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#9333ea" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <Sparkle cx={28} cy={26} r={6} fill="#fde047" />
            <Sparkle cx={76} cy={68} r={4.5} fill="#f472b6" />
            {/* Iconic curved Karambit blade + ergonomic handle + finger ring */}
            <g transform="translate(50, 52) rotate(-8)">
              {/* Curved claw Doppler blade */}
              <path
                d="M -2 -2 C -14 -24, 14 -38, 34 -32 C 16 -24, 8 -12, 10 4 Z"
                fill={`url(#${gid}-doppler)`}
                stroke="#3b0764"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Blade bevel highlight */}
              <path d="M 4 -8 C 2 -21, 16 -30, 30 -30" fill="none" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" />
              {/* Black tactical grip */}
              <path
                d="M -2 -2 L 10 4 C 8 17, -4 25, -15 26 L -20 16 C -10 14, -4 8, -2 -2 Z"
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Pommel finger ring */}
              <circle cx="-22" cy="24" r="9" fill="none" stroke="#334155" strokeWidth="4.5" />
              <circle cx="-22" cy="24" r="9" fill="none" stroke="#ec4899" strokeWidth="1.5" />
            </g>
          </g>
        );

      // 30: POLICE - Мусора (Stern cartoon policeman bust in dark navy uniform, tie & officer cap)
      case 30:
        return (
          <g>
            {/* Uniform shoulders / torso */}
            <path
              d="M 16 88 C 16 68, 30 62, 50 62 C 70 62, 84 68, 84 88 Z"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            {/* Gold shoulder epaulets */}
            <rect x="20" y="65" width="14" height="5" rx="2" transform="rotate(-14 27 67)" fill="#fbbf24" />
            <rect x="66" y="65" width="14" height="5" rx="2" transform="rotate(14 73 67)" fill="#fbbf24" />
            {/* Blue shirt V-neck & dark tie */}
            <polygon points="41,62 50,82 59,62" fill="#bae6fd" />
            <polygon points="47,63 53,63 54,84 50,88 46,84" fill="#0f172a" />
            {/* Shield badge on chest */}
            <polygon points="64,72 72,72 71,81 68,84 65,81" fill="#fbbf24" stroke="#92400e" strokeWidth="1.2" />

            {/* Head */}
            <rect x="35" y="34" width="30" height="29" rx="12" fill="#fed7aa" stroke="#9a3412" strokeWidth="2" />
            {/* Aviator sunglasses & stern frown */}
            <path d="M 37 45 L 49 45 C 49 52, 38 52, 37 45 Z" fill="#0f172a" />
            <path d="M 51 45 L 63 45 C 62 52, 51 52, 51 45 Z" fill="#0f172a" />
            <line x1="36" y1="45" x2="64" y2="45" stroke="#fbbf24" strokeWidth="2" />
            <path d="M 44 56 Q 50 53 56 56" fill="none" stroke="#7c2d12" strokeWidth="2.4" strokeLinecap="round" />

            {/* Officer peaked cap */}
            <path d="M 28 34 L 50 15 L 72 34 Z" fill="#1e3a8a" stroke="#0f172a" strokeWidth="2.4" strokeLinejoin="round" />
            <rect x="33" y="31" width="34" height="6" rx="2" fill="#1e293b" />
            {/* Glossy black visor */}
            <path d="M 32 36 Q 50 43 68 36 Q 50 38 32 36 Z" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.2" />
            {/* Gold cockade badge */}
            <circle cx="50" cy="26" r="5" fill="#fbbf24" stroke="#92400e" strokeWidth="1.4" />
          </g>
        );

      // 31: Бабушкина хрущёвка с ковром (Ornate red-gold-black geometric Soviet wall rug)
      case 31:
        return (
          <g>
            {/* Top & bottom golden fringe tassels */}
            <line x1="18" y1="13" x2="82" y2="13" stroke="#fcd34d" strokeWidth="4" strokeDasharray="3 3" />
            <line x1="18" y1="87" x2="82" y2="87" stroke="#fcd34d" strokeWidth="4" strokeDasharray="3 3" />
            {/* Crimson rug base */}
            <rect x="16" y="15" width="68" height="70" rx="3" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.4" />
            {/* Ornate gold & dark inner border */}
            <rect x="22" y="21" width="56" height="58" fill="none" stroke="#fbbf24" strokeWidth="3" />
            <rect x="27" y="26" width="46" height="48" fill="#991b1b" stroke="#0f172a" strokeWidth="1.8" />
            {/* Central geometric Soviet diamond medallion */}
            <polygon points="50,30 68,50 50,70 32,50" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
            <polygon points="50,38 60,50 50,62 40,50" fill="#dc2626" stroke="#fef3c7" strokeWidth="1.8" />
            <circle cx="50" cy="50" r="4" fill="#fef08a" />
            {/* Corner floral motifs */}
            <rect x="30" y="29" width="5" height="5" fill="#fde047" />
            <rect x="65" y="29" width="5" height="5" fill="#fde047" />
            <rect x="30" y="66" width="5" height="5" fill="#fde047" />
            <rect x="65" y="66" width="5" height="5" fill="#fde047" />
          </g>
        );

      // 32: Съёмная однушка в Мурино (Tall dense blue-grey 25-floor anthill apartment block)
      case 32:
        return (
          <g>
            {/* Side wing tower */}
            <rect x="16" y="26" width="22" height="62" rx="2" fill="#475569" stroke="#1e293b" strokeWidth="2" />
            {/* Main colossal Murino human-anthill block */}
            <rect x="34" y="12" width="48" height="76" rx="2" fill="#64748b" stroke="#1e293b" strokeWidth="2.4" />
            <rect x="34" y="12" width="48" height="6" fill="#334155" />
            {/* Dense grid of tiny lit & dark apartment windows */}
            {[22, 30, 38, 46, 54, 62, 70, 78].map((y, rIdx) =>
              [40, 49, 58, 67, 74].map((x, cIdx) => {
                const isLit = (rIdx + cIdx * 2) % 3 === 0;
                return (
                  <rect
                    key={`${rIdx}-${cIdx}`}
                    x={x}
                    y={y}
                    width="5"
                    height="4.5"
                    fill={isLit ? '#fde047' : '#1e293b'}
                  />
                );
              })
            )}
            {[34, 44, 54, 64, 74].map((y, idx) => (
              <rect key={`w-${idx}`} x="22" y={y} width="6" height="5" fill={idx % 2 === 0 ? '#fde047' : '#1e293b'} />
            ))}
          </g>
        );

      // 34: Пентхаус в Дубае в ипотеку (Sleek golden Burj Al Arab sail tower + sun & water)
      case 34:
        return (
          <g>
            {/* Golden Dubai sun */}
            <circle cx="68" cy="28" r="13" fill="#fde047" opacity="0.9" />
            {/* Iconic Burj Al Arab sail silhouette */}
            <line x1="36" y1="11" x2="36" y2="80" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
            <path
              d="M 36 16 C 68 24, 76 52, 62 80 L 36 80 Z"
              fill="#38bdf8"
              stroke="#0369a1"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Helipad cantilever */}
            <line x1="25" y1="27" x2="39" y2="27" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" />
            {/* Horizontal gold structural ribs */}
            <line x1="36" y1="34" x2="60" y2="34" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="36" y1="48" x2="66" y2="48" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="36" y1="62" x2="66" y2="62" stroke="#fbbf24" strokeWidth="2.5" />
            {/* Turquoise Gulf waves */}
            <path
              d="M 14 82 Q 26 77 38 82 T 62 82 T 86 82"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        );

      // 35: Маршрутка с шансоном (Yellow GAZelle minibus front view + musical notes)
      case 35:
        return (
          <g>
            {/* Floating Chanson musical notes */}
            <text x="17" y="28" fontSize="16" fontWeight="900" fill="#0f172a">♪</text>
            <text x="77" y="25" fontSize="15" fontWeight="900" fill="#d97706">♫</text>

            {/* Yellow minibus front */}
            <rect x="22" y="24" width="56" height="54" rx="10" fill="#facc15" stroke="#854d0e" strokeWidth="2.5" />
            {/* Route number sign */}
            <rect x="37" y="27" width="26" height="8" rx="2" fill="#ffffff" stroke="#0f172a" strokeWidth="1.4" />
            <text x="50" y="33.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#dc2626">777</text>
            {/* Wide windshield */}
            <rect x="27" y="38" width="46" height="19" rx="4" fill="#bae6fd" stroke="#1e293b" strokeWidth="2" />
            {/* Radiator grille & headlights */}
            <rect x="38" y="62" width="24" height="9" rx="2" fill="#1e293b" />
            <circle cx="31" cy="66" r="4.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
            <circle cx="69" cy="66" r="4.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
            {/* Side mirrors & wheels */}
            <rect x="16" y="42" width="5" height="10" rx="2" fill="#1e293b" />
            <rect x="79" y="42" width="5" height="10" rx="2" fill="#1e293b" />
            <rect x="26" y="78" width="11" height="8" rx="2" fill="#1e293b" />
            <rect x="63" y="78" width="11" height="8" rx="2" fill="#1e293b" />
          </g>
        );

      // 37: Айфон в кредит на 5 лет (Sleek titanium pro smartphone with triple-camera plateau)
      case 37:
        return (
          <g>
            {/* Titanium smartphone body */}
            <rect
              x="27"
              y="11"
              width="46"
              height="78"
              rx="10"
              fill="#334155"
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            <rect x="30" y="14" width="40" height="72" rx="8" fill="#475569" />
            {/* Iconic Pro triple-camera square plateau */}
            <rect x="33" y="17" width="23" height="23" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="1.4" />
            <circle cx="39.5" cy="23.5" r="4.5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.4" />
            <circle cx="39.5" cy="33.5" r="4.5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.4" />
            <circle cx="49.5" cy="28.5" r="4.5" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.4" />
            <circle cx="49.5" cy="20.5" r="1.8" fill="#fde68a" />
            {/* Parody bitten pear/fruit logo in center */}
            <path
              d="M 50 47 C 45 47, 42 53, 42 58 C 42 63, 46 66, 50 66 C 54 66, 58 63, 58 58 C 56 57, 55 54, 57 52 C 55 49, 53 47, 50 47 Z"
              fill="#cbd5e1"
            />
            <ellipse cx="52" cy="44" rx="3" ry="1.6" transform="rotate(-30 52 44)" fill="#cbd5e1" />
          </g>
        );

      // 38: TAX - Налог на воздух (Faceted sky-blue sparkling Diamond like Monopoly One luxury tax)
      case 38:
        return (
          <g transform="translate(14, 12) scale(0.72)">
            <Sparkle cx={20} cy={24} r={5} fill="#38bdf8" />
            <Sparkle cx={82} cy={28} r={5.5} fill="#7dd3fc" />
            <Sparkle cx={50} cy={88} r={4} fill="#38bdf8" />

            {/* Crown (top facets) */}
            <polygon points="31,24 69,24 85,43 15,43" fill="#7dd3fc" />
            <polygon points="31,24 50,24 36,43 15,43" fill="#bae6fd" />
            <polygon points="31,24 69,24 64,43 36,43" fill="#e0f2fe" />
            <polygon points="69,24 85,43 64,43" fill="#38bdf8" />

            {/* Pavilion (bottom facets converging to tip) */}
            <polygon points="15,43 36,43 50,82" fill="#38bdf8" />
            <polygon points="36,43 64,43 50,82" fill="#0ea5e9" />
            <polygon points="64,43 85,43 50,82" fill="#0284c7" />

            {/* Crisp facet lines */}
            <polygon
              points="31,24 69,24 85,43 50,82 15,43"
              fill="none"
              stroke="#0369a1"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <line x1="15" y1="43" x2="85" y2="43" stroke="#0369a1" strokeWidth="2" />
            <line x1="31" y1="24" x2="36" y2="43" stroke="#0284c7" strokeWidth="1.6" />
            <line x1="69" y1="24" x2="64" y2="43" stroke="#0284c7" strokeWidth="1.6" />
            <line x1="36" y1="43" x2="50" y2="82" stroke="#0369a1" strokeWidth="1.6" />
            <line x1="64" y1="43" x2="50" y2="82" stroke="#0369a1" strokeWidth="1.6" />
          </g>
        );

      // 39: Майнинг-ферма на балконе (Dual-fan RTX graphics card + golden Bitcoin coin)
      case 39:
        return (
          <g>
            {/* Copper heatpipes top */}
            <path d="M 24 38 L 24 33 L 52 33" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
            {/* PCIe gold pins bottom */}
            <rect x="26" y="76" width="34" height="5" rx="1" fill="#facc15" />

            {/* Dual-fan GPU shroud */}
            <rect x="12" y="38" width="76" height="39" rx="6" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
            <polygon points="46,38 54,38 49,77 41,77" fill="#334155" />

            {/* Left cooling fan */}
            <circle cx="30" cy="57.5" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="1.8" />
            <path d="M 30 45 L 30 70 M 18 57.5 L 42 57.5 M 21 49 L 39 66 M 39 49 L 21 66" stroke="#475569" strokeWidth="2.4" />
            <circle cx="30" cy="57.5" r="4" fill="#22c55e" />

            {/* Right cooling fan */}
            <circle cx="69" cy="57.5" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="1.8" />
            <path d="M 69 45 L 69 70 M 57 57.5 L 81 57.5 M 60 49 L 78 66 M 78 49 L 60 66" stroke="#475569" strokeWidth="2.4" />
            <circle cx="69" cy="57.5" r="4" fill="#22c55e" />

            {/* Glowing Golden Bitcoin badge floating above */}
            <g transform="translate(64, 24)">
              <circle cx="0" cy="0" r="14" fill="#fbbf24" stroke="#b45309" strokeWidth="2.4" />
              <circle cx="0" cy="0" r="10.5" fill="none" stroke="#fef08a" strokeWidth="1.4" />
              <text x="0" y="5.5" textAnchor="middle" fontSize="16" fontWeight="900" fill="#78350f">₿</text>
            </g>
          </g>
        );

      default:
        return (
          <circle cx="50" cy="50" r="24" fill="#94a3b8" />
        );
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
