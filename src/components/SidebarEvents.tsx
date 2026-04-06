import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit,
  where,
  Timestamp
} from 'firebase/firestore';
import { Calendar, Bell, Plus, X, Info, Clock } from 'lucide-react';
import { format, isToday, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarEvent, Teacher } from '../types';
import { cn, safeFormat } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
  compact?: boolean;
}

export default function SidebarEvents({ user, compact }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'event' as CalendarEvent['type']
  });

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const q = query(
      collection(db, 'events'),
      where('date', '>=', startOfDay(new Date()).toISOString()),
      orderBy('date', 'asc'),
      limit(compact ? 4 : 10)
    );

    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    return () => unsub();
  }, [compact]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events'), {
        title: newEvent.title || "",
        description: newEvent.description || "",
        date: newEvent.date || format(new Date(), 'yyyy-MM-dd'),
        type: newEvent.type || 'event',
        createdAt: new Date().toISOString()
      });
      setShowAddEvent(false);
      setNewEvent({ title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'event' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'events');
    }
  };

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Próximos Eventos</h3>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAddEvent(true)}
              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {events.length === 0 ? (
            <div className="col-span-full text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 font-medium">Nenhum evento próximo</p>
            </div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-indigo-200 hover:shadow-sm text-left group",
                  isToday(new Date(event.date)) ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 font-bold",
                  isToday(new Date(event.date)) ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"
                )}>
                  <span className="text-[8px] uppercase leading-none">{safeFormat(event.date, 'MMM', { locale: ptBR })}</span>
                  <span className="text-sm leading-none">{safeFormat(event.date, 'dd')}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {event.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">{event.type}</p>
                </div>
              </button>
            ))
          )}
        </div>

        <AnimatePresence>
          {showAddEvent && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Novo Evento</h3>
                  <button onClick={() => setShowAddEvent(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <form onSubmit={handleAddEvent} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                    <input
                      required
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                      <input
                        required
                        type="date"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                      <select
                        value={newEvent.type}
                        onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="event">Evento</option>
                        <option value="meeting">Reunião</option>
                        <option value="holiday">Feriado</option>
                        <option value="other">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                    <textarea
                      rows={3}
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    Criar Evento
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {selectedEvent && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-xl font-bold text-slate-900">Detalhes do Evento</h3>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                    <p className="text-lg font-bold text-slate-900">{selectedEvent.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                      <p className="text-sm font-medium text-slate-700">
                        {safeFormat(selectedEvent.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-600">
                        {selectedEvent.type}
                      </span>
                    </div>
                  </div>
                  {selectedEvent.description && (
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                      <p className="text-sm text-slate-600 leading-relaxed mt-1">
                        {selectedEvent.description}
                      </p>
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-100 w-80 shrink-0 hidden xl:flex">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900">Agenda & Eventos</h3>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAddEvent(true)}
            className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Daily Alert */}
        {events.some(e => isToday(new Date(e.date))) && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 animate-pulse">
            <Bell className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Alerta de Hoje</p>
              <p className="text-sm text-amber-700 font-medium">Você tem eventos programados para hoje!</p>
            </div>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhum evento próximo</p>
            </div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all hover:shadow-md group",
                  isToday(new Date(event.date)) 
                    ? "bg-indigo-50 border-indigo-100" 
                    : "bg-white border-slate-100 hover:border-indigo-200"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                    event.type === 'holiday' ? "bg-red-100 text-red-600" :
                    event.type === 'meeting' ? "bg-blue-100 text-blue-600" :
                    "bg-indigo-100 text-indigo-600"
                  )}>
                    {event.type}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {safeFormat(event.date, "dd 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {event.title}
                </h4>
                {event.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Novo Evento</h3>
                <button onClick={() => setShowAddEvent(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleAddEvent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                  <input
                    required
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <input
                      required
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <select
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="event">Evento</option>
                      <option value="meeting">Reunião</option>
                      <option value="holiday">Feriado</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <textarea
                    rows={3}
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Criar Evento
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Event Details Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-xl font-bold text-slate-900">Detalhes do Evento</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Título</label>
                  <p className="text-lg font-bold text-slate-900">{selectedEvent.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <p className="text-sm font-medium text-slate-700">
                      {safeFormat(selectedEvent.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-600">
                      {selectedEvent.type}
                    </span>
                  </div>
                </div>
                {selectedEvent.description && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                    <p className="text-sm text-slate-600 leading-relaxed mt-1">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
