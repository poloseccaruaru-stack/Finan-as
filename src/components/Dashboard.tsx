import { useState, useEffect } from 'react';
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
  Trophy
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
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface Props {
  user: Teacher;
}

export default function Dashboard({ user }: Props) {
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

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const stats = [
    { label: 'Total Alunos', value: students.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Professores', value: teachers.length, icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Turmas Ativas', value: classes.length, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
    { label: 'Projetos', value: projects.length, icon: Briefcase, color: 'bg-amber-50 text-amber-600' },
  ];

  const classAttendanceData = classes.map(c => {
    const classStudents = students.filter(s => s.classId === c.id);
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
    high: students.filter(s => (s.attendancePercentage || 0) >= config.highFrequencyLimit).length,
    intermediate: students.filter(s => (s.attendancePercentage || 0) < config.highFrequencyLimit && (s.attendancePercentage || 0) >= config.intermediateFrequencyLimit).length,
    low: students.filter(s => (s.attendancePercentage || 0) < config.intermediateFrequencyLimit).length,
  };

  const pieData = [
    { name: 'Alta', value: frequencyClassification.high, color: '#10b981' },
    { name: 'Intermediária', value: frequencyClassification.intermediate, color: '#f59e0b' },
    { name: 'Baixa', value: frequencyClassification.low, color: '#ef4444' },
  ];

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

        {/* Critical Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-slate-900">Alertas de Frequência</h3>
          </div>
          <div className="space-y-4">
            {students.filter(s => s.consecutiveAbsences >= 2).map(student => (
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
            {students.filter(s => s.consecutiveAbsences >= 2).length === 0 && (
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
