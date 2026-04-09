import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
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
  updateDoc
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
  Printer
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
import { motion, AnimatePresence } from 'framer-motion';
import { Student, Teacher, Class, Transaction, Project, DashboardConfig } from '../types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, getMonth, getDate, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
}

export default function Dashboard({ user, selectedSchoolYear }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<DashboardConfig>({
    highFrequencyLimit: 80,
    intermediateFrequencyLimit: 50
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'dashboard'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as DashboardConfig);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'config/dashboard'));

    const isAdmin = user.role === 'admin';
    const classIds = user?.classIds || [];
    
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

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));
    
    return () => {
      unsubConfig();
      unsubStudents();
      unsubTeachers();
      unsubClasses();
      unsubTransactions();
      unsubProjects();
    };
  }, [user]);

  const updateConfig = async (newConfig: DashboardConfig) => {
    try {
      await setDoc(doc(db, 'config', 'dashboard'), newConfig);
      setConfig(newConfig);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'config/dashboard');
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
    { label: 'Professores', value: teachers.length, icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Turmas Ativas', value: filteredClasses.length, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
    { label: 'Projetos', value: projects.length, icon: Briefcase, color: 'bg-amber-50 text-amber-600' },
  ];

  const classAttendanceData = filteredClasses.map(c => {
    const classStudents = filteredStudents.filter(s => s.classId === c.id);
    const avgAttendance = classStudents.length > 0 
      ? classStudents.reduce((acc, s) => acc + (s.attendancePercentage || 0), 0) / classStudents.length
      : 0;
    return {
      id: c.id,
      name: c.name,
      attendance: Math.round(avgAttendance),
      students: classStudents.length
    };
  }).sort((a, b) => b.attendance - a.attendance);

  const frequencyClassification = {
    high: filteredStudents.filter(s => (s.attendancePercentage || 0) >= config.highFrequencyLimit).length,
    intermediate: filteredStudents.filter(s => (s.attendancePercentage || 0) < config.highFrequencyLimit && (s.attendancePercentage || 0) >= config.intermediateFrequencyLimit).length,
    low: filteredStudents.filter(s => (s.attendancePercentage || 0) < config.intermediateFrequencyLimit).length,
  };

  const pieData = [
    { name: 'Alta', value: frequencyClassification.high, color: '#10b981' },
    { name: 'Intermediária', value: frequencyClassification.intermediate, color: '#f59e0b' },
    { name: 'Baixa', value: frequencyClassification.low, color: '#ef4444' },
  ];

  const [birthdayStart, setBirthdayStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [birthdayEnd, setBirthdayEnd] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  const weeklyBirthdays = useMemo(() => {
    const start = parseISO(birthdayStart);
    const end = parseISO(birthdayEnd);
    
    const allPeople: any[] = [
      ...filteredStudents.map(s => ({ ...s, type: 'Aluno' })),
      ...teachers.map(t => ({ ...t, tEmail: t.email, type: 'Professor' }))
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
            Período: ${format(parseISO(birthdayStart), 'dd/MM/yyyy')} até ${format(parseISO(birthdayEnd), 'dd/MM/yyyy')}
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
                  <td>${format(parseISO(p.birthDate!), 'dd/MM')}</td>
                  <td>${classes.find(c => c.id === (p as any).classId)?.name || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8;">
            Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Inteligente</h2>
        {user.role === 'admin' && (
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-sm font-semibold text-slate-600"
          >
            <Settings className="w-4 h-4" />
            Configurar Limites
          </button>
        )}
      </div>

      {showConfig && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Limite Alta Frequência (%)</label>
            <input 
              type="number" 
              value={config.highFrequencyLimit}
              onChange={(e) => updateConfig({ ...config, highFrequencyLimit: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Limite Frequência Intermediária (%)</label>
            <input 
              type="number" 
              value={config.intermediateFrequencyLimit}
              onChange={(e) => updateConfig({ ...config, intermediateFrequencyLimit: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
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
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classAttendanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => `${value}%`} />
                <Bar dataKey="attendance" radius={[0, 8, 8, 0]} barSize={20}>
                  {classAttendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.attendance >= config.highFrequencyLimit ? '#10b981' : entry.attendance >= config.intermediateFrequencyLimit ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequency Classification */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Classificação de Alunos</h3>
          <div className="h-[200px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
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

        {/* Birthdays of the Week */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-bold text-slate-900">Aniversariantes da Semana</h3>
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

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {weeklyBirthdays.length > 0 ? (
              weeklyBirthdays.map((person) => (
                <div key={person.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-pink-200 hover:bg-pink-50/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm">
                      {person.type === 'Aluno' ? '👶' : '👨‍🏫'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{person.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                          {person.type}
                        </span>
                        <span className="text-xs text-slate-500">
                          {classes.find(c => c.id === (person as any).classId)?.name || 'Sem Turma'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-pink-600">
                      {format(parseISO(person.birthDate!), 'dd/MM')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Aniversário</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 italic text-sm">
                Nenhum aniversariante neste período.
              </div>
            )}
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-slate-900">Alertas de Frequência</h3>
          </div>
          <div className="space-y-4">
            {filteredStudents.filter(s => s.consecutiveAbsences >= 2).map(student => (
              <div key={student.id} className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-900">{student.name}</p>
                  <p className="text-xs text-red-700">Faltou 2 vezes seguidas! Entrar em contato.</p>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'students', student.id), { consecutiveAbsences: 0 });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
                    }
                  }}
                  className="px-3 py-1 bg-white text-red-600 text-xs font-bold rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                >
                  Resolvido
                </button>
              </div>
            ))}
            {filteredStudents.filter(s => s.consecutiveAbsences >= 2).length === 0 && (
              <div className="text-center py-8 text-slate-400 italic text-sm">
                Nenhum alerta crítico no momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
