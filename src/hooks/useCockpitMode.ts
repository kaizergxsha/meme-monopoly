import { useEffect, useState } from 'react';

export interface ViewportMode {
  isCockpit: boolean;
  isCompactHeight: boolean;
  isTightHeight: boolean;
  width: number;
  height: number;
}

export function getViewportMode(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      isCockpit: true,
      isCompactHeight: false,
      isTightHeight: false,
      width: 1440,
      height: 900,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  // Десктоп и любой небольшой/масштабированный ноутбук в альбомной ориентации (>=780px и шире высоты)
  // остаются в едином двухпанельном кокпите, а не падают в мобильный док.
  const isCockpit = width >= 1024 || (width >= 780 && width > height * 1.02);
  return {
    isCockpit,
    isCompactHeight: height <= 760,
    isTightHeight: height <= 660,
    width,
    height,
  };
}

export function useCockpitMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => getViewportMode());

  useEffect(() => {
    const sync = () => {
      const next = getViewportMode();
      setMode((prev) =>
        prev.isCockpit === next.isCockpit &&
        prev.isCompactHeight === next.isCompactHeight &&
        prev.isTightHeight === next.isTightHeight &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next
      );
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return mode;
}
