import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  query,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { 
  Book, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  ChevronRight,
  GripVertical,
  FileText,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Calendar as CalendarIcon,
  Printer,
  Lock,
  Unlock
} from 'lucide-react';
import { Regimento, Teacher, CalendarEvent, SchoolYearConfig } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
  subTab: 'regimento' | 'calendar' | 'system';
}

export default function AdminModule({ user, subTab }: Props) {
  const [regimentos, setRegimentos] = useState<Regimento[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYearConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [activeCalendarType, setActiveCalendarType] = useState<'ebd' | 'church' | 'convention'>('ebd');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', order: 0 });
  const [calendarForm, setCalendarForm] = useState({ title: '', date: '', type: 'event' as any, description: '' });
  const [schoolYearForm, setSchoolYearForm] = useState({ startDate: '', endDate: '' });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isAdmin = user.role === 'admin';

  const COLLECTIONS = [
    'users', 'students', 'classes', 'attendance', 'regimento', 
    'projects', 'transactions', 'budgets', 'planning', 'justificationOptions'
  ];

  const handleBackup = async () => {
    if (!confirm('Deseja gerar um arquivo de backup com todos os dados do sistema?')) return;
    setIsBackingUp(true);
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const collName of COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, collName));
          backupData[collName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn(`Could not backup collection ${collName}:`, e);
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_ebd_completo_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('ATENÇÃO: A restauração irá sobrescrever os dados existentes com os dados do arquivo. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          for (const collName of COLLECTIONS) {
            if (data[collName] && Array.isArray(data[collName])) {
              // Clear existing collection
              const existingSnap = await getDocs(collection(db, collName));
              for (const docSnap of existingSnap.docs) {
                await deleteDoc(doc(db, collName, docSnap.id));
              }

              // Restore from backup
              for (const item of data[collName]) {
                const { id, ...docData } = item;
                await setDoc(doc(db, collName, id), docData);
              }
            }
          }
          alert('Dados restaurados com sucesso!');
        } catch (err) {
          alert('Erro ao processar arquivo de backup.');
        } finally {
          setIsRestoring(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      alert('Erro ao ler arquivo.');
      setIsRestoring(false);
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (subTab === 'regimento') {
      const q = query(collection(db, 'regimento'), orderBy('order', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        setRegimentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Regimento)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'regimento'));
      return () => unsub();
    }
    if (subTab === 'calendar') {
      const unsubEvents = onSnapshot(collection(db, 'calendarEvents'), (snap) => {
        setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents'));
      return () => unsubEvents();
    }
    if (subTab === 'system') {
      const unsubYear = onSnapshot(doc(db, 'config', 'schoolYear'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SchoolYearConfig;
          setSchoolYear(data);
          setSchoolYearForm({ startDate: data.startDate, endDate: data.endDate });
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'config/schoolYear'));
      return () => unsubYear();
    }
  }, [subTab]);

  const handleSaveSchoolYear = async () => {
    try {
      await setDoc(doc(db, 'config', 'schoolYear'), {
        startDate: schoolYearForm.startDate,
        endDate: schoolYearForm.endDate,
        isFixed: true,
        updatedAt: new Date().toISOString()
      });
      alert('Ano letivo fixado com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'config/schoolYear');
    }
  };

  const handleSaveCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventData = {
        ...calendarForm,
        calendarType: activeCalendarType,
        createdAt: new Date().toISOString()
      };

      if (editingCalendarId) {
        await updateDoc(doc(db, 'calendarEvents', editingCalendarId), eventData);
      } else {
        await addDoc(collection(db, 'calendarEvents'), eventData);
      }
      setShowCalendarForm(false);
      setEditingCalendarId(null);
      setCalendarForm({ title: '', date: '', type: 'event', description: '' });
    } catch (err) {
      handleFirestoreError(err, editingCalendarId ? OperationType.UPDATE : OperationType.CREATE, 'calendarEvents');
    }
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    if (!confirm('Deseja excluir este evento?')) return;
    try {
      await deleteDoc(doc(db, 'calendarEvents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'calendarEvents');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'regimento', editingId), form);
      } else {
        await addDoc(collection(db, 'regimento'), {
          ...form,
          order: regimentos.length + 1
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', order: 0 });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'regimento');
    }
  };

  const handleEdit = (reg: Regimento) => {
    setForm({ title: reg.title, content: reg.content, order: reg.order });
    setEditingId(reg.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este capítulo?')) return;
    try {
      await deleteDoc(doc(db, 'regimento', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'regimento');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          {subTab === 'regimento' ? 'Regimento Interno EBD' : 
           subTab === 'calendar' ? 'Calendário Escolar' : 'Configurações do Sistema'}
        </h2>
        {isAdmin && subTab === 'regimento' && (
          <button
            onClick={() => {
              setForm({ title: '', content: '', order: regimentos.length + 1 });
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Novo Capítulo
          </button>
        )}
      </div>

      {subTab === 'system' && isAdmin && (
        <div className="space-y-6">
          {/* School Year Config */}
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Configuração do Ano Letivo</h3>
                <p className="text-sm text-slate-500">Defina as datas de início e término do ano letivo atual.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                <input
                  type="date"
                  value={schoolYearForm.startDate}
                  onChange={(e) => setSchoolYearForm({ ...schoolYearForm, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data de Término</label>
                <input
                  type="date"
                  value={schoolYearForm.endDate}
                  onChange={(e) => setSchoolYearForm({ ...schoolYearForm, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSchoolYear}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              {schoolYear?.isFixed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              Fixar Ano Letivo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Backup de Dados</h3>
                <p className="text-sm text-slate-500">Baixe todos os dados do sistema em um arquivo JSON.</p>
              </div>
            </div>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {isBackingUp ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              Fazer Backup Agora
            </button>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Restaurar Dados</h3>
                <p className="text-sm text-slate-500">Importe dados a partir de um arquivo de backup anterior.</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                disabled={isRestoring}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all">
                {isRestoring ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                Selecionar Arquivo e Restaurar
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>Aviso: Esta ação é irreversível e substituirá os dados atuais pelos dados do arquivo.</p>
            </div>
          </div>
        </div>
      </div>
      )}
      {subTab === 'calendar' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveCalendarType('ebd')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'ebd' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário EBD
            </button>
            <button 
              onClick={() => setActiveCalendarType('church')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'church' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário Igreja
            </button>
            <button 
              onClick={() => setActiveCalendarType('convention')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'convention' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário Convenção
            </button>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 capitalize">
              {activeCalendarType === 'ebd' ? 'Eventos EBD' : activeCalendarType === 'church' ? 'Eventos da Igreja' : 'Eventos da Convenção'}
            </h3>
            {isAdmin && (
              <button
                onClick={() => {
                  setCalendarForm({ title: '', date: '', type: 'event', description: '' });
                  setEditingCalendarId(null);
                  setShowCalendarForm(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                Cadastrar Evento
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {calendarEvents
              .filter(e => e.calendarType === activeCalendarType)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map(event => (
                <div key={event.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3 group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600">
                        <span className="text-[10px] uppercase leading-none">{format(parseISO(event.date), 'MMM', { locale: ptBR })}</span>
                        <span className="text-lg leading-none">{format(parseISO(event.date), 'dd')}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{event.title}</h4>
                        <p className="text-xs text-slate-500">{format(parseISO(event.date), 'EEEE', { locale: ptBR })}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setCalendarForm({ title: event.title, date: event.date, type: event.type, description: event.description || '' });
                            setEditingCalendarId(event.id);
                            setShowCalendarForm(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCalendarEvent(event.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {event.description && <p className="text-sm text-slate-600 line-clamp-2">{event.description}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Calendar Form Modal */}
      <AnimatePresence>
        {showCalendarForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingCalendarId ? 'Editar Evento' : 'Novo Evento'}
                </h3>
                <button onClick={() => setShowCalendarForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveCalendarEvent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Evento</label>
                  <input
                    required
                    type="text"
                    value={calendarForm.title}
                    onChange={(e) => setCalendarForm({ ...calendarForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <input
                      required
                      type="date"
                      value={calendarForm.date}
                      onChange={(e) => setCalendarForm({ ...calendarForm, date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <select
                      value={calendarForm.type}
                      onChange={(e) => setCalendarForm({ ...calendarForm, type: e.target.value as any })}
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição (Opcional)</label>
                  <textarea
                    rows={3}
                    value={calendarForm.description}
                    onChange={(e) => setCalendarForm({ ...calendarForm, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingCalendarId ? 'Atualizar Evento' : 'Salvar Evento'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {subTab === 'regimento' && (
        <div className="grid grid-cols-1 gap-4">
          {regimentos.map((reg) => (
            <div key={reg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
              <div className="p-6 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                      {reg.order}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{reg.title}</h3>
                  </div>
                  <div className="prose prose-slate max-w-none text-slate-600 text-sm whitespace-pre-wrap">
                    {reg.content}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleEdit(reg)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(reg.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Regimento Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Editar Capítulo' : 'Novo Capítulo'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Título do Capítulo</label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ordem</label>
                    <input
                      required
                      type="number"
                      value={form.order}
                      onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo</label>
                  <textarea
                    required
                    rows={12}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingId ? 'Atualizar Capítulo' : 'Salvar Capítulo'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
