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
  Trash2
} from 'lucide-react';
import { 
  Student, 
  Teacher, 
  Attendance, 
  Planning, 
  Project, 
  Transaction,
  Class,
  ManualReport
} from '../types';
import { cn } from '../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, deleteDoc, doc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';

interface Props {
  user: Teacher;
}

type ReportType = 'students' | 'attendance' | 'planning' | 'finance' | 'projects' | 'teachers';

export default function ReportModule({ user }: Props) {
  const [activeTab, setActiveTab] = useState<ReportType>('students');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'ALL' | 'EM ANDAMENTO' | 'FINALIZADO'>('ALL');
  const [financeStatusFilter, setFinanceStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'with-absences' | 'no-absences'>('all');

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [manualReports, setManualReports] = useState<ManualReport[]>([]);
  const [showManualReportForm, setShowManualReportForm] = useState(false);
  const [manualReportForm, setManualReportForm] = useState({
    title: '',
    content: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [loading, setLoading] = useState(true);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const classIds = (user.classIds && user.classIds.length > 0) ? user.classIds : ['none'];

    const studentsQuery = isAdmin ? collection(db, 'students') : query(collection(db, 'students'), where('classId', 'in', classIds));
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

    const attendanceQuery = isAdmin ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('classId', 'in', classIds));
    const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    });

    const planningQuery = isAdmin ? collection(db, 'planning') : query(collection(db, 'planning'), where('classId', 'in', classIds));
    const unsubPlanning = onSnapshot(planningQuery, (snap) => {
      setPlannings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Planning)));
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    });

    const unsubFinance = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const classesQuery = isAdmin ? collection(db, 'classes') : query(collection(db, 'classes'), where('id', 'in', classIds));
    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    const unsubManualReports = onSnapshot(collection(db, 'manual_reports'), (snap) => {
      setManualReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualReport)));
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
    };
  }, []);

  const filteredData = useMemo(() => {
    const filterByDate = (dateStr: string) => {
      if (!dateRange.start || !dateRange.end) return true;
      const date = parseISO(dateStr);
      return isWithinInterval(date, {
        start: startOfDay(parseISO(dateRange.start)),
        end: endOfDay(parseISO(dateRange.end))
      });
    };

    switch (activeTab) {
      case 'students':
        return students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
      case 'teachers':
        return teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
      case 'attendance':
        return attendances.filter(a => {
          const matchesDate = filterByDate(a.date);
          const matchesStatus = attendanceStatusFilter === 'all' || 
                                (attendanceStatusFilter === 'with-absences' ? a.absentStudentIds.length > 0 : a.absentStudentIds.length === 0);
          return matchesDate && matchesStatus;
        });
      case 'planning':
        return plannings.filter(p => filterByDate(p.date));
      case 'projects':
        return projects.filter(p => filterByDate(p.startDate) && (projectStatusFilter === 'ALL' || p.status === projectStatusFilter));
      case 'finance':
        return transactions.filter(t => {
          const matchesDate = filterByDate(t.date);
          const matchesStatus = financeStatusFilter === 'all' || t.status === financeStatusFilter;
          return matchesDate && matchesStatus;
        });
      default:
        return [];
    }
  }, [activeTab, students, teachers, attendances, plannings, projects, transactions, searchTerm, dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'manual_reports'), {
        ...manualReportForm,
        createdAt: new Date().toISOString()
      });
      setShowManualReportForm(false);
      setManualReportForm({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'manual_reports');
    }
  };

  const handleDeleteManualReport = async (id: string) => {
    if (!confirm('Deseja excluir este relatório?')) return;
    try {
      await deleteDoc(doc(db, 'manual_reports', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `manual_reports/${id}`);
    }
  };

  const tabs: { id: ReportType, label: string, icon: any }[] = [
    { id: 'students', label: 'Alunos', icon: Users },
    { id: 'teachers', label: 'Professores', icon: User },
    { id: 'attendance', label: 'Frequência', icon: Calendar },
    { id: 'planning', label: 'Planejamento', icon: BookOpen },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'projects', label: 'Projetos', icon: Briefcase },
  ];

  return (
    <div className="space-y-6 print:p-0">
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium">Carregando relatórios...</p>
        </div>
      ) : (
        <>
          {/* Header - Hidden on print */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 print:hidden">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Central de Relatórios
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowManualReportForm(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              Novo Relatório Manual
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              <Printer className="w-5 h-5" />
              Imprimir Relatório
            </button>
          </div>
        </div>

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
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        <div className="p-8 space-y-8">
          {/* Print Header */}
          <div className="hidden print:block text-center border-bottom-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-2xl font-black uppercase">Relatório do Sistema - EBD</h1>
            <p className="text-sm font-bold text-slate-500">
              Tipo: {tabs.find(t => t.id === activeTab)?.label} | 
              Período: {dateRange.start ? format(parseISO(dateRange.start), 'dd/MM/yyyy') : 'Início'} - {dateRange.end ? format(parseISO(dateRange.end), 'dd/MM/yyyy') : 'Fim'}
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
                    <td className="py-4 text-sm text-slate-500">{format(parseISO(s.birthDate), 'dd/MM/yyyy')}</td>
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
              {(filteredData as Attendance[]).map(a => {
                const cls = classes.find(c => c.id === a.classId);
                return (
                  <div key={a.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900">{cls?.name || 'Classe Removida'}</h4>
                      <span className="text-xs font-black text-slate-400">{format(parseISO(a.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2"><strong>Conteúdo:</strong> {a.contentGiven || 'Não informado'}</p>
                    <div className="flex gap-4 text-[10px] font-bold uppercase">
                      <span className="text-green-600">Presentes: {a.presentStudentIds.length}</span>
                      <span className="text-red-600">Ausentes: {a.absentStudentIds.length}</span>
                    </div>
                  </div>
                );
              })}
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
                      <td className="py-4 text-sm text-slate-500">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
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
                    <span>Início: {format(parseISO(p.startDate), 'dd/MM/yyyy')}</span>
                    <span>Alunos: {p.studentIds.length}</span>
                  </div>
                </div>
              ))}
            </div>
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
                        {format(parseISO(report.date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteManualReport(report.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
        </>
      )}
    </div>
  );
}

const User = ({ className }: { className?: string }) => <Users className={className} />;
