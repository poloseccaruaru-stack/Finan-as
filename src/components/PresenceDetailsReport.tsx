import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  limit
} from 'firebase/firestore';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { Student, Class, Attendance } from '../types';
import { Users, Calendar, Printer, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  type: 'classification' | 'ranking';
  targetId: string; // 'high' | 'intermediate' | 'low' for classification, or classId for ranking
  startDate?: string;
  endDate?: string;
  highLimit: number;
  interLimit: number;
}

export default function PresenceDetailsReport({ type, targetId, startDate, endDate, highLimit, interLimit }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });
    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(500)), 
      (snap) => {
        setAttendanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        setLoading(false);
      }
    );

    return () => {
      unsubStudents();
      unsubClasses();
      unsubAttendance();
    };
  }, []);

  const calculateAttendance = (studentId: string) => {
    const start = startDate ? parseISO(startDate) : null;
    const end = endDate ? parseISO(endDate) : null;
    const student = students.find(s => s.id === studentId);

    const relevant = attendanceRecords.filter(att => {
      const d = parseISO(att.date);
      const inPeriod = (!start || d >= start) && (!end || d <= end);
      
      // Check enrollment and exit dates for the specific class of this attendance
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
      
      const isEnrolled = afterEnroll && beforeExit;
      
      return inPeriod && isEnrolled && (att.presentStudentIds?.includes(studentId) || att.absentStudentIds?.includes(studentId));
    });

    if (relevant.length === 0) return { percentage: 100, presences: [], absences: [] };

    const presences = relevant.filter(att => att.presentStudentIds?.includes(studentId)).map(att => att.date).sort();
    const absences = relevant.filter(att => att.absentStudentIds?.includes(studentId)).map(att => att.date).sort();
    const percentage = (presences.length / relevant.length) * 100;

    return { percentage, presences, absences };
  };

  const filteredData = useMemo(() => {
    if (loading) return [];

    let filtered = students;

    if (type === 'ranking') {
      filtered = students.filter(s => s.classId === targetId);
    } else {
      // classification
      filtered = students.filter(s => {
        const { percentage } = calculateAttendance(s.id);
        if (targetId === 'high') return percentage >= highLimit;
        if (targetId === 'intermediate') return percentage < highLimit && percentage >= interLimit;
        if (targetId === 'low') return percentage < interLimit;
        return true;
      });
    }

    // Group by class
    const groups: Record<string, { className: string, students: any[] }> = {};
    
    filtered.forEach(s => {
      const classObj = classes.find(c => c.id === s.classId);
      const className = classObj?.name || 'Sem Turma';
      if (!groups[s.classId || 'none']) {
        groups[s.classId || 'none'] = { className, students: [] };
      }
      const attData = calculateAttendance(s.id);
      groups[s.classId || 'none'].students.push({
        ...s,
        ...attData
      });
    });

    return Object.values(groups).sort((a, b) => a.className.localeCompare(b.className));
  }, [students, classes, attendanceRecords, loading, type, targetId, startDate, endDate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Gerando Relatório Detalhado...</p>
        </div>
      </div>
    );
  }

  const titleMap = {
    high: 'Presença Alta',
    intermediate: 'Presença Intermediária',
    low: 'Presença Baixa'
  };

  const reportTitle = type === 'ranking' 
    ? `Detalhamento de Turma: ${classes.find(c => c.id === targetId)?.name || 'N/A'}`
    : `Alunos com ${titleMap[targetId as keyof typeof titleMap] || targetId}`;

  return (
    <div className="min-h-screen bg-white p-4 md:p-10 font-sans">
      {/* Printable Header */}
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
              <Printer className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{reportTitle}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                {startDate && endDate ? `Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} até ${format(parseISO(endDate), 'dd/MM/yyyy')}` : 'Todo o Período'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <button 
              onClick={() => window.print()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 print:hidden"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório
            </button>
            <p className="hidden print:block text-[10px] font-bold text-slate-400 uppercase mt-2">
              Gerado via IGBAPI Dashboard em {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhum aluno encontrado nesta condição para o período selecionado.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredData.map((group, gIdx) => (
              <div key={gIdx} className="space-y-4">
                <div className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-widest">Turma: {group.className}</h2>
                  <span className="text-[10px] font-bold opacity-70">{group.students.length} aluno(s)</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {group.students.map((student: any) => (
                    <div key={student.id} className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50 hover:bg-white transition-all hover:shadow-xl hover:shadow-slate-100/50">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white shadow-lg",
                            student.percentage >= highLimit ? "bg-green-500" : student.percentage >= interLimit ? "bg-amber-500" : "bg-red-500"
                          )}>
                            {Math.round(student.percentage)}%
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{student.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{student.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Presences */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-green-600">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <h3 className="text-xs font-black uppercase tracking-widest">Datas de Presença ({student.presences.length})</h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {student.presences.length > 0 ? student.presences.map((date: string, dIdx: number) => (
                              <span key={dIdx} className="px-2 py-1 bg-green-50 text-green-700 text-[9px] font-bold rounded-lg border border-green-100">
                                {format(parseISO(date), 'dd/MM/yy')}
                              </span>
                            )) : <span className="text-[10px] text-slate-400 italic font-medium">Nenhuma presença no período</span>}
                          </div>
                        </div>

                        {/* Absences */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-red-600">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <h3 className="text-xs font-black uppercase tracking-widest">Datas de Faltas ({student.absences.length})</h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {student.absences.length > 0 ? student.absences.map((date: string, dIdx: number) => (
                              <span key={dIdx} className="px-2 py-1 bg-red-50 text-red-700 text-[9px] font-bold rounded-lg border border-red-100">
                                {format(parseISO(date), 'dd/MM/yy')}
                              </span>
                            )) : <span className="text-[10px] text-slate-400 italic font-medium">Nenhuma falta no período</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
