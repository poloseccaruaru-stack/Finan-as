import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Student, Teacher, Class } from '../types';
import { cn, safeFormat } from '../lib/utils';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, addDays, getMonth, getDate, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Cake, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  type: 'student' | 'collaborator';
}

export default function BirthdayBanner({ type }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubClasses();
    };
  }, []);

  const weeklyBirthdays = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    let allPeople: any[] = [];
    
    if (type === 'student') {
      allPeople = students.map(s => ({ 
        ...s, 
        personType: 'Aluno', 
        className: classes.find(c => c.id === s.classId)?.name || 'Sem Turma' 
      }));
    } else {
      allPeople = teachers.map(t => ({ 
        ...t, 
        personType: 'Colaborador', 
        className: 'Administração/Docente', 
        birthDate: (t as any).birthDate || '' 
      }));
    }

    return allPeople.filter(person => {
      if (!person.birthDate) return false;
      const bDate = parseISO(person.birthDate);
      if (!isValid(bDate)) return false;
      const bMonth = getMonth(bDate);
      const bDay = getDate(bDate);
      
      const thisYearBirthday = new Date(now.getFullYear(), bMonth, bDay);
      return isWithinInterval(thisYearBirthday, { start, end });
    }).sort((a, b) => {
      const dateA = parseISO(a.birthDate);
      const dateB = parseISO(b.birthDate);
      const thisYearA = new Date(now.getFullYear(), getMonth(dateA), getDate(dateA));
      const thisYearB = new Date(now.getFullYear(), getMonth(dateB), getDate(dateB));
      return thisYearA.getTime() - thisYearB.getTime();
    });
  }, [students, teachers, classes, type]);

  useEffect(() => {
    if (weeklyBirthdays.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % weeklyBirthdays.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [weeklyBirthdays.length]);

  if (weeklyBirthdays.length === 0) return null;

  const current = weeklyBirthdays[currentIndex];

  return (
    <div className={cn(
      "text-white py-2 px-4 shadow-lg overflow-hidden relative print:hidden border-b border-white/10",
      type === 'student' ? "bg-indigo-600" : "bg-emerald-600"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
        <Cake className={cn("w-5 h-5 animate-bounce", type === 'student' ? "text-amber-300" : "text-amber-200")} />
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-2 text-sm font-bold"
          >
            <span>🎉 Aniversariante da Semana ({type === 'student' ? 'Alunos' : 'Colaboradores'}):</span>
            <span className="bg-white/20 px-2 py-0.5 rounded">{current.name}</span>
            <span className={cn("text-sm", type === 'student' ? "text-indigo-100" : "text-emerald-100")}>
              ({current.className})
            </span>
            <span className="text-amber-300">
              Dia {safeFormat(current.birthDate, 'dd/MM')}
            </span>
          </motion.div>
        </AnimatePresence>
        
        {weeklyBirthdays.length > 1 && (
          <div className="flex gap-1 ml-4">
            <button 
              onClick={() => setCurrentIndex(prev => (prev - 1 + weeklyBirthdays.length) % weeklyBirthdays.length)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => (prev + 1) % weeklyBirthdays.length)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
