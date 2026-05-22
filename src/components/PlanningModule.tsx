import { useState, useEffect, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  doc,
  deleteDoc,
  serverTimestamp
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
  Printer,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Pin
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
import { cn, safeFormat } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { suggestPlanning } from '../services/geminiService';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
  hasFullAccess?: boolean;
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

export default function PlanningModule({ user, selectedSchoolYear, hasFullAccess: propHasFullAccess }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Reschedule flow state
  const [rescheduleTarget, setRescheduleTarget] = useState<Planning | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleMonth, setRescheduleMonth] = useState<Date>(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const handlePinClass = async () => {
    if (!selectedClassId || !user.id) return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        pinnedClassId: selectedClassId,
        updatedAt: new Date().toISOString()
      });
      showAlert('Sucesso', 'Esta turma foi fixada como sua turma padrão!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  useEffect(() => {
    if (user.pinnedClassId && !selectedClassId) {
      setSelectedClassId(user.pinnedClassId);
    }
  }, [user.pinnedClassId]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    content: '',
    methodology: [] as string[]
  });

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    onConfirm?: (inputValue?: string) => void;
    isPassword?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ show: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: (inputValue?: string) => void, isPassword = false) => {
    setModalConfig({ show: true, title, message, type: 'confirm', onConfirm, isPassword });
  };

  const showAdminConfirm = (title: string, message: string, onConfirm: () => void) => {
    showConfirm(title, message, (password) => {
      if (password?.toUpperCase() === 'SISTEMA') {
        onConfirm();
      } else {
        showAlert('Senha Incorreta', 'Operação cancelada. A senha do administrador "SISTEMA" é obrigatória para esta ação.');
      }
    }, true);
  };

  const [showReportModal, setShowReportModal] = useState(false);

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator' || isAdmin;
  const hasFullAccess = propHasFullAccess ?? (
    isAdmin || 
    (user.permissions && user.permissions['planning'] === 'full') ||
    (!user.permissions && user.allowedTabs && user.allowedTabs.includes('planning')) ||
    (!user.permissions && !user.allowedTabs && (isAdmin || isCoordinator))
  );

  const filteredClasses = useMemo(() => {
    if (hasFullAccess) return classes;
    return classes.filter(c => 
      c.teacherIds?.includes(user.id) || 
      c.teacherId === user.id ||
      user.classIds?.includes(c.id)
    );
  }, [classes, hasFullAccess, user.id, user.classIds]);

  useEffect(() => {
    const classIds = user.classIds || [];
    const classesQuery = collection(db, 'classes');

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      const classesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      const yearClasses = classesData.filter(c => c.schoolYear === selectedSchoolYear);
      setClasses(yearClasses);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'classes');
      setLoading(false);
    });

    const planningQuery = collection(db, 'planning');

    const unsubPlanning = onSnapshot(planningQuery, (snap) => {
      setPlannings(snap.docs.map(d => {
        const data = d.data();
        // Handle serverTimestamp conversion for display
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
        return { id: d.id, ...data, createdAt } as Planning;
      }));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'planning');
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubPlanning();
    };
  }, [user, hasFullAccess, selectedClassId]);

  useEffect(() => {
    if (filteredClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(filteredClasses[0].id);
    } else if (selectedClassId && !filteredClasses.some(c => c.id === selectedClassId)) {
      // If the selected class is no longer in the filtered list (e.g. role change)
      setSelectedClassId(filteredClasses.length > 0 ? filteredClasses[0].id : '');
    }
  }, [filteredClasses, selectedClassId]);

  const monthSundays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end }).filter(date => isSunday(date));
  }, [currentMonth]);

  const handleAISuggest = async () => {
    if (!selectedDate || !selectedClassId) return;
    const className = filteredClasses.find(c => c.id === selectedClassId)?.name || "";
    const dateStr = safeFormat(selectedDate, 'dd/MM/yyyy');
    
    setSuggesting(true);
    try {
      const suggestion = await suggestPlanning(className, dateStr);
      setForm({
        content: suggestion.content,
        methodology: suggestion.methodology
      });
    } catch (error) {
      alert("Erro ao obter sugestão da IA. Verifique sua chave de API.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleSavePlanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedClassId) return;

    if (!auth.currentUser || !auth.currentUser.uid) {
      alert("Usuário não autenticado");
      return;
    }

    try {
      const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
      const existing = plannings.find(p => p.date === dateStr && p.classId === selectedClassId);
      
      const planningData = {
        month: safeFormat(currentMonth, 'yyyy-MM') || "",
        classId: selectedClassId || "",
        teacherId: auth.currentUser.uid,
        date: dateStr || "",
        content: form.content || "",
        methodology: form.methodology.join(', ') || "",
        updatedAt: serverTimestamp()
      };

      if (existing) {
        await updateDoc(doc(db, 'planning', existing.id), planningData);
      } else {
        await addDoc(collection(db, 'planning'), {
          ...planningData,
          createdAt: serverTimestamp()
        });
      }
      
      setShowForm(false);
      setForm({ content: '', methodology: [] });
      setSelectedDate(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'planning');
    }
  };

  const handleDelete = async (id: string) => {
    showAdminConfirm('Excluir Planejamento', 'Deseja realmente excluir este planejamento?', async () => {
      try {
        await deleteDoc(doc(db, 'planning', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'planning');
      }
    });
  };

  // Reschedule sequence calculator
  const rescheduleCascade = useMemo(() => {
    if (!rescheduleTarget || !rescheduleDate) return { updates: [], hasConflict: false };
    const dateStr = safeFormat(rescheduleDate, 'yyyy-MM-dd');
    
    // Filter plannings for the selected class
    const classPlannings = plannings.filter(p => p.classId === selectedClassId);
    
    // Others (excluding target) that might need to shift
    const others = classPlannings.filter(p => p.id !== rescheduleTarget.id);
    
    const updates: Array<{ id: string; planning: Planning; from: string; to: string }> = [
      { id: rescheduleTarget.id, planning: rescheduleTarget, from: rescheduleTarget.date, to: dateStr }
    ];
    
    let hasConflict = false;
    let currentCheck = dateStr;
    let loop = true;
    const maxIterations = 52; // Keep safe limit (up to a year) to avoid infinite loops
    let iter = 0;
    
    while (loop && iter < maxIterations) {
      iter++;
      const conflict = others.find(p => p.date === currentCheck);
      if (conflict) {
        hasConflict = true;
        const nextSun = parseISO(currentCheck);
        nextSun.setDate(nextSun.getDate() + 7);
        const nextSunStr = safeFormat(nextSun, 'yyyy-MM-dd');
        
        updates.push({
          id: conflict.id,
          planning: conflict,
          from: conflict.date,
          to: nextSunStr
        });
        currentCheck = nextSunStr;
      } else {
        loop = false;
      }
    }
    
    return { updates, hasConflict };
  }, [rescheduleTarget, rescheduleDate, plannings, selectedClassId]);

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    
    try {
      const { updates } = rescheduleCascade;
      
      // Update each planning sequentially
      for (const update of updates) {
        const parsedDate = parseISO(update.to);
        const monthStr = safeFormat(parsedDate, 'yyyy-MM') || "";
        
        await updateDoc(doc(db, 'planning', update.id), {
          date: update.to,
          month: monthStr,
          updatedAt: serverTimestamp()
        });
      }
      
      // Clear forms, states & close modals
      setSelectedDate(null);
      setShowForm(false);
      setShowRescheduleModal(false);
      setRescheduleTarget(null);
      setRescheduleDate(null);
      
      showAlert('Sucesso', 'Planejamento reagendado com sucesso.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'planning');
    }
  };

  const rescheduleSundays = useMemo(() => {
    const start = startOfMonth(rescheduleMonth);
    const end = endOfMonth(rescheduleMonth);
    return eachDayOfInterval({ start, end }).filter(date => isSunday(date));
  }, [rescheduleMonth]);

  return (
    <div className="space-y-6">
      {/* Header with Title and Expand Button */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Planejamento</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Gestão de Conteúdo e Metodologia</p>
          </div>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden space-y-6"
          >
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
              {safeFormat(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-500 uppercase">Turma:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
            >
              <option value="">Selecione uma turma...</option>
              {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClassId && (
            <button
              onClick={handlePinClass}
              className={cn(
                "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                user.pinnedClassId === selectedClassId 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50"
              )}
            >
              <Pin className={cn("w-3 h-3", user.pinnedClassId === selectedClassId ? "fill-current" : "")} />
              {user.pinnedClassId === selectedClassId ? "Turma Fixada" : "Fixar como Padrão"}
            </button>
          )}
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
              const dateStr = safeFormat(sunday, 'yyyy-MM-dd');
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
                      <span className="text-[10px] uppercase leading-none">{safeFormat(sunday, 'MMM', { locale: ptBR })}</span>
                      <span className="text-lg leading-none">{safeFormat(sunday, 'dd')}</span>
                    </div>
                    <div>
                      <p className="font-bold">{safeFormat(sunday, 'EEEE', { locale: ptBR })}</p>
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
                      {safeFormat(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - {filteredClasses.find(c => c.id === selectedClassId)?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAISuggest}
                      disabled={suggesting}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl font-bold hover:bg-amber-100 transition-all disabled:opacity-50"
                      title="Sugerir com Gemini"
                    >
                      {suggesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      <span className="hidden md:inline">Sugerir com IA</span>
                    </button>
                    <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full">
                      <Plus className="w-6 h-6 text-slate-400 rotate-45" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSavePlanning} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Conteúdo a ser ministrado</label>
                    <textarea
                      required
                      readOnly={!hasFullAccess}
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder={hasFullAccess ? "Descreva o tema e os principais pontos da lição..." : "Sem conteúdo registrado"}
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
                          disabled={!hasFullAccess}
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
                              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600",
                            !hasFullAccess && "opacity-80 cursor-default"
                          )}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                    {hasFullAccess && (
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
                    )}
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
                    {hasFullAccess ? (
                      <>
                        <button
                          type="submit"
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                          <Save className="w-5 h-5" />
                          Salvar Planejamento
                        </button>
                        {plannings.find(p => p.date === safeFormat(selectedDate, 'yyyy-MM-dd') && p.classId === selectedClassId) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const p = plannings.find(p => p.date === safeFormat(selectedDate, 'yyyy-MM-dd') && p.classId === selectedClassId);
                                if (p) {
                                  setRescheduleTarget(p);
                                  setRescheduleMonth(parseISO(p.date));
                                  setRescheduleDate(null);
                                  setShowRescheduleModal(true);
                                }
                              }}
                              className="px-4 py-4 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-2xl transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                              title="Reagendar Planejamento"
                            >
                              <CalendarIcon className="w-5 h-5 shrink-0" />
                              <span>Reagendar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const p = plannings.find(p => p.date === safeFormat(selectedDate, 'yyyy-MM-dd') && p.classId === selectedClassId);
                                if (p) handleDelete(p.id);
                              }}
                              className="p-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all"
                              title="Excluir Planejamento"
                            >
                              <Trash2 className="w-6 h-6 shrink-0" />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" />
                          Modo Somente Leitura
                        </p>
                      </div>
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
                  {plannings.filter(p => p.month === safeFormat(currentMonth, 'yyyy-MM') && p.classId === selectedClassId).length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {plannings
                .filter(p => p.month === safeFormat(currentMonth, 'yyyy-MM') && p.classId === selectedClassId)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(planning => (
                  <div key={planning.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600">
                          <span className="text-[10px] uppercase leading-none">{safeFormat(planning.date, 'MMM', { locale: ptBR })}</span>
                          <span className="text-lg leading-none">{safeFormat(planning.date, 'dd')}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{safeFormat(planning.date, 'EEEE', { locale: ptBR })}</h4>
                          <p className="text-xs text-slate-500">Criado em {safeFormat(planning.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                        {hasFullAccess && (
                          <button 
                            onClick={() => {
                              setRescheduleTarget(planning);
                              setRescheduleMonth(parseISO(planning.date));
                              setRescheduleDate(null);
                              setShowRescheduleModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Reagendar Planejamento"
                          >
                            <CalendarIcon className="w-5 h-5" />
                          </button>
                        )}
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
              {plannings.filter(p => p.month === safeFormat(currentMonth, 'yyyy-MM') && p.classId === selectedClassId).length === 0 && (
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
                    {safeFormat(currentMonth, 'MMMM yyyy', { locale: ptBR })} - {filteredClasses.find(c => c.id === selectedClassId)?.name}
                  </p>
                </div>

                <div className="space-y-8">
                  {plannings
                    .filter(p => p.month === safeFormat(currentMonth, 'yyyy-MM') && p.classId === selectedClassId)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(planning => (
                      <div key={planning.id} className="border-b border-slate-100 pb-6 last:border-0">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                            {safeFormat(planning.date, 'dd/MM/yyyy')}
                          </div>
                          <span className="font-bold text-slate-900 uppercase text-sm">
                            {safeFormat(planning.date, 'EEEE', { locale: ptBR })}
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
    </motion.div>
    )}
    </AnimatePresence>

      {/* Reschedule Planning Modal */}
      <AnimatePresence>
        {showRescheduleModal && rescheduleTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <CalendarIcon className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      Reagendar Planejamento
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                      Reorganização de cronograma semanal
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Target Planning Card Snapshot */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Planejamento selecionado:
                  </p>
                  <p className="font-bold text-slate-800 text-sm line-clamp-2">
                    {rescheduleTarget.content}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-150">
                      Data atual: {safeFormat(parseISO(rescheduleTarget.date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </div>

                {rescheduleDate === null ? (
                  /* Step 1: Selection of New Date */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Escolha a Nova Data (Domingos):
                      </p>
                    </div>

                    {/* Month Navigator */}
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <button
                        type="button"
                        onClick={() => setRescheduleMonth(subMonths(rescheduleMonth, 1))}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all border border-transparent"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider capitalize">
                        {safeFormat(rescheduleMonth, 'MMMM yyyy', { locale: ptBR })}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setRescheduleMonth(addMonths(rescheduleMonth, 1))}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all border border-transparent"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Sunday Selector List */}
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {rescheduleSundays.map((sunday) => {
                        const sDateStr = safeFormat(sunday, 'yyyy-MM-dd') || "";
                        const isTargetDate = sDateStr === rescheduleTarget.date;
                        const conflictingPlanning = plannings.find(
                          (p) => p.date === sDateStr && p.classId === selectedClassId && p.id !== rescheduleTarget.id
                        );

                        return (
                          <button
                            key={sDateStr}
                            type="button"
                            disabled={isTargetDate}
                            onClick={() => setRescheduleDate(sunday)}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              isTargetDate
                                ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                : conflictingPlanning
                                  ? "bg-amber-50/55 border-amber-100 text-slate-700 hover:bg-amber-50 hover:border-amber-300"
                                  : "bg-white border-slate-150 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/20"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs shrink-0",
                                  isTargetDate
                                    ? "bg-slate-200 text-slate-500"
                                    : conflictingPlanning
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-indigo-50 text-indigo-600"
                                )}
                              >
                                <span>{safeFormat(sunday, 'dd')}</span>
                                <span className="text-[8px] uppercase font-black leading-none">{safeFormat(sunday, 'MMM', { locale: ptBR })}</span>
                              </div>
                              <div>
                                <p className="font-bold text-sm">{safeFormat(sunday, 'EEEE', { locale: ptBR })}</p>
                                <p className="text-xs opacity-70">
                                  {isTargetDate
                                    ? "Data atual deste planejamento"
                                    : conflictingPlanning
                                      ? `Ocupado: ${conflictingPlanning.content.substring(0, 30)}...`
                                      : "Disponível"}
                                </p>
                              </div>
                            </div>

                            <div>
                              {isTargetDate ? (
                                <span className="text-[8px] font-black uppercase tracking-widest bg-slate-200 text-slate-500 px-2.5 py-1 rounded-lg">
                                  Atual
                                </span>
                              ) : conflictingPlanning ? (
                                <span className="text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg">
                                  Conflito
                                </span>
                              ) : (
                                <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                                  Livre
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Step 2: Safety Summary and Sequence Shift preview */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Resumo da Mudança:
                      </p>
                      <button
                        type="button"
                        onClick={() => setRescheduleDate(null)}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                      >
                        ← Escolher outra data
                      </button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            De (Data Antiga)
                          </p>
                          <p className="text-base font-black text-slate-600 mt-1">
                            {safeFormat(parseISO(rescheduleTarget.date), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                            Para (Nova Data)
                          </p>
                          <p className="text-base font-black text-indigo-600 mt-1">
                            {safeFormat(rescheduleDate, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {rescheduleCascade.hasConflict ? (
                      /* Warning / Conflict shift view */
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl">
                          <div className="flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">
                                Reorganização em Cadeia Necessária
                              </h4>
                              <p className="text-xs text-amber-700 font-medium mt-1">
                                Já existe um planejamento programado para esta data. Deseja reorganizar automaticamente os planejamentos seguintes?
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Shifts List preview */}
                        <div className="space-y-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            Planejamentos que serão deslocados:
                          </p>
                          <div className="space-y-2 max-h-[20vh] overflow-y-auto pr-1">
                            {rescheduleCascade.updates.map((upd, idx) => (
                              <div
                                key={upd.id}
                                className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 text-xs"
                              >
                                <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-xs shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">
                                    {upd.id === rescheduleTarget.id
                                      ? "Planejamento Atual"
                                      : `Deslocado: "${upd.planning.content.substring(0, 32)}..."`}
                                  </p>
                                  <p className="text-slate-500 font-medium mt-0.5">
                                    {safeFormat(parseISO(upd.from), 'dd/MM/yyyy')} →{" "}
                                    <span className="font-bold text-indigo-600">
                                      {safeFormat(parseISO(upd.to), 'dd/MM/yyyy')}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* No conflicts info card */
                      <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider font-bold">A Nova Data está Livre!</p>
                          <p className="text-xs text-emerald-700 font-medium mt-1">
                            Nenhum outro planejamento será deslocado. A data anterior ({safeFormat(parseISO(rescheduleTarget.date), 'dd/MM/yyyy')}) ficará totalmente livre para novos planejamentos.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl transition-all hover:bg-slate-100 hover:text-slate-800 text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                {rescheduleDate !== null && (
                  <button
                    type="button"
                    onClick={handleConfirmReschedule}
                    className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-2xl transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 text-xs uppercase tracking-widest"
                  >
                    {rescheduleCascade.hasConflict ? "Reorganizar Sequência" : "Confirmar Reagendamento"}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generic Confirmation/Alert Modal */}
      <AnimatePresence>
        {modalConfig.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                  modalConfig.type === 'confirm' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                )}>
                  {modalConfig.type === 'confirm' ? <BookOpen className="w-8 h-8" /> : <X className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{modalConfig.title}</h3>
                <p className="text-slate-500 font-medium mb-8">{modalConfig.message}</p>

                {modalConfig.isPassword && (
                  <div className="mb-6">
                    <input
                      id="planning-modal-password-input"
                      type="password"
                      placeholder="Digite a senha..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget.value;
                          if (modalConfig.onConfirm) modalConfig.onConfirm(input);
                          setModalConfig(prev => ({ ...prev, show: false }));
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  {modalConfig.type === 'confirm' && (
                    <button
                      onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (modalConfig.type === 'confirm' && modalConfig.onConfirm) {
                        const input = (document.getElementById('planning-modal-password-input') as HTMLInputElement)?.value;
                        modalConfig.onConfirm(input);
                      }
                      setModalConfig(prev => ({ ...prev, show: false }));
                    }}
                    className={cn(
                      "flex-1 py-3 text-white font-bold rounded-xl transition-all shadow-lg",
                      modalConfig.type === 'confirm' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    {modalConfig.type === 'confirm' ? 'Confirmar' : 'Entendido'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
