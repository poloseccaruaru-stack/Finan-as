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
import { Student, Teacher, Class, Transaction, Project, DashboardConfig, AbsenceResolution, PreDefinedResolution, CalendarEvent } from '../types';
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
  X,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  Focus,
  Pin,
  MessageSquare,
  Send,
  ExternalLink,
  Phone
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
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, getMonth, getDate, isValid, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeFormat } from '../lib/utils';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
  hasFullAccess?: boolean;
}

const DEFAULT_LAYOUT = ['stats', 'attendanceMonitoring', 'ranking', 'classification', 'studentsPerClass', 'birthdaysStudents', 'birthdaysColab', 'alerts'];

export default function Dashboard({ user, selectedSchoolYear, hasFullAccess: propHasFullAccess }: Props) {
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
    eventBarPosition: 'bottom',
    layout: DEFAULT_LAYOUT
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
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);
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
  const [showColabBirthConfig, setShowColabBirthConfig] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [localLayout, setLocalLayout] = useState<string[]>(() => {
    const saved = localStorage.getItem('ebd_dashboard_layout');
    let l = DEFAULT_LAYOUT;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          l = parsed;
        }
      } catch (e) {}
    }
    // Force vital cards
    if (!l.includes('attendanceMonitoring')) {
      l = [...l, 'attendanceMonitoring'];
    }
    if (!l.includes('stats')) {
      l = ['stats', ...l.filter(item => item !== 'stats')];
    }
    return l;
  });
  
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppStudent, setWhatsAppStudent] = useState<Student | null>(null);
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState('');
  const [selectedWhatsAppTemplate, setSelectedWhatsAppTemplate] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  
  const [tempConsecutiveLimit, setTempConsecutiveLimit] = useState(2);
  const [tempFreqStart, setTempFreqStart] = useState('');
  const [tempFreqEnd, setTempFreqEnd] = useState('');
  
  const [tempRankStart, setTempRankStart] = useState('');
  const [tempRankEnd, setTempRankEnd] = useState('');
  
  const [tempClassifStart, setTempClassifStart] = useState('');
  const [tempClassifEnd, setTempClassifEnd] = useState('');

  const [tempColabBirthStart, setTempColabBirthStart] = useState('');
  const [tempColabBirthEnd, setTempColabBirthEnd] = useState('');

  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const showAlert = (title: string, message: string) => {
    setAlert({ title, message });
    setTimeout(() => setAlert(null), 3000);
  };

  const [displayMode, setDisplayMode] = useState<'general' | 'room'>(user.dashboardDisplayMode || 'general');
  const [selectedClassId, setSelectedClassId] = useState<string>(user.pinnedClassId || '');

  const handlePinDashboardPreferences = async () => {
    if (!user.id) return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        dashboardDisplayMode: displayMode,
        pinnedClassId: selectedClassId,
        updatedAt: new Date().toISOString()
      });
      showAlert('Sucesso', 'Preferências do dashboard fixadas!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const [attendanceMonitoringStart, setAttendanceMonitoringStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [attendanceMonitoringEnd, setAttendanceMonitoringEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  useEffect(() => {
    if (config.attendanceMonitoringStartDate) {
      setAttendanceMonitoringStart(config.attendanceMonitoringStartDate);
      setTempAttendanceStart(config.attendanceMonitoringStartDate);
    }
    if (config.attendanceMonitoringEndDate) {
      setAttendanceMonitoringEnd(config.attendanceMonitoringEndDate);
      setTempAttendanceEnd(config.attendanceMonitoringEndDate);
    }
  }, [config.attendanceMonitoringStartDate, config.attendanceMonitoringEndDate]);

  const [showAttendanceMonitoringConfig, setShowAttendanceMonitoringConfig] = useState(false);
  const [tempAttendanceStart, setTempAttendanceStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [tempAttendanceEnd, setTempAttendanceEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [detailReportParams, setDetailReportParams] = useState<{
    type: 'classification' | 'ranking';
    id: string;
  } | null>(null);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [absenceDates, setAbsenceDates] = useState<Record<string, string[]>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  const isAdmin = user.role === 'admin';
  const hasFullAccess = propHasFullAccess ?? (user.allowedTabs ? user.allowedTabs.includes('dashboard') : isAdmin);
  const isCoordinator = user.role === 'coordinator';

  useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, 'calendarEvents'), (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents'));

    return () => {
      unsubEvents();
    };
  }, [user]);

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

  useEffect(() => {
    if (showColabBirthConfig) {
      setTempColabBirthStart(config.colabBirthdayStartDate || '');
      setTempColabBirthEnd(config.colabBirthdayEndDate || '');
    }
  }, [showColabBirthConfig]);

  // Stable Config Listener
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'dashboard'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Sync local layout from DB (DB priority)
        let l = data.layout ? (data.layout.includes('stats') ? data.layout : ['stats', ...data.layout]) : [...DEFAULT_LAYOUT];
        // ALWAYS ensure attendanceMonitoring and stats are present for everyone
        if (!l.includes('attendanceMonitoring')) {
          l = [...l, 'attendanceMonitoring'];
        }
        if (!l.includes('stats')) {
          l = ['stats', ...l.filter(u => u !== 'stats')];
        }
        
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
          colabBirthdayStartDate: data.colabBirthdayStartDate,
          colabBirthdayEndDate: data.colabBirthdayEndDate,
          attendanceMonitoringStartDate: data.attendanceMonitoringStartDate,
          attendanceMonitoringEndDate: data.attendanceMonitoringEndDate,
          layout: l,
          eventBarPosition: data.eventBarPosition || 'bottom',
          whatsappMessages: data.whatsappMessages || []
        }));

        setLocalLayout(l);
        localStorage.setItem('ebd_dashboard_layout', JSON.stringify(l));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'config/dashboard'));

    return () => unsubConfig();
  }, []);

  // Debounced auto-save for layout updates when isEditMode is active
  useEffect(() => {
    if (!isEditMode || localLayout.length === 0) return;

    const timer = setTimeout(() => {
      // Check if actually changed to avoid redundant writes
      if (JSON.stringify(localLayout) !== JSON.stringify(config.layout)) {
        updateConfig({ ...config, layout: localLayout });
      }
    }, 1500); // Debounce delay

    return () => clearTimeout(timer);
  }, [localLayout, isEditMode, config.layout]);

  // Handle reorder persistence
  const handleReorder = (newLayout: string[]) => {
    setLocalLayout(newLayout);
  };

  useEffect(() => {
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

    const studentsQuery = collection(db, 'students');
    
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const classesQuery = collection(db, 'classes');

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));

    const unsubEvents = onSnapshot(collection(db, 'calendarEvents'), (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents'));

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
      unsubEvents();
    };
  }, [user]);

  const updateConfig = async (updates: Partial<DashboardConfig>) => {
    setIsSavingConfig(true);
    try {
      // Save to localStorage as fallback
      if (updates.layout) {
        localStorage.setItem('ebd_dashboard_layout', JSON.stringify(updates.layout));
      }
      
      // Use setDoc with merge: true for partial updates
      await setDoc(doc(db, 'config', 'dashboard'), updates, { merge: true });
      showAlert('Sucesso', 'Configurações do dashboard atualizadas!');
      
      // State is handled by onSnapshot, but we can update it immediately for responsiveness
      // but only if it's safe. Actually, onSnapshot is very fast locally.
      // But let's close modals here.
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

  const filteredClasses = useMemo(() => {
    let yearClasses = classes.filter(c => c.schoolYear === selectedSchoolYear);
    
    // Access-based filtering
    if (!hasFullAccess) {
      yearClasses = yearClasses.filter(c => 
        c.teacherIds?.includes(user.id) || 
        c.teacherId === user.id ||
        user.classIds?.includes(c.id)
      );
    }

    // Mode-based filtering
    if (displayMode === 'room' && selectedClassId) {
      const specificClass = yearClasses.find(c => c.id === selectedClassId);
      if (specificClass) return [specificClass];
      // If selected class is not in allowed list for current year, return empty or all?
      // Usually return empty as the selection is invalid for current context.
      return [];
    }

    return yearClasses;
  }, [classes, selectedSchoolYear, hasFullAccess, user.id, user.classIds, displayMode, selectedClassId]);

  const filteredStudents = useMemo(() => {
    const yearStudents = students.filter(s => s.schoolYear === selectedSchoolYear);
    if (!hasFullAccess || displayMode === 'room') {
      const allowedClassIds = filteredClasses.map(c => c.id);
      return yearStudents.filter(s => 
        allowedClassIds.includes(s.classId) || 
        (s.classIds?.some(id => allowedClassIds.includes(id)))
      );
    }
    return yearStudents;
  }, [students, selectedSchoolYear, hasFullAccess, filteredClasses, displayMode]);
  
  const frequencyAlerts = useMemo(() => {
    return filteredStudents
      .filter(s => {
        const baseFilter = s.consecutiveAbsences >= (config.consecutiveAbsencesLimit || 2);
        if (!baseFilter) return false;
        if (config.frequencyStartDate || config.frequencyEndDate) {
          const studentAbsences = absenceDates[s.id] || [];
          const start = (config.frequencyStartDate && isValid(parseISO(config.frequencyStartDate))) ? parseISO(config.frequencyStartDate) : null;
          const end = (config.frequencyEndDate && isValid(parseISO(config.frequencyEndDate))) ? parseISO(config.frequencyEndDate) : null;
          if (!start && !end) return true;
          return studentAbsences.some(dateStr => {
            const d = parseISO(dateStr);
            return isValid(d) && (!start || d >= start) && (!end || d <= end);
          });
        }
        return true;
      })
      .sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);
  }, [filteredStudents, config.consecutiveAbsencesLimit, config.frequencyStartDate, config.frequencyEndDate, absenceDates]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const stats = [
    { label: 'Total Alunos', value: filteredStudents.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Membros da Equipe', value: teachers.length, icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Turmas Ativas', value: filteredClasses.length, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
    { label: 'Projetos', value: projects.length, icon: Briefcase, color: 'bg-amber-50 text-amber-600' },
  ];

  const calculateStudentPeriodAttendance = (studentId: string, startDate?: string, endDate?: string) => {
    const start = (startDate && isValid(parseISO(startDate))) ? parseISO(startDate) : null;
    const end = (endDate && isValid(parseISO(endDate))) ? parseISO(endDate) : null;
    const student = students.find(s => s.id === studentId);

    const relevantAttendance = attendanceRecords.filter(att => {
      const d = parseISO(att.date);
      const inPeriod = (!start || d >= start) && (!end || d <= end);
      
      const enrollmentDateStr = student?.enrollmentDates?.[att.classId];
      const exitDateStr = student?.exitDates?.[att.classId];
      const enrollmentStatus = student?.enrollmentStatuses?.[att.classId] || 'ativo';

      const afterEnroll = !enrollmentDateStr || att.date >= enrollmentDateStr;
      const isActiveStatus = enrollmentStatus === 'ativo';

      let beforeExit = true;
      if (exitDateStr) {
        if (isActiveStatus) {
          beforeExit = att.date <= exitDateStr;
        } else {
          beforeExit = att.date < exitDateStr;
        }
      }

      return inPeriod && afterEnroll && beforeExit && (att.presentStudentIds?.includes(studentId) || att.absentStudentIds?.includes(studentId));
    });

    if (relevantAttendance.length === 0) return 100; // Default to 100 if no records found in period

    const presentCount = relevantAttendance.filter(att => att.presentStudentIds?.includes(studentId)).length;
    return (presentCount / relevantAttendance.length) * 100;
  };

  const classAttendanceData = useMemo(() => {
    return filteredClasses.map(c => {
      const classStudents = filteredStudents.filter(s => s.classId === c.id);
      
      const start = (config.rankStartDate && isValid(parseISO(config.rankStartDate))) ? parseISO(config.rankStartDate) : null;
      const end = (config.rankEndDate && isValid(parseISO(config.rankEndDate))) ? parseISO(config.rankEndDate) : null;

      const relevantAttendance = attendanceRecords.filter(att => {
        const d = parseISO(att.date);
        return att.classId === c.id && (!start || d >= start) && (!end || d <= end);
      });

      let totalPossiblePresences = 0;
      relevantAttendance.forEach(att => {
        const studentsEnrolledAtThisDate = classStudents.filter(s => {
          const enrollmentDateStr = s.enrollmentDates?.[c.id];
          const exitDateStr = s.exitDates?.[c.id];
          const enrollmentStatus = s.enrollmentStatuses?.[c.id] || 'ativo';

          const afterEnroll = !enrollmentDateStr || att.date >= enrollmentDateStr;
          const isActiveStatus = enrollmentStatus === 'ativo';

          let beforeExit = true;
          if (exitDateStr) {
            if (isActiveStatus) {
              beforeExit = att.date <= exitDateStr;
            } else {
              beforeExit = att.date < exitDateStr;
            }
          }

          return afterEnroll && beforeExit;
        });
        totalPossiblePresences += studentsEnrolledAtThisDate.length;
      });

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
      const start = (config.classificationStartDate && isValid(parseISO(config.classificationStartDate))) ? config.classificationStartDate : undefined;
      const end = (config.classificationEndDate && isValid(parseISO(config.classificationEndDate))) ? config.classificationEndDate : undefined;
      const percent = calculateStudentPeriodAttendance(s.id, start, end);
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
    const studentStart = parseISO(birthdayStart);
    const studentEnd = parseISO(birthdayEnd);
    
    const colabStart = config.colabBirthdayStartDate ? parseISO(config.colabBirthdayStartDate) : parseISO(birthdayStart);
    const colabEnd = config.colabBirthdayEndDate ? parseISO(config.colabBirthdayEndDate) : parseISO(birthdayEnd);
    
    const allPeople: any[] = [
      ...filteredStudents.map(s => ({ ...s, type: 'Aluno' })),
      ...teachers.map(t => ({ ...t, type: 'Membro da Equipe' }))
    ];

    return allPeople.filter(person => {
      const bDateStr = person.birthDate;
      if (!bDateStr) return false;
      const bDate = parseISO(bDateStr);
      if (!isValid(bDate)) return false;

      // Check if birthday falls within the range (ignoring year)
      const currentYear = new Date().getFullYear();
      const bDateThisYear = new Date(currentYear, getMonth(bDate), getDate(bDate));
      
      const start = person.type === 'Aluno' ? studentStart : colabStart;
      const end = person.type === 'Aluno' ? studentEnd : colabEnd;

      return isWithinInterval(bDateThisYear, { start, end });
    }).sort((a, b) => {
      const dateA = parseISO(a.birthDate!);
      const dateB = parseISO(b.birthDate!);
      return getDate(dateA) - getDate(dateB);
    });
  }, [filteredStudents, teachers, birthdayStart, birthdayEnd, config.colabBirthdayStartDate, config.colabBirthdayEndDate]);

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
    <div className="space-y-6 pb-20 relative">
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] bg-white border-l-4 border-emerald-500 p-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px]"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{alert.title}</h4>
              <p className="text-xs text-slate-500 font-bold">{alert.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
          {hasFullAccess && (
            <div className="flex items-center gap-2">
               <button 
                onClick={() => {
                  if (isEditMode) {
                    // One final forced sync when turning off edit mode
                    updateConfig({ layout: localLayout });
                  }
                  setIsEditMode(!isEditMode);
                }}
                title={isEditMode ? "Desativar salvamento automático da ordem" : "Ativar salvamento automático da ordem"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-bold border shadow-sm",
                  isEditMode 
                    ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200 ring-offset-2 animate-pulse" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  isEditMode ? "bg-white" : "bg-slate-300"
                )} />
                <Settings className={cn("w-4 h-4", isEditMode ? "animate-spin-slow" : "")} />
                Fixar Ordem
              </button>
              <button 
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-sm font-bold text-slate-600"
              >
                <Settings className="w-4 h-4" />
                Configurar Limites
              </button>
            </div>
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

      {/* Dashboard Display Controls */}
      <div className="flex flex-wrap items-center gap-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm transition-all">
        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button 
            onClick={() => setDisplayMode('general')}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
              displayMode === 'general' 
                ? "bg-white text-indigo-600 shadow-md ring-1 ring-black/5" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Dados Gerais
          </button>
          <button 
            onClick={() => setDisplayMode('room')}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
              displayMode === 'room' 
                ? "bg-white text-indigo-600 shadow-md ring-1 ring-black/5" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Focus className="w-3.5 h-3.5" />
            Dados da Sala
          </button>
        </div>

        {displayMode === 'room' && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar Turma:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-xs min-w-[220px] transition-all hover:border-slate-300 shadow-inner"
            >
              <option value="">Selecione uma turma...</option>
              {classes
                .filter(c => c.schoolYear === selectedSchoolYear && (hasFullAccess || c.teacherIds?.includes(user.id) || c.teacherId === user.id || user.classIds?.includes(c.id)))
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <button 
          onClick={handlePinDashboardPreferences}
          className="md:ml-auto flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100/50 hover:scale-[1.02] active:scale-95 group"
        >
          <Pin className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
          Fixar Preferências
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
                onChange={(e) => updateConfig({ highFrequencyLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Limite Frequência Intermediária (%)</label>
              <input 
                type="number" 
                value={config.intermediateFrequencyLimit}
                onChange={(e) => updateConfig({ intermediateFrequencyLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 font-bold uppercase tracking-wider text-[10px]">Alerta Faltas Seguidas</label>
              <input 
                type="number" 
                value={config.consecutiveAbsencesLimit}
                onChange={(e) => updateConfig({ consecutiveAbsencesLimit: Number(e.target.value) })}
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
              onClick={() => setShowWhatsAppConfig(true)}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Configurar Mensagens WhatsApp
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

            <Reorder.Group 
              axis="y" 
              values={localLayout} 
              onReorder={(newLayout) => setLocalLayout(newLayout)}
              className="flex flex-col gap-6"
            >
              {localLayout.map((blockId, index) => {
                const currentLayout = localLayout;
                
                // Helper to render Draggable controls
                const DragControls = () => isEditMode ? (
                  <div className="absolute top-2 right-2 flex gap-1 z-20 bg-white/90 backdrop-blur p-1 rounded-lg border shadow-sm border-amber-200" onPointerDown={e => e.stopPropagation()}>
                    <div className="flex flex-col items-center border-r border-amber-100 pr-1 mr-1">
                      <label className="text-[8px] font-black text-amber-500 uppercase leading-none mb-1">Posição</label>
                      <input 
                        type="number" 
                        value={index + 1}
                        min="1"
                        max={currentLayout?.length || 7}
                        onChange={(e) => {
                          const newPos = parseInt(e.target.value) - 1;
                          if (isNaN(newPos) || newPos < 0 || !currentLayout || newPos >= currentLayout.length) return;
                          
                          const newLayout = [...currentLayout];
                          const [removed] = newLayout.splice(index, 1);
                          newLayout.splice(newPos, 0, removed);
                          setLocalLayout(newLayout);
                        }}
                        className="w-8 h-6 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-center text-amber-700 focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (index > 0 && currentLayout) {
                          const newLayout = [...currentLayout];
                          [newLayout[index], newLayout[index-1]] = [newLayout[index-1], newLayout[index]];
                          setLocalLayout(newLayout);
                        }
                      }}
                      className="p-1.5 hover:bg-amber-50 rounded text-amber-600"
                      title="Mover para cima"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button 
                       onClick={(e) => {
                        e.stopPropagation();
                        if (currentLayout && index < currentLayout.length - 1) {
                          const newLayout = [...currentLayout];
                          [newLayout[index], newLayout[index+1]] = [newLayout[index+1], newLayout[index]];
                          setLocalLayout(newLayout);
                        }
                      }}
                      className="p-1.5 hover:bg-amber-50 rounded text-amber-600"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <div className="px-2 py-1 bg-amber-600 text-[10px] font-black text-white rounded flex items-center uppercase tracking-widest whitespace-nowrap cursor-grab active:cursor-grabbing">
                      Mover
                    </div>
                  </div>
                ) : null;

                const wrapInItem = (content: React.ReactNode) => (
                  <Reorder.Item 
                    key={blockId} 
                    value={blockId}
                    dragListener={isEditMode}
                    className="relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    onDragEnd={() => {
                      // Final save when dragging stops
                      updateConfig({ ...config, layout: localLayout });
                    }}
                    whileDrag={{ 
                      scale: 1.02, 
                      zIndex: 50,
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    {content}
                  </Reorder.Item>
                );

                if (blockId === 'stats') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10 p-2 rounded-3xl")}>
                      {stats.map((stat, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
                          <div className={cn("p-4 rounded-xl", stat.color)}>
                            <stat.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );

                if (blockId === 'ranking') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <h3 className="text-lg font-bold text-slate-900">Ranking de Presença por Turma</h3>
                        </div>
                        <div className="flex items-center gap-2 relative">
                          <button 
                            onClick={() => setShowRankConfig(!showRankConfig)}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group/btn"
                          >
                            <Settings className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-500" />
                          </button>
                          <AnimatePresence>
                            {showRankConfig && (
                              <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Início</label>
                                      <input type="date" value={tempRankStart} onChange={(e) => setTempRankStart(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Fim</label>
                                      <input type="date" value={tempRankEnd} onChange={(e) => setTempRankEnd(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                  </div>
                                  <button onClick={() => { updateConfig({ rankStartDate: tempRankStart, rankEndDate: tempRankEnd }); setShowRankConfig(false); }} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all font-bold">Fixar Seleção</button>
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
                            <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                                    <p className="text-sm font-black text-slate-900 mb-2 uppercase tracking-tight">{label}</p>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex justify-between gap-4"><span>Presenças:</span> <span>{data.attendance}%</span></p>
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between gap-4"><span>Média Alunos:</span> <span>{data.avgPresent}</span></p>
                                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex justify-between gap-4"><span>Faltas:</span> <span>{data.absencePercent}%</span></p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Bar dataKey="attendance" radius={[0, 8, 8, 0]} barSize={20} onDoubleClick={(data) => handleOpenDetail('ranking', data.id)} style={{ cursor: 'pointer' }}>
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
                  </div>
                );

                if (blockId === 'classification') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("h-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-indigo-500" />
                          <h3 className="text-lg font-bold text-slate-900">Classificação de Alunos</h3>
                        </div>
                        <div className="relative">
                          <button onClick={() => setShowClassifConfig(!showClassifConfig)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group/btn">
                            <Settings className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" />
                          </button>
                          <AnimatePresence>
                            {showClassifConfig && (
                              <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Início</label>
                                      <input type="date" value={tempClassifStart} onChange={(e) => setTempClassifStart(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Fim</label>
                                      <input type="date" value={tempClassifEnd} onChange={(e) => setTempClassifEnd(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                  </div>
                                  <button onClick={() => { updateConfig({ classificationStartDate: tempClassifStart, classificationEndDate: tempClassifEnd }); setShowClassifConfig(false); }} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all font-bold">Fixar Seleção</button>
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
                              cx="50%" 
                              cy="50%" 
                              innerRadius={60} 
                              outerRadius={80} 
                              paddingAngle={5} 
                              dataKey="value" 
                              onDoubleClick={(data) => {
                                const mappedId = (data as any).name === 'Alta' ? 'high' : (data as any).name === 'Intermediária' ? 'intermediate' : 'low';
                                handleOpenDetail('classification', mappedId);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                                    <p className="text-xs font-black text-slate-900 uppercase">{(payload[0] as any).name}</p>
                                    <p className="text-xl font-black" style={{ color: (payload[0].payload as any).color }}>{(payload[0] as any).value} alunos</p>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-4">
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
                );

                if (blockId === 'studentsPerClass') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <h3 className="text-lg font-bold text-slate-900 mb-6 font-black uppercase tracking-tight">Alunos por Turma</h3>
                      <div className="space-y-4">
                        {classAttendanceData.map((c) => (
                          <div key={c.id} className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-slate-700">{c.name}</span>
                                <span className="text-sm text-slate-500 font-bold">{c.students} alunos</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(c.students / (students.length || 1)) * 100}%` }}></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );

                if (blockId === 'attendanceMonitoring') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-lg font-bold text-slate-900 font-black uppercase tracking-tight text-indigo-700">Monitoramento de Chamadas (Domingos)</h3>
                        </div>
                        <div className="relative">
                          <button onClick={() => setShowAttendanceMonitoringConfig(!showAttendanceMonitoringConfig)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group/btn"><Settings className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-500" /></button>
                          <AnimatePresence>
                            {showAttendanceMonitoringConfig && (
                              <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Início</label>
                                      <input type="date" value={tempAttendanceStart} onChange={(e) => setTempAttendanceStart(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Fim</label>
                                      <input type="date" value={tempAttendanceEnd} onChange={(e) => setTempAttendanceEnd(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                  </div>
                                  <button onClick={() => { updateConfig({ attendanceMonitoringStartDate: tempAttendanceStart, attendanceMonitoringEndDate: tempAttendanceEnd }); setShowAttendanceMonitoringConfig(false); }} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all font-bold">Fixar Período</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      
                      <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[300px]">
                        {(() => {
                          const start = parseISO(attendanceMonitoringStart);
                          const end = parseISO(attendanceMonitoringEnd);
                          
                          if (!isValid(start) || !isValid(end)) return null;

                          const sundays: Date[] = [];
                          let current = start;
                          while (current <= end) {
                            if (current.getDay() === 0) {
                              sundays.push(new Date(current));
                            }
                            current = new Date(current.getTime() + 86400000);
                          }

                          if (sundays.length === 0) return <div className="text-center py-12 text-slate-400 italic text-xs">Nenhum domingo no período.</div>;

                          return sundays.map(sunday => {
                            const dateStr = format(sunday, 'yyyy-MM-dd');
                            return (
                              <div key={dateStr} className="space-y-3">
                                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                    {format(sunday, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {filteredClasses.length > 0 ? (
                                    filteredClasses.map(cls => {
                                      const hasAttendance = attendanceRecords.some(r => r.classId === cls.id && r.date === dateStr);
                                      return (
                                        <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group transition-all">
                                          <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", hasAttendance ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]")}></div>
                                            <span className={cn("text-xs font-black uppercase tracking-tight truncate max-w-[150px]", hasAttendance ? "text-emerald-700" : "text-rose-700")}>
                                              {cls.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {hasAttendance ? (
                                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                <CheckCircle2 className="w-3 h-3" />
                                                CHAMADA REALIZADA
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                                                <XCircle className="w-3 h-3" />
                                                PENDENTE
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-[10px] text-slate-400 italic">Nenhuma turma cadastrada.</div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                );

                if (blockId === 'birthdaysStudents') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-indigo-500" />
                          <h3 className="text-lg font-bold text-slate-900 font-black uppercase tracking-tight">Aniversariantes - Alunos</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <input type="date" value={birthdayStart} onChange={(e) => setBirthdayStart(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none p-1" />
                            <span className="text-slate-300">|</span>
                            <input type="date" value={birthdayEnd} onChange={(e) => setBirthdayEnd(e.target.value)} className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none p-1" />
                          </div>
                          <button onClick={handlePrintBirthdays} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all font-bold"><Printer className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[200px]">
                        {weeklyBirthdays.filter(p => p.type === 'Aluno').length > 0 ? (
                          weeklyBirthdays.filter(p => p.type === 'Aluno').map((person) => (
                            <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm shadow-sm shrink-0">👶</div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{person.name}</p>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{classes.find(c => c.id === (person as any).classId)?.name || 'Sem Turma'}</p>
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
                  </div>
                );

                if (blockId === 'birthdaysColab') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-emerald-500" />
                          <h3 className="text-lg font-bold text-slate-900 font-black uppercase tracking-tight text-emerald-700">Aniversariantes - Membros da Equipe</h3>
                        </div>
                        <div className="relative">
                          <button onClick={() => setShowColabBirthConfig(!showColabBirthConfig)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group/btn"><Settings className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-500" /></button>
                          <AnimatePresence>
                            {showColabBirthConfig && (
                              <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Início</label>
                                      <input type="date" value={tempColabBirthStart} onChange={(e) => setTempColabBirthStart(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Fim</label>
                                      <input type="date" value={tempColabBirthEnd} onChange={(e) => setTempColabBirthEnd(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                  </div>
                                  <button onClick={() => { updateConfig({ colabBirthdayStartDate: tempColabBirthStart, colabBirthdayEndDate: tempColabBirthEnd }); setShowColabBirthConfig(false); }} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all font-bold">Fixar Seleção</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[200px]">
                        {weeklyBirthdays.filter(p => p.type === 'Membro da Equipe').length > 0 ? (
                          weeklyBirthdays.filter(p => p.type === 'Membro da Equipe').map((person) => (
                            <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm shadow-sm shrink-0">👨‍🏫</div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{person.name}</p>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-[9px] truncate">DOCENTE/ADMIN</p>
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
                  </div>
                );

                if (blockId === 'alerts') return wrapInItem(
                  <div className="relative group/block transition-all">
                    <DragControls />
                    <div className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-100", isEditMode && "border-2 border-dashed border-amber-200 bg-amber-50/10")}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-black">Alertas de Frequência</h3>
                            {(config.frequencyStartDate || config.frequencyEndDate) && (
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                {config.frequencyStartDate ? safeFormat(config.frequencyStartDate, 'dd/MM/yy') : 'Início'} — {config.frequencyEndDate ? safeFormat(config.frequencyEndDate, 'dd/MM/yy') : 'Fim'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 relative">
                          <button 
                            onClick={() => setShowWhatsAppConfig(true)} 
                            className="p-2 hover:bg-emerald-50 rounded-xl transition-all text-emerald-500 group/wa" 
                            title="Configurar Mensagens WhatsApp"
                          >
                            <MessageSquare className="w-5 h-5 group-hover/wa:scale-110 transition-transform" />
                          </button>
                          <button onClick={() => setShowQuickAlertConfig(!showQuickAlertConfig)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 group/btn" title="Configurar Alerta">
                            <Settings className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" />
                          </button>
                          <AnimatePresence>
                            {showQuickAlertConfig && (
                              <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }} className="absolute right-full top-0 mr-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 min-w-[240px] z-50">
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Faltas para Alerta</label>
                                    <div className="flex items-center gap-2">
                                      <input type="number" min="1" value={tempConsecutiveLimit} onChange={(e) => setTempConsecutiveLimit(parseInt(e.target.value) || 1)} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Faltas</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Início Período</label>
                                      <input type="date" value={tempFreqStart} onChange={(e) => setTempFreqStart(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-bold tracking-widest">Fim Período</label>
                                      <input type="date" value={tempFreqEnd} onChange={(e) => setTempFreqEnd(e.target.value)} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none" />
                                    </div>
                                  </div>
                                  <button onClick={() => { updateConfig({ consecutiveAbsencesLimit: tempConsecutiveLimit, frequencyStartDate: tempFreqStart, frequencyEndDate: tempFreqEnd }); setShowQuickAlertConfig(false); }} className="w-full py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold">Fixar Alerta</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {frequencyAlerts.length > 0 ? (
                          frequencyAlerts.map(student => {
                            const lastClass = classes.find(c => c.id === student.classId) || classes.find(c => student.classIds?.includes(c.id));
                            return (
                              <div key={student.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-red-100/50 transition-all gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-red-100 shrink-0">⚠️</div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-black text-red-900 uppercase leading-none truncate">{student.name}</p>
                                      {student.phone && (
                                        <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                                          <Phone className="w-2.5 h-2.5" />
                                          {student.phone}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mt-1">Faltou {student.consecutiveAbsences} vezes seguidas!</p>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Turma: {lastClass?.name || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setWhatsAppStudent(student);
                                      setCustomWhatsAppMessage("");
                                      setSelectedWhatsAppTemplate(config.whatsappMessages?.[0] || "");
                                      setShowWhatsAppModal(true);
                                    }}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-md flex items-center justify-center gap-2"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    Falar no WhatsApp
                                  </button>
                                  <button 
                                    onClick={() => { setResolvingStudent(student); setResolutionNote(''); setShowResolveModal(true); }} 
                                    className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-md"
                                  >
                                    Resolvido
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-12 text-slate-400 italic text-xs">Sem alertas de frequência no momento.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );

                return null;
              })}
            </Reorder.Group>
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
                    const start = (reportStartDate && isValid(parseISO(reportStartDate))) ? parseISO(reportStartDate) : null;
                    const end = (reportEndDate && isValid(parseISO(reportEndDate))) ? parseISO(reportEndDate) : null;
                    const matchDate = (!start || rDate >= start) && (!end || rDate <= end);
                    
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
                  const start = (reportStartDate && isValid(parseISO(reportStartDate))) ? parseISO(reportStartDate) : null;
                  const end = (reportEndDate && isValid(parseISO(reportEndDate))) ? parseISO(reportEndDate) : null;
                  const matchDate = (!start || rDate >= start) && (!end || rDate <= end);
                  
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
    {showWhatsAppConfig && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100"
        >
          <div className="p-6 border-b border-slate-50 flex justify-between items-center text-emerald-600">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Mensagens WhatsApp</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Gerencie os textos para contatos rápidos</p>
            </div>
            <button onClick={() => setShowWhatsAppConfig(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Nova mensagem WhatsApp..."
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTemplateText.trim()) {
                    const messages = config.whatsappMessages || [];
                    updateConfig({ whatsappMessages: [...messages, newTemplateText.trim()] });
                    setNewTemplateText('');
                  }
                }}
              />
              <button 
                disabled={!newTemplateText.trim()}
                onClick={() => {
                  const messages = config.whatsappMessages || [];
                  updateConfig({ whatsappMessages: [...messages, newTemplateText.trim()] });
                  setNewTemplateText('');
                }}
                className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-black disabled:opacity-50"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensagem Padrão (Sempre presente)</span>
                </div>
                <span className="text-sm font-bold text-slate-600">Olá, Graça e paz. Estamos sentindo muito a sua falta nessas últimas semanas em nossa EBD. Queremos incentivar sua presença já nesse próximo domingo para juntos aprendermos mais da Palavra do Senhor. Podemos contar com a sua presença?</span>
              </div>
              {config.whatsappMessages?.map((msg, idx) => (
                <div key={idx} className="flex items-start justify-between p-4 bg-white rounded-2xl border border-slate-100 group hover:border-emerald-200 hover:bg-emerald-50/10 transition-all gap-4">
                  <span className="text-sm font-bold text-slate-700 flex-1 whitespace-pre-wrap">{msg}</span>
                  <button 
                    onClick={() => {
                      const messages = [...(config.whatsappMessages || [])];
                      messages.splice(idx, 1);
                      updateConfig({ whatsappMessages: messages });
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!config.whatsappMessages || config.whatsappMessages.length === 0) && (
                <p className="text-center py-8 text-slate-400 italic text-xs">Padrão cadastrado.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    )}

    {showWhatsAppModal && whatsAppStudent && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={() => setShowWhatsAppModal(false)}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-emerald-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1 text-white">WhatsApp</h3>
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest leading-none line-clamp-1">{whatsAppStudent.name}</p>
              </div>
            </div>
            <button onClick={() => setShowWhatsAppModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Número Aluno/Responsável</label>
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">{whatsAppStudent.phone || 'NÃO CADASTRADO'}</span>
              </div>
              {!whatsAppStudent.phone && (
                <p className="mt-1 text-[9px] text-red-500 font-bold uppercase tracking-widest leading-none">⚠️ Adicione o telefone no cadastro para falar.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Escolha uma Mensagem</label>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                <button
                  onClick={() => {
                    setSelectedWhatsAppTemplate("default");
                    setCustomWhatsAppMessage("");
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all text-xs font-bold uppercase whitespace-pre-wrap",
                    selectedWhatsAppTemplate === "default" && !customWhatsAppMessage
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300"
                  )}
                >
                  Olá, Graça e paz. Estamos sentindo muito a sua falta nessas últimas semanas em nossa EBD. Queremos incentivar sua presença já nesse próximo domingo para juntos aprendermos mais da Palavra do Senhor. Podemos contar com a sua presença?
                </button>
                {config.whatsappMessages?.map((msg, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedWhatsAppTemplate(msg);
                      setCustomWhatsAppMessage("");
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all text-xs font-bold uppercase whitespace-pre-wrap",
                      selectedWhatsAppTemplate === msg && !customWhatsAppMessage
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300"
                    )}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ou escreva uma mensagem agora</label>
              <textarea 
                value={customWhatsAppMessage}
                onChange={(e) => setCustomWhatsAppMessage(e.target.value)}
                placeholder="Ex: Olá, notamos sua ausência..."
                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all resize-none font-medium"
              ></textarea>
            </div>

            <div className="pt-2">
              <button 
                disabled={!whatsAppStudent.phone}
                onClick={() => {
                  if (!whatsAppStudent.phone) return;
                  const cleanPhone = whatsAppStudent.phone.replace(/\D/g, '');
                  const defaultMsg = "Olá, Graça e paz. Estamos sentindo muito a sua falta nessas últimas semanas em nossa EBD. Queremos incentivar sua presença já nesse próximo domingo para juntos aprendermos mais da Palavra do Senhor. Podemos contar com a sua presença?";
                  const finalMsg = customWhatsAppMessage.trim() || 
                                  (selectedWhatsAppTemplate === 'default' ? defaultMsg : selectedWhatsAppTemplate) ||
                                  defaultMsg;
                  
                  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMsg)}`;
                  window.open(url, '_blank');
                  setShowWhatsAppModal(false);
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:grayscale disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                Deseja enviar mensagem agora?
                <ExternalLink className="w-4 h-4 ml-auto opacity-50" />
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
