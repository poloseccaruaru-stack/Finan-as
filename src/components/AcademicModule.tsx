import { useState, useEffect, useMemo } from 'react';
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
  setDoc
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
  CheckSquare,
  AlertCircle,
  Save,
  Check,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Printer
} from 'lucide-react';
import { format, differenceInYears, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Student, Teacher, Class, Attendance, Planning, JustificationOption } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
  subTab: 'students' | 'teachers' | 'classes' | 'attendance';
}

type SortField = 'name' | 'age' | 'class';

export default function AcademicModule({ user, subTab }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
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
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [currentJustifyStudent, setCurrentJustifyStudent] = useState<string | null>(null);
  const [newJustification, setNewJustification] = useState('');
  const [attendanceFilterMonth, setAttendanceFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [attendanceFilterClass, setAttendanceFilterClass] = useState<string>('all');

  const isAdmin = user.role === 'admin';

  // Fetch Data
  useEffect(() => {
    const studentsQuery = isAdmin 
      ? collection(db, 'students') 
      : query(collection(db, 'students'), where('classId', 'in', user.classIds.length > 0 ? user.classIds : ['none']));

    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const classesQuery = isAdmin
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('id', 'in', user.classIds.length > 0 ? user.classIds : ['none']));

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    const unsubJustifications = onSnapshot(collection(db, 'justificationOptions'), (snap) => {
      setJustificationOptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as JustificationOption)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'justificationOptions'));

    const unsubAttendances = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubClasses();
      unsubJustifications();
      unsubAttendances();
    };
  }, [user, isAdmin]);

  // Sorting and Filtering Logic
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterClass === 'all' || s.classId === filterClass)
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
  }, [students, searchTerm, filterClass, sortField, sortOrder, classes]);

  // Forms State
  const [studentForm, setStudentForm] = useState({
    name: '',
    birthDate: '',
    guardians: '',
    emergencyContact: '',
    phone: '',
    history: '',
    classId: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    password: '',
    contact: '',
    classIds: [] as string[]
  });

  const [classForm, setClassForm] = useState({
    name: '',
    ageRange: '',
    teacherId: ''
  });

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Deseja excluir este aluno?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('Deseja excluir este professor?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Deseja excluir esta turma?')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${id}`);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), studentForm);
      } else {
        await addDoc(collection(db, 'students'), {
          ...studentForm,
          consecutiveAbsences: 0,
          attendancePercentage: 100,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingStudent(null);
      setStudentForm({ name: '', birthDate: '', guardians: '', emergencyContact: '', phone: '', history: '', classId: '' });
    } catch (err) {
      handleFirestoreError(err, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      birthDate: student.birthDate,
      guardians: student.guardians,
      emergencyContact: student.emergencyContact,
      phone: student.phone || '',
      history: student.history,
      classId: student.classId || ''
    });
    setShowForm(true);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teacherForm.name || !teacherForm.email || (!editingTeacher && !teacherForm.password)) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!editingTeacher && teacherForm.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      if (editingTeacher) {
        await updateDoc(doc(db, 'users', editingTeacher.id), {
          name: teacherForm.name,
          email: teacherForm.email,
          contact: teacherForm.contact,
          classIds: teacherForm.classIds,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, teacherForm.email, teacherForm.password);
        const newUser = userCredential.user;

        // Create User Doc
        await setDoc(doc(db, 'users', newUser.uid), {
          name: teacherForm.name,
          email: teacherForm.email,
          contact: teacherForm.contact,
          classIds: teacherForm.classIds,
          role: 'teacher',
          firstLogin: true,
          createdAt: new Date().toISOString()
        });
      }

      setShowForm(false);
      setEditingTeacher(null);
      setTeacherForm({ name: '', email: '', password: '', contact: '', classIds: [] });
    } catch (err) {
      handleFirestoreError(err, editingTeacher ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setTeacherForm({
      name: teacher.name,
      email: teacher.email,
      password: '', // Don't load password
      contact: teacher.contact,
      classIds: teacher.classIds
    });
    setShowForm(true);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'classes'), {
        ...classForm,
        studentIds: [],
        createdAt: new Date().toISOString()
      });
      setShowForm(false);
      setClassForm({ name: '', ageRange: '', teacherId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
    }
  };

  // Attendance Logic
  const [attendanceList, setAttendanceList] = useState<{ [key: string]: boolean }>({});
  const [justifications, setJustifications] = useState<{ [key: string]: string }>({});
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [contentGiven, setContentGiven] = useState('');
  const [observation, setObservation] = useState('');
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);

  useEffect(() => {
    const unsubPlanning = onSnapshot(collection(db, 'planning'), (snap) => {
      setPlannings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Planning)));
    });
    return () => unsubPlanning();
  }, []);

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
      const classStudents = students.filter(s => s.classId === selectedClass);
      const initial = classStudents.reduce((acc, s) => ({ ...acc, [s.id]: true }), {});
      setAttendanceList(initial);
      setJustifications({});
    }
  }, [selectedClass, students]);

  const saveAttendance = async () => {
    if (!selectedClass) return;
    if (existingAttendance && !editingAttendance) {
      alert('Já existe uma chamada para esta data e turma.');
      return;
    }

    const present = Object.keys(attendanceList).filter(id => attendanceList[id]);
    const absent = Object.keys(attendanceList).filter(id => !attendanceList[id]);
    
    try {
      const attendanceData = {
        classId: selectedClass,
        date: attendanceDate,
        presentStudentIds: present,
        absentStudentIds: absent,
        justifications,
        contentGiven,
        observation,
        createdAt: new Date().toISOString()
      };

      if (editingAttendance) {
        await updateDoc(doc(db, 'attendance', editingAttendance.id), attendanceData);
      } else {
        await addDoc(collection(db, 'attendance'), attendanceData);
      }

      // Update student stats
      for (const studentId of absent) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          // Only count as absence if not justified
          const isJustified = !!justifications[studentId];
          if (!isJustified) {
            await updateDoc(doc(db, 'students', studentId), {
              consecutiveAbsences: (student.consecutiveAbsences || 0) + 1,
              lastAbsenceDate: attendanceDate
            });
          }
        }
      }

      for (const studentId of present) {
        await updateDoc(doc(db, 'students', studentId), {
          consecutiveAbsences: 0
        });
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setContentGiven('');
      setObservation('');
      setEditingAttendance(null);
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
    if (!confirm('Deseja excluir este registro de chamada?')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
    }
  };

  const handleEditAttendance = (att: Attendance) => {
    setEditingAttendance(att);
    setSelectedClass(att.classId);
    setAttendanceDate(att.date);
    setContentGiven(att.contentGiven || '');
    setObservation(att.observation || '');
    
    const list: { [key: string]: boolean } = {};
    att.presentStudentIds.forEach(id => list[id] = true);
    att.absentStudentIds.forEach(id => list[id] = false);
    setAttendanceList(list);
    setJustifications(att.justifications || {});
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
              <select 
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 outline-none"
              >
                <option value="all">Todas as Turmas</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          {isAdmin && subTab !== 'attendance' && (
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all print:hidden"
              >
                <Printer className="w-5 h-5" />
                Imprimir
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                Novo {subTab === 'students' ? 'Aluno' : subTab === 'teachers' ? 'Professor' : 'Turma'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        {classes.find(c => c.id === student.classId)?.name || 'Sem Turma'}
                      </span>
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Professor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turmas</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
                          <p className="text-xs text-slate-500">{teacher.contact}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{teacher.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.classIds?.map(cid => (
                          <span key={cid} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                            {classes.find(c => c.id === cid)?.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Faixa Etária</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Professor Responsável</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Alunos</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.ageRange}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {teachers.find(t => t.id === c.teacherId)?.name || 'Não atribuído'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {students.filter(s => s.classId === c.id).length} alunos
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteClass(c.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'attendance' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecionar Turma</label>
                <select
                  value={selectedClass || ''}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Selecione uma turma...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allPresent = students.filter(s => s.classId === selectedClass).reduce((acc, s) => ({ ...acc, [s.id]: true }), {});
                    setAttendanceList(allPresent);
                  }}
                  className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl transition-all text-sm"
                >
                  Presença em Todos
                </button>
                <button
                  onClick={() => {
                    const allAbsent = students.filter(s => s.classId === selectedClass).reduce((acc, s) => ({ ...acc, [s.id]: false }), {});
                    setAttendanceList(allAbsent);
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl transition-all text-sm"
                >
                  Falta em Todos
                </button>
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

            {selectedClass ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.filter(s => s.classId === selectedClass).map(student => (
                    <button
                      key={student.id}
                      onClick={() => setAttendanceList(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        attendanceList[student.id] 
                          ? "bg-green-50 border-green-200 text-green-700" 
                          : "bg-red-50 border-red-200 text-red-700"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                          attendanceList[student.id] ? "bg-green-200" : "bg-red-200"
                        )}>
                          {student.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <span className="font-medium text-sm block">{student.name}</span>
                          {justifications[student.id] && (
                            <span className="text-[10px] text-slate-500 italic">J: {justifications[student.id]}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!attendanceList[student.id] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentJustifyStudent(student.id);
                              setShowJustifyModal(true);
                            }}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all",
                              justifications[student.id] ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            )}
                            title="Justificar falta"
                          >
                            J
                          </button>
                        )}
                        {attendanceList[student.id] ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conteúdo Ministrado</label>
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
                </div>

                <div className="flex flex-col gap-4">
                  {showSuccess && (
                    <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-bounce">
                      <Check className="w-5 h-5" />
                      Chamada salva com sucesso!
                    </div>
                  )}
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
                      <select
                        value={attendanceFilterClass}
                        onChange={(e) => setAttendanceFilterClass(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">Todas as Turmas</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input 
                        type="month"
                        value={attendanceFilterMonth}
                        onChange={(e) => setAttendanceFilterMonth(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Presenças/Faltas</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendances
                          .filter(a => {
                            const matchesClass = attendanceFilterClass === 'all' || a.classId === attendanceFilterClass;
                            const matchesMonth = a.date.startsWith(attendanceFilterMonth);
                            const matchesAccess = isAdmin || user.classIds.includes(a.classId);
                            return matchesClass && matchesMonth && matchesAccess;
                          })
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                              {format(parseISO(att.date), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {classes.find(c => c.id === att.classId)?.name}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                  {att.presentStudentIds.length} P
                                </span>
                                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                  {att.absentStudentIds.length} F
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => handleEditAttendance(att)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteAttendance(att.id)}
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
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Selecione uma turma para realizar a chamada.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {subTab === 'students' ? (editingStudent ? 'Editar Aluno' : 'Cadastrar Aluno') : 
                   subTab === 'teachers' ? (editingTeacher ? 'Editar Professor' : 'Cadastrar Professor') : 
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
                      <label className="text-xs font-bold text-slate-500 uppercase">Data de Nascimento</label>
                      <input
                        required
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Turma</label>
                      <select
                        value={studentForm.classId}
                        onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Selecione...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
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
                  </div>
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    {editingStudent ? 'Atualizar Aluno' : 'Salvar Aluno'}
                  </button>
                </form>
              )}

              {subTab === 'teachers' && (
                <form onSubmit={handleAddTeacher} className="p-6 space-y-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Email (Login)</label>
                      <input
                        required
                        type="email"
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Senha Provisória</label>
                      <input
                        required={!editingTeacher}
                        type="password"
                        value={teacherForm.password}
                        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                        placeholder={editingTeacher ? 'Deixe em branco para manter' : ''}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
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
                    <label className="text-xs font-bold text-slate-500 uppercase">Vincular Turmas (Múltipla Seleção)</label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                      {classes.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <input 
                            type="checkbox"
                            checked={teacherForm.classIds.includes(c.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...teacherForm.classIds, c.id]
                                : teacherForm.classIds.filter(id => id !== c.id);
                              setTeacherForm({ ...teacherForm, classIds: ids });
                            }}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    {editingTeacher ? 'Atualizar Professor' : 'Salvar Professor'}
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
                    <label className="text-xs font-bold text-slate-500 uppercase">Professor Responsável</label>
                    <select
                      value={classForm.teacherId}
                      onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Selecione...</option>
                      {teachers.filter(t => t.role === 'teacher').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                    Salvar Turma
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
            {attendances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(att => (
              <div key={att.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 group relative">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      {classes.find(c => c.id === att.classId)?.name}
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      {format(parseISO(att.date), "dd 'de' MMMM", { locale: ptBR })}
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
    </div>
  );
}
