import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  CheckSquare, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Briefcase,
  Target,
  AlertCircle,
  Settings,
  Trophy,
  Printer,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Check,
  Plus,
  Trash2,
  Archive,
  History,
  Filter,
  Edit2,
  Save,
  Clock,
  RefreshCw,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import PresenceDetailsReport from './PresenceDetailsReport';
import { motion, AnimatePresence } from 'framer-motion';
import { Student, Teacher, Class, Transaction, Project, DashboardConfig, AbsenceResolution, PreDefinedResolution } from '../types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, getMonth, getDate, isValid, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeFormat } from '../lib/utils';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
}

export default function Dashboard({ user, selectedSchoolYear }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<DashboardConfig>({
    highFrequencyLimit: 80,
    intermediateFrequencyLimit: 50,
    consecutiveAbsencesLimit: 2,
    eventBarPosition: 'bottom'
  });
  const [showConfig, setShowConfig] = useState(false);
  
  // Resolution States
  const [resolutions, setResolutions] = useState<AbsenceResolution[]>([]);
  const [preDefinedResolutions, setPreDefinedResolutions] = useState<PreDefinedResolution[]>([]);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingStudent, setResolvingStudent] = useState<Student | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSavingResolution, setIsSavingResolution] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showPreDefinedConfig, setShowPreDefinedConfig] = useState(false);
  const [showResolvedReport, setShowResolvedReport] = useState(false);
  
  // Report Filter States
  const [reportStartDate, setReportStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportClassId, setReportClassId] = useState('all');
  const [reportMinOccurrences, setReportMinOccurrences] = useState(1);
  const [reportExhibitionType, setReportExhibitionType] = useState('all');
  
  // Resolution Edit States
  const [editingResolution, setEditingResolution] = useState<AbsenceResolution | null>(null);
  const [showQuickAlertConfig, setShowQuickAlertConfig] = useState(false);
  const [showRankConfig, setShowRankConfig] = useState(false);
  const [showClassifConfig, setShowClassifConfig] = useState(false);
  
  const [tempConsecutiveLimit, setTempConsecutiveLimit] = useState(2);
  const [tempFreqStart, setTempFreqStart] = useState('');
  const [tempFreqEnd, setTempFreqEnd] = useState('');
  
  const [tempRankStart, setTempRankStart] = useState('');
  const [tempRankEnd, setTempRankEnd] = useState('');
  
  const [tempClassifStart, setTempClassifStart] = useState('');
  const [tempClassifEnd, setTempClassifEnd] = useState('');

  const [detailReportParams, setDetailReportParams] = useState<{
    type: 'classification' | 'ranking';
    id: string;
  } | null>(null);

  const [absenceDates, setAbsenceDates] = useState<Record<string, string[]>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  // Sync temp values only when modal OPENS to avoid overwriting user edits while typing
  useEffect(() => {
    if (showQuickAlertConfig) {
      setTempConsecutiveLimit(config.consecutiveAbsencesLimit || 2);
      setTempFreqStart(config.frequencyStartDate || '');
      setTempFreqEnd(config.frequencyEndDate || '');
    }
  }, [showQuickAlertConfig]);

  useEffect(() => {
    if (showRankConfig) {
      setTempRankStart(config.rankStartDate || '');
      setTempRankEnd(config.rankEndDate || '');
    }
  }, [showRankConfig]);

  useEffect(() => {
    if (showClassifConfig) {
      setTempClassifStart(config.classificationStartDate || '');
      setTempClassifEnd(config.classificationEndDate || '');
    }
  }, [showClassifConfig]);

  // Stable Config Listener
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'dashboard'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(prev => ({
          ...prev,
          highFrequencyLimit: data.highFrequencyLimit || 80,
          intermediateFrequencyLimit: data.intermediateFrequencyLimit || 50,
          consecutiveAbsencesLimit: data.consecutiveAbsencesLimit || 2,
          frequencyStartDate: data.frequencyStartDate,
          frequencyEndDate: data.frequencyEndDate,
          rankStartDate: data.rankStartDate,
          rankEndDate: data.rankEndDate,
          classificationStartDate: data.classificationStartDate,
          classificationEndDate: data.classificationEndDate,
          eventBarPosition: data.eventBarPosition || 'bottom'
        }));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'config/dashboard'));

    return () => unsubConfig();
  }, []);

  // Other Listeners
  useEffect(() => {
    const isAdmin = user.role === 'admin' || user.role === 'coordinator';
    const classIds = user?.classIds || [];

    const unsubResolutions = onSnapshot(
      query(collection(db, 'absenceResolutions'), orderBy('createdAt', 'desc')), 
      (snap) => {
        setResolutions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AbsenceResolution)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'absenceResolutions')
    );

    const unsubPreDefined = onSnapshot(
      query(collection(db, 'preDefinedResolutions'), orderBy('createdAt', 'asc')), 
      (snap) => {
        setPreDefinedResolutions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PreDefinedResolution)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'preDefinedResolutions')
    );

    const studentsQuery = isAdmin 
      ? collection(db, 'students') 
      : query(collection(db, 'students'), where('classId', 'in', classIds.length > 0 ? classIds : ['none']));
    
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const classesQuery = isAdmin
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('id', 'in', classIds.length > 0 ? classIds : ['none']));

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    let unsubTransactions = () => {};
    if (user.role === 'admin') {
      unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));
    }

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));

    // Fetch Attendance for absence dates
    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(300)), 
      (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setAttendanceRecords(records);
        const datesMap: Record<string, string[]> = {};
        
        // Use current students from state
        setStudents(currentStudents => {
          currentStudents.forEach(student => {
            if (student.consecutiveAbsences > 0) {
              const sDates = records
                .filter((att: any) => att.absentStudentIds?.includes(student.id))
                .map((att: any) => att.date)
                .slice(0, student.consecutiveAbsences);
              datesMap[student.id] = sDates;
            }
          });
          setAbsenceDates(datesMap);
          return currentStudents;
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    );
    
    return () => {
      unsubStudents();
      unsubTeachers();
      unsubClasses();
      unsubTransactions();
      unsubProjects();
      unsubResolutions();
      unsubPreDefined();
      unsubAttendance();
    };
  }, [user]);

  const updateConfig = async (newConfig: DashboardConfig) => {
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'config', 'dashboard'), newConfig);
      setConfig(newConfig);
      setShowQuickAlertConfig(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'config/dashboard');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenDetail = (type: 'classification' | 'ranking', id: string) => {
    setDetailReportParams({ type, id });
  };

  const handleResolveAbsences = async () => {
    if (!resolvingStudent || !resolutionNote.trim()) return;
    setIsSavingResolution(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Create Resolution Record
      await addDoc(collection(db, 'absenceResolutions'), {
        studentId: resolvingStudent.id,
        teacherId: user.id || auth.currentUser?.uid || "unknown",
        note: resolutionNote,
        consecutiveAbsences: resolvingStudent.consecutiveAbsences,
        date: today,
        createdAt: new Date().toISOString()
      });

      // 2. Add to Student History (Report)
      await addDoc(collection(db, 'student_reports'), {
        studentId: resolvingStudent.id,
        teacherId: user.id || auth.currentUser?.uid || "unknown",
        content: `OCORRÊNCIA RESOLVIDA (${resolvingStudent.consecutiveAbsences} faltas seguidas): ${resolutionNote}`,
        date: today,
        createdAt: new Date().toISOString()
      });

      // 3. Reset Student consecutiveAbsences
      await updateDoc(doc(db, 'students', resolvingStudent.id), {
        consecutiveAbsences: 0
      });

      setShowResolveModal(false);
      setResolvingStudent(null);
      setResolutionNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${resolvingStudent.id}`);
    } finally {
      setIsSavingResolution(false);
    }
  };

  const handleAddPreDefined = async (text: string) => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'preDefinedResolutions'), {
        text,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'preDefinedResolutions');
    }
  };

  const handleDeletePreDefined = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'preDefinedResolutions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `preDefinedResolutions/${id}`);
    }
  };

  const handleUpdateResolution = async () => {
    if (!editingResolution || !resolutionNote.trim()) return;
    setIsSavingResolution(true);
    try {
      await updateDoc(doc(db, 'absenceResolutions', editingResolution.id), {
        note: resolutionNote,
        updatedAt: new Date().toISOString()
      });
      
      // Also add a history entry for the modification
      await addDoc(collection(db, 'student_reports'), {
        studentId: editingResolution.studentId,
        teacherId: user.id || auth.currentUser?.uid || "unknown",
        content: `OCORRÊNCIA MODIFICADA: ${resolutionNote}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      });

      setEditingResolution(null);
      setResolutionNote('');
      setShowResolveModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `absenceResolutions/${editingResolution.id}`);
    } finally {
      setIsSavingResolution(false);
    }
  };

  const handleReopenResolution = async (resolution: AbsenceResolution) => {
    try {
      // 1. Restore students consecutiveAbsences
      await updateDoc(doc(db, 'students', resolution.studentId), {
        consecutiveAbsences: resolution.consecutiveAbsences
      });

      // 2. Add history entry
      await addDoc(collection(db, 'student_reports'), {
        studentId: resolution.studentId,
        teacherId: user.id || auth.currentUser?.uid || "",
        content: `OCORRÊNCIA REABERTA (${resolution.consecutiveAbsences} faltas).`,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      });

      // 3. Delete the resolution record
      await deleteDoc(doc(db, 'absenceResolutions', resolution.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `absenceResolutions/${resolution.id}`);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => s.schoolYear === selectedSchoolYear);
  }, [students, selectedSchoolYear]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c => c.schoolYear === selectedSchoolYear);
  }, [classes, selectedSchoolYear]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const stats = [
    { label: 'Total Alunos', value: filteredStudents.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Colaboradores', value: teachers.length, icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Turmas Ativas', value: filteredClasses.length, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
    { label: 'Projetos', value: projects.length, icon: Briefcase, color: 'bg-amber-50 text-amber-600' },
  ];

  const calculateStudentPeriodAttendance = (studentId: string, startDate?: string, endDate?: string) => {
    const start = startDate ? parseISO(startDate) : null;
    const end = endDate ? parseISO(endDate) : null;

    const relevantAttendance = attendanceRecords.filter(att => {
      const d = parseISO(att.date);
      const inPeriod = (!start || d >= start) && (!end || d <= end);
      return inPeriod && (att.presentStudentIds?.includes(studentId) || att.absentStudentIds?.includes(studentId));
    });

    if (relevantAttendance.length === 0) return 100; // Default to 100 if no records found in period

    const presentCount = relevantAttendance.filter(att => att.presentStudentIds?.includes(studentId)).length;
    return (presentCount / relevantAttendance.length) * 100;
  };

  const classAttendanceData = useMemo(() => {
    return filteredClasses.map(c => {
      const classStudents = filteredStudents.filter(s => s.classId === c.id);
      
      const start = config.rankStartDate ? parseISO(config.rankStartDate) : null;
      const end = config.rankEndDate ? parseISO(config.rankEndDate) : null;

      const relevantAttendance = attendanceRecords.filter(att => {
        const d = parseISO(att.date);
        return att.classId === c.id && (!start || d >= start) && (!end || d <= end);
      });

      const totalPossiblePresences = relevantAttendance.length * (classStudents.length || 1);
      const actualPresences = relevantAttendance.reduce((acc, att) => acc + (att.presentStudentIds?.length || 0), 0);
      
      const attendancePercent = totalPossiblePresences > 0 ? (actualPresences / totalPossiblePresences) * 100 : 0;
      
      const avgPresentStudents = relevantAttendance.length > 0 
        ? actualPresences / relevantAttendance.length 
        : 0;

      return {
        id: c.id,
        name: c.name,
        attendance: Math.round(attendancePercent),
        absencePercent: Math.round(100 - attendancePercent),
        avgPresent: avgPresentStudents.toFixed(1),
        students: classStudents.length
      };
    }).sort((a, b) => b.attendance - a.attendance);
  }, [filteredClasses, filteredStudents, attendanceRecords, config.rankStartDate, config.rankEndDate]);

  const frequencyClassification = useMemo(() => {
    const periodAttendances = filteredStudents.map(s => {
      const percent = calculateStudentPeriodAttendance(s.id, config.classificationStartDate, config.classificationEndDate);
      return percent;
    });

    return {
      high: periodAttendances.filter(p => p >= config.highFrequencyLimit).length,
      intermediate: periodAttendances.filter(p => p < config.highFrequencyLimit && p >= config.intermediateFrequencyLimit).length,
      low: periodAttendances.filter(p => p < config.intermediateFrequencyLimit).length,
    };
  }, [filteredStudents, attendanceRecords, config.classificationStartDate, config.classificationEndDate, config.highFrequencyLimit, config.intermediateFrequencyLimit]);

  const pieData = [
    { name: 'Alta', value: frequencyClassification.high, color: '#10b981' },
    { name: 'Intermediária', value: frequencyClassification.intermediate, color: '#f59e0b' },
    { name: 'Baixa', value: frequencyClassification.low, color: '#ef4444' },
  ];

  const [birthdayStart, setBirthdayStart] = useState(safeFormat(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [birthdayEnd, setBirthdayEnd] = useState(safeFormat(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  const weeklyBirthdays = useMemo(() => {
    const start = parseISO(birthdayStart);
    const end = parseISO(birthdayEnd);
    
    const allPeople: any[] = [
      ...filteredStudents.map(s => ({ ...s, type: 'Aluno' })),
      ...teachers.map(t => ({ ...t, type: 'Colaborador' }))
    ];

    return allPeople.filter(person => {
      const bDateStr = person.birthDate;
      if (!bDateStr) return false;
      const bDate = parseISO(bDateStr);
      if (!isValid(bDate)) return false;

      // Check if birthday falls within the range (ignoring year)
      const currentYear = new Date().getFullYear();
      const bDateThisYear = new Date(currentYear, getMonth(bDate), getDate(bDate));
      
      return isWithinInterval(bDateThisYear, { start, end });
    }).sort((a, b) => {
      const dateA = parseISO(a.birthDate!);
      const dateB = parseISO(b.birthDate!);
      return getDate(dateA) - getDate(dateB);
    });
  }, [students, teachers, birthdayStart, birthdayEnd]);

  const handlePrintBirthdays = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Aniversariantes - EBD IGBAPI</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            h1 { color: #4f46e5; text-align: center; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { bg-color: #f8fafc; font-weight: bold; }
            .header-info { text-align: center; margin-bottom: 20px; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>Relatório de Aniversariantes</h1>
          <div class="header-info">
            Período: ${safeFormat(birthdayStart, 'dd/MM/yyyy')} até ${safeFormat(birthdayEnd, 'dd/MM/yyyy')}
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Data</th>
                <th>Turma</th>
              </tr>
            </thead>
            <tbody>
              ${weeklyBirthdays.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.type}</td>
                  <td>${safeFormat(p.birthDate, 'dd/MM')}</td>
                  <td>${classes.find(c => c.id === (p as any).classId)?.name || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8;">
            Gerado em ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Header with Config */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Dashboard Inteligente</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Visão Geral do Ano de {selectedSchoolYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.role === 'admin' && (
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-sm font-bold text-slate-600"
            >
              <Settings className="w-4 h-4" />
              Configurar Limites
            </button>
          )}
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
            {showConfig && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Limite Alta Frequência (%)</label>
              <input 
                type="number" 
                value={config.highFrequencyLimit}
                onChange={(e) => updateConfig({ ...config, highFrequencyLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Limite Frequência Intermediária (%)</label>
              <input 
                type="number" 
                value={config.intermediateFrequencyLimit}
                onChange={(e) => updateConfig({ ...config, intermediateFrequencyLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Alerta Faltas Seguidas</label>
              <input 
                type="number" 
                value={config.consecutiveAbsencesLimit}
                onChange={(e) => updateConfig({ ...config, consecutiveAbsencesLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4">
            <button 
              onClick={() => setShowPreDefinedConfig(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configurar Respostas Pré-definidas
            </button>
            <button 
              onClick={() => setShowResolvedReport(true)}
              className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Relatório de Ocorrências Resolvidas
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Ranking */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">Ranking de Presença por Turma</h3>
            </div>
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setShowRankConfig(!showRankConfig)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group"
              >
                <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
              </button>

              <AnimatePresence>
                {showRankConfig && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.9 }}
                    className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-10"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Início
                          </label>
                          <input 
                            type="date" 
                            value={tempRankStart}
                            onChange={(e) => setTempRankStart(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Fim
                          </label>
                          <input 
                            type="date" 
                            value={tempRankEnd}
                            onChange={(e) => setTempRankEnd(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          updateConfig({ 
                            ...config, 
                            rankStartDate: tempRankStart,
                            rankEndDate: tempRankEnd
                          });
                          setShowRankConfig(false);
                        }}
                        disabled={isSavingConfig}
                        className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                      >
                        {isSavingConfig ? 'Gravando...' : 'Fixar Seleção'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classAttendanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                          <p className="text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">{label}</p>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex justify-between gap-4">
                              <span>Presenças:</span> <span>{data.attendance}%</span>
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between gap-4">
                              <span>Média Alunos:</span> <span>{data.avgPresent}</span>
                            </p>
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex justify-between gap-4">
                              <span>Faltas:</span> <span>{data.absencePercent}%</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="attendance" 
                  radius={[0, 8, 8, 0]} 
                  barSize={20}
                  onDoubleClick={(data) => handleOpenDetail('ranking', data.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {classAttendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.attendance >= config.highFrequencyLimit ? '#10b981' : entry.attendance >= config.intermediateFrequencyLimit ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {classAttendanceData.slice(0, 3).map((turma, idx) => (
              <div key={idx} className="flex-1 min-w-[140px] p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:shadow-md">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{turma.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-indigo-600">{turma.attendance}%</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Avg: {turma.avgPresent}</span>
                    <span className="text-[9px] font-bold text-red-400 uppercase">Faltas: {turma.absencePercent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Frequency Classification */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Classificação de Alunos</h3>
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setShowClassifConfig(!showClassifConfig)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group"
              >
                <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
              </button>

              <AnimatePresence>
                {showClassifConfig && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.9 }}
                    className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-10"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Início
                          </label>
                          <input 
                            type="date" 
                            value={tempClassifStart}
                            onChange={(e) => setTempClassifStart(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Fim
                          </label>
                          <input 
                            type="date" 
                            value={tempClassifEnd}
                            onChange={(e) => setTempClassifEnd(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          updateConfig({ 
                            ...config, 
                            classificationStartDate: tempClassifStart,
                            classificationEndDate: tempClassifEnd
                          });
                          setShowClassifConfig(false);
                        }}
                        disabled={isSavingConfig}
                        className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                      >
                        {isSavingConfig ? 'Gravando...' : 'Fixar Seleção'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="h-[200px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onDoubleClick={(data) => {
                    const mappedId = data.name === 'Alta' ? 'high' : data.name === 'Intermediária' ? 'intermediate' : 'low';
                    handleOpenDetail('classification', mappedId);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value} alunos</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students per Class */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Alunos por Turma</h3>
          <div className="space-y-4">
            {classAttendanceData.map((c) => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700">{c.name}</span>
                    <span className="text-sm text-slate-500">{c.students} alunos</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${(c.students / (students.length || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Birthdays of the Week - Alunos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-slate-900 font-black uppercase tracking-tight">Aniversariantes - Alunos</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <input 
                  type="date" 
                  value={birthdayStart}
                  onChange={(e) => setBirthdayStart(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none p-1"
                />
                <span className="text-slate-300">|</span>
                <input 
                  type="date" 
                  value={birthdayEnd}
                  onChange={(e) => setBirthdayEnd(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none p-1"
                />
              </div>
              <button 
                onClick={handlePrintBirthdays}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                title="Imprimir Aniversariantes"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {weeklyBirthdays.filter(p => p.type === 'Aluno').length > 0 ? (
              weeklyBirthdays.filter(p => p.type === 'Aluno').map((person) => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm shadow-sm shrink-0">
                      👶
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{person.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {classes.find(c => c.id === (person as any).classId)?.name || 'Sem Turma'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-indigo-600">{safeFormat(person.birthDate, 'dd/MM')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 italic text-xs">Nenhum aluno.</div>
            )}
          </div>
        </div>

        {/* Birthdays of the Week - Colaboradores */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900 font-black uppercase tracking-tight">Aniversariantes - Colaboradores</h3>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {weeklyBirthdays.filter(p => p.type === 'Colaborador').length > 0 ? (
              weeklyBirthdays.filter(p => p.type === 'Colaborador').map((person) => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm shadow-sm shrink-0">
                      👨‍🏫
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{person.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Administração/Docente</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">{safeFormat(person.birthDate, 'dd/MM')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 italic text-xs">Nenhum colaborador.</div>
            )}
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight text-sm">Alertas de Frequência</h3>
            </div>
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setShowQuickAlertConfig(!showQuickAlertConfig)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group"
              >
                <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
              </button>
              
              <AnimatePresence>
                {showQuickAlertConfig && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.9 }}
                    className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-10"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                          Faltas para Alerta
                        </label>
                        <input 
                          type="number" 
                          min="1"
                          value={tempConsecutiveLimit}
                          onChange={(e) => setTempConsecutiveLimit(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Início Período
                          </label>
                          <input 
                            type="date" 
                            value={tempFreqStart}
                            onChange={(e) => setTempFreqStart(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">
                            Fim Período
                          </label>
                          <input 
                            type="date" 
                            value={tempFreqEnd}
                            onChange={(e) => setTempFreqEnd(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          updateConfig({ 
                            ...config, 
                            consecutiveAbsencesLimit: tempConsecutiveLimit,
                            frequencyStartDate: tempFreqStart,
                            frequencyEndDate: tempFreqEnd
                          });
                        }}
                        disabled={isSavingConfig}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        title="Fixar Configuração"
                      >
                        {isSavingConfig ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Fixar Período e Limite
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredStudents
              .filter(s => {
                const baseFilter = s.consecutiveAbsences >= (config.consecutiveAbsencesLimit || 2);
                if (!baseFilter) return false;
                
                // Date period filter
                if (config.frequencyStartDate || config.frequencyEndDate) {
                  const studentAbsences = absenceDates[s.id] || [];
                  const start = config.frequencyStartDate ? parseISO(config.frequencyStartDate) : null;
                  const end = config.frequencyEndDate ? parseISO(config.frequencyEndDate) : null;
                  
                  // If period is set, at least one of the recent absences must be within the period
                  const hasAbsenceInPeriod = studentAbsences.some(dateStr => {
                    const d = parseISO(dateStr);
                    return (!start || d >= start) && (!end || d <= end);
                  });
                  return hasAbsenceInPeriod;
                }
                
                return true;
              })
              .map(student => (
              <div key={student.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between group hover:bg-red-100/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-red-100">
                    ⚠️
                  </div>
                  <div>
                    <p className="text-sm font-black text-red-900 uppercase leading-none mb-1">{student.name}</p>
                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
                      Faltou {student.consecutiveAbsences} vezes seguidas!
                    </p>
                    {absenceDates[student.id] && (
                      <div className="flex flex-wrap gap-1">
                        {absenceDates[student.id]
                          .filter(dateStr => {
                            const d = parseISO(dateStr);
                            const start = config.frequencyStartDate ? parseISO(config.frequencyStartDate) : null;
                            const end = config.frequencyEndDate ? parseISO(config.frequencyEndDate) : null;
                            return (!start || d >= start) && (!end || d <= end);
                          })
                          .map((date, idx) => (
                          <span key={idx} className="text-[8px] font-bold bg-white/60 text-red-600 px-1.5 py-0.5 rounded border border-red-100 shadow-sm">
                            {format(parseISO(date), 'dd/MM')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setResolvingStudent(student);
                    setResolutionNote('');
                    setShowResolveModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95"
                >
                  Resolvido
                </button>
              </div>
            ))}
            {filteredStudents.filter(s => {
              const baseFilter = s.consecutiveAbsences >= (config.consecutiveAbsencesLimit || 2);
              if (!baseFilter) return false;
              if (config.frequencyStartDate || config.frequencyEndDate) {
                const studentAbsences = absenceDates[s.id] || [];
                const start = config.frequencyStartDate ? parseISO(config.frequencyStartDate) : null;
                const end = config.frequencyEndDate ? parseISO(config.frequencyEndDate) : null;
                return studentAbsences.some(dateStr => {
                  const d = parseISO(dateStr);
                  return (!start || d >= start) && (!end || d <= end);
                });
              }
              return true;
            }).length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tudo em dia</p>
                <p className="text-[10px] text-slate-400 mt-1">Nenhum alerta crítico no momento.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  <AnimatePresence>
    {showResolveModal && (resolvingStudent || editingResolution) && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => { setShowResolveModal(false); setEditingResolution(null); }}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-indigo-600 text-white">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1 text-white">
                {editingResolution ? 'Editar Resolução' : 'Resolver Frequência'}
              </h3>
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest leading-none">
                {editingResolution ? (students.find(s => s.id === editingResolution.studentId)?.name || 'Carregando...') : resolvingStudent?.name}
              </p>
            </div>
            <button onClick={() => { setShowResolveModal(false); setEditingResolution(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Como o problema foi resolvido?</label>
              <textarea 
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Digite aqui o que foi feito (Ex: Conversado com os pais, aluno estava doente...)"
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all resize-none font-medium"
              ></textarea>
            </div>

            {preDefinedResolutions.length > 0 && !editingResolution && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Respostas Pré-definidas</label>
                <div className="flex flex-wrap gap-2">
                  {preDefinedResolutions.map(res => (
                    <button
                      key={res.id}
                      onClick={() => setResolutionNote(res.text)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-all uppercase"
                    >
                      {res.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => { setShowResolveModal(false); setEditingResolution(null); }}
                disabled={isSavingResolution}
                className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Voltar
              </button>
              <button 
                onClick={() => editingResolution ? handleUpdateResolution() : handleResolveAbsences()}
                disabled={!resolutionNote.trim() || isSavingResolution}
                className={cn(
                  "flex-1 px-6 py-3.5 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2",
                  editingResolution ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {isSavingResolution ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gravando...
                  </>
                ) : (
                  editingResolution ? 'Salvar Alteração' : 'Gravar e Arquivar'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}

    {showPreDefinedConfig && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100"
        >
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Configurar Respostas</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Gerencie os textos pré-definidos para resoluções</p>
            </div>
            <button onClick={() => setShowPreDefinedConfig(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <input 
                id="new-pre-def"
                type="text"
                placeholder="Nova resposta pré-definida..."
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPreDefined((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('new-pre-def') as HTMLInputElement;
                  handleAddPreDefined(input.value);
                  input.value = '';
                }}
                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-black"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {preDefinedResolutions.map(res => (
                <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <span className="text-sm font-bold text-slate-700">{res.text}</span>
                  <button 
                    onClick={() => handleDeletePreDefined(res.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {preDefinedResolutions.length === 0 && (
                <p className="text-center py-12 text-slate-400 italic text-sm">Nenhuma resposta cadastrada.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    )}

    {showResolvedReport && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 20 }}
          className="bg-slate-50 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden h-[90vh] flex flex-col border border-slate-200"
        >
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1 text-emerald-600">Ocorrências Resolvidas</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Histórico completo de resoluções de frequência</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  
                  const filteredResolutions = resolutions.filter(r => {
                    const rDate = parseISO(r.date);
                    const start = parseISO(reportStartDate);
                    const end = parseISO(reportEndDate);
                    const matchDate = (!reportStartDate || rDate >= start) && (!reportEndDate || rDate <= end);
                    
                    const student = students.find(s => s.id === r.studentId);
                    const matchClass = reportClassId === 'all' || student?.classId === reportClassId;
                    
                    const occurrenceCount = resolutions.filter(res => res.studentId === r.studentId).length;
                    const matchOccurrences = occurrenceCount >= reportMinOccurrences;

                    const isNotified = r.consecutiveAbsences >= (config.consecutiveAbsencesLimit || 2);
                    const matchExhibition = reportExhibitionType === 'all' || 
                                           (reportExhibitionType === 'notified' && isNotified) || 
                                           (reportExhibitionType === 'unnotified' && !isNotified);

                    return matchDate && matchClass && matchOccurrences && matchExhibition;
                  });

                  const content = `
                    <html>
                      <head>
                        <title>Ocorrências Resolvidas - EBD</title>
                        <style>
                          body { font-family: sans-serif; padding: 40px; color: #1e293b; }
                          h1 { color: #10b981; text-align: center; margin-bottom: 5px; }
                          .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 30px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                          th { background-color: #f8fafc; font-weight: bold; font-size: 12px; text-transform: uppercase; }
                          td { font-size: 13px; }
                          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 20px; }
                        </style>
                      </head>
                      <body>
                        <h1>Relatório de Ocorrências Resolvidas</h1>
                        <div class="subtitle">Período: ${safeFormat(reportStartDate, 'dd/MM/yyyy')} - ${safeFormat(reportEndDate, 'dd/MM/yyyy')}</div>
                        <table>
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Aluno</th>
                              <th>Turma</th>
                              <th>Faltas</th>
                              <th>Resolução</th>
                              <th>Professor</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${filteredResolutions.map(r => {
                              const s = students.find(stud => stud.id === r.studentId);
                              const c = classes.find(cl => cl.id === s?.classId);
                              const t = teachers.find(te => te.id === r.teacherId);
                              return `
                                <tr>
                                  <td>${safeFormat(r.date, 'dd/MM/yyyy')}</td>
                                  <td><b>${s?.name || 'N/A'}</b></td>
                                  <td>${c?.name || 'N/A'}</td>
                                  <td>${r.consecutiveAbsences}</td>
                                  <td>${r.note}</td>
                                  <td>${t?.name || 'N/A'}</td>
                                </tr>
                              `;
                            }).join('')}
                          </tbody>
                        </table>
                        <div class="footer">Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                      </body>
                    </html>
                  `;
                  printWindow.document.write(content);
                  printWindow.document.close();
                  printWindow.print();
                }}
                className="p-3 bg-white text-slate-600 rounded-2xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button onClick={() => setShowResolvedReport(false)} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all text-slate-400 shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border-b border-slate-200 p-6 flex flex-wrap gap-4 items-end">
                <div className="w-full md:w-auto">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Exibir</label>
                  <select
                    value={reportExhibitionType}
                    onChange={(e) => setReportExhibitionType(e.target.value)}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-48 appearance-none font-bold uppercase"
                  >
                    <option value="all">TODAS OCORRÊNCIAS</option>
                    <option value="notified">APENAS NOTIFICADOS</option>
                    <option value="unnotified">NÃO NOTIFICADOS</option>
                  </select>
                </div>
            <div className="w-full md:w-auto">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Data Inicial</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                />
              </div>
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Data Final</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                />
              </div>
            </div>
            <div className="w-full md:w-auto min-w-[200px]">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Filtrar por Turma</label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={reportClassId}
                  onChange={(e) => setReportClassId(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-full appearance-none"
                >
                  <option value="all">TODAS AS TURMAS</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Mín. Ocorrências</label>
              <input 
                type="number"
                min="1"
                value={reportMinOccurrences}
                onChange={(e) => setReportMinOccurrences(parseInt(e.target.value) || 1)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-24"
              />
            </div>
          </div>

          {/* Table Data */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resolutions
                .filter(r => {
                  const rDate = parseISO(r.date);
                  const start = parseISO(reportStartDate);
                  const end = parseISO(reportEndDate);
                  const matchDate = (!reportStartDate || rDate >= start) && (!reportEndDate || rDate <= end);
                  
                  const student = students.find(s => s.id === r.studentId);
                  const matchClass = reportClassId === 'all' || student?.classId === reportClassId;
                  
                  const occurrenceCount = resolutions.filter(res => res.studentId === r.studentId).length;
                  const matchOccurrences = occurrenceCount >= reportMinOccurrences;

                  const isNotified = r.consecutiveAbsences >= (config.consecutiveAbsencesLimit || 2);
                  const matchExhibition = reportExhibitionType === 'all' || 
                                         (reportExhibitionType === 'notified' && isNotified) || 
                                         (reportExhibitionType === 'unnotified' && !isNotified);

                  return matchDate && matchClass && matchOccurrences && matchExhibition;
                })
                .map(res => {
                  const student = students.find(s => s.id === res.studentId);
                  const groupClass = classes.find(c => c.id === student?.classId);
                  const teacher = teachers.find(t => t.id === res.teacherId);
                  
                  return (
                    <div key={res.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-100">
                          Resolvido
                        </span>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900 leading-none">{safeFormat(res.date, 'dd/MM/yyyy')}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-1">{res.consecutiveAbsences} Faltas Seguidas</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-sm font-black text-slate-800 uppercase line-clamp-1">{student?.name || 'N/A'}</h4>
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">{groupClass?.name || 'N/A'}</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 h-24 overflow-y-auto">
                        <p className="text-xs text-slate-600 italic leading-relaxed font-medium">"{res.note}"</p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                            {teacher?.name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Resolvido por:</p>
                            <p className="text-[10px] font-black text-slate-700 uppercase leading-none mt-1">{teacher?.name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingResolution(res);
                              setResolutionNote(res.note);
                              setShowResolveModal(true);
                            }}
                            className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all shadow-sm"
                            title="Editar Resolução"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm('Deseja reabrir esta ocorrência? Ela voltará para o alerta de frequência.')) {
                                handleReopenResolution(res);
                              }
                            }}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all shadow-sm"
                            title="Reabrir Ocorrência"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {resolutions.length === 0 && (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma ocorrência encontrada</p>
                <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou verifique se há alertas resolvidos.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Detail Report Overlay - "Nova Janela na Plataforma" */}
  <AnimatePresence>
    {detailReportParams && (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-[150] bg-white overflow-y-auto"
      >
        <div className="sticky top-0 w-full flex justify-end p-4 bg-white/80 backdrop-blur-md border-b border-slate-100 z-[160]">
          <button 
            onClick={() => setDetailReportParams(null)}
            className="group flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all font-black uppercase tracking-widest text-[10px]"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Fechar Janela
          </button>
        </div>
        <div className="pb-10">
          <PresenceDetailsReport 
            type={detailReportParams.type}
            targetId={detailReportParams.id}
            startDate={detailReportParams.type === 'classification' ? config.classificationStartDate : config.rankStartDate}
            endDate={detailReportParams.type === 'classification' ? config.classificationEndDate : config.rankEndDate}
            highLimit={config.highFrequencyLimit}
            interLimit={config.intermediateFrequencyLimit}
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
);
}
