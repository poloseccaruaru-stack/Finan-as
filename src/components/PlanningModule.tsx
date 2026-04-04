import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  BookOpen, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Edit,
  Save,
  Info,
  Printer
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSunday, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Planning, Teacher, Class } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
}

const PREDEFINED_METHODOLOGIES = [
  'Aula Expositiva',
  'Debate/Discussão',
  'Atividade em Grupo',
  'Dinâmica de Grupo',
  'Teatro/Dramatização',
  'Uso de Recursos Visuais',
  'Atividade Lúdica',
  'Estudo de Caso',
  'Música/Louvor',
  'Trabalho Manual'
];

export default function PlanningModule({ user }: Props) {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    content: '',
    methodology: [] as string[]
  });

  const [showReportModal, setShowReportModal] = useState(false);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const classIds = user.classIds || [];
    const classesQuery = isAdmin
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('id', 'in', classIds.length > 0 ? classIds : ['none']));

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      const classesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      setClasses(classesData);
      if (classesData.length > 0 && !selectedClassId) {
        setSelectedClassId(classesData[0].id);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'classes');
      setLoading(false);
    });

    const planningQuery = isAdmin 
      ? collection(db, 'planning')
      : query(
          collection(db, 'planning'),
          where('teacherId', '==', user.id)
        );

    const unsubPlanning = onSnapshot(planningQuery, (snap) => {
      setPlannings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Planning)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'planning');
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubPlanning();
    };
  }, [user, isAdmin, selectedClassId]);

  const monthSundays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end }).filter(date => isSunday(date));
  }, [currentMonth]);

  const handleSavePlanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedClassId) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = plannings.find(p => p.date === dateStr && p.classId === selectedClassId);
      
      const planningData = {
        month: format(currentMonth, 'yyyy-MM'),
        classId: selectedClassId,
        teacherId: user.id,
        date: dateStr,
        content: form.content,
        methodology: form.methodology.join(', '),
        createdAt: new Date().toISOString()
      };

      if (existing) {
        await updateDoc(doc(db, 'planning', existing.id), planningData);
      } else {
        await addDoc(collection(db, 'planning'), planningData);
      }
      
      setShowForm(false);
      setForm({ content: '', methodology: [] });
      setSelectedDate(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'planning');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este planejamento?')) return;
    try {
      await deleteDoc(doc(db, 'planning', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'planning');
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium">Carregando planejamentos...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2">
          <button 
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-all print:hidden"
          >
            <BookOpen className="w-5 h-5" />
            Ver Relatório Mensal
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all print:hidden"
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-slate-500 uppercase">Turma:</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sundays List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Domingos do Mês
          </h3>
          <div className="space-y-2">
            {monthSundays.map(sunday => {
              const dateStr = format(sunday, 'yyyy-MM-dd');
              const hasPlanning = plannings.find(p => p.date === dateStr && p.classId === selectedClassId);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(sunday);
                    if (hasPlanning) {
                      setForm({ 
                        content: hasPlanning.content, 
                        methodology: hasPlanning.methodology.split(', ').filter(m => m.length > 0) 
                      });
                    } else {
                      setForm({ content: '', methodology: [] });
                    }
                    setShowForm(true);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left group",
                    isSameDay(selectedDate || new Date(0), sunday)
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : hasPlanning
                        ? "bg-white border-indigo-100 text-slate-900 hover:border-indigo-300"
                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold",
                      isSameDay(selectedDate || new Date(0), sunday) ? "bg-indigo-500" : "bg-slate-50 text-slate-500"
                    )}>
                      <span className="text-[10px] uppercase leading-none">{format(sunday, 'MMM', { locale: ptBR })}</span>
                      <span className="text-lg leading-none">{format(sunday, 'dd')}</span>
                    </div>
                    <div>
                      <p className="font-bold">{format(sunday, 'EEEE', { locale: ptBR })}</p>
                      <p className="text-xs opacity-70">
                        {hasPlanning ? 'Planejamento concluído' : 'Aguardando planejamento'}
                      </p>
                    </div>
                  </div>
                  {hasPlanning && <CheckCircle2 className={cn("w-5 h-5", isSameDay(selectedDate || new Date(0), sunday) ? "text-white" : "text-green-500")} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Planning Form/Details */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {showForm && selectedDate ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Planejamento da Aula</h3>
                    <p className="text-slate-500 font-medium">
                      {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - {classes.find(c => c.id === selectedClassId)?.name}
                    </p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <Plus className="w-6 h-6 text-slate-400 rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSavePlanning} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Conteúdo a ser ministrado</label>
                    <textarea
                      required
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="Descreva o tema e os principais pontos da lição..."
                      className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Metodologia (Múltipla Seleção)</label>
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_METHODOLOGIES.map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            const current = form.methodology;
                            const next = current.includes(method)
                              ? current.filter(m => m !== method)
                              : [...current, method];
                            setForm({ ...form, methodology: next });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold transition-all border",
                            form.methodology.includes(method)
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                          )}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Adicionar outra metodologia..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !form.methodology.includes(val)) {
                              setForm({ ...form, methodology: [...form.methodology, val] });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    {form.methodology.length > 0 && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Selecionadas:</p>
                        <div className="flex flex-wrap gap-2">
                          {form.methodology.map(m => (
                            <span key={m} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2">
                              {m}
                              <button 
                                type="button"
                                onClick={() => setForm({ ...form, methodology: form.methodology.filter(item => item !== m) })}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Plus className="w-3 h-3 rotate-45" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      Salvar Planejamento
                    </button>
                    {plannings.find(p => p.date === format(selectedDate, 'yyyy-MM-dd') && p.classId === selectedClassId) && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = plannings.find(p => p.date === format(selectedDate, 'yyyy-MM-dd') && p.classId === selectedClassId);
                          if (p) handleDelete(p.id);
                        }}
                        className="p-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200"
              >
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                  <BookOpen className="w-10 h-10 text-indigo-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Selecione um Domingo</h3>
                <p className="text-slate-500 max-w-xs">
                  Clique em um domingo no calendário ao lado para visualizar ou criar o planejamento da aula.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Planning History/Reports for the Month */}
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Relatório de Planejamentos do Mês</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Total:</span>
                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                  {plannings.filter(p => p.month === format(currentMonth, 'yyyy-MM') && p.classId === selectedClassId).length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {plannings
                .filter(p => p.month === format(currentMonth, 'yyyy-MM') && p.classId === selectedClassId)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(planning => (
                  <div key={planning.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600">
                          <span className="text-[10px] uppercase leading-none">{format(parseISO(planning.date), 'MMM', { locale: ptBR })}</span>
                          <span className="text-lg leading-none">{format(parseISO(planning.date), 'dd')}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{format(parseISO(planning.date), 'EEEE', { locale: ptBR })}</h4>
                          <p className="text-xs text-slate-500">Criado em {format(parseISO(planning.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setSelectedDate(parseISO(planning.date));
                            setForm({ 
                              content: planning.content, 
                              methodology: planning.methodology.split(', ').filter(m => m.length > 0) 
                            });
                            setShowForm(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(planning.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conteúdo</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{planning.content}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metodologia</p>
                        <div className="flex flex-wrap gap-1">
                          {planning.methodology.split(', ').map(m => (
                            <span key={m} className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded text-[10px] font-bold border border-slate-100">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {plannings.filter(p => p.month === format(currentMonth, 'yyyy-MM') && p.classId === selectedClassId).length === 0 && (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">Nenhum planejamento encontrado para este mês.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:p-0 print:bg-white">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:rounded-none"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
                <h3 className="text-xl font-bold text-slate-900">Relatório Mensal de Planejamento</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <Plus className="w-5 h-5 text-slate-500 rotate-45" />
                  </button>
                </div>
              </div>
              <div className="p-8 overflow-y-auto print:p-0">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Relatório de Planejamento</h2>
                  <p className="text-slate-500 font-bold">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })} - {classes.find(c => c.id === selectedClassId)?.name}
                  </p>
                </div>

                <div className="space-y-8">
                  {plannings
                    .filter(p => p.month === format(currentMonth, 'yyyy-MM') && p.classId === selectedClassId)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(planning => (
                      <div key={planning.id} className="border-b border-slate-100 pb-6 last:border-0">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                            {format(parseISO(planning.date), 'dd/MM/yyyy')}
                          </div>
                          <span className="font-bold text-slate-900 uppercase text-sm">
                            {format(parseISO(planning.date), 'EEEE', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conteúdo Ministrado</p>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{planning.content}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metodologias Utilizadas</p>
                            <div className="flex flex-wrap gap-1">
                              {planning.methodology.split(', ').map(m => (
                                <span key={m} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}
