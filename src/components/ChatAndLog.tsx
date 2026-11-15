import React, { useEffect, useRef, useState } from 'react';
import { txt } from '../../shared/rules.ts';
import { GameLogEntry } from '../../shared/types.ts';

interface ChatAndLogProps {
  logs: GameLogEntry[];
  censored: boolean;
  onSendChat: (msg: string) => void;
}

export const ChatAndLog: React.FC<ChatAndLogProps> = ({ logs, censored, onSendChat }) => {
  const [filter, setFilter] = useState<'ALL' | 'CHAT' | 'DICE'>('ALL');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'CHAT') return l.type === 'CHAT' || l.type === 'TAUNT';
    if (filter === 'DICE') return l.type === 'DICE';
    return true;
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredLogs.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendChat(draft);
    setDraft('');
  };

  return (
    <aside className="w-[265px] xl:w-[295px] shrink-0 h-full bg-slate-900/95 border-l border-slate-800 flex flex-col p-2.5 overflow-hidden">
      {/* Переключатель вкладок */}
      <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 mb-2">
        {[
          { id: 'ALL' as const, label: '📜 Всё' },
          { id: 'CHAT' as const, label: '💬 Чат' },
          { id: 'DICE' as const, label: '🎲 Броски' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              filter === tab.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Лента событий и сообщений */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
        {filteredLogs.map((entry) => {
          const message = txt(entry.text, entry.cleanText, censored);
          const timeStr = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

          if (entry.type === 'CHAT' || entry.type === 'TAUNT') {
            return (
              <div
                key={entry.id}
                className={`rounded-xl px-2.5 py-1.5 border ${
                  entry.type === 'TAUNT'
                    ? 'bg-amber-500/15 border-amber-500/40'
                    : 'bg-slate-800/90 border-slate-700/70'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className="font-extrabold text-[11px]"
                    style={{ color: entry.playerColor || '#fbbf24' }}
                  >
                    {entry.playerName || 'Игрок'}
                  </span>
                  <span className="text-[9px] text-slate-500">{timeStr}</span>
                </div>
                <p className="text-slate-100 break-words leading-snug">{message}</p>
              </div>
            );
          }

          const typeColor =
            entry.type === 'DICE'
              ? 'border-l-indigo-400 text-indigo-100 bg-indigo-950/30'
              : entry.type === 'RENT'
              ? 'border-l-rose-400 text-rose-100 bg-rose-950/25'
              : entry.type === 'BUY' || entry.type === 'AUCTION'
              ? 'border-l-emerald-400 text-emerald-100 bg-emerald-950/25'
              : entry.type === 'BANKRUPT'
              ? 'border-l-red-500 text-red-200 bg-red-950/40 font-bold'
              : 'border-l-slate-500 text-slate-300 bg-slate-950/40';

          return (
            <div
              key={entry.id}
              className={`rounded-r-lg border-l-2 px-2 py-1 text-[11px] leading-snug ${typeColor}`}
            >
              <span className="text-[9px] text-slate-500 mr-1.5">{timeStr}</span>
              <span>{message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода чата */}
      <form onSubmit={submit} className="mt-2 pt-2 border-t border-slate-800 flex gap-1.5">
        <input
          type="text"
          maxLength={240}
          placeholder="Написать в чат..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-400 outline-none rounded-xl px-2.5 py-1.5 text-xs text-white"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
        >
          ➤
        </button>
      </form>
    </aside>
  );
};
