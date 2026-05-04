import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { 
  FileText, 
  Search,
  Calendar,
  Printer,
  Users,
  Briefcase,
  DollarSign,
  BookOpen,
  Filter,
  Download,
  PlusCircle,
  X,
  Trash2,
  Cake,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { 
  Student, 
  Teacher, 
  Attendance, 
  Planning, 
  Project, 
  Transaction,
  Class,
  ManualReport,
  StudentReport,
  TeacherReport,
  SavedAISearch
} from '../types';
import { cn, safeFormat } from '../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
  hasFullAccess?: boolean;
}

type ReportType = 'students' | 'attendance' | 'planning' | 'finance' | 'projects' | 'teachers' | 'individual_students' | 'individual_teachers' | 'birthdays' | 'ai_searches';

export default function ReportModule({ user, selectedSchoolYear, hasFullAccess: propHasFullAccess }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportType>('students');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'ALL' | 'EM ANDAMENTO' | 'FINALIZADO'>('ALL');
  const [financeStatusFilter, setFinanceStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'with-absences' | 'no-absences'>('all');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [manualReports, setManualReports] = useState<ManualReport[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [teacherReports, setTeacherReports] = useState<TeacherReport[]>([]);
  const [savedAISearches, setSavedAISearches] = useState<SavedAISearch[]>([]);
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
  const [showManualReportForm, setShowManualReportForm] = useState(false);
  const [manualReportForm, setManualReportForm] = useState({
    title: '',
    content: '',
    date: safeFormat(new Date(), 'yyyy-MM-dd') || ""
  });

  const [loading, setLoading] = useState(true);

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator' || isAdmin;
  const hasFullAccess = propHasFullAccess ?? (
    isAdmin || 
    (user.permissions && user.permissions['reports'] === 'full') ||
    (!user.permissions && user.allowedTabs && user.allowedTabs.includes('reports')) ||
    (!user.permissions && !user.allowedTabs && (isAdmin || isCoordinator))
  );

  const filteredClassesList = useMemo(() => {
    const yearClasses = classes.filter(c => c.schoolYear === selectedSchoolYear);
    if (hasFullAccess) return yearClasses;
    return yearClasses.filter(c => 
      c.teacherIds?.includes(user.id) || 
      c.teacherId === user.id ||
      user.classIds?.includes(c.id)
    );
  }, [classes, selectedSchoolYear, hasFullAccess, user.id, user.classIds]);

  useEffect(() => {
    const classIds = (user.classIds && user.classIds.length > 0) ? user.classIds : ['none'];

    const studentsQuery = collection(db, 'students');
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'students');
      setLoading(false);
    });

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    });

    const attendanceQuery = collection(db, 'attendance');
    const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    });

    const planningQuery = collection(db, 'planning');
    const unsubPlanning = onSnapshot(planningQuery, (snap) => {
      setPlannings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Planning)));
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    });

    const unsubFinance = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const classesQuery = collection(db, 'classes');
    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    const unsubManualReports = onSnapshot(collection(db, 'manual_reports'), (snap) => {
      setManualReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualReport)));
    });

    const unsubStudentReports = onSnapshot(collection(db, 'student_reports'), (snap) => {
      setStudentReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentReport)));
    });

    const unsubTeacherReports = onSnapshot(collection(db, 'teacher_reports'), (snap) => {
      setTeacherReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherReport)));
    });

    const unsubSavedAISearches = onSnapshot(collection(db, 'saved_ai_searches'), (snap) => {
      setSavedAISearches(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedAISearch)));
    });

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubAttendance();
      unsubPlanning();
      unsubProjects();
      unsubFinance();
      unsubClasses();
      unsubManualReports();
      unsubStudentReports();
      unsubTeacherReports();
      unsubSavedAISearches();
    };
  }, [user, hasFullAccess, selectedSchoolYear]);

  const filteredData = useMemo(() => {
    const filterByDate = (dateStr: string) => {
      if (!dateRange.start || !dateRange.end || !dateStr) return true;
      try {
        const date = parseISO(dateStr);
        const start = startOfDay(parseISO(dateRange.start));
        const end = endOfDay(parseISO(dateRange.end));
        if (!isValid(date) || !isValid(start) || !isValid(end)) return true;
        return isWithinInterval(date, { start, end });
      } catch (e) {
        return true;
      }
    };

    switch (activeTab) {
      case 'students':
        return students.filter(s => s.schoolYear === selectedSchoolYear && s.name.toLowerCase().includes(searchTerm.toLowerCase()));
      case 'teachers':
        return teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
      case 'attendance':
        return attendances.filter(a => {
          const cls = classes.find(c => c.id === a.classId);
          const matchesYear = cls?.schoolYear === selectedSchoolYear;
          const matchesClass = selectedClassIds.length === 0 || selectedClassIds.includes(a.classId);
          const matchesDate = filterByDate(a.date);
          const matchesStatus = attendanceStatusFilter === 'all' || 
                                (attendanceStatusFilter === 'with-absences' ? a.absentStudentIds.length > 0 : a.absentStudentIds.length === 0);
          return matchesYear && matchesClass && matchesDate && matchesStatus;
        });
      case 'planning':
        return plannings.filter(p => {
          const cls = classes.find(c => c.id === p.classId);
          const matchesYear = cls?.schoolYear === selectedSchoolYear;
          return matchesYear && filterByDate(p.date);
        });
      case 'projects':
        return projects.filter(p => p.schoolYear === selectedSchoolYear && filterByDate(p.startDate) && (projectStatusFilter === 'ALL' || p.status === projectStatusFilter));
      case 'finance':
        return transactions.filter(t => {
          const matchesDate = filterByDate(t.date);
          const matchesStatus = financeStatusFilter === 'all' || t.status === financeStatusFilter;
          return matchesDate && matchesStatus;
        });
      case 'individual_students':
        return studentReports.filter(r => {
          const student = students.find(s => s.id === r.studentId);
          const matchesSearch = student?.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.content.toLowerCase().includes(searchTerm.toLowerCase());
          return filterByDate(r.date) && matchesSearch;
        });
      case 'individual_teachers':
        return teacherReports.filter(r => {
          const teacher = teachers.find(t => t.id === r.targetTeacherId);
          const matchesSearch = teacher?.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.content.toLowerCase().includes(searchTerm.toLowerCase());
          return filterByDate(r.date) && matchesSearch;
        });
      case 'birthdays':
        const allPeople = [
          ...students.map(s => ({ ...s, type: 'Aluno', className: classes.find(c => c.id === s.classId)?.name || 'Sem Turma' })),
          ...teachers.map(t => ({ ...t, type: 'Professor', className: 'Administração/Docente', birthDate: (t as any).birthDate || '' }))
        ].filter(p => p.birthDate);
        return allPeople.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => {
          try {
            const dateA = parseISO(a.birthDate);
            const dateB = parseISO(b.birthDate);
            if (!isValid(dateA) || !isValid(dateB)) return 0;
            if (dateA.getMonth() !== dateB.getMonth()) return dateA.getMonth() - dateB.getMonth();
            return dateA.getDate() - dateB.getDate();
          } catch (e) {
            return 0;
          }
        });
      case 'ai_searches':
        return savedAISearches
          .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()) || (s.comments || '').toLowerCase().includes(searchTerm.toLowerCase()))
          .filter(s => filterByDate(s.date))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      default:
        return [];
    }
  }, [activeTab, students, teachers, attendances, plannings, projects, transactions, studentReports, teacherReports, savedAISearches, searchTerm, dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'manual_reports'), {
        title: manualReportForm.title || "",
        content: manualReportForm.content || "",
        date: manualReportForm.date || safeFormat(new Date(), 'yyyy-MM-dd') || "",
        createdAt: new Date().toISOString()
      });
      setShowManualReportForm(false);
      setManualReportForm({ title: '', content: '', date: safeFormat(new Date(), 'yyyy-MM-dd') || "" });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'manual_reports');
    }
  };

  const handleDeleteManualReport = async (id: string) => {
    showAdminConfirm('Excluir Relatório', 'Deseja realmente excluir este relatório?', async () => {
      try {
        await deleteDoc(doc(db, 'manual_reports', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `manual_reports/${id}`);
      }
    });
  };

  const tabs: { id: ReportType, label: string, icon: any }[] = [
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'individual_students', label: 'Relatórios Alunos', icon: FileText },
    { id: 'teachers', label: 'Professores', icon: User },
    { id: 'individual_teachers', label: 'Relatórios Prof.', icon: FileText },
    { id: 'attendance', label: 'Frequência', icon: Calendar },
    { id: 'birthdays', label: 'Aniversariantes', icon: Cake },
    { id: 'planning', label: 'Planejamento', icon: BookOpen },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'projects', label: 'Projetos', icon: Briefcase },
    { id: 'ai_searches', label: 'Pesquisas IA', icon: Sparkles },
  ];

  return (
    <div className="space-y-6 print:p-0">
      {/* Header with Title and Expand Button */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Central de Relatórios</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Análise e Impressão de Dados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowManualReportForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="hidden md:inline">Novo Relatório Manual</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm"
          >
            <Printer className="w-5 h-5" />
            <span className="hidden md:inline">Imprimir</span>
          </button>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
          </button>
        </div>
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
          <p className="text-slate-500 font-medium">Carregando relatórios...</p>
        </div>
      ) : (
        <>
          {/* Filters - Hidden on print */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 print:hidden">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Relatório</label>
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                    activeTab === tab.id 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-slate-400 font-bold">até</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Class Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por Turmas</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedClassIds(filteredClassesList.map(c => c.id))}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
              >
                Selecionar Todas
              </button>
              <button 
                onClick={() => setSelectedClassIds([])}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-500"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
            {filteredClassesList.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedClassIds(prev => 
                    prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                  );
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold transition-all border",
                  selectedClassIds.includes(c.id)
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        <div className="p-8 space-y-8">
          {/* Print Header */}
          <div className="hidden print:block text-center border-bottom-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl font-black uppercase">Relatório do Sistema - EBD</h1>
            <p className="text-sm font-bold text-slate-500">
              Tipo: {tabs.find(t => t.id === activeTab)?.label} | 
              Período: {dateRange.start ? safeFormat(dateRange.start, 'dd/MM/yyyy') : 'Início'} - {dateRange.end ? safeFormat(dateRange.end, 'dd/MM/yyyy') : 'Fim'}
            </p>
          </div>

          {activeTab === 'students' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Nome</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Data Nasc.</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Telefone</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase text-right">Frequência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filteredData as Student[]).map(s => (
                  <tr key={s.id}>
                    <td className="py-4 text-sm font-bold text-slate-900">{s.name}</td>
                    <td className="py-4 text-sm text-slate-500">{safeFormat(s.birthDate, 'dd/MM/yyyy')}</td>
                    <td className="py-4 text-sm text-slate-500">{s.phone || '-'}</td>
                    <td className="py-4 text-sm font-black text-right text-indigo-600">{s.attendancePercentage?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'teachers' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Nome</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Email</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Contato</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filteredData as Teacher[]).map(t => (
                  <tr key={t.id}>
                    <td className="py-4 text-sm font-bold text-slate-900">{t.name}</td>
                    <td className="py-4 text-sm text-slate-500">{t.email}</td>
                    <td className="py-4 text-sm text-slate-500">{t.contact}</td>
                    <td className="py-4 text-sm font-bold text-indigo-600 uppercase">{t.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={() => setAttendanceStatusFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    attendanceStatusFilter === 'all' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Todas
                </button>
                <button
                  onClick={() => setAttendanceStatusFilter('with-absences')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    attendanceStatusFilter === 'with-absences' ? "bg-red-600 text-white shadow-lg shadow-red-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Com Faltas
                </button>
                <button
                  onClick={() => setAttendanceStatusFilter('no-absences')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    attendanceStatusFilter === 'no-absences' ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  100% Presença
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-100">
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Turma</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Conteúdo</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-center">Pres.</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-center">Aus.</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(filteredData as Attendance[]).map(a => {
                      const cls = classes.find(c => c.id === a.classId);
                      const total = a.presentStudentIds.length + a.absentStudentIds.length;
                      const percentage = total > 0 ? (a.presentStudentIds.length / total) * 100 : 0;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-xs font-bold text-slate-900">{safeFormat(a.date, 'dd/MM/yyyy')}</td>
                          <td className="py-3 text-xs text-slate-600 font-medium">{cls?.name || '---'}</td>
                          <td className="py-3 text-xs text-slate-500 max-w-xs truncate" title={a.contentGiven}>{a.contentGiven || '---'}</td>
                          <td className="py-3 text-xs text-center font-bold text-green-600">{a.presentStudentIds.length}</td>
                          <td className="py-3 text-xs text-center font-bold text-red-600">{a.absentStudentIds.length}</td>
                          <td className="py-3 text-xs text-right font-black text-indigo-600">{percentage.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={() => setFinanceStatusFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    financeStatusFilter === 'all' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFinanceStatusFilter('paid')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    financeStatusFilter === 'paid' ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Pagas
                </button>
                <button
                  onClick={() => setFinanceStatusFilter('pending')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    financeStatusFilter === 'pending' ? "bg-amber-600 text-white shadow-lg shadow-amber-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Pendentes
                </button>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100">
                    <th className="py-4 text-xs font-black text-slate-400 uppercase">Data</th>
                    <th className="py-4 text-xs font-black text-slate-400 uppercase">Descrição</th>
                    <th className="py-4 text-xs font-black text-slate-400 uppercase">Categoria</th>
                    <th className="py-4 text-xs font-black text-slate-400 uppercase text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(filteredData as Transaction[]).map(t => (
                    <tr key={t.id}>
                      <td className="py-4 text-sm text-slate-500">{safeFormat(t.date, 'dd/MM/yyyy')}</td>
                      <td className="py-4 text-sm font-bold text-slate-900">
                        {t.description}
                        <span className={cn(
                          "ml-2 text-[8px] font-black px-1 py-0.5 rounded uppercase",
                          t.status === 'paid' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-slate-500">{t.category}</td>
                      <td className={cn(
                        "py-4 text-sm font-black text-right",
                        t.type === 'income' ? "text-green-600" : "text-red-600"
                      )}>
                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={() => setProjectStatusFilter('ALL')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    projectStatusFilter === 'ALL' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setProjectStatusFilter('EM ANDAMENTO')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    projectStatusFilter === 'EM ANDAMENTO' ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Em Andamento
                </button>
                <button
                  onClick={() => setProjectStatusFilter('FINALIZADO')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    projectStatusFilter === 'FINALIZADO' ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  Finalizados
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(filteredData as Project[]).filter(p => projectStatusFilter === 'ALL' || p.status === projectStatusFilter).map(p => (
                <div key={p.id} className="p-6 border border-slate-100 rounded-2xl">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-slate-900">{p.title}</h4>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-1 rounded uppercase",
                      p.status === 'FINALIZADO' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {p.status || 'EM ANDAMENTO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">{p.description}</p>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Início: {safeFormat(p.startDate, 'dd/MM/yyyy')}</span>
                    <span>Alunos: {p.studentIds.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

          {activeTab === 'individual_students' && (
            <div className="space-y-6">
              {(filteredData as StudentReport[]).map(r => {
                const student = students.find(s => s.id === r.studentId);
                const teacher = teachers.find(t => t.id === r.teacherId);
                return (
                  <div key={r.id} className="p-6 border border-slate-100 rounded-2xl bg-slate-50/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900">Aluno: {student?.name || 'Removido'}</h4>
                        <p className="text-xs text-slate-500 font-medium">Professor: {teacher?.name || 'Removido'}</p>
                      </div>
                      <span className="text-xs font-black text-slate-400">{safeFormat(r.date, 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                      <ReactMarkdown>{r.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'individual_teachers' && (
            <div className="space-y-6">
              {(filteredData as TeacherReport[]).map(r => {
                const targetTeacher = teachers.find(t => t.id === r.targetTeacherId);
                const admin = teachers.find(t => t.id === r.adminId);
                return (
                  <div key={r.id} className="p-6 border border-slate-100 rounded-2xl bg-slate-50/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900">Professor: {targetTeacher?.name || 'Removido'}</h4>
                        <p className="text-xs text-slate-500 font-medium">Administrador: {admin?.name || 'Removido'}</p>
                      </div>
                      <span className="text-xs font-black text-slate-400">{safeFormat(r.date, 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                      <ReactMarkdown>{r.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'birthdays' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Nome</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Tipo</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Turma</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Data Nasc.</th>
                  <th className="py-4 text-xs font-black text-slate-400 uppercase">Telefone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filteredData as any[]).map(p => (
                  <tr key={p.id}>
                    <td className="py-4 text-sm font-bold text-slate-900">{p.name}</td>
                    <td className="py-4 text-sm text-slate-500">{p.type}</td>
                    <td className="py-4 text-sm text-slate-500">{p.className}</td>
                    <td className="py-4 text-sm text-slate-500">{safeFormat(p.birthDate, 'dd/MM')}</td>
                    <td className="py-4 text-sm text-slate-500">{p.phone || p.contact || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'ai_searches' && (
            <div className="space-y-8">
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-indigo-900 uppercase tracking-tight">Conteúdos de Pesquisa Salvas</h4>
                  <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Pesquisas geradas pelo Assistente de IA e arquivadas para consulta</p>
                </div>
              </div>

              {(filteredData as SavedAISearch[]).map(search => (
                <div key={search.id} className="p-6 border border-slate-100 rounded-2xl bg-slate-50/30 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-tight">{search.title}</h4>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          {safeFormat(search.date, 'dd/MM/yyyy')} 
                          {search.createdAt && ` - ${format(parseISO(search.createdAt), 'HH:mm')}`}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        showAdminConfirm('Excluir Pesquisa', 'Deseja realmente excluir este conteúdo?', async () => {
                          try {
                            await deleteDoc(doc(db, 'saved_ai_searches', search.id));
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, `saved_ai_searches/${search.id}`);
                          }
                        });
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="prose prose-sm prose-slate max-w-none bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-4">
                    <ReactMarkdown>{search.content}</ReactMarkdown>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentários</label>
                    <textarea 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none italic text-slate-600 h-20"
                      placeholder="Adicione um comentário ou observação sobre esta pesquisa..."
                      defaultValue={search.comments || ''}
                      onBlur={async (e) => {
                        const newComments = e.target.value;
                        if (newComments !== (search.comments || '')) {
                          try {
                            await updateDoc(doc(db, 'saved_ai_searches', search.id), {
                              comments: newComments
                            });
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, `saved_ai_searches/${search.id}`);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredData.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold">Nenhum dado encontrado para os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Reports Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Relatórios Manuais e Ações Registradas
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {manualReports.length === 0 ? (
            <p className="text-center py-12 text-slate-400 font-medium italic">Nenhum relatório manual registrado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {manualReports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(report => (
                <div key={report.id} className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{report.title}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {safeFormat(report.date, 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteManualReport(report.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none line-clamp-4">
                    <ReactMarkdown>{report.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Report Form Modal */}
      <AnimatePresence>
        {showManualReportForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Novo Relatório Manual</h3>
                <button onClick={() => setShowManualReportForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveManualReport} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Relatório</label>
                  <input
                    required
                    type="text"
                    value={manualReportForm.title}
                    onChange={(e) => setManualReportForm({ ...manualReportForm, title: e.target.value })}
                    placeholder="Ex: Relatório Mensal - Março 2024"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data de Referência</label>
                  <input
                    required
                    type="date"
                    value={manualReportForm.date}
                    onChange={(e) => setManualReportForm({ ...manualReportForm, date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo (Suporta Markdown)</label>
                  <textarea
                    required
                    rows={8}
                    value={manualReportForm.content}
                    onChange={(e) => setManualReportForm({ ...manualReportForm, content: e.target.value })}
                    placeholder="Descreva as ações realizadas ou detalhes do relatório..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Relatório
                </button>
              </form>
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
                  {modalConfig.type === 'confirm' ? <FileText className="w-8 h-8" /> : <X className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{modalConfig.title}</h3>
                <p className="text-slate-500 font-medium mb-8">{modalConfig.message}</p>

                {modalConfig.isPassword && (
                  <div className="mb-6">
                    <input
                      id="report-modal-password-input"
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
                        const input = (document.getElementById('report-modal-password-input') as HTMLInputElement)?.value;
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

const User = ({ className }: { className?: string }) => <Users className={className} />;
