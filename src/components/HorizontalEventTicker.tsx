import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeFormat } from '../lib/utils';
import { Calendar } from 'lucide-react';
import { CalendarEvent, DashboardConfig } from '../types';

interface Props {
  config: DashboardConfig | null;
}

export default function HorizontalEventTicker({ config }: Props) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, 'calendarEvents'), (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents'));

    return () => unsubEvents();
  }, []);

  const activeEvents = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return calendarEvents.filter(event => {
      const eventDateStr = event.date;
      return todayStr <= eventDateStr;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarEvents]);

  if (activeEvents.length === 0) return null;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className={cn(
      "w-full bg-slate-900 text-white overflow-hidden py-2 px-4 flex items-center gap-6 shadow-lg",
      config?.eventBarPosition === 'top' ? "rounded-2xl" : "fixed bottom-0 left-0 right-0 z-[100] h-12"
    )}>
      <div className="flex items-center gap-2 shrink-0">
        <Calendar className="w-4 h-4 text-amber-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Próximos Eventos:</span>
      </div>
      <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-6">
        {activeEvents.map(event => {
          const isToday = event.date === todayStr;
          return (
            <div 
              key={event.id} 
              className={cn(
                "flex items-center gap-2 whitespace-nowrap px-3 py-1 rounded-lg border border-white/10 transition-all",
                isToday ? "bg-rose-500/20 border-rose-500/50 text-rose-100 animate-pulse-slow shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "text-slate-300"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                isToday ? "bg-rose-500 animate-blink-fast shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-slate-500"
              )} />
              <span className="text-xs font-black uppercase tracking-tight">{event.title}</span>
              <span className="text-[10px] font-bold text-slate-400">
                {safeFormat(event.date, "dd 'de' MMM", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
