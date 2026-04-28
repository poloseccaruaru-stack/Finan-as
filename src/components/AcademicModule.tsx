import { useState, useEffect, useMemo, useRef } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  limit
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  CheckCircle2, 
  XCircle, 
  UserPlus,
  BookOpen,
  LayoutDashboard,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  FileText,
  AlertCircle,
  Save,
  Check,
  ArrowUpDown,
  Filter,
  Printer,
  Calendar,
  Copy,
  Eye,
  Pin,
  X,
  Clock,
  LayoutGrid,
  List,
  Minus,
  GripVertical
} from 'lucide-react';
import { format, differenceInYears, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Student, Teacher, Class, Attendance, Planning, JustificationOption, StudentReport, TeacherReport, Enrollment, AccessProfile } from '../types';
import { cn, safeFormat } from '../lib/utils';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { DiaryReportModal } from './DiaryReportModal';

interface Props {
  user: Teacher;
  subTab: 'students' | 'teachers' | 'classes' | 'attendance' | 'schoolYear' | 'meetings';
  selectedSchoolYear: string;
  onImpersonate?: (teacher: Teacher) => void;
  hasFullAccess?: boolean;
}

type SortField = 'name' | 'age' | 'class';

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

function AttendanceStudentCard({ 
  student, 
  index, 
  markingOrderMode, 
  markingZoom, 
  attendanceList, 
  justifications, 
  setAttendanceList, 
  setReportTargetId, 
  setReportType, 
  setShowReportListModal,
  setCurrentJustifyStudent, 
  setShowJustifyModal, 
  moveStudent, 
  isLast,
  isSelected,
  onSelect,
  onNumberChange
}: any) {
  const controls = useDragControls();
  const [localNumber, setLocalNumber] = useState(index + 1);
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setLocalNumber(index + 1);
  }, [index]);

  useEffect(() => {
    if (isSelected && markingOrderMode && document.activeElement !== itemRef.current) {
      itemRef.current?.focus();
    }
  }, [isSelected, markingOrderMode]);

  const handleNumberBlur = () => {
    const nextIdx = parseInt(String(localNumber)) - 1;
    if (!isNaN(nextIdx) && nextIdx !== index) {
      onNumberChange(index, nextIdx);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!markingOrderMode) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveStudent(index, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveStudent(index, 'down');
    }
  };

  return (
    <Reorder.Item
      value={student.id}
      dragControls={controls}
      dragListener={false}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={itemRef}
      tabIndex={markingOrderMode ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={() => markingOrderMode && onSelect(student.id)}
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        backgroundColor: "white",
        zIndex: 50
      }}
      className={cn(
        "flex items-center justify-between transition-all rounded-xl border group relative outline-none",
        markingZoom === 1 ? "p-2" : markingZoom === 2 ? "p-4" : "p-6",
        isSelected && markingOrderMode ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/30" : "",
        !markingOrderMode && (attendanceList[student.id] === 'present' || attendanceList[student.id] === true)
          ? "bg-green-50 border-green-200 text-green-700" 
          : !markingOrderMode ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200"
      )}
    >
      <div className="flex items-center gap-3">
        {markingOrderMode && (
          <div className="flex items-center gap-2 mr-2">
            <input 
              type="text"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value)}
              onBlur={handleNumberBlur}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as any).blur()}
              className="w-8 h-8 text-center text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              title="Número na chamada"
            />
            <div className="flex items-center gap-1">
              <div 
                onPointerDown={(e) => controls.start(e)}
                className="cursor-grab active:cursor-grabbing p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Arraste para reordenar"
              >
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); moveStudent(index, 'up'); }}
                  disabled={index === 0}
                  className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); moveStudent(index, 'down'); }}
                  disabled={isLast}
                  className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div 
           className={cn("flex items-center gap-3 transition-opacity", markingOrderMode ? "cursor-grab active:cursor-grabbing" : "")}
           onPointerDown={(e) => markingOrderMode && controls.start(e)}
        >
          <div className={cn(
            "rounded-full flex items-center justify-center font-bold shrink-0",
            markingZoom === 1 ? "w-6 h-6 text-[10px]" : markingZoom === 2 ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
            (attendanceList[student.id] === 'present' || attendanceList[student.id] === true) ? "bg-green-200" : "bg-red-200"
          )}>
            {student.name.charAt(0)}
          </div>
          <div className="text-left">
            <span className={cn(
              "font-medium block",
              markingZoom === 1 ? "text-[11px]" : markingZoom === 2 ? "text-sm" : "text-base"
            )}>{student.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {justifications[student.id] && (
                <span className="text-[10px] text-slate-500 italic">J: {justifications[student.id]}</span>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setReportTargetId(student.id);
                  setReportType('student');
                  setShowReportListModal(true);
                }}
                className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-all"
                title="Ver histórico de relatórios"
              >
                <FileText className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { 
            e.stopPropagation(); 
            setAttendanceList((prev: any) => ({ 
              ...prev, 
              [student.id]: (prev[student.id] === 'present' || prev[student.id] === true) ? 'absent' : 'present' 
            })); 
          }}
          className={cn(
            "rounded-xl flex items-center justify-center transition-all shadow-sm",
            markingZoom === 1 ? "w-10 h-10" : markingZoom === 2 ? "w-12 h-12" : "w-14 h-14",
            (attendanceList[student.id] === 'present' || attendanceList[student.id] === true) ? "bg-green-600 text-white shadow-green-100" : "bg-red-600 text-white shadow-red-100"
          )}
          title={(attendanceList[student.id] === 'present' || attendanceList[student.id] === true) ? "Presente (Clique para Falta)" : "Falta (Clique para Presente)"}
        >
          {(attendanceList[student.id] === 'present' || attendanceList[student.id] === true) ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <XCircle className="w-6 h-6" />
          )}
        </button>
        
        <AnimatePresence>
          {!(attendanceList[student.id] === 'present' || attendanceList[student.id] === true) && (
            <motion.button 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentJustifyStudent(student.id);
                setShowJustifyModal(true);
              }}
              className={cn(
                "rounded-lg flex items-center justify-center font-bold transition-all",
                markingZoom === 1 ? "w-10 h-10 text-xs" : markingZoom === 2 ? "w-12 h-12 text-sm" : "w-14 h-14 text-base",
                justifications[student.id] ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              )}
              title="Justificar falta"
            >
              J
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  );
}

const MODULES_SUB_AREAS_LINKING: Record<string, string[]> = {
  academic: ['students', 'teachers', 'classes', 'attendance', 'schoolYear', 'regimento', 'calendar', 'planning'],
  projects: ['projects'],
  dashboard: ['dashboard'],
  finance: ['finance'],
  reports: ['reports'],
  administrative: ['admin', 'system', 'comunicados', 'documentos', 'meetings', 'organogram']
};

export default function AcademicModule({ user, subTab, selectedSchoolYear, onImpersonate, hasFullAccess: propHasFullAccess }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [justificationOptions, setJustificationOptions] = useState<JustificationOption[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [teacherReports, setTeacherReports] = useState<TeacherReport[]>([]);
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [currentJustifyStudent, setCurrentJustifyStudent] = useState<string | null>(null);
  const [newJustification, setNewJustification] = useState('');
  const [attendanceFilterMonth, setAttendanceFilterMonth] = useState(safeFormat(new Date(), 'yyyy-MM') || "");
  const [attendanceFilterClass, setAttendanceFilterClass] = useState<string>('all');
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportListModal, setShowReportListModal] = useState(false);
  const [showGeneralReportModal, setShowGeneralReportModal] = useState(false);
  const [showRangeReportModal, setShowRangeReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd') || "");
  const [reportEndDate, setReportEndDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd') || "");
  const [reportType, setReportType] = useState<'student' | 'professor'>('student');
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [viewingAttendance, setViewingAttendance] = useState<Attendance | null>(null);
  const [reportFilterClass, setReportFilterClass] = useState<string>('all');
  const [reportContent, setReportContent] = useState('');
  const [reportDate, setReportDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd') || "");
  const [newReportContent, setNewReportContent] = useState('');
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [showDiaryRangeBar, setShowDiaryRangeBar] = useState(false);
  const [diaryStartDate, setDiaryStartDate] = useState(safeFormat(new Date(), 'yyyy-MM-01') || "");
  const [diaryEndDate, setDiaryEndDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd') || "");
  const [aulaObjetivos, setAulaObjetivos] = useState<'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA'>('SIM');
  const [alunosParticiparam, setAlunosParticiparam] = useState<'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA'>('SIM');
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloningClass, setCloningClass] = useState<Class | null>(null);
  const [resetAttendanceOnClone, setResetAttendanceOnClone] = useState(true);

  const generateRegistrationNumber = async (collectionName: 'students' | 'users') => {
    const currentYear = new Date().getFullYear().toString();
    const q = query(
      collection(db, collectionName),
      where('registrationNumber', '>=', currentYear),
      where('registrationNumber', '<=', currentYear + '\uf8ff'),
      orderBy('registrationNumber', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    let nextSeq = 1;
    if (!snap.empty) {
      const lastNum = snap.docs[0].data().registrationNumber;
      if (lastNum && lastNum.startsWith(currentYear)) {
        const lastSeq = parseInt(lastNum.substring(4));
        nextSeq = lastSeq + 1;
      }
    }
    return `${currentYear}${nextSeq.toString().padStart(3, '0')}`;
  };
  const [versiculoCitado, setVersiculoCitado] = useState<'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA'>('SIM');
  const [houveOferta, setHouveOferta] = useState<'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA'>('SIM');
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [schoolYearConfig, setSchoolYearConfig] = useState<any>(null);
  const [showReenrollmentSummary, setShowReenrollmentSummary] = useState(false);
  const [reenrollmentSummary, setReenrollmentSummary] = useState({
    studentsReenrolled: 0,
    studentsCompleted: 0,
    classesCreated: 0
  });

  const [workingStudentOrder, setWorkingStudentOrder] = useState<string[]>([]);
  const [showDiaryReport, setShowDiaryReport] = useState(false);
  const [diaryReportClass, setDiaryReportClass] = useState<string | null>(null);
  const [diaryReportMonth, setDiaryReportMonth] = useState(safeFormat(new Date(), 'yyyy-MM') || "");
  const [diaryReportBimestre, setDiaryReportBimestre] = useState<'1º' | '2º' | '3º' | '4º'>('1º');

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

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator' || isAdmin;
  const isProfessorEBD = user.role === 'professor_ebd';
  const isProfessor = user.role === 'professor';
  const hasFullAccess = propHasFullAccess ?? (
    isAdmin || 
    (user.permissions && (user.permissions['academic'] === 'full' || user.permissions['administrative'] === 'full')) ||
    (!user.permissions && user.allowedTabs && (user.allowedTabs.includes('admin') || user.allowedTabs.includes('system') || user.allowedTabs.includes('teachers') || user.allowedTabs.includes('classes'))) ||
    (!user.permissions && !user.allowedTabs && (isAdmin || isCoordinator || isProfessorEBD))
  );

  const isClassFinalized = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return false;
    if (cls.status !== 'ENCERRADA') return false;
    const hasNextYearClass = classes.some(c => c.originalClassId === cls.id);
    return hasNextYearClass;
  };

  // Fetch Data
  useEffect(() => {
    const classIds = user?.classIds || [];
    const userId = user?.id;
    
    if (!userId) {
      setLoading(false);
      return;
    }

    const studentsQuery = query(collection(db, 'students'), where('schoolYear', '==', selectedSchoolYear));

    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching students:', err);
      handleFirestoreError(err, OperationType.LIST, 'students');
      setLoading(false);
    });

    const classesQuery = collection(db, 'classes');

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubJustifications = onSnapshot(collection(db, 'justificationOptions'), (snap) => {
      setJustificationOptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as JustificationOption)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'justificationOptions'));

    const unsubAttendances = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    const unsubStudentReports = onSnapshot(collection(db, 'student_reports'), (snap) => {
      setStudentReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentReport)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'student_reports'));

    const unsubTeacherReports = onSnapshot(collection(db, 'teacher_reports'), (snap) => {
      setTeacherReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherReport)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'teacher_reports'));

    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snap) => {
      setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'profiles'));

    const unsubMeetings = onSnapshot(collection(db, 'meetings'), (snap) => {
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'meetings'));

    const unsubSchoolYear = onSnapshot(doc(db, 'config', 'schoolYear'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSchoolYearConfig(data);
        if (data.startDate) {
          setSchoolYear(data.startDate.split('-')[0]);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'config/schoolYear'));

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubClasses();
      unsubJustifications();
      unsubAttendances();
      unsubStudentReports();
      unsubTeacherReports();
      unsubProfiles();
      unsubMeetings();
      unsubSchoolYear();
    };
  }, [user?.id, user?.role, JSON.stringify(user?.classIds), hasFullAccess, isAdmin, selectedSchoolYear]);

  useEffect(() => {
    if (selectedClass) {
      const cls = classes.find(c => c.id === selectedClass);
      if (cls) {
        const classStudentsIds = students
          .filter(s => (s.classId === selectedClass || s.classIds?.includes(selectedClass)))
          .map(s => s.id);

        if (cls.isOrderFixed && cls.studentOrder && cls.studentOrder.length > 0) {
          // Keep only students currently in class, preserving order
          const existingOrder = cls.studentOrder.filter(id => classStudentsIds.includes(id));
          // Add any new students at the end
          const newStudents = classStudentsIds.filter(id => !existingOrder.includes(id));
          setWorkingStudentOrder(prev => {
            // Only update if the base class or students list meaningfully changed and we don't have a local sequence being edited
            const nextOrder = [...existingOrder, ...newStudents];
            return JSON.stringify(prev) === JSON.stringify(nextOrder) ? prev : nextOrder;
          });
        } else {
          // Default: Alphabetical
          const alphaOrder = students
            .filter(s => classStudentsIds.includes(s.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(s => s.id);
          setWorkingStudentOrder(prev => {
             return JSON.stringify(prev) === JSON.stringify(alphaOrder) ? prev : alphaOrder;
          });
        }
      }
    } else {
      setWorkingStudentOrder([]);
    }
  }, [selectedClass, students.length, classes.find(c => c.id === selectedClass)?.studentOrder?.length, classes.find(c => c.id === selectedClass)?.isOrderFixed]);

  const moveStudent = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...workingStudentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setWorkingStudentOrder(newOrder);
    }
  };

  const handleManualReorder = (fromIndex: number, toIndex: number) => {
    const newOrder = [...workingStudentOrder];
    const item = newOrder.splice(fromIndex, 1)[0];
    const target = Math.max(0, Math.min(toIndex, newOrder.length));
    newOrder.splice(target, 0, item);
    setWorkingStudentOrder(newOrder);
  };

  const handleSaveOrderPreference = async () => {
    if (!selectedClass) return;
    const cls = classes.find(c => c.id === selectedClass);
    if (!cls) return;

    try {
      await updateDoc(doc(db, 'classes', selectedClass), {
        isOrderFixed: true,
        studentOrder: workingStudentOrder,
        updatedAt: new Date().toISOString()
      });
      showAlert('Sucesso', 'Preferencia de ordem salva e fixada com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${selectedClass}`);
    }
  };

  // Sorting and Filtering Logic
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterClass === 'all' || s.classId === filterClass || s.classIds?.includes(filterClass)) &&
      (s.schoolYear === selectedSchoolYear)
    );

    result.sort((a, b) => {
      let valA: any = a.name;
      let valB: any = b.name;

      if (sortField === 'age') {
        valA = differenceInYears(new Date(), parseISO(a.birthDate));
        valB = differenceInYears(new Date(), parseISO(b.birthDate));
      } else if (sortField === 'class') {
        valA = classes.find(c => c.id === a.classId)?.name || '';
        valB = classes.find(c => c.id === b.classId)?.name || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, searchTerm, filterClass, sortField, sortOrder, classes, selectedSchoolYear]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c => c.schoolYear === selectedSchoolYear);
  }, [classes, selectedSchoolYear]);

  const filteredClassesForAttendance = useMemo(() => {
    if (hasFullAccess) return filteredClasses;
    return filteredClasses.filter(c => 
      c.teacherIds?.includes(user.id) || 
      c.teacherId === user.id ||
      user.classIds?.includes(c.id)
    );
  }, [filteredClasses, hasFullAccess, user.id, user.classIds]);

  // Forms State
  const [attendanceViewMode, setAttendanceViewMode] = useState<'list' | 'months' | 'icons'>('list');
  const [selectedOrderStudentId, setSelectedOrderStudentId] = useState<string | null>(null);
  const [attendanceFilterClasses, setAttendanceFilterClasses] = useState<string[]>(['all']);
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');

  const [viewingStudentHistory, setViewingStudentHistory] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<Enrollment[]>([]);

  useEffect(() => {
    if (viewingStudentHistory) {
      const q = query(collection(db, 'enrollments'), where('studentId', '==', viewingStudentHistory.id));
      const unsub = onSnapshot(q, (snap) => {
        setStudentHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments'));
      return () => unsub();
    }
  }, [viewingStudentHistory]);

  const [studentForm, setStudentForm] = useState({
    name: '',
    birthDate: '',
    address: '',
    guardians: '',
    emergencyContact: '',
    phone: '',
    history: '',
    classId: '',
    classIds: [] as string[],
    schoolYear: selectedSchoolYear,
    doNotRenew: false,
    status: 'ativo' as 'ativo' | 'concluído' | 'transferido' | 'evadido'
  });

interface TeacherFormState {
  name: string;
  email: string;
  login: string;
  password?: string;
  confirmPassword?: string;
  contact: string;
  profession: string;
  startDateEBD: string;
  birthDate: string;
  generalProfile: string;
  role: string;
  classIds: string[];
  allowedTabs: string[];
  address: string;
  academicBackground: string;
  theologicalBackground: string;
  turmas: Record<string, boolean>;
  modulos: Record<string, boolean>;
  subAreas: Record<string, boolean>;
  permissions?: Record<string, 'read' | 'full'>;
}

const [teacherForm, setTeacherForm] = useState<TeacherFormState>({
  name: '',
  email: '',
  login: '',
  password: '',
  confirmPassword: '',
  contact: '',
  profession: '',
  startDateEBD: '',
  birthDate: '',
  generalProfile: '',
  role: '',
  classIds: [] as string[],
  allowedTabs: ['dashboard', 'academic', 'projects', 'reports'] as string[],
  address: '',
  academicBackground: '',
  theologicalBackground: '',
  // Organized state for checkboxes
  turmas: {} as Record<string, boolean>,
  modulos: {
    dashboard: false,
    academic: false,
    administrative: false,
    projects: false,
    finance: false,
    reports: false
  } as Record<string, boolean>,
  subAreas: {
    students: false,
    teachers: false,
    classes: false,
    attendance: false,
    planning: false,
    schoolYear: false,
    regimento: false,
    calendar: false,
    organogram: false,
    system: false,
    comunicados: false,
    documentos: false,
    meetings: false
  } as Record<string, boolean>,
  permissions: {} as Record<string, 'read' | 'full'>
});

  // Sync forms with selectedSchoolYear
  useEffect(() => {
    setStudentForm(prev => ({ ...prev, schoolYear: selectedSchoolYear }));
    setClassForm(prev => ({ ...prev, schoolYear: selectedSchoolYear }));
  }, [selectedSchoolYear]);

  // Auto-filter attendance list when a class is selected in the marking section
  useEffect(() => {
    if (subTab === 'attendance' && selectedClass) {
      if (isAdmin) {
        setAttendanceFilterClasses([selectedClass]);
      } else {
        setAttendanceFilterClass(selectedClass);
      }
    }
  }, [selectedClass, subTab, isAdmin]);

  const [classForm, setClassForm] = useState({
    name: '',
    ageRange: '',
    teacherId: '',
    teacherIds: [] as string[],
    schoolYear: selectedSchoolYear,
    gradeLevel: 0,
    isFinalGrade: false
  });

  const [editingClass, setEditingClass] = useState<Class | null>(null);

  const [meetingForm, setMeetingForm] = useState({
    type: 'ADMINISTRATIVA' as any,
    title: '',
    content: '',
    date: safeFormat(new Date(), 'yyyy-MM-dd') || "",
    participants: ''
  });
  const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<any | null>(null);

  const handleDeleteStudent = async (id: string) => {
    showAdminConfirm('Excluir Aluno', 'Deseja realmente excluir este aluno?', async () => {
      try {
        await deleteDoc(doc(db, 'students', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
      }
    });
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...meetingForm,
        updatedAt: new Date().toISOString()
      };
      if (editingMeeting) {
        await updateDoc(doc(db, 'meetings', editingMeeting.id), data);
      } else {
        await addDoc(collection(db, 'meetings'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingMeeting(null);
      setMeetingForm({ type: 'ADMINISTRATIVA', title: '', content: '', date: safeFormat(new Date(), 'yyyy-MM-dd') || "", participants: '' });
    } catch (err) {
      handleFirestoreError(err, editingMeeting ? OperationType.UPDATE : OperationType.CREATE, 'meetings');
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    showAdminConfirm('Excluir Reunião', 'Deseja realmente excluir esta ata de reunião?', async () => {
      try {
        await deleteDoc(doc(db, 'meetings', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `meetings/${id}`);
      }
    });
  };
  const handleDeleteTeacher = async (id: string) => {
    showAdminConfirm('Excluir Membro da Equipe', 'Deseja realmente excluir este membro?', async () => {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
      }
    });
  };

  const handleDeleteClass = async (id: string) => {
    showAdminConfirm('Excluir Turma', 'Deseja realmente excluir esta turma?', async () => {
      try {
        await deleteDoc(doc(db, 'classes', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `classes/${id}`);
      }
    });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedForm = {
        name: studentForm.name || "",
        birthDate: studentForm.birthDate || "",
        address: studentForm.address || "",
        guardians: studentForm.guardians || "",
        emergencyContact: studentForm.emergencyContact || "",
        phone: studentForm.phone || "",
        history: studentForm.history || "",
        classId: studentForm.classIds[0] || "",
        classIds: studentForm.classIds.filter(id => id !== ""),
        schoolYear: studentForm.schoolYear || selectedSchoolYear,
        doNotRenew: studentForm.doNotRenew || false,
        status: studentForm.status || 'ativo'
      };

      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), sanitizedForm);
      } else {
        const registrationNumber = await generateRegistrationNumber('students');
        await addDoc(collection(db, 'students'), {
          ...sanitizedForm,
          registrationNumber,
          consecutiveAbsences: 0,
          attendancePercentage: 100,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingStudent(null);
      setStudentForm({ name: '', birthDate: '', address: '', guardians: '', emergencyContact: '', phone: '', history: '', classId: '', classIds: [], schoolYear: selectedSchoolYear, doNotRenew: false, status: 'ativo' });
    } catch (err) {
      handleFirestoreError(err, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleAddReport = async () => {
    if (!newReportContent.trim() || !reportTargetId) return;
    setIsSavingReport(true);
    try {
      if (reportType === 'student') {
        await addDoc(collection(db, 'student_reports'), {
          studentId: reportTargetId,
          teacherId: auth.currentUser?.uid || 'system',
          content: newReportContent.trim(),
          date: safeFormat(new Date(), 'yyyy-MM-dd'),
          createdAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'teacher_reports'), {
          targetTeacherId: reportTargetId,
          adminId: auth.currentUser?.uid || 'system',
          content: newReportContent.trim(),
          date: safeFormat(new Date(), 'yyyy-MM-dd'),
          createdAt: new Date().toISOString()
        });
      }
      setNewReportContent('');
      showAlert('Sucesso', 'Relatório cadastrado com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, reportType === 'student' ? 'student_reports' : 'teacher_reports');
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    if (student.classId && isClassFinalized(student.classId)) {
      showAlert('Turma Finalizada', 'Esta turma já foi encerrada e não permite alterações nos registros.');
      return;
    }
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      birthDate: student.birthDate,
      address: student.address || '',
      guardians: student.guardians,
      emergencyContact: student.emergencyContact,
      phone: student.phone || '',
      history: student.history,
      classId: student.classId || '',
      classIds: student.classIds || (student.classId ? [student.classId] : []),
      schoolYear: student.schoolYear || selectedSchoolYear,
      doNotRenew: student.doNotRenew || false,
      status: student.status || 'ativo'
    });
    setShowForm(true);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teacherForm.name || !teacherForm.email || (!editingTeacher && !teacherForm.password)) {
      showAlert('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!editingTeacher && teacherForm.password !== teacherForm.confirmPassword) {
      showAlert('Erro de Senha', 'A senha e a confirmação não coincidem.');
      return;
    }

    if (!editingTeacher && teacherForm.password.length < 6) {
      showAlert('Senha Curta', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    const actuallySaveTeacher = async () => {
      try {
        // Convert structured state back to arrays for persistence
        const classIds = teacherForm.classIds.filter(id => id !== "");
        
        const allowedTabsSet = new Set<string>();
        Object.keys(teacherForm.modulos).forEach(m => {
          if (teacherForm.modulos[m]) allowedTabsSet.add(m);
        });
        Object.keys(teacherForm.subAreas).forEach(s => {
          if (teacherForm.subAreas[s]) allowedTabsSet.add(s);
        });
        const allowedTabs = Array.from(allowedTabsSet);

        const currentTeacherId = editingTeacher ? editingTeacher.id : "";
        
        let finalTeacherId = editingTeacher?.id || "";
        
        if (editingTeacher) {
          const updateData: any = {
            name: teacherForm.name || "",
            email: teacherForm.email || "",
            login: teacherForm.login || teacherForm.email || "",
            contact: teacherForm.contact || "",
            profession: teacherForm.profession || "",
            startDateEBD: teacherForm.startDateEBD || "",
            birthDate: teacherForm.birthDate || "",
            generalProfile: teacherForm.generalProfile || "",
            address: teacherForm.address || "",
            academicBackground: teacherForm.academicBackground || "",
            theologicalBackground: teacherForm.theologicalBackground || "",
            classIds: classIds,
            allowedTabs: allowedTabs,
            permissions: teacherForm.permissions || {},
            role: teacherForm.role || 'professor',
            updatedAt: new Date().toISOString()
          };

          if (teacherForm.password && teacherForm.password.trim() !== "") {
            updateData.password = teacherForm.password;
          }

          await updateDoc(doc(db, 'users', editingTeacher.id), updateData);
        } else {
          // Create Auth User
          const userCredential = await createUserWithEmailAndPassword(auth, teacherForm.email, teacherForm.password);
          const newUser = userCredential.user;
          finalTeacherId = newUser.uid;

          const registrationNumber = await generateRegistrationNumber('users');
          // Create User Doc
          await setDoc(doc(db, 'users', newUser.uid), {
            name: teacherForm.name || "",
            email: teacherForm.email || "",
            login: teacherForm.login || teacherForm.email || "",
            password: teacherForm.password, 
            contact: teacherForm.contact || "",
            profession: teacherForm.profession || "",
            startDateEBD: teacherForm.startDateEBD || "",
            birthDate: teacherForm.birthDate || "",
            generalProfile: teacherForm.generalProfile || "",
            address: teacherForm.address || "",
            academicBackground: teacherForm.academicBackground || "",
            theologicalBackground: teacherForm.theologicalBackground || "",
            classIds: classIds,
            allowedTabs: allowedTabs,
            permissions: teacherForm.permissions || {},
            registrationNumber,
            role: teacherForm.role || 'professor',
            firstLogin: true,
            createdAt: new Date().toISOString()
          });
        }

        // Bidirectional Sync: Update Classes to include/exclude this teacher
        // (This is the requested sync logic for "Turma Responsável")
        const classUpdatePromises = classes.map(async (cls) => {
          const isLinked = classIds.includes(cls.id);
          const currentTeacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
          
          if (isLinked) {
            if (!currentTeacherIds.includes(finalTeacherId)) {
              await updateDoc(doc(db, 'classes', cls.id), {
                teacherIds: [...currentTeacherIds, finalTeacherId]
              });
            }
          } else {
            if (currentTeacherIds.includes(finalTeacherId)) {
              await updateDoc(doc(db, 'classes', cls.id), {
                teacherIds: currentTeacherIds.filter(id => id !== finalTeacherId)
              });
            }
          }
        });
        await Promise.all(classUpdatePromises);

        setShowForm(false);
        setEditingTeacher(null);
        setTeacherForm({ 
          name: '', email: '', login: '', password: '', confirmPassword: '', contact: '', profession: '', startDateEBD: '', birthDate: '', generalProfile: '', academicBackground: '', theologicalBackground: '', role: 'professor', classIds: [], allowedTabs: [], address: '',
          turmas: {},
          modulos: { dashboard: false, academic: false, administrative: false, projects: false, finance: false, reports: false },
          subAreas: { students: false, teachers: false, classes: false, attendance: false, planning: false, schoolYear: false, regimento: false, calendar: false, organogram: false, system: false, comunicados: false, documentos: false, meetings: false },
          permissions: {}
        });
      } catch (err) {
        handleFirestoreError(err, editingTeacher ? OperationType.UPDATE : OperationType.CREATE, 'users');
      }
    };

    actuallySaveTeacher();
  };

  const handleEditTeacher = (teacher: Teacher) => {
    // Convert arrays back to objects for the organized state
    const turmas: Record<string, boolean> = {};
    (teacher.classIds || []).forEach(id => turmas[id] = true);

    const modulos: Record<string, boolean> = {
      dashboard: false,
      academic: false,
      administrative: false,
      projects: false,
      finance: false,
      reports: false
    };
    const subAreas: Record<string, boolean> = {
      students: false,
      teachers: false,
      classes: false,
      attendance: false,
      planning: false,
      schoolYear: false,
      regimento: false,
      calendar: false,
      organogram: false,
      system: false,
      comunicados: false,
      documentos: false,
      meetings: false
    };

    (teacher.allowedTabs || []).forEach(tab => {
      if (tab in modulos) modulos[tab] = true;
      if (tab in subAreas) subAreas[tab] = true;
    });

    setEditingTeacher(teacher);
    setTeacherForm({
      name: teacher.name,
      email: teacher.email,
      login: teacher.login || teacher.email || '',
      contact: teacher.contact,
      profession: teacher.profession || '',
      startDateEBD: teacher.startDateEBD || '',
      birthDate: (teacher as any).birthDate || '',
      generalProfile: teacher.generalProfile || '',
      address: teacher.address || '',
      academicBackground: teacher.academicBackground || '',
      theologicalBackground: teacher.theologicalBackground || '',
      role: teacher.role || 'professor',
      classIds: teacher.classIds || [],
      allowedTabs: teacher.allowedTabs || [],
      password: teacher.password || '',
      confirmPassword: teacher.password || '',
      permissions: teacher.permissions || {},
      turmas,
      modulos,
      subAreas
    });
    setShowForm(true);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const teacherIds = classForm.teacherIds.filter(id => id !== "");
      const sanitizedForm = {
        name: classForm.name || "",
        ageRange: classForm.ageRange || "",
        teacherId: teacherIds[0] || "",
        teacherIds: teacherIds,
        schoolYear: classForm.schoolYear || selectedSchoolYear,
        gradeLevel: Number(classForm.gradeLevel) || 0,
        isFinalGrade: classForm.isFinalGrade || false,
        status: 'ATIVA' as const
      };

      // Bidirectional Sync: Update Teachers to include/exclude this class
      // Actually, it's easier to just handle it on save.
      if (!editingClass) {
        const newDoc = await addDoc(collection(db, 'classes'), {
          ...sanitizedForm,
          studentIds: [],
          createdAt: new Date().toISOString()
        });
        // Sync for new class
        for (const tid of teacherIds) {
          const t = teachers.find(x => x.id === tid);
          if (t && !(t.classIds || []).includes(newDoc.id)) {
            await updateDoc(doc(db, 'users', tid), {
              classIds: [...(t.classIds || []), newDoc.id]
            });
          }
        }
      } else {
        await updateDoc(doc(db, 'classes', editingClass.id), sanitizedForm);
        // Sync for edited class
        for (const t of teachers) {
          const shouldHave = teacherIds.includes(t.id);
          const has = (t.classIds || []).includes(editingClass.id);
          if (shouldHave && !has) {
            await updateDoc(doc(db, 'users', t.id), { classIds: [...(t.classIds || []), editingClass.id] });
          } else if (!shouldHave && has) {
            await updateDoc(doc(db, 'users', t.id), { classIds: (t.classIds || []).filter(id => id !== editingClass.id) });
          }
        }
      }

      setShowForm(false);
      setEditingClass(null);
      setClassForm({ name: '', ageRange: '', teacherId: '', teacherIds: [], schoolYear: selectedSchoolYear, gradeLevel: 0, isFinalGrade: false });
    } catch (err) {
      handleFirestoreError(err, editingClass ? OperationType.UPDATE : OperationType.CREATE, 'classes');
    }
  };

  const handleEditClass = (cls: Class) => {
    if (isClassFinalized(cls.id)) {
      showAlert('Turma Finalizada', 'Esta turma já foi encerrada e não permite alterações nos registros.');
      return;
    }
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      ageRange: cls.ageRange,
      teacherId: cls.teacherId || '',
      teacherIds: cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []),
      schoolYear: cls.schoolYear || selectedSchoolYear,
      gradeLevel: cls.gradeLevel || 0,
      isFinalGrade: cls.isFinalGrade || false
    });
    setShowForm(true);
  };

  const handleCloneClass = (cls: Class) => {
    setCloningClass(cls);
    setShowCloneModal(true);
  };

  const executeCloneClass = async () => {
    if (!cloningClass) return;
    try {
      const newClassRef = await addDoc(collection(db, 'classes'), {
        name: `${cloningClass.name} (Cópia)`,
        ageRange: cloningClass.ageRange,
        teacherId: cloningClass.teacherId || "",
        studentIds: cloningClass.studentIds || [],
        schoolYear: selectedSchoolYear,
        status: 'ATIVA',
        gradeLevel: cloningClass.gradeLevel || 0,
        isFinalGrade: cloningClass.isFinalGrade || false,
        createdAt: new Date().toISOString()
      });

      // Update students to point to the new class and school year
      const studentUpdatePromises = (cloningClass.studentIds || []).map(studentId => 
        updateDoc(doc(db, 'students', studentId), {
          classId: newClassRef.id,
          schoolYear: selectedSchoolYear
        })
      );
      await Promise.all(studentUpdatePromises);

      if (!resetAttendanceOnClone) {
        // Copy attendance records
        const q = query(collection(db, 'attendance'), where('classId', '==', cloningClass.id));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const data = d.data();
          await addDoc(collection(db, 'attendance'), {
            ...data,
            classId: newClassRef.id,
            createdAt: new Date().toISOString()
          });
        }
      }

      setShowCloneModal(false);
      setCloningClass(null);
      showAlert('Sucesso', 'Turma clonada com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
    }
  };

  const [showReenrollmentModal, setShowReenrollmentModal] = useState(false);
  const [selectedClassesForReenroll, setSelectedClassesForReenroll] = useState<string[]>([]);

  const handleCloseSchoolYear = async () => {
    if (!schoolYearConfig?.startDate) {
      showAlert('Configuração Pendente', 'Por favor, defina o ano letivo nas configurações.');
      return;
    }

    setShowReenrollmentModal(true);
    setSelectedClassesForReenroll(classes.filter(c => c.schoolYear === schoolYear && c.status !== 'ENCERRADA').map(c => c.id));
  };

  const handleAutoReenrollment = async () => {
    if (selectedClassesForReenroll.length === 0) {
      showAlert('Atenção', 'Selecione pelo menos uma turma para processar.');
      return;
    }

    showAdminConfirm('Confirmar Processamento', 'Deseja realmente iniciar o processo de rematrícula automática?', async () => {
      setLoading(true);
      try {
      let reenrollCount = 0;
      let completedCount = 0;
      let classesCreatedCount = 0;

      const currentYear = parseInt(schoolYear);
      const nextYear = currentYear + 1;

      // 1. Get selected active classes for current year
      const activeClasses = classes.filter(c => selectedClassesForReenroll.includes(c.id));

      for (const cls of activeClasses) {
        // a) Create new class if not final grade
        let nextClassId = '';
        if (!cls.isFinalGrade) {
          const nextGradeLevel = (cls.gradeLevel || 0) + 1;
          const newClassName = cls.name.replace(currentYear.toString(), nextYear.toString());
          const finalNewName = newClassName.includes(nextYear.toString()) ? newClassName : `${newClassName} - ${nextYear}`;

          const newClassRef = await addDoc(collection(db, 'classes'), {
            name: finalNewName,
            ageRange: cls.ageRange,
            teacherId: cls.teacherId || "",
            studentIds: [], 
            schoolYear: nextYear.toString(),
            status: 'ATIVA',
            gradeLevel: nextGradeLevel,
            isFinalGrade: false, 
            createdAt: new Date().toISOString(),
            originalClassId: cls.id // Reference to track rematriculation
          });
          nextClassId = newClassRef.id;
          classesCreatedCount++;
        }

        // b) Process students in the class
        const classStudents = students.filter(s => s.classId === cls.id || s.classIds?.includes(cls.id));
        for (const student of classStudents) {
          // Save historical enrollment
          await addDoc(collection(db, 'enrollments'), {
            studentId: student.id,
            classId: cls.id,
            schoolYear: schoolYear,
            status: student.status || 'ativo',
            registrationNumber: student.registrationNumber || '',
            createdAt: new Date().toISOString()
          });

          if (student.doNotRenew) {
            await updateDoc(doc(db, 'students', student.id), {
              status: 'transferido',
              classId: '',
              schoolYear: ''
            });
            continue;
          }

          if (cls.isFinalGrade) {
            await updateDoc(doc(db, 'students', student.id), {
              status: 'concluído',
              classId: '',
              schoolYear: ''
            });
            completedCount++;
          } else {
            // Re-enroll in next class
            if (nextClassId) {
              await updateDoc(doc(db, 'students', student.id), {
                classId: nextClassId,
                schoolYear: nextYear.toString(),
                status: 'ativo'
              });
              
              // Add student to new class studentIds
              const nextClassDoc = await getDoc(doc(db, 'classes', nextClassId));
              if (nextClassDoc.exists()) {
                const currentIds = nextClassDoc.data().studentIds || [];
                await updateDoc(doc(db, 'classes', nextClassId), {
                  studentIds: [...currentIds, student.id]
                });
              }
            }
            reenrollCount++;
          }
        }

        // c) Close old class
        await updateDoc(doc(db, 'classes', cls.id), {
          status: 'ENCERRADA'
        });
      }

      // 2. Update global school year config
      await updateDoc(doc(db, 'config', 'schoolYear'), {
        startDate: `${nextYear}-01-01`,
        updatedAt: new Date().toISOString()
      });

      setShowReenrollmentModal(false);
      showAlert('Processo Concluído', 
        `Ano letivo ${currentYear} encerrado.\n` +
        `- ${classesCreatedCount} novas turmas criadas para ${nextYear}.\n` +
        `- ${reenrollCount} alunos rematriculados.\n` +
        `- ${completedCount} alunos concluíram seus estudos.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'reenrollment');
    } finally {
      setLoading(false);
    }
  });
};

  // Attendance Logic
  const [attendanceList, setAttendanceList] = useState<{ [key: string]: string | boolean }>({});
  const [justifications, setJustifications] = useState<{ [key: string]: string }>({});
  const [attendanceDate, setAttendanceDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd') || "");
  const [startTime, setStartTime] = useState('15:50');
  const [endTime, setEndTime] = useState('16:40');
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [defaultTimes, setDefaultTimes] = useState({ start: '15:50', end: '16:40' });
  const [markingViewMode, setMarkingViewMode] = useState<'grid' | 'list'>('list');
  const [markingZoom, setMarkingZoom] = useState<number>(1);
  const [markingOrderMode, setMarkingOrderMode] = useState(false);

  const handleFixTimes = async () => {
    try {
      await setDoc(doc(db, 'config', 'attendance_times'), {
        startTime,
        endTime,
        updatedAt: new Date().toISOString()
      });
      showAlert('Sucesso', 'Horários de aula fixados como padrão!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'config/attendance_times');
    }
  };

  useEffect(() => {
    const unsubTimes = onSnapshot(doc(db, 'config', 'attendance_times'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const times = { 
          start: data.startTime || '15:50', 
          end: data.endTime || '16:40' 
        };
        setDefaultTimes(times);
        if (!editingAttendance) {
          setStartTime(times.start);
          setEndTime(times.end);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'config/attendance_times'));
    return () => unsubTimes();
  }, [editingAttendance]);

  const [contentGiven, setContentGiven] = useState('');
  const [attendanceMethodology, setAttendanceMethodology] = useState<string[]>([]);
  const [observation, setObservation] = useState('');
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubPlanning = onSnapshot(collection(db, 'planning'), (snap) => {
      setPlannings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Planning)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'planning'));
    return () => unsubPlanning();
  }, []);

  useEffect(() => {
    if (selectedClass && attendanceDate && !editingAttendance) {
      const planning = plannings.find(p => p.classId === selectedClass && p.date === attendanceDate);
      if (planning) {
        setContentGiven(planning.content);
        setAttendanceMethodology(planning.methodology.split(', ').filter(m => m.length > 0));
      } else {
        setContentGiven('');
        setAttendanceMethodology([]);
      }
    }
  }, [selectedClass, attendanceDate, editingAttendance, plannings]);

  const currentPlanning = useMemo(() => {
    if (!selectedClass || !attendanceDate) return null;
    return plannings.find(p => p.classId === selectedClass && p.date === attendanceDate);
  }, [plannings, selectedClass, attendanceDate]);

  const existingAttendance = useMemo(() => {
    if (!selectedClass || !attendanceDate) return null;
    return attendances.find(a => a.classId === selectedClass && a.date === attendanceDate);
  }, [attendances, selectedClass, attendanceDate]);

  useEffect(() => {
    if (selectedClass) {
      const classStudents = students.filter(s => s.classId === selectedClass || s.classIds?.includes(selectedClass));
      const initial = classStudents.reduce((acc, s) => ({ ...acc, [s.id]: 'present' }), {});
      setAttendanceList(initial);
      setJustifications({});
    }
  }, [selectedClass, students]);

  const saveAttendance = async () => {
    if (!selectedClass) return;

    if (isClassFinalized(selectedClass)) {
      showAlert('Turma Finalizada', 'Esta turma já foi encerrada e não permite alterações nos registros.');
      return;
    }

    if (existingAttendance && !editingAttendance) {
      showAlert('Aviso', 'Já existe uma chamada para esta data e turma.');
      return;
    }

    const present = Object.keys(attendanceList).filter(id => attendanceList[id] === 'present' || attendanceList[id] === true);
    const absent = Object.keys(attendanceList).filter(id => attendanceList[id] === 'absent' || attendanceList[id] === false);
    
    try {
      if (currentPlanning && contentGiven !== currentPlanning.content && !observation.trim()) {
        showConfirm(
          'Conteúdo Diferente',
          'O conteúdo ministrado é diferente do planejado. Deseja adicionar uma justificativa nas observações antes de salvar?',
          () => {} // Just close and let them edit
        );
        return;
      }

      const attendanceData = {
        classId: selectedClass || "",
        date: attendanceDate || "",
        startTime: startTime || "",
        endTime: endTime || "",
        presentStudentIds: present || [],
        absentStudentIds: absent || [],
        justifications: justifications || {},
        contentGiven: contentGiven || "",
        methodology: attendanceMethodology.join(', ') || "",
        observation: observation || "",
        aulaObjetivos,
        alunosParticiparam,
        versiculoCitado,
        houveOferta,
        createdAt: new Date().toISOString()
      };

      if (editingAttendance) {
        await updateDoc(doc(db, 'attendance', editingAttendance.id), attendanceData);
      } else {
        await addDoc(collection(db, 'attendance'), attendanceData);
      }

      // Show success message immediately after the main record is saved
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Reset form fields
      setContentGiven('');
      setStartTime(defaultTimes.start);
      setEndTime(defaultTimes.end);
      setAttendanceMethodology([]);
      setObservation('');
      setAulaObjetivos('SIM');
      setAlunosParticiparam('SIM');
      setVersiculoCitado('SIM');
      setHouveOferta('SIM');
      setEditingAttendance(null);
      setSelectedClass(null);

      // Update student stats in parallel (background)
      const studentUpdates = [];
      
      for (const studentId of absent) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          const isJustified = !!justifications[studentId];
          if (!isJustified) {
            studentUpdates.push(updateDoc(doc(db, 'students', studentId), {
              consecutiveAbsences: (student.consecutiveAbsences || 0) + 1,
              lastAbsenceDate: attendanceDate
            }));
          }
        }
      }

      for (const studentId of present) {
        studentUpdates.push(updateDoc(doc(db, 'students', studentId), {
          consecutiveAbsences: 0
        }));
      }

      await Promise.all(studentUpdates);
    } catch (err) {
      handleFirestoreError(err, editingAttendance ? OperationType.UPDATE : OperationType.CREATE, 'attendance');
    }
  };

  const handleJustify = async (studentId: string, text: string) => {
    setJustifications(prev => ({ ...prev, [studentId]: text }));
    
    // If it's a new justification, save it to options
    if (text && !justificationOptions.find(o => o.text === text)) {
      try {
        await addDoc(collection(db, 'justificationOptions'), {
          text,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error saving justification option:', err);
      }
    }
    setShowJustifyModal(false);
  };

  const handleDeleteAttendance = async (id: string) => {
    const att = attendances.find(a => a.id === id);
    if (att && isClassFinalized(att.classId)) {
      showAlert('Turma Finalizada', 'Esta turma já foi encerrada e não permite alterações nos registros.');
      return;
    }

    showAdminConfirm('Excluir Chamada', 'Deseja realmente excluir este registro de chamada?', async () => {
      try {
        await deleteDoc(doc(db, 'attendance', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
      }
    });
  };

  const handleEditAttendance = (att: Attendance) => {
    if (isClassFinalized(att.classId)) {
      showAlert('Turma Finalizada', 'Esta turma já foi encerrada e não permite alterações nos registros.');
      return;
    }

    setEditingAttendance(att);
    setSelectedClass(att.classId);
    setAttendanceDate(att.date);
    setStartTime(att.startTime || defaultTimes.start);
    setEndTime(att.endTime || defaultTimes.end);
    setContentGiven(att.contentGiven || '');
    setAttendanceMethodology(att.methodology ? att.methodology.split(', ').filter(m => m.length > 0) : []);
    setObservation(att.observation || '');
    setAulaObjetivos(att.aulaObjetivos || 'SIM');
    setAlunosParticiparam(att.alunosParticiparam || 'SIM');
    setVersiculoCitado(att.versiculoCitado || 'SIM');
    setHouveOferta(att.houveOferta || 'SIM');
    
    const list: { [key: string]: boolean } = {};
    att.presentStudentIds.forEach(id => list[id] = true);
    att.absentStudentIds.forEach(id => list[id] = false);
    setAttendanceList(list);
    setJustifications(att.justifications || {});
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetId) return;

    try {
      const currentUserId = user.id || auth.currentUser?.uid || "";
      if (!currentUserId) {
        showAlert('Erro', "Erro: Usuário não identificado. Por favor, faça login novamente.");
        return;
      }

      const collectionName = reportType === 'student' ? 'student_reports' : 'teacher_reports';
      const reportData = reportType === 'student' ? {
        studentId: reportTargetId,
        teacherId: currentUserId,
        content: reportContent || "",
        date: reportDate || format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      } : {
        targetTeacherId: reportTargetId,
        adminId: currentUserId,
        content: reportContent || "",
        date: reportDate || format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, collectionName), reportData);
      setShowReportModal(false);
      setReportContent('');
      setReportTargetId(null);
      showAlert('Sucesso', 'Relatório salvo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, reportType === 'student' ? 'student_reports' : 'teacher_reports');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Button */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar ${subTab === 'students' ? 'alunos' : subTab === 'teachers' ? 'professores' : 'turmas'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {subTab === 'students' && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setReportType('student');
                  setShowGeneralReportModal(true);
                }}
                className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-bold hover:bg-amber-100 transition-all print:hidden"
              >
                <FileText className="w-5 h-5" />
                Gerar Relatório
              </button>
              <select 
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 outline-none"
              >
                <option value="all">Todas as Turmas</option>
                {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button 
                onClick={() => {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
              >
                <ArrowUpDown className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          )}
          {hasFullAccess && subTab !== 'attendance' && (
            <div className="flex gap-2">
              {subTab === 'teachers' && (
                <button 
                  onClick={() => {
                    setReportType('professor');
                    setShowGeneralReportModal(true);
                  }}
                  className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-bold hover:bg-amber-100 transition-all print:hidden"
                >
                  <FileText className="w-5 h-5" />
                  Gerar Relatório
                </button>
              )}
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all print:hidden"
              >
                <Printer className="w-5 h-5" />
                Imprimir
              </button>
              <button
                onClick={() => {
                  if (subTab === 'meetings') {
                    setMeetingForm({ type: 'ADMINISTRATIVA', title: '', content: '', date: safeFormat(new Date(), 'yyyy-MM-dd') || "", participants: '' });
                    setEditingMeeting(null);
                  } else if (subTab === 'students') {
                    setEditingStudent(null);
                    setStudentForm({ name: '', birthDate: '', address: '', guardians: '', emergencyContact: '', phone: '', history: '', classId: '', classIds: [], schoolYear: selectedSchoolYear, doNotRenew: false, status: 'ativo' });
                  } else if (subTab === 'teachers') {
                    setEditingTeacher(null);
                    setTeacherForm({ 
                      name: '', 
                      email: '', 
                      login: '', 
                      password: '', 
                      confirmPassword: '', 
                      contact: '', 
                      profession: '', 
                      startDateEBD: '', 
                      birthDate: '', 
                      address: '', 
                      academicBackground: '', 
                      theologicalBackground: '', 
                      generalProfile: '', 
                      role: 'professor', 
                      classIds: [], 
                      allowedTabs: ['dashboard', 'academic', 'projects', 'reports'],
                      turmas: {},
                      modulos: { dashboard: true, academic: true, projects: true, finance: false, reports: true },
                      subAreas: { students: false, teachers: false, classes: false, attendance: false, planning: false, schoolYear: false, regimento: false, calendar: false, organogram: false, system: false, comunicados: false, documentos: false, meetings: false }
                    });
                  } else if (subTab === 'classes') {
                    setEditingClass(null);
                    setClassForm({ name: '', ageRange: '', teacherId: '', teacherIds: [], schoolYear: selectedSchoolYear, gradeLevel: 0, isFinalGrade: false });
                  }
                  setShowForm(true);
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                {subTab === 'students' ? 'Novo Aluno' : subTab === 'teachers' ? 'Cadastro do novo membro da Equipe EBD' : subTab === 'meetings' ? 'Nova Ata/Reunião' : 'Nova Turma'}
              </button>
            </div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronUp className="w-5 h-5 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <motion.div 
        initial={false}
        animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        {subTab === 'students' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th 
                    className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                    onClick={() => setSortField('name')}
                  >
                    Aluno
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                    onClick={() => setSortField('age')}
                  >
                    Idade
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600"
                    onClick={() => setSortField('class')}
                  >
                    Turma
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Frequência</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Telefone</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500">{student.guardians}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {differenceInYears(new Date(), parseISO(student.birthDate))} anos
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {student.classIds?.length > 0 ? (
                          student.classIds.map(cid => (
                            <span key={cid} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase">
                              {classes.find(c => c.id === cid)?.name}
                            </span>
                          ))
                        ) : student.classId ? (
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase">
                            {classes.find(c => c.id === student.classId)?.name}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 italic">Sem Turma</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">
                      {student.registrationNumber || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              (student.attendancePercentage || 0) >= 80 ? "bg-green-500" : (student.attendancePercentage || 0) >= 50 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${student.attendancePercentage || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-slate-600">{student.attendancePercentage || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {student.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setViewingStudentHistory(student)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Ver Histórico de Trajetória"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setReportType('student');
                            setReportTargetId(student.id);
                            setShowReportModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Criar Relatório"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setReportType('student');
                            setReportTargetId(student.id);
                            setShowReportListModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Ver Histórico de Relatórios"
                        >
                          <LayoutDashboard className="w-5 h-5" />
                        </button>
                        {hasFullAccess && (
                          <>
                            <button 
                              onClick={() => handleEditStudent(student)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'teachers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Membro da Equipe / Cargo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Info. Profissional</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email / Contato</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                          teacher.role === 'admin' ? "bg-red-50 text-red-600" : teacher.role === 'coordinator' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            teacher.role === 'admin' ? "text-red-500" : teacher.role === 'coordinator' ? "text-amber-500" : "text-slate-400"
                          )}>{teacher.role === 'admin' ? 'Administrador' : teacher.role === 'coordinator' ? 'Coordenador' : 'Professor'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700 font-medium">{teacher.profession || '-'}</p>
                      <p className="text-xs text-slate-500">Início: {teacher.startDateEBD ? safeFormat(teacher.startDateEBD, 'dd/MM/yyyy') : '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 font-medium">{teacher.email}</p>
                      <p className="text-xs text-slate-400">{teacher.contact || 'Nenhum contato'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">
                      {teacher.registrationNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {hasFullAccess && teacher.role !== 'admin' && (
                          <button 
                            onClick={() => {
                              showConfirm(
                                'Entrar como Membro',
                                `Para visualizar a plataforma como "${teacher.name}", digite a senha do sistema:`,
                                (pass) => {
                                  if (pass === 'SISTEMA') {
                                    onImpersonate?.(teacher);
                                  } else {
                                    showAlert('Erro', 'Senha do sistema incorreta!');
                                  }
                                },
                                true // isPassword
                              );
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Visualizar como Professor"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        )}
                        {hasFullAccess && (
                          <>
                            <button 
                              onClick={() => {
                                setReportType('professor');
                                setReportTargetId(teacher.id);
                                setShowReportModal(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Criar Relatório"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                setReportType('professor');
                                setReportTargetId(teacher.id);
                                setShowReportListModal(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Ver Histórico de Relatórios"
                            >
                              <LayoutDashboard className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleEditTeacher(teacher)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTeacher(teacher.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'classes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ano Letivo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Faixa Etária</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Membro da Equipe Responsável</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Alunos</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.schoolYear || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.ageRange}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {teachers.find(t => t.id === c.teacherId)?.name || 'Não atribuído'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {students.filter(s => s.classId === c.id || s.classIds?.includes(c.id)).length} alunos
                    </td>
                     <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {hasFullAccess && (
                          <>
                            <button 
                              onClick={() => handleCloneClass(c)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Clonar Turma"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleEditClass(c)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Editar Turma"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteClass(c.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Excluir Turma"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'attendance' && (
          <div className="p-6 space-y-6">
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
                >
                  <div className="bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border-2 border-green-500/50 backdrop-blur-sm">
                    <div className="bg-white/20 p-2 rounded-xl">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase tracking-wider">Sucesso!</span>
                      <span className="text-xs font-bold text-green-50">O registro de chamada foi realizado com sucesso.</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecionar Turma</label>
                <select
                  value={selectedClass || ''}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Selecione uma turma...</option>
                  {filteredClassesForAttendance.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data da Chamada</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  disabled={!!existingAttendance && !editingAttendance}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horário Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horário Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <button
                  onClick={handleFixTimes}
                  className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all shadow-sm group relative"
                  title="Fixar horários como padrão"
                >
                  <Pin className="w-5 h-5" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Fixar Padrão
                  </span>
                </button>
                {selectedClass && (
                  <>
                    <button
                      onClick={() => setMarkingOrderMode(!markingOrderMode)}
                      className={cn(
                        "p-2.5 rounded-xl transition-all shadow-sm group relative",
                        markingOrderMode ? "bg-amber-100 text-amber-600 ring-2 ring-amber-500" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                      title="Configurar Ordem dos Alunos"
                    >
                      <ArrowUpDown className="w-5 h-5" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Configurar Ordem
                      </span>
                    </button>
                    {markingOrderMode && (
                      <button
                        onClick={async () => {
                          const classStudentsIds = students
                            .filter(s => (s.classId === selectedClass || s.classIds?.includes(selectedClass)))
                            .map(s => s.id);
                          const alphaOrder = students
                            .filter(s => classStudentsIds.includes(s.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(s => s.id);
                          setWorkingStudentOrder(alphaOrder);
                          showAlert('Sucesso', 'Ordem redefinida para alfabética. Clique em "Fixar Preferência" para salvar.');
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-all"
                      >
                        Redefinir A-Z
                      </button>
                    )}
                    <button
                      onClick={handleSaveOrderPreference}
                      className={cn(
                        "px-4 py-2 rounded-xl transition-all shadow-sm group relative flex items-center gap-2 font-bold text-xs shadow-indigo-100",
                        (classes.find(c => c.id === selectedClass)?.isOrderFixed && JSON.stringify(classes.find(c => c.id === selectedClass)?.studentOrder) === JSON.stringify(workingStudentOrder))
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50"
                      )}
                      title="Fixar/Salvar ordem dos alunos"
                    >
                      <Pin className="w-4 h-4" />
                      {(classes.find(c => c.id === selectedClass)?.isOrderFixed && JSON.stringify(classes.find(c => c.id === selectedClass)?.studentOrder) === JSON.stringify(workingStudentOrder)) ? 'Ordem Salva' : 'Fixar Preferência'}
                    </button>
                    <button
                      onClick={() => {
                        setDiaryReportClass(selectedClass);
                        setShowDiaryReport(true);
                      }}
                      className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-all shadow-sm group relative"
                      title="Gerar Diário de Classe"
                    >
                      <FileText className="w-5 h-5" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Gerar Diário
                      </span>
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setMarkingViewMode('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      markingViewMode === 'grid' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                    title="Visualização em Grade"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMarkingViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      markingViewMode === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                    title="Visualização em Lista"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setMarkingZoom(Math.max(1, markingZoom - 1))}
                    className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
                    title="Diminuir"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-500 w-4 text-center">{markingZoom}</span>
                  <button
                    onClick={() => setMarkingZoom(Math.min(3, markingZoom + 1))}
                    className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
                    title="Aumentar"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {selectedClass && (
                  <div className="flex items-center gap-2">
                    {showDiaryRangeBar ? (
                      <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-2 duration-300">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Início</label>
                          <input 
                            type="date"
                            value={diaryStartDate}
                            onChange={(e) => setDiaryStartDate(e.target.value)}
                            className="px-2 py-0.5 text-xs font-bold border-none outline-none text-slate-700 bg-transparent"
                          />
                        </div>
                        <div className="w-px h-6 bg-slate-100" />
                        <div className="flex flex-col">
                          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Fim</label>
                          <input 
                            type="date"
                            value={diaryEndDate}
                            onChange={(e) => setDiaryEndDate(e.target.value)}
                            className="px-2 py-0.5 text-xs font-bold border-none outline-none text-slate-700 bg-transparent"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            setDiaryReportClass(selectedClass);
                            setShowDiaryReport(true);
                            setShowDiaryRangeBar(false);
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all ml-2"
                        >
                          Gerar Diário
                        </button>
                        <button 
                          onClick={() => setShowDiaryRangeBar(false)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDiaryRangeBar(true)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold rounded-xl transition-all text-sm flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Gerar Diário
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    const allPresentValue = students.filter(s => s.classId === selectedClass || s.classIds?.includes(selectedClass)).reduce((acc, s) => ({ ...acc, [s.id]: 'present' }), {});
                    setAttendanceList(allPresentValue);
                  }}
                  className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl transition-all text-sm"
                >
                  Presença em Todos
                </button>
                <button
                  onClick={() => {
                    const allAbsentValue = students.filter(s => s.classId === selectedClass || s.classIds?.includes(selectedClass)).reduce((acc, s) => ({ ...acc, [s.id]: 'absent' }), {});
                    setAttendanceList(allAbsentValue);
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl transition-all text-sm"
                >
                  Falta em Todos
                </button>
              </div>
            </div>

            {selectedClass ? (
              <div className="space-y-6">
                <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Planejamentos Disponíveis</label>
                <div className="flex flex-wrap gap-2">
                  {plannings
                    .filter(p => p.classId === selectedClass)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 8)
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setAttendanceDate(p.date);
                          setContentGiven(p.content);
                          setAttendanceMethodology(p.methodology ? p.methodology.split(', ').filter(m => m.length > 0) : []);
                          // Check if attendance already exists for this date/class
                          const att = attendances.find(a => a.classId === selectedClass && a.date === p.date);
                          if (att) {
                            handleEditAttendance(att);
                          } else {
                            setEditingAttendance(null);
                            // Reset attendance list to all present for new date
                            const initial = students.filter(s => s.classId === selectedClass || s.classIds?.includes(selectedClass)).reduce((acc, s) => ({ ...acc, [s.id]: true }), {});
                            setAttendanceList(initial);
                            setJustifications({});
                            setContentGiven('');
                            setAttendanceMethodology([]);
                            setObservation('');
                          }
                        }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                          attendanceDate === p.date 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                        )}
                      >
                        {safeFormat(p.date, 'dd/MM/yyyy')}
                      </button>
                    ))}
                  {plannings.filter(p => p.classId === selectedClass).length === 0 && (
                    <p className="text-xs text-slate-400 italic">Nenhum planejamento encontrado para esta turma.</p>
                  )}
                </div>
              </div>

                {currentPlanning && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <BookOpen className="w-5 h-5" />
                  <h4 className="font-bold uppercase text-xs tracking-wider">Planejamento para este dia</h4>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Conteúdo Previsto:</p>
                  <p className="text-sm text-slate-700">{currentPlanning.content}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Metodologia:</p>
                  <p className="text-sm text-slate-700">{currentPlanning.methodology}</p>
                </div>
              </div>
            )}

              <div className="space-y-6">
                <Reorder.Group 
                  axis="y" 
                  values={workingStudentOrder} 
                  onReorder={setWorkingStudentOrder}
                  className={cn(
                    "grid gap-4",
                    (markingViewMode === 'grid' && !markingOrderMode)
                      ? (markingZoom === 1 ? "grid-cols-1 md:grid-cols-3 lg:grid-cols-4" : markingZoom === 2 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-1 lg:grid-cols-2")
                      : "grid-cols-1"
                  )}
                >
                  {workingStudentOrder
                    .map(sid => students.find(s => s.id === sid))
                    .filter((s): s is Student => !!s)
                    .map((student, index) => (
                      <AttendanceStudentCard
                        key={student.id}
                        student={student}
                        index={index}
                        markingOrderMode={markingOrderMode}
                        markingZoom={markingZoom}
                        attendanceList={attendanceList}
                        justifications={justifications}
                        setAttendanceList={setAttendanceList}
                        setReportTargetId={setReportTargetId}
                        setReportType={setReportType}
                        setShowReportListModal={setShowReportListModal}
                        setCurrentJustifyStudent={setCurrentJustifyStudent}
                        setShowJustifyModal={setShowJustifyModal}
                        moveStudent={moveStudent}
                        isLast={index === workingStudentOrder.length - 1}
                        isSelected={selectedOrderStudentId === student.id}
                        onSelect={setSelectedOrderStudentId}
                        onNumberChange={handleManualReorder}
                      />
                  ))}
                </Reorder.Group>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conteúdo Ministrado</label>
                      {currentPlanning && contentGiven !== currentPlanning.content && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Alterado do Planejado</span>
                      )}
                    </div>
                    <textarea
                      value={contentGiven}
                      onChange={(e) => setContentGiven(e.target.value)}
                      placeholder="O que foi ensinado hoje?"
                      className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</label>
                    <textarea
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      placeholder="Alguma observação importante sobre a aula ou alunos?"
                      className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metodologia Utilizada</label>
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_METHODOLOGIES.map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            const current = attendanceMethodology;
                            const next = current.includes(method)
                              ? current.filter(m => m !== method)
                              : [...current, method];
                            setAttendanceMethodology(next);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                            attendanceMethodology.includes(method)
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
                        placeholder="Outra metodologia..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !attendanceMethodology.includes(val)) {
                              setAttendanceMethodology([...attendanceMethodology, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* New Attendance Questions */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                    {[
                      { id: 'aulaObjetivos', label: '1) A aula atingiu os objetivos desejados?', value: aulaObjetivos, setter: setAulaObjetivos },
                      { id: 'alunosParticiparam', label: '2) Os alunos participaram e interagiram durante a aula?', value: alunosParticiparam, setter: setAlunosParticiparam },
                      { id: 'versiculoCitado', label: '3) O versículo bíblico da semana foi citado em sala?', value: versiculoCitado, setter: setVersiculoCitado },
                      { id: 'houveOferta', label: '4) Houve oferta em sala?', value: houveOferta, setter: setHouveOferta },
                    ].map((q) => (
                      <div key={q.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{q.label}</label>
                        <div className="flex gap-2">
                          {(q.id === 'houveOferta' ? ['SIM', 'NÃO', 'NÃO SE APLICA'] : ['SIM', 'NÃO', 'PARCIALMENTE', 'NÃO SE APLICA']).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => q.setter(opt as any)}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[10px] font-bold transition-all border",
                                q.value === opt
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={saveAttendance}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    {editingAttendance ? 'Atualizar Chamada' : 'Salvar Chamada do Dia'}
                  </button>
                  {editingAttendance && (
                    <button
                      onClick={() => {
                        setEditingAttendance(null);
                        setSelectedClass(null);
                        setContentGiven('');
                        setObservation('');
                      }}
                      className="w-full py-2 text-slate-500 font-semibold hover:text-slate-700 transition-all"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                {/* Attendance Report */}
                <div className="mt-12 space-y-6 border-t border-slate-100 pt-12">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-slate-900">Relatório de Chamadas Realizadas</h3>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setAttendanceViewMode('list')}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            attendanceViewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"
                          )}
                          title="Lista"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setAttendanceViewMode('months')}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            attendanceViewMode === 'months' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"
                          )}
                          title="Por Meses"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setAttendanceViewMode('icons')}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            attendanceViewMode === 'icons' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"
                          )}
                          title="Ícones Pequenos"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                      </div>

                      <button 
                        onClick={() => setShowRangeReportModal(true)}
                        className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Relatório por Período
                      </button>

                      {isAdmin ? (
                        <div className="relative group">
                          <button className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2">
                            {attendanceFilterClasses.includes('all') ? 'Todas as Turmas' : `${attendanceFilterClasses.length} Turmas`}
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 z-50 hidden group-hover:block">
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={attendanceFilterClasses.includes('all')}
                                  onChange={(e) => {
                                    if (e.target.checked) setAttendanceFilterClasses(['all']);
                                    else setAttendanceFilterClasses([]);
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-slate-700">Todas as Turmas</span>
                              </label>
                              {filteredClasses.map(c => (
                                <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={attendanceFilterClasses.includes(c.id)}
                                    onChange={(e) => {
                                      let newClasses = attendanceFilterClasses.filter(id => id !== 'all');
                                      if (e.target.checked) {
                                        newClasses = [...newClasses, c.id];
                                      } else {
                                        newClasses = newClasses.filter(id => id !== c.id);
                                      }
                                      if (newClasses.length === 0) newClasses = ['all'];
                                      setAttendanceFilterClasses(newClasses);
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={attendanceFilterClass}
                          onChange={(e) => setAttendanceFilterClass(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="all">Todas as Turmas</option>
                          {filteredClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}

                      <div className="flex items-center gap-2">
                        <input 
                          type="date"
                          value={attendanceStartDate}
                          onChange={(e) => setAttendanceStartDate(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          title="Data Início"
                        />
                        <span className="text-slate-400">até</span>
                        <input 
                          type="date"
                          value={attendanceEndDate}
                          onChange={(e) => setAttendanceEndDate(e.target.value)}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          title="Data Fim"
                        />
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-xs font-bold text-slate-600 flex items-center gap-2 print:hidden"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Lista
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {attendanceViewMode === 'list' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                              <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-12">°</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">DIA/HORÁRIO</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">DATA MINISTRADA</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">RESUMO CONTEÚDO</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">AÇÕES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {attendances
                              .filter(a => {
                                const matchesClass = hasFullAccess 
                                  ? (attendanceFilterClasses.includes('all') || attendanceFilterClasses.includes(a.classId))
                                  : (attendanceFilterClass === 'all' || a.classId === attendanceFilterClass);
                                
                                const matchesDate = (!attendanceStartDate || a.date >= attendanceStartDate) && 
                                                   (!attendanceEndDate || a.date <= attendanceEndDate);
                                
                                const matchesAccess = hasFullAccess || user.classIds.includes(a.classId);
                                return matchesClass && matchesDate && matchesAccess;
                              })
                              .sort((a, b) => a.date.localeCompare(b.date)) // Sort ascending for sequence
                              .map((att, idx) => (
                              <tr key={att.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100 last:border-0">
                                <td className="px-4 py-6 text-sm font-bold text-slate-900 text-center align-top">{idx + 1}</td>
                                <td className="px-4 py-6 align-top">
                                  <div className="text-sm font-bold text-slate-900">
                                    {safeFormat(att.date, 'dd/MM/yyyy')}
                                  </div>
                                  <div className="text-[11px] font-black text-slate-500 uppercase mt-1">
                                    {safeFormat(att.date, 'EEEE', { locale: ptBR }).toUpperCase()} - {att.startTime || defaultTimes.start} às {att.endTime || defaultTimes.end}
                                  </div>
                                </td>
                                <td className="px-4 py-6 text-sm font-bold text-slate-900 align-top">
                                  {safeFormat(att.date, 'dd/MM/yyyy')}
                                </td>
                                <td className="px-4 py-6 align-top">
                                  <div className="text-xs text-slate-700 max-w-2xl leading-relaxed whitespace-pre-wrap">
                                    <span className="font-black text-slate-900 uppercase">
                                      ({classes.find(c => c.id === att.classId)?.name})
                                    </span> - {att.contentGiven || 'Sem resumo de conteúdo.'}
                                  </div>
                                </td>
                                <td className="px-4 py-6 text-right align-top">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                    <button 
                                      onClick={() => setViewingAttendance(att)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="Ver Detalhes"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setViewingAttendance(att);
                                        setTimeout(() => window.print(), 500);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="Imprimir"
                                    >
                                      <Printer className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleEditAttendance(att)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="Editar"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteAttendance(att.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {attendanceViewMode === 'months' && (
                      <div className="space-y-8">
                        {Array.from(new Set(attendances.map(a => a.date.substring(0, 7))))
                          .sort((a, b) => b.localeCompare(a))
                          .map(month => {
                            const monthAttendances = attendances.filter(a => {
                              const matchesMonth = a.date.startsWith(month);
                              const matchesClass = isAdmin 
                                ? (attendanceFilterClasses.includes('all') || attendanceFilterClasses.includes(a.classId))
                                : (attendanceFilterClass === 'all' || a.classId === attendanceFilterClass);
                              const matchesDate = (!attendanceStartDate || a.date >= attendanceStartDate) && 
                                                 (!attendanceEndDate || a.date <= attendanceEndDate);
                              const matchesAccess = isAdmin || user.classIds.includes(a.classId);
                              return matchesMonth && matchesClass && matchesDate && matchesAccess;
                            });

                            if (monthAttendances.length === 0) return null;

                            return (
                              <div key={month} className="space-y-4">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  {safeFormat(`${month}-01`, 'MMMM yyyy', { locale: ptBR })}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {monthAttendances.sort((a, b) => b.date.localeCompare(a.date)).map(att => (
                                    <div key={att.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-slate-900">
                                          {safeFormat(att.date, 'dd/MM/yyyy')}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                          <button onClick={() => setViewingAttendance(att)} className="p-1 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                                          <button onClick={() => { setViewingAttendance(att); setTimeout(() => window.print(), 500); }} className="p-1 text-slate-400 hover:text-indigo-600"><Printer className="w-4 h-4" /></button>
                                        </div>
                                      </div>
                                      <p className="text-xs font-medium text-slate-500 mb-2">
                                        {classes.find(c => c.id === att.classId)?.name}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-green-600 bg-green-100/50 px-2 py-0.5 rounded-full">
                                          {att.presentStudentIds.length} P
                                        </span>
                                        <span className="text-[10px] font-bold text-red-600 bg-red-100/50 px-2 py-0.5 rounded-full">
                                          {att.absentStudentIds.length} F
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {attendanceViewMode === 'icons' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {attendances
                          .filter(a => {
                            const matchesClass = isAdmin 
                              ? (attendanceFilterClasses.includes('all') || attendanceFilterClasses.includes(a.classId))
                              : (attendanceFilterClass === 'all' || a.classId === attendanceFilterClass);
                            const matchesDate = (!attendanceStartDate || a.date >= attendanceStartDate) && 
                                               (!attendanceEndDate || a.date <= attendanceEndDate);
                            const matchesAccess = isAdmin || user.classIds.includes(a.classId);
                            return matchesClass && matchesDate && matchesAccess;
                          })
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(att => (
                            <button 
                              key={att.id}
                              onClick={() => setViewingAttendance(att)}
                              className="p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-500 hover:shadow-sm transition-all text-center group relative"
                            >
                              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mx-auto mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <CheckSquare className="w-4 h-4" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-900">{safeFormat(att.date, 'dd/MM')}</p>
                              <p className="text-[9px] text-slate-500 truncate">{classes.find(c => c.id === att.classId)?.name}</p>
                              
                              <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <div className="p-1 bg-white shadow-md rounded-full text-indigo-600" onClick={(e) => { e.stopPropagation(); setViewingAttendance(att); setTimeout(() => window.print(), 500); }}>
                                  <Printer className="w-3 h-3" />
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Selecione uma turma para realizar a chamada.
              </div>
            )}
          </div>
        )}

        {subTab === 'schoolYear' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Configuração do Ano Letivo</h3>
                <p className="text-sm text-slate-500">Defina o ano letivo atual para o sistema</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  O ano letivo definido aqui será automaticamente vinculado a todas as <strong>novas turmas</strong> criadas.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Ano Letivo Atual</label>
                  <div className="flex gap-4">
                    <input 
                      type="number" 
                      min="2000"
                      max="2100"
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
                      placeholder="Ex: 2024"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await setDoc(doc(db, 'config', 'schoolYear'), { 
                            startDate: `${schoolYear}-01-01`,
                            endDate: `${schoolYear}-12-31`,
                            updatedAt: new Date().toISOString()
                          });
                          showAlert('Sucesso', 'Ano letivo atualizado com sucesso!');
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, 'config/schoolYear');
                        }
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      Salvar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                    <input
                      type="date"
                      value={schoolYearConfig?.startDate || ''}
                      onChange={async (e) => {
                        await updateDoc(doc(db, 'config', 'schoolYear'), { startDate: e.target.value });
                      }}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data de Término</label>
                    <input
                      type="date"
                      value={schoolYearConfig?.endDate || ''}
                      onChange={async (e) => {
                        await updateDoc(doc(db, 'config', 'schoolYear'), { endDate: e.target.value });
                      }}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button
                    onClick={handleCloseSchoolYear}
                    disabled={loading}
                    className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-3 border border-red-100"
                  >
                    <XCircle className="w-6 h-6" />
                    {loading ? 'Processando Rematrícula...' : 'ENCERRAR ANO LETIVO E REMATRICULAR'}
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-2">
                    Atenção: Esta ação é irreversível e automatiza a progressão de todos os alunos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'meetings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Atas de Reuniões</h3>
                <p className="text-sm text-slate-500">Registro e gestão de reuniões administrativas e pedagógicas</p>
              </div>
              <button
                onClick={() => {
                  setMeetingForm({ type: 'ADMINISTRATIVA', title: '', content: '', date: safeFormat(new Date(), 'yyyy-MM-dd') || "", participants: '' });
                  setEditingMeeting(null);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                Nova Ata
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['ADMINISTRATIVA', 'PEDAGÓGICA', 'PAIS', 'ALUNOS', 'GERAL', 'OUTRAS'].map(type => (
                <div key={type} className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      type === 'ADMINISTRATIVA' ? "bg-indigo-400" :
                      type === 'PEDAGÓGICA' ? "bg-amber-400" :
                      type === 'PAIS' ? "bg-green-400" :
                      type === 'ALUNOS' ? "bg-blue-400" :
                      type === 'GERAL' ? "bg-purple-400" : "bg-slate-400"
                    )} />
                    {type}
                  </h4>
                  <div className="space-y-3">
                    {meetings
                      .filter(m => m.type === type)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(meeting => (
                        <div key={meeting.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                              {safeFormat(meeting.date, 'dd/MM/yyyy')}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setViewingMeeting(meeting)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Eye className="w-4 h-4" />
                              </button>
                              {hasFullAccess && (
                                <>
                                  <button onClick={() => { setEditingMeeting(meeting); setMeetingForm({ ...meeting }); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteMeeting(meeting.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <h5 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1">{meeting.title}</h5>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{meeting.content}</p>
                          <button 
                            onClick={() => { setViewingMeeting(meeting); setTimeout(() => window.print(), 500); }}
                            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            IMPRIMIR ATA
                          </button>
                        </div>
                      ))}
                    {meetings.filter(m => m.type === type).length === 0 && (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhuma ata</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-2xl shadow-2xl w-full overflow-y-auto ${subTab === 'teachers' ? 'max-w-4xl max-h-[90vh]' : 'max-w-lg max-h-[90vh]'}`}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {subTab === 'students' ? (editingStudent ? 'Editar Aluno' : 'Cadastrar Aluno') : 
                   subTab === 'teachers' ? (editingTeacher ? 'Editar Membro da Equipe' : 'Cadastrar Membro da Equipe') : 
                   subTab === 'meetings' ? (editingMeeting ? 'Editar Ata' : 'Nova Ata de Reunião') :
                   'Cadastrar Turma'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              {subTab === 'students' && (
                <form onSubmit={handleAddStudent} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                    <input
                      required
                      type="text"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Data de Nascimento (Opcional)</label>
                      <input
                        type="date"
                        value={studentForm.birthDate}
                        onChange={(e) => setStudentForm({ ...studentForm, birthDate: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Telefone</label>
                      <input
                        type="tel"
                        value={studentForm.phone}
                        onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Turmas Vinculadas</label>
                      <div className="space-y-2">
                        {studentForm.classIds.map((cid, index) => (
                          <div key={index} className="flex gap-2">
                            <select
                              value={cid}
                              onChange={(e) => {
                                const newIds = [...studentForm.classIds];
                                newIds[index] = e.target.value;
                                setStudentForm({ ...studentForm, classIds: newIds });
                              }}
                              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">Selecione...</option>
                              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const newIds = studentForm.classIds.filter((_, i) => i !== index);
                                setStudentForm({ ...studentForm, classIds: newIds });
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setStudentForm({ ...studentForm, classIds: [...studentForm.classIds, ''] })}
                          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all text-[10px] font-bold uppercase flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" /> Adicionar Outra Turma
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Endereço</label>
                      <input
                        type="text"
                        value={studentForm.address}
                        onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Rua, número, bairro..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Responsáveis</label>
                      <input
                        type="text"
                        value={studentForm.guardians}
                        onChange={(e) => setStudentForm({ ...studentForm, guardians: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Ano Letivo</label>
                      <select
                        required
                        value={studentForm.schoolYear}
                        onChange={(e) => setStudentForm({ ...studentForm, schoolYear: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                      <select
                        value={studentForm.status}
                        onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value as any })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="concluído">Concluído</option>
                        <option value="transferido">Transferido</option>
                        <option value="evadido">Evadido</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="doNotRenew"
                        checked={studentForm.doNotRenew}
                        onChange={(e) => setStudentForm({ ...studentForm, doNotRenew: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="doNotRenew" className="text-sm font-medium text-slate-700">Não renovar matrícula automaticamente</label>
                    </div>
                  </div>
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    {editingStudent ? 'Atualizar Aluno' : 'Salvar Aluno'}
                  </button>
                </form>
              )}

              {subTab === 'teachers' && (
                <form onSubmit={handleAddTeacher} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Basic Info */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                          <input
                            required
                            type="text"
                            value={teacherForm.name}
                            onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Perfil de Acesso (Cargo)</label>
                          <select
                            value={teacherForm.role}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              let allowedTabsList: string[] = [];
                              let permissions: Record<string, 'read' | 'full'> = {};
                              
                              if (newRole === 'admin') {
                                const allModules = ['dashboard', 'academic', 'projects', 'finance', 'reports', 'planning', 'organogram'];
                                const allSubAreas = ['students', 'teachers', 'classes', 'attendance', 'schoolYear', 'regimento', 'calendar', 'system', 'comunicados', 'documentos', 'meetings'];
                                allowedTabsList = [...allModules, ...allSubAreas, 'system'];
                                allowedTabsList.forEach(t => permissions[t] = 'full');
                              } else if (newRole === 'coordinator') {
                                // Coordination access: All except system config usually, but let's include all 18 non-admin modules
                                allowedTabsList = [
                                  'dashboard', 'academic', 'students', 'teachers', 'classes', 'attendance',
                                  'schoolYear', 'projects', 'finance', 'reports', 'planning',
                                  'regimento', 'calendar', 'comunicados', 'documentos', 'meetings', 'organogram'
                                ];
                                allowedTabsList.forEach(t => permissions[t] = 'full');
                              } else {
                                const profile = profiles.find(p => p.id === newRole || p.name === newRole);
                                if (profile) {
                                  allowedTabsList = profile.allowedTabs;
                                  permissions = profile.permissions || {};
                                  // Ensure default 'full' if not explicitly set
                                  allowedTabsList.forEach(t => {
                                    if (!permissions[t]) permissions[t] = 'full';
                                  });
                                }
                              }
                              
                              const modulos = { ...teacherForm.modulos };
                              Object.keys(modulos).forEach(k => modulos[k] = allowedTabsList.includes(k));
                              
                              const subAreas = { ...teacherForm.subAreas };
                              Object.keys(subAreas).forEach(k => subAreas[k] = allowedTabsList.includes(k));

                              let turmasList = [...teacherForm.classIds];
                              if (newRole === 'admin' || newRole === 'coordinator') {
                                turmasList = classes.map(c => c.id);
                              }
                              
                              setTeacherForm({ 
                                ...teacherForm, 
                                role: newRole, 
                                modulos, 
                                subAreas, 
                                allowedTabs: allowedTabsList, 
                                permissions,
                                classIds: turmasList 
                              });
                            }}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                          >
                            <option value="">Selecione um perfil...</option>
                            <option value="admin" className="font-bold text-indigo-600">ADMINISTRADOR</option>
                            <option value="coordinator">COORDENAÇÃO</option>
                            {profiles.filter(p => !['admin', 'administrador', 'coordenação', 'coordenador'].includes(p.name.toLowerCase())).map(profile => (
                              <option key={profile.id} value={profile.id}>{profile.name.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                          <input
                            required
                            type="email"
                            value={teacherForm.email}
                            onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Login (Usuário)</label>
                          <input
                            required
                            type="text"
                            value={teacherForm.login}
                            onChange={(e) => setTeacherForm({ ...teacherForm, login: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Senha de Acesso</label>
                          <input
                            required
                            type={(hasFullAccess || (editingTeacher && editingTeacher.id === user.id)) ? "text" : "password"}
                            value={teacherForm.password}
                            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Confirmar Senha</label>
                          <input
                            required
                            type={(hasFullAccess || (editingTeacher && editingTeacher.id === user.id)) ? "text" : "password"}
                            value={teacherForm.confirmPassword}
                            onChange={(e) => setTeacherForm({ ...teacherForm, confirmPassword: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Contato (Telefone)</label>
                          <input
                            type="text"
                            value={teacherForm.contact}
                            onChange={(e) => setTeacherForm({ ...teacherForm, contact: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Data de Aniversário</label>
                          <input
                            type="date"
                            value={teacherForm.birthDate}
                            onChange={(e) => setTeacherForm({ ...teacherForm, birthDate: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Endereço Completo</label>
                        <input
                          type="text"
                          value={teacherForm.address}
                          onChange={(e) => setTeacherForm({ ...teacherForm, address: e.target.value })}
                          placeholder="Rua, número, bairro, cidade..."
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Profissão</label>
                          <input
                            type="text"
                            value={teacherForm.profession}
                            onChange={(e) => setTeacherForm({ ...teacherForm, profession: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Início Exercício Docente na EBD</label>
                          <input
                            type="date"
                            value={teacherForm.startDateEBD}
                            onChange={(e) => setTeacherForm({ ...teacherForm, startDateEBD: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Perfil Geral do Membro</label>
                        <textarea
                          value={teacherForm.generalProfile}
                          onChange={(e) => setTeacherForm({ ...teacherForm, generalProfile: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                          placeholder="Descreva o perfil, experiências e observações..."
                        />
                      </div>
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Formações Acadêmicas</label>
                          <textarea
                            value={teacherForm.academicBackground}
                            onChange={(e) => setTeacherForm({ ...teacherForm, academicBackground: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                            placeholder="Descreva as formações acadêmicas..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Formações Teológicas</label>
                          <textarea
                            value={teacherForm.theologicalBackground}
                            onChange={(e) => setTeacherForm({ ...teacherForm, theologicalBackground: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                            placeholder="Descreva as formações teológicas..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Permissions & Classes */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase">Turma Responsável</label>
                          <button 
                            type="button"
                            onClick={() => setTeacherForm({ ...teacherForm, classIds: [...teacherForm.classIds, ""] })}
                            className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2 p-3 border border-slate-200 rounded-xl bg-slate-50 max-h-48 overflow-y-auto">
                          {(teacherForm.classIds.length > 0 ? teacherForm.classIds : [""]).map((cid, idx) => (
                            <div key={idx} className="flex gap-2">
                              <select
                                value={cid}
                                onChange={(e) => {
                                  const newIds = [...(teacherForm.classIds.length > 0 ? teacherForm.classIds : [""])];
                                  newIds[idx] = e.target.value;
                                  setTeacherForm({ ...teacherForm, classIds: newIds });
                                }}
                                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                              >
                                <option value="">Selecione a turma...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <button 
                                type="button"
                                onClick={() => {
                                  const newIds = teacherForm.classIds.filter((_, i) => i !== idx);
                                  setTeacherForm({ ...teacherForm, classIds: newIds });
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Áreas de Acesso</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newMods = { ...teacherForm.modulos };
                                Object.keys(newMods).forEach(k => newMods[k] = true);
                                // Trigger auto-linking
                                const newSubAreas = { ...teacherForm.subAreas };
                                Object.keys(newMods).forEach(modId => {
                                  if (newMods[modId] && MODULES_SUB_AREAS_LINKING[modId]) {
                                    MODULES_SUB_AREAS_LINKING[modId].forEach(sub => {
                                      if (sub in newSubAreas) newSubAreas[sub] = true;
                                    });
                                  }
                                });
                                setTeacherForm({ ...teacherForm, modulos: newMods, subAreas: newSubAreas });
                              }}
                              className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors uppercase tracking-widest"
                            >
                              TODOS MÓDULOS
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newSubs = { ...teacherForm.subAreas };
                                Object.keys(newSubs).forEach(k => newSubs[k] = true);
                                setTeacherForm({ ...teacherForm, subAreas: newSubs });
                              }}
                              className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100 transition-colors uppercase tracking-widest"
                            >
                              TODAS SUBÁREAS
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50 max-h-80 overflow-y-auto">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Módulos Principais</p>
                            {[
                               { id: 'dashboard', label: 'Dashboard' },
                               { id: 'academic', label: 'Acadêmico' },
                               { id: 'administrative', label: 'Administrativo' },
                               { id: 'projects', label: 'Projetos' },
                               { id: 'finance', label: 'Financeiro' },
                               { id: 'reports', label: 'Relatórios' },
                             ].map(tab => (
                               <label key={tab.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors">
                                 <input 
                                   type="checkbox"
                                   checked={!!teacherForm.modulos[tab.id]}
                                   onChange={(e) => {
                                     const checked = e.target.checked;
                                     const newSubAreas = { ...teacherForm.subAreas };
                                     
                                     // Auto-link sub-areas
                                     if (MODULES_SUB_AREAS_LINKING[tab.id]) {
                                       MODULES_SUB_AREAS_LINKING[tab.id].forEach(sub => {
                                         if (sub in newSubAreas) {
                                           newSubAreas[sub] = checked;
                                         }
                                       });
                                     }

                                     setTeacherForm({ 
                                       ...teacherForm, 
                                       modulos: { ...teacherForm.modulos, [tab.id]: checked },
                                       subAreas: newSubAreas
                                     });
                                   }}
                                   className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                 />
                                 <span className="text-xs font-bold uppercase">{tab.label}</span>
                               </label>
                             ))}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Sub-Áreas</p>
                             {[
                                { id: 'students', label: 'Alunos' },
                                { id: 'teachers', label: 'Equipe' },
                                { id: 'classes', label: 'Turmas' },
                                { id: 'attendance', label: 'Chamada' },
                                { id: 'planning', label: 'Planejamento' },
                                { id: 'schoolYear', label: 'Ano Letivo' },
                                { id: 'calendar', label: 'Calendário' },
                                { id: 'meetings', label: 'Reuniões' },
                                { id: 'comunicados', label: 'Comunicados' },
                                { id: 'documentos', label: 'Documentos' },
                                { id: 'organogram', label: 'Organograma' },
                                { id: 'regimento', label: 'Regimento' }
                              ].map(sub => (
                                <label key={sub.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-emerald-600 transition-colors">
                                  <input 
                                    type="checkbox"
                                    checked={!!teacherForm.subAreas[sub.id]}
                                    onChange={(e) => {
                                      setTeacherForm({ 
                                        ...teacherForm, 
                                        subAreas: { ...teacherForm.subAreas, [sub.id]: e.target.checked }
                                      });
                                    }}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                                  />
                                  <span className="text-[10px] font-medium uppercase italic">{sub.label}</span>
                                </label>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-100 mt-4">
                    {editingTeacher ? 'Atualizar Membro' : 'Salvar Membro'}
                  </button>
                </form>
              )}

              {subTab === 'meetings' && (
                <form onSubmit={handleAddMeeting} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Reunião</label>
                      <select
                        required
                        value={meetingForm.type}
                        onChange={(e) => setMeetingForm({ ...meetingForm, type: e.target.value as any })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="ADMINISTRATIVA">Administrativa</option>
                        <option value="PEDAGÓGICA">Pedagógica</option>
                        <option value="PAIS">Reunião de Pais</option>
                        <option value="ALUNOS">Encontro de Alunos</option>
                        <option value="GERAL">Geral</option>
                        <option value="OUTRAS">Outras</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                      <input
                        required
                        type="date"
                        value={meetingForm.date}
                        onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Título da Reunião</label>
                    <input
                      required
                      type="text"
                      value={meetingForm.title}
                      onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                      placeholder="Ex: Planejamento Trimestral"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Participantes</label>
                    <input
                      type="text"
                      value={meetingForm.participants}
                      onChange={(e) => setMeetingForm({ ...meetingForm, participants: e.target.value })}
                      placeholder="Nomes dos presentes..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo / Pauta / Decisões</label>
                    <textarea
                      required
                      rows={8}
                      value={meetingForm.content}
                      onChange={(e) => setMeetingForm({ ...meetingForm, content: e.target.value })}
                      placeholder="Descreva o que foi discutido e decidido..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    {editingMeeting ? 'Atualizar Ata' : 'Salvar Ata'}
                  </button>
                </form>
              )}

              {subTab === 'classes' && (
                <form onSubmit={handleAddClass} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome da Turma</label>
                    <input
                      required
                      type="text"
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Faixa Etária</label>
                      <input
                        required
                        type="text"
                        value={classForm.ageRange}
                        onChange={(e) => setClassForm({ ...classForm, ageRange: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Ano Letivo</label>
                      <select
                        required
                        value={classForm.schoolYear}
                        onChange={(e) => setClassForm({ ...classForm, schoolYear: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Membros da Equipe Responsáveis</label>
                      <button 
                        type="button"
                        onClick={() => setClassForm({ ...classForm, teacherIds: [...classForm.teacherIds, ""] })}
                        className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {(classForm.teacherIds.length > 0 ? classForm.teacherIds : [""]).map((tid, idx) => (
                      <div key={idx} className="flex gap-2">
                        <select
                          value={tid}
                          onChange={(e) => {
                            const newIds = [...(classForm.teacherIds.length > 0 ? classForm.teacherIds : [""])];
                            newIds[idx] = e.target.value;
                            setClassForm({ ...classForm, teacherIds: newIds });
                          }}
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Selecione...</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button 
                          type="button"
                          onClick={() => {
                            const newIds = classForm.teacherIds.filter((_, i) => i !== idx);
                            setClassForm({ ...classForm, teacherIds: newIds });
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nível da Série (Ordem)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={classForm.gradeLevel}
                        onChange={(e) => setClassForm({ ...classForm, gradeLevel: parseInt(e.target.value) })}
                        placeholder="Ex: 1 para 1º ano"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="isFinalGrade"
                        checked={classForm.isFinalGrade}
                        onChange={(e) => setClassForm({ ...classForm, isFinalGrade: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="isFinalGrade" className="text-sm font-medium text-slate-700">Série Final (Concluintes)</label>
                    </div>
                  </div>
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    {editingClass ? 'Atualizar Turma' : 'Salvar Turma'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Justification Modal */}
      <AnimatePresence>
        {showJustifyModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Justificar Falta</h3>
                <button onClick={() => setShowJustifyModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Selecione uma justificativa ou crie uma nova para o aluno 
                  <span className="font-bold"> {students.find(s => s.id === currentJustifyStudent)?.name}</span>.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Opções Salvas</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                    {justificationOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleJustify(currentJustifyStudent!, opt.text)}
                        className="text-left px-4 py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-sm transition-all border border-slate-100"
                      >
                        {opt.text}
                      </button>
                    ))}
                    {justificationOptions.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Nenhuma justificativa salva ainda.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nova Justificativa</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newJustification}
                      onChange={(e) => setNewJustification(e.target.value)}
                      placeholder="Digite aqui..."
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => {
                        if (newJustification.trim()) {
                          handleJustify(currentJustifyStudent!, newJustification.trim());
                          setNewJustification('');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  Criar Relatório Individual ({reportType === 'student' ? 'Aluno' : 'Membro da Equipe'})
                </h3>
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveReport} className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-900">
                    Alvo: {reportType === 'student' 
                      ? students.find(s => s.id === reportTargetId)?.name 
                      : teachers.find(t => t.id === reportTargetId)?.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                  <input
                    required
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo do Relatório</label>
                  <textarea
                    required
                    rows={8}
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="Descreva o desempenho, comportamento ou observações..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Relatório
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Attendance Report at the end */}
      {subTab === 'attendance' && attendances.length > 0 && (
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Relatório de Chamadas Realizadas</h3>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-sm font-bold text-slate-600"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attendances
              .filter(a => !selectedClass || a.classId === selectedClass)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(att => (
              <div key={att.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 group relative">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      {classes.find(c => c.id === att.classId)?.name}
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      {safeFormat(att.date, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => handleEditAttendance(att)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteAttendance(att.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Conteúdo:</span>
                    <span className="truncate">{att.contentGiven || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {att.presentStudentIds.length} Presentes
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-3.5 h-3.5" />
                      {att.absentStudentIds.length} Faltas
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* View Attendance Modal */}
      <AnimatePresence>
        {viewingAttendance && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:p-0 print:bg-white">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none print:rounded-none"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 print:border-b-2 print:border-slate-900">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Relatório de Chamada</h3>
                  <p className="text-sm text-slate-500 font-bold">
                    {safeFormat(viewingAttendance.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - {classes.find(c => c.id === viewingAttendance.classId)?.name}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                    title="Imprimir"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setViewingAttendance(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <XCircle className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-8 print:p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 print:text-slate-900">Conteúdo Ministrado</h4>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap print:bg-white print:border-slate-200">
                        {viewingAttendance.contentGiven || 'Nenhum conteúdo registrado.'}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 print:text-slate-900">Metodologia</h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingAttendance.methodology ? (
                          viewingAttendance.methodology.split(', ').map(m => (
                            <span key={m} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100 print:bg-white print:border-slate-300 print:text-slate-900">
                              {m}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400 italic print:text-slate-500">Nenhuma metodologia registrada.</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 print:text-slate-900">Observações</h4>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 italic whitespace-pre-wrap print:bg-white print:border-slate-200">
                        {viewingAttendance.observation || 'Sem observações.'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 print:bg-white print:border-slate-200">
                        <p className="text-[10px] font-bold text-green-600 uppercase mb-1 print:text-slate-900">Presentes</p>
                        <p className="text-xl font-black text-green-700 print:text-slate-900">{viewingAttendance.presentStudentIds.length}</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-xl border border-red-100 print:bg-white print:border-slate-200">
                        <p className="text-[10px] font-bold text-red-600 uppercase mb-1 print:text-slate-900">Faltas</p>
                        <p className="text-xl font-black text-red-700 print:text-slate-900">{viewingAttendance.absentStudentIds.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Questions in Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 print:grid-cols-2 print:gap-4">
                  {[
                    { label: '1) A aula atingiu os objetivos desejados?', value: viewingAttendance.aulaObjetivos },
                    { label: '2) Os alunos participaram e interagiram durante a aula?', value: viewingAttendance.alunosParticiparam },
                    { label: '3) O versículo bíblico da semana foi citado em sala?', value: viewingAttendance.versiculoCitado },
                    { label: '4) Houve oferta em sala?', value: viewingAttendance.houveOferta },
                  ].map((q, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-200">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 print:text-slate-900">{q.label}</p>
                      <p className={cn(
                        "text-xs font-black uppercase",
                        q.value === 'SIM' ? "text-green-600" : q.value === 'NÃO' ? "text-red-600" : q.value === 'PARCIALMENTE' ? "text-amber-600" : "text-slate-600"
                      )}>
                        {q.value || 'NÃO INFORMADO'}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-900">Lista de Alunos</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden print:border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 print:bg-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-600 print:text-slate-900">Aluno</th>
                          <th className="px-4 py-3 font-bold text-slate-600 print:text-slate-900">Status</th>
                          <th className="px-4 py-3 font-bold text-slate-600 print:text-slate-900">Justificativa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                        {students
                          .filter(s => s.classId === viewingAttendance.classId)
                          .map(student => {
                            const isPresent = viewingAttendance.presentStudentIds.includes(student.id);
                            const justification = viewingAttendance.justifications?.[student.id];
                            return (
                              <tr key={student.id}>
                                <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                <td className="px-4 py-3">
                                  {isPresent ? (
                                    <span className="text-green-600 font-bold flex items-center gap-1 print:text-slate-900">
                                      <CheckCircle2 className="w-4 h-4 print:hidden" /> Presente
                                    </span>
                                  ) : (
                                    <span className="text-red-600 font-bold flex items-center gap-1 print:text-slate-900">
                                      <XCircle className="w-4 h-4 print:hidden" /> Falta
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-500 italic text-xs print:text-slate-600">
                                  {justification || '-'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Range Report Modal */}
      <AnimatePresence>
        {showRangeReportModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:p-0 print:bg-white">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:rounded-none"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
                <h3 className="text-xl font-bold text-slate-900">Relatório por Período</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowRangeReportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <XCircle className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 items-end print:hidden">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Turma</label>
                  <select
                    value={reportFilterClass}
                    onChange={(e) => setReportFilterClass(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                  >
                    <option value="all">Todas as Turmas</option>
                    {filteredClassesForAttendance.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data Início</label>
                  <input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data Fim</label>
                  <input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-8 overflow-y-auto print:p-0">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Relatório de Chamadas e Registros</h2>
                  <p className="text-slate-500 font-bold">
                    Período: {safeFormat(reportStartDate, 'dd/MM/yyyy')} até {safeFormat(reportEndDate, 'dd/MM/yyyy')}
                  </p>
                </div>

                <div className="space-y-10">
                  {attendances
                    .filter(a => {
                      const date = a.date;
                      const matchesRange = date >= reportStartDate && date <= reportEndDate;
                      const matchesClass = reportFilterClass === 'all' || a.classId === reportFilterClass;
                      const matchesAccess = isAdmin || user.classIds.includes(a.classId);
                      return matchesRange && matchesClass && matchesAccess;
                    })
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(att => (
                      <div key={att.id} className="space-y-4 border-b border-slate-100 pb-8 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                              {safeFormat(att.date, 'dd/MM/yyyy')}
                            </div>
                            <span className="font-bold text-slate-900 uppercase text-sm">
                              {classes.find(c => c.id === att.classId)?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold">
                            <span className="text-green-600">{att.presentStudentIds.length} Presentes</span>
                            <span className="text-red-600">{att.absentStudentIds.length} Faltas</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conteúdo Ministrado</p>
                              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">{att.contentGiven || 'Nenhum conteúdo registrado.'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Metodologia</p>
                              <p className="text-slate-700 leading-relaxed text-sm">{att.methodology || 'Nenhuma metodologia registrada.'}</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observações</p>
                              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm italic">{att.observation || 'Sem observações.'}</p>
                            </div>
                            {att.justifications && Object.keys(att.justifications).length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Justificativas de Falta</p>
                                <div className="space-y-1">
                                  {Object.entries(att.justifications).map(([sId, text]) => (
                                    <p key={sId} className="text-xs text-slate-600">
                                      <span className="font-bold">{students.find(s => s.id === sId)?.name}:</span> {text}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {attendances.filter(a => {
                    const date = a.date;
                    const matchesRange = date >= reportStartDate && date <= reportEndDate;
                    const matchesClass = reportFilterClass === 'all' || a.classId === reportFilterClass;
                    const matchesAccess = isAdmin || user.classIds.includes(a.classId);
                    return matchesRange && matchesClass && matchesAccess;
                  }).length === 0 && (
                    <div className="text-center py-20 text-slate-400">
                      Nenhum registro encontrado para o período selecionado.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Report List Modal */}
      {/* Meeting View Modal */}
      <AnimatePresence>
        {viewingMeeting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0 print:bg-white print:static print:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none print:rounded-none"
            >
              <div className="p-8 space-y-8 print:p-12">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6 print:border-slate-300">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 print:hidden">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Ata de Reunião</h2>
                      <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">{viewingMeeting.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{safeFormat(viewingMeeting.date, 'dd/MM/yyyy')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data da Reunião</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Título / Assunto</label>
                    <h3 className="text-xl font-bold text-slate-900">{viewingMeeting.title}</h3>
                  </div>

                  {viewingMeeting.participants && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Participantes</label>
                      <p className="text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100 print:bg-transparent print:border-slate-200">
                        {viewingMeeting.participants}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Conteúdo e Decisões</label>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[200px] print:bg-transparent print:border-slate-200">
                      {viewingMeeting.content}
                    </div>
                  </div>
                </div>

                <div className="pt-12 grid grid-cols-2 gap-12 print:pt-24">
                  <div className="border-t border-slate-200 pt-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assinatura do Responsável</p>
                  </div>
                  <div className="border-t border-slate-200 pt-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assinatura do Secretário</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir Ata
                  </button>
                  <button
                    onClick={() => setViewingMeeting(null)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportListModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Histórico de Relatórios
                  </h3>
                  <p className="text-sm text-slate-500">
                    {reportType === 'student' 
                      ? students.find(s => s.id === reportTargetId)?.name 
                      : teachers.find(t => t.id === reportTargetId)?.name}
                  </p>
                </div>
                <button onClick={() => setShowReportListModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* New Report Form */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Relatório
                  </h4>
                  <textarea
                    value={newReportContent}
                    onChange={(e) => setNewReportContent(e.target.value)}
                    placeholder="Descreva o desempenho, comportamento ou observações..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[100px] resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddReport}
                      disabled={isSavingReport || !newReportContent.trim()}
                      className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingReport ? 'Salvando...' : 'Salvar Relatório'}
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Registros Anteriores
                  </h4>
                  {(reportType === 'student' 
                    ? studentReports.filter(r => r.studentId === reportTargetId)
                    : teacherReports.filter(r => r.targetTeacherId === reportTargetId)
                  ).sort((a, b) => b.date.localeCompare(a.date)).map(report => (
                  <div key={report.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        {safeFormat(report.date, 'dd/MM/yyyy')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Por: {teachers.find(t => t.id === (reportType === 'student' ? (report as StudentReport).teacherId : (report as TeacherReport).adminId))?.name || 'Sistema'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {report.content}
                    </p>
                  </div>
                ))}
                {(reportType === 'student' 
                  ? studentReports.filter(r => r.studentId === reportTargetId)
                  : teacherReports.filter(r => r.targetTeacherId === reportTargetId)
                ).length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic">
                    Nenhum relatório encontrado para este registro.
                  </div>
                )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* General Report Modal (Printable) */}
      <AnimatePresence>
        {showGeneralReportModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:p-0 print:bg-white">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:rounded-none"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
                <h3 className="text-xl font-bold text-slate-900">
                  Relatório Geral de {reportType === 'student' ? 'Alunos' : 'Equipe EBD'}
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowGeneralReportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <XCircle className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="p-8 overflow-y-auto print:p-0">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                    Relatório Geral - {reportType === 'student' ? 'Alunos' : 'Equipe EBD'}
                  </h2>
                  <p className="text-slate-500 font-bold">Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Nome</th>
                      {reportType === 'student' ? (
                        <>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Turma</th>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Idade</th>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Frequência</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Email</th>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Contato</th>
                          <th className="py-3 text-left text-sm font-black uppercase tracking-wider">Turmas</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportType === 'student' ? (
                      filteredStudents.map(student => (
                        <tr key={student.id}>
                          <td className="py-4 text-sm font-bold text-slate-900">{student.name}</td>
                          <td className="py-4 text-sm text-slate-600">{classes.find(c => c.id === student.classId)?.name || '-'}</td>
                          <td className="py-4 text-sm text-slate-600">{differenceInYears(new Date(), parseISO(student.birthDate))} anos</td>
                          <td className="py-4 text-sm font-bold text-indigo-600">{student.attendancePercentage || 0}%</td>
                        </tr>
                      ))
                    ) : (
                      teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(teacher => (
                        <tr key={teacher.id}>
                          <td className="py-4 text-sm font-bold text-slate-900">{teacher.name}</td>
                          <td className="py-4 text-sm text-slate-600">{teacher.email}</td>
                          <td className="py-4 text-sm text-slate-600">{teacher.contact}</td>
                          <td className="py-4 text-sm text-slate-600">
                            {teacher.classIds?.map(cid => classes.find(c => c.id === cid)?.name).join(', ')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clone Class Modal */}
      <AnimatePresence>
        {showCloneModal && cloningClass && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <Copy className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Clonar Turma</h3>
                <p className="text-slate-500 font-medium mb-8">
                  Você está clonando a turma <span className="text-indigo-600 font-bold">{cloningClass.name}</span>. 
                  Os alunos serão vinculados automaticamente à nova turma.
                </p>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-left">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center mt-1">
                      <input
                        type="checkbox"
                        checked={resetAttendanceOnClone}
                        onChange={(e) => setResetAttendanceOnClone(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:bg-indigo-600 checked:border-indigo-600"
                      />
                      <Check className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Resetar frequência dos alunos
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Se marcado, a nova turma começará sem registros de chamada. A frequência da turma original não será afetada.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={executeCloneClass}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Copy className="w-5 h-5" />
                    Confirmar Clonagem
                  </button>
                  <button
                    onClick={() => {
                      setShowCloneModal(false);
                      setCloningClass(null);
                    }}
                    className="w-full py-4 bg-white text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student History Modal */}
      <AnimatePresence>
        {viewingStudentHistory && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-200">
                    {viewingStudentHistory.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{viewingStudentHistory.name}</h3>
                    <p className="text-slate-500 font-medium">Histórico de Trajetória Escolar</p>
                  </div>
                </div>
                <button onClick={() => setViewingStudentHistory(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {/* Current Enrollment */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-indigo-600 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <time className="font-black text-indigo-600 uppercase text-xs">Ano Atual</time>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full">ATIVO</span>
                      </div>
                      <div className="text-slate-900 font-bold">
                        {classes.find(c => c.id === viewingStudentHistory.classId)?.name || 'Sem Turma'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Matrícula: {viewingStudentHistory.registrationNumber}</div>
                    </div>
                  </div>

                  {/* Past Enrollments */}
                  {studentHistory
                    .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear))
                    .map((enroll, idx) => (
                    <div key={enroll.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <time className="font-black text-slate-400 uppercase text-xs">{enroll.schoolYear}</time>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            enroll.status === 'concluído' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                          )}>
                            {enroll.status}
                          </span>
                        </div>
                        <div className="text-slate-700 font-bold">
                          {classes.find(c => c.id === enroll.classId)?.name || 'Turma Antiga'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Matrícula: {enroll.registrationNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {studentHistory.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-medium">Nenhum histórico anterior encontrado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rematriculation Modal */}
      <AnimatePresence>
        {showReenrollmentModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Processar Rematrícula</h3>
                    <p className="text-indigo-100 text-sm">Selecione as turmas para o próximo ano</p>
                  </div>
                </div>
                <button onClick={() => setShowReenrollmentModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">Atenção!</p>
                    <p>As turmas selecionadas serão duplicadas para o ano de {parseInt(schoolYear) + 1}. Os alunos serão rematriculados automaticamente e as turmas atuais serão <strong>finalizadas</strong>.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Turmas Ativas ({schoolYear})</label>
                    <button 
                      onClick={() => {
                        const allIds = classes.filter(c => c.schoolYear === schoolYear && c.status !== 'ENCERRADA').map(c => c.id);
                        setSelectedClassesForReenroll(selectedClassesForReenroll.length === allIds.length ? [] : allIds);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      {selectedClassesForReenroll.length === classes.filter(c => c.schoolYear === schoolYear && c.status !== 'ENCERRADA').length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2">
                    {classes
                      .filter(c => c.schoolYear === schoolYear && c.status !== 'ENCERRADA')
                      .map(c => (
                        <label 
                          key={c.id} 
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                            selectedClassesForReenroll.includes(c.id) 
                              ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                              : "bg-slate-50 border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <input 
                            type="checkbox"
                            checked={selectedClassesForReenroll.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedClassesForReenroll([...selectedClassesForReenroll, c.id]);
                              else setSelectedClassesForReenroll(selectedClassesForReenroll.filter(id => id !== c.id));
                            }}
                            className="w-5 h-5 text-indigo-600 border-slate-300 rounded-lg focus:ring-indigo-500"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{students.filter(s => s.classId === c.id || s.classIds?.includes(c.id)).length} Alunos</p>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>

                <button
                  onClick={handleAutoReenrollment}
                  disabled={loading || selectedClassesForReenroll.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      Confirmar e Processar Rematrícula
                    </>
                  )}
                </button>
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
                  {modalConfig.type === 'confirm' ? <AlertCircle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{modalConfig.title}</h3>
                <p className="text-slate-500 font-medium mb-8">{modalConfig.message}</p>

                {modalConfig.isPassword && (
                  <div className="mb-6">
                    <input
                      id="modal-password-input"
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
                        const input = (document.getElementById('modal-password-input') as HTMLInputElement)?.value;
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

      {/* Reenrollment Summary Modal */}
      <AnimatePresence>
        {showReenrollmentSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Rematrícula Concluída!</h3>
                <p className="text-slate-500 font-medium mb-8">
                  O processo de encerramento do ano letivo e rematrícula automática foi finalizado com sucesso.
                </p>

                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Alunos Rematriculados</span>
                    <span className="text-lg font-black text-indigo-600">{reenrollmentSummary.studentsReenrolled}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Alunos Concluintes</span>
                    <span className="text-lg font-black text-green-600">{reenrollmentSummary.studentsCompleted}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Novas Turmas Criadas</span>
                    <span className="text-lg font-black text-amber-600">{reenrollmentSummary.classesCreated}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowReenrollmentSummary(false)}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DiaryReportModal 
        isOpen={showDiaryReport}
        onClose={() => setShowDiaryReport(false)}
        classId={diaryReportClass || ""}
        classes={classes}
        students={students}
        attendances={attendances}
        teachers={teachers}
        initialMonth={diaryReportMonth}
        startDate={diaryStartDate}
        endDate={diaryEndDate}
      />
    </div>
  );
}
