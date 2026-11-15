import React, { useEffect, useRef, useState } from 'react';

interface AvatarCreatorModalProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onSaveAvatar: (dataUrl: string) => void;
}

const BG_PRESETS = [
  { id: 'sunset', label: 'Закат', c1: '#f97316', c2: '#db2777' },
  { id: 'cyber', label: 'Кибер', c1: '#4f46e5', c2: '#06b6d4' },
  { id: 'toxic', label: 'Токсик', c1: '#84cc16', c2: '#059669' },
  { id: 'gold', label: 'Мажор', c1: '#facc15', c2: '#d97706' },
  { id: 'crimson', label: 'Рейдер', c1: '#dc2626', c2: '#7f1d1d' },
  { id: 'void', label: 'Неон', c1: '#1e1b4b', c2: '#9333ea' },
  { id: 'ice', label: 'Лёд', c1: '#0ea5e9', c2: '#312e81' },
  { id: 'dark', label: 'Нуар', c1: '#27272a', c2: '#09090b' },
];

const FRAME_PRESETS = [
  { id: 'none', label: 'Без рамки', color: 'transparent', width: 0 },
  { id: 'white', label: 'Белая', color: '#ffffff', width: 6 },
  { id: 'gold', label: 'Золото', color: '#facc15', width: 7 },
  { id: 'neon', label: 'Кибер-лайм', color: '#8fce00', width: 7 },
  { id: 'rose', label: 'Хардкор', color: '#f43f5e', width: 7 },
];

const STICKERS = [
  '😎', '🤑', '🤠', '😈', '🦊', '🐯',
  '👾', '🤖', '💎', '👑', '🔥', '🚀',
  '🎭', '🐺', '🦄', '🧠', '💣', '⚡',
];

export const AvatarCreatorModal: React.FC<AvatarCreatorModalProps> = ({
  open,
  initialName = '',
  onClose,
  onSaveAvatar,
}) => {
  const [tab, setTab] = useState<'builder' | 'upload'>('builder');
  const [bgId, setBgId] = useState<string>(BG_PRESETS[0].id);
  const [frameId, setFrameId] = useState<string>('gold');
  const [sticker, setSticker] = useState<string>('😎');
  const [customText, setCustomText] = useState<string>('');
  const [uploadedImg, setUploadedImg] = useState<HTMLImageElement | null>(null);
  const [uploadZoom, setUploadZoom] = useState<number>(1);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setUploadError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 128;
    ctx.clearRect(0, 0, size, size);

    const bg = BG_PRESETS.find((b) => b.id === bgId) || BG_PRESETS[0];
    const frame = FRAME_PRESETS.find((f) => f.id === frameId) || FRAME_PRESETS[0];

    if (tab === 'upload' && uploadedImg) {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, size, size);
      const scale = Math.max(size / uploadedImg.width, size / uploadedImg.height) * uploadZoom;
      const drawW = uploadedImg.width * scale;
      const drawH = uploadedImg.height * scale;
      const dx = (size - drawW) / 2;
      const dy = (size - drawH) / 2;
      ctx.drawImage(uploadedImg, dx, dy, drawW, drawH);
    } else {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, bg.c1);
      grad.addColorStop(1, bg.c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Мягкий световой блик сверху
      const radial = ctx.createRadialGradient(size * 0.35, size * 0.25, 4, size * 0.5, size * 0.5, size * 0.75);
      radial.addColorStop(0, 'rgba(255,255,255,0.28)');
      radial.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);

      const textVal = customText.trim().slice(0, 3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (textVal) {
        ctx.font = `900 ${textVal.length === 1 ? 64 : textVal.length === 2 ? 50 : 38}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillText(textVal.toUpperCase(), size / 2 + 2, size / 2 + 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(textVal.toUpperCase(), size / 2, size / 2 + 2);
      } else {
        ctx.font = '66px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.fillText(sticker, size / 2, size / 2 + 4);
      }
    }

    if (frame.width > 0) {
      ctx.strokeStyle = frame.color;
      ctx.lineWidth = frame.width;
      ctx.strokeRect(frame.width / 2, frame.width / 2, size - frame.width, size - frame.width);
    }
  }, [open, tab, bgId, frameId, sticker, customText, uploadedImg, uploadZoom]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Выберите изображение (PNG, JPG, WebP или GIF)');
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setUploadedImg(img);
        setUploadZoom(1);
        setTab('upload');
      };
      img.onerror = () => {
        setUploadError('Не удалось прочитать картинку');
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tab === 'upload' && !uploadedImg) {
      setUploadError('Сначала выберите файл изображения');
      return;
    }
    let dataUrl = canvas.toDataURL('image/webp', 0.88);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/png');
    }
    onSaveAvatar(dataUrl);
    onClose();
  };

  const suggestedInitials = initialName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      data-testid="avatar-creator-modal"
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl bg-[#141724] border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.8)] p-4 sm:p-5 space-y-4 text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-amber-300">
              🎨 Студия своей аватарки
            </h3>
            <p className="text-[11px] text-slate-400">
              Собери уникальную аватарку или загрузи свой мем — бесплатно сохранится в профиле
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 font-black text-xs flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Переключатель вкладок */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="avatar-tab-builder"
            onClick={() => setTab('builder')}
            className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              tab === 'builder'
                ? 'bg-amber-400/20 border-amber-300/75 text-amber-200'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            🎨 Конструктор
          </button>
          <button
            type="button"
            data-testid="avatar-tab-upload"
            onClick={() => setTab('upload')}
            className={`py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
              tab === 'upload'
                ? 'bg-sky-500/25 border-sky-300/75 text-sky-200'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            📁 Загрузить фото / мем
          </button>
        </div>

        {/* Предпросмотр */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/30 border border-white/10 rounded-2xl p-3.5">
          <div className="relative shrink-0">
            <canvas
              ref={canvasRef}
              width={128}
              height={128}
              data-testid="avatar-creator-canvas"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/25 shadow-xl bg-black"
            />
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
            <div className="text-xs font-bold text-slate-200">
              Предпросмотр в профиле и на фишке
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Аватарка автоматически сжимается в 128×128 WebP и привязывается к твоему аккаунту.
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
              {FRAME_PRESETS.map((fr) => (
                <button
                  key={fr.id}
                  type="button"
                  onClick={() => setFrameId(fr.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition ${
                    frameId === fr.id
                      ? 'bg-white/20 border-white/60 text-white'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {fr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === 'builder' ? (
          <div className="space-y-3">
            {/* Фон */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Градиент фона
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {BG_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    onClick={() => setBgId(b.id)}
                    style={{ background: `linear-gradient(135deg, ${b.c1}, ${b.c2})` }}
                    className={`h-8 rounded-xl border transition cursor-pointer ${
                      bgId === b.id
                        ? 'ring-2 ring-white border-white scale-105'
                        : 'border-white/20 opacity-85 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Текст / Инициалы */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-300">
                  Свой текст / инициалы (вместо иконки)
                </label>
                {suggestedInitials && (
                  <button
                    type="button"
                    onClick={() => setCustomText(suggestedInitials)}
                    className="text-[10px] text-amber-300 hover:underline font-bold cursor-pointer"
                  >
                    Вставить «{suggestedInitials}»
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={3}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Напр. VIP, БОС, 777"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/35 border border-white/15 focus:border-amber-400 outline-none text-xs font-bold text-white uppercase"
                />
                {customText && (
                  <button
                    type="button"
                    onClick={() => setCustomText('')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                  >
                    Сброс
                  </button>
                )}
              </div>
            </div>

            {/* Стикеры */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Или выбери иконку / стикер
              </label>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                {STICKERS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setCustomText('');
                      setSticker(st);
                    }}
                    className={`h-9 rounded-xl text-lg flex items-center justify-center border transition cursor-pointer ${
                      !customText.trim() && sticker === st
                        ? 'bg-amber-400/25 border-amber-300/80 scale-105'
                        : 'bg-white/[0.05] border-white/10 hover:bg-white/15'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              data-testid="avatar-file-input"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-xl border-2 border-dashed border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-xs font-extrabold transition cursor-pointer"
            >
              📁 {uploadedImg ? 'Выбрать другую картинку' : 'Выбрать фото или мем с устройства'}
            </button>

            {uploadedImg && (
              <div className="space-y-1.5 bg-white/[0.04] border border-white/10 rounded-xl p-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>Масштаб (Zoom)</span>
                  <span className="tabular-nums text-sky-300">{uploadZoom.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2.6}
                  step={0.1}
                  value={uploadZoom}
                  onChange={(e) => setUploadZoom(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            )}

            {uploadError && (
              <div className="text-xs font-bold text-rose-300 bg-rose-500/15 border border-rose-400/40 rounded-xl px-3 py-2">
                ⚠️ {uploadError}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs cursor-pointer transition"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="avatar-save-btn"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black text-xs cursor-pointer transition shadow-lg"
          >
            ✅ Сохранить аватарку
          </button>
        </div>
      </div>
    </div>
  );
};
