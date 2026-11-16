import React, { useState } from 'react';

const APPLE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64';

const resolvedUrlCache = new Map<string, string | 'TEXT_FALLBACK'>();

function toHexCodepoints(grapheme: string, includeFe0f: boolean): string {
  const cps: string[] = [];
  for (const ch of Array.from(grapheme)) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (!includeFe0f && cp === 0xfe0f) continue;
    const hex = cp.toString(16).toLowerCase();
    cps.push(cp < 0x100 ? hex.padStart(4, '0') : hex);
  }
  return cps.join('-');
}

export function getAppleEmojiUrls(grapheme: string): { primary: string; secondary: string } | null {
  const trimmed = grapheme.trim();
  if (!trimmed) return null;
  const hasKeycap = trimmed.includes('\u20e3');
  const withFe0f = toHexCodepoints(
    hasKeycap && !trimmed.includes('\ufe0f')
      ? trimmed.replace('\u20e3', '\ufe0f\u20e3')
      : trimmed,
    true
  );
  const withoutFe0f = toHexCodepoints(trimmed, false);
  if (!withoutFe0f) return null;

  // В emoji-datasource-apple большинство цветных смайликов идут без -fe0f,
  // а символы BMP (🛡️, ⚙️, ⚠️, ⛓️, 👁️, 7️⃣) — с -fe0f
  const firstCp = trimmed.codePointAt(0) ?? 0;
  const preferFe0f = hasKeycap || (firstCp < 0x1f000 && withFe0f !== withoutFe0f);

  const primaryHex = preferFe0f ? withFe0f : withoutFe0f;
  const secondaryHex = preferFe0f ? withoutFe0f : withFe0f;

  return {
    primary: `${APPLE_CDN_BASE}/${primaryHex}.png`,
    secondary: `${APPLE_CDN_BASE}/${secondaryHex}.png`,
  };
}

interface AppleEmojiProps {
  emoji: string;
  alt?: string;
  fill?: boolean;
  className?: string;
}

export const AppleEmoji: React.FC<AppleEmojiProps> = ({
  emoji,
  alt,
  fill = false,
  className = '',
}) => {
  const cached = resolvedUrlCache.get(emoji);
  const urls = getAppleEmojiUrls(emoji);
  const [stage, setStage] = useState<'primary' | 'secondary' | 'text'>(() => {
    if (cached === 'TEXT_FALLBACK' || !urls) return 'text';
    if (cached && urls && cached === urls.secondary) return 'secondary';
    return 'primary';
  });

  if (!urls || stage === 'text') {
    return <span className={className}>{emoji}</span>;
  }

  const src =
    cached && cached !== 'TEXT_FALLBACK'
      ? cached
      : stage === 'primary'
      ? urls.primary
      : urls.secondary;

  return (
    <img
      src={src}
      alt={alt ?? emoji}
      draggable={false}
      loading="lazy"
      decoding="async"
      onLoad={() => {
        resolvedUrlCache.set(emoji, src);
      }}
      onError={() => {
        if (stage === 'primary' && urls.secondary !== urls.primary) {
          setStage('secondary');
        } else {
          resolvedUrlCache.set(emoji, 'TEXT_FALLBACK');
          setStage('text');
        }
      }}
      className={
        fill
          ? `apple-emoji w-[78%] h-[78%] object-contain select-none pointer-events-none inline-block ${className}`
          : `apple-emoji inline-block w-[1.15em] h-[1.15em] align-[-0.18em] object-contain select-none pointer-events-none shrink-0 ${className}`
      }
    />
  );
};

const EMOJI_TEST_RE = /\p{Extended_Pictographic}|\u20e3/u;
// Исключаем базовые текстовые символы стрелок/звёзд/крестиков, которые стилизованы CSS-цветом (★, ✕, ●, ○, →, ←, ⇄)
const KEEP_AS_TEXT_SET = new Set([
  '★',
  '☆',
  '✕',
  '✖',
  '✓',
  '✔',
  '●',
  '○',
  '→',
  '←',
  '⇄',
  '➤',
  '♠',
  '♥',
  '♦',
  '♣',
]);

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ru', { granularity: 'grapheme' })
    : null;

export function renderAppleEmojis(text: string, keyPrefix = 'em'): React.ReactNode {
  if (!text || !EMOJI_TEST_RE.test(text)) return text;

  const graphemes = segmenter
    ? Array.from(segmenter.segment(text), (s) => s.segment)
    : Array.from(text);

  const out: React.ReactNode[] = [];
  let textBuf = '';

  graphemes.forEach((g, idx) => {
    if (!KEEP_AS_TEXT_SET.has(g.trim()) && EMOJI_TEST_RE.test(g)) {
      if (textBuf) {
        out.push(textBuf);
        textBuf = '';
      }
      out.push(<AppleEmoji key={`${keyPrefix}_${idx}`} emoji={g} className="mx-[0.03em]" />);
    } else {
      textBuf += g;
    }
  });

  if (textBuf) out.push(textBuf);
  return out.length === 1 ? out[0] : out;
}
