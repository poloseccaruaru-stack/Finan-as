import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, FileText, BookOpen } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { Student, Class, Attendance, Teacher } from '../types';
import { cn, safeFormat } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  classes: Class[];
  students: Student[];
  attendances: Attendance[];
  teachers: Teacher[];
  initialMonth: string;
  startDate?: string;
  endDate?: string;
}

export function DiaryReportModal({ 
  isOpen, 
  onClose, 
  classId, 
  classes, 
  students, 
  attendances, 
  teachers,
  initialMonth,
  startDate,
  endDate
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [filterType, setFilterType] = useState<'month' | 'bimestre' | 'range'>(startDate && endDate ? 'range' : 'month');
  const [selectedBimestre, setSelectedBimestre] = useState<number>(1);
  const [localStartDate, setLocalStartDate] = useState(startDate || "");
  const [localEndDate, setLocalEndDate] = useState(endDate || "");

  if (!isOpen) return null;

  const currentClass = classes.find(c => c.id === classId);
  const teacher = teachers.find(t => t.id === currentClass?.teacherId);
  
  const classStudentsIds = students
    .filter(s => (s.classId === classId || s.classIds?.includes(classId)))
    .map(s => s.id);
  
  let orderedStudents: Student[] = [];
  if (currentClass?.isOrderFixed && currentClass.studentOrder) {
     const existingOrder = currentClass.studentOrder.filter(id => classStudentsIds.includes(id));
     const newStudentsIds = classStudentsIds.filter(id => !existingOrder.includes(id));
     orderedStudents = [...existingOrder, ...newStudentsIds]
       .map(id => students.find(s => s.id === id)!)
       .filter(Boolean);
  } else {
     orderedStudents = students
       .filter(s => classStudentsIds.includes(s.id))
       .sort((a,b) => a.name.localeCompare(b.name));
  }

  const getBimestreMonths = (b: number) => {
    const year = selectedMonth.split('-')[0];
    if (b === 1) return [`${year}-01`, `${year}-02`, `${year}-03`];
    if (b === 2) return [`${year}-04`, `${year}-05`, `${year}-06`];
    if (b === 3) return [`${year}-07`, `${year}-08`, `${year}-09`];
    return [`${year}-10`, `${year}-11`, `${year}-12`];
  };

  const classAttendances = attendances
    .filter(a => {
      if (a.classId !== classId) return false;
      if (filterType === 'range' && localStartDate && localEndDate) {
        return a.date >= localStartDate && a.date <= localEndDate;
      }
      if (filterType === 'month') return a.date.startsWith(selectedMonth);
      const months = getBimestreMonths(selectedBimestre);
      return months.some(m => a.date.startsWith(m));
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const handlePrint = () => {
    const printContent = document.getElementById('diary-report-content');
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('');
        } catch (e) {
          return '';
        }
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Diário de Classe - ${currentClass?.name}</title>
          <style>
            ${styles}
            @media print {
              .print\\:hidden { display: none !important; }
              @page { size: landscape; margin: 1cm; }
            }
            body { background: white !important; }
          </style>
        </head>
        <body>
          <div class="p-8">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto items-start pt-4 sm:pt-10 print:bg-white print:p-0 print:block">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-w-none print:w-full print:block"
      >
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Diário de Classe
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilterType('month')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'month' ? "bg-white shadow text-indigo-600" : "text-slate-500")}
              >Mês</button>
              <button 
                onClick={() => setFilterType('bimestre')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'bimestre' ? "bg-white shadow text-indigo-600" : "text-slate-500")}
              >Bimestre</button>
              <button 
                onClick={() => setFilterType('range')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", filterType === 'range' ? "bg-white shadow text-indigo-600" : "text-slate-500")}
              >Período</button>
            </div>
            {filterType === 'month' ? (
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            ) : filterType === 'bimestre' ? (
              <select 
                value={selectedBimestre}
                onChange={(e) => setSelectedBimestre(parseInt(e.target.value))}
                className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value={1}>1º Bimestre</option>
                <option value={2}>2º Bimestre</option>
                <option value={3}>3º Bimestre</option>
                <option value={4}>4º Bimestre</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={localStartDate} 
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <span className="text-slate-400">até</span>
                <input 
                  type="date" 
                  value={localEndDate} 
                  onChange={(e) => setLocalEndDate(e.target.value)}
                  className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </div>

        <div id="diary-report-content" className="p-8 overflow-y-auto print:p-0 print:overflow-visible flex-1">
          <div className="space-y-12 print:space-y-8">
            {/* Page 1: Grid */}
            <div className="border-[2px] border-slate-900 flex flex-col min-h-[700px]">
              <div className="grid grid-cols-4 border-b-[2px] border-slate-900">
                <div className="p-3 border-r-[2px] border-slate-900">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Série/Turma</p>
                  <p className="font-bold text-sm uppercase">{currentClass?.name}</p>
                </div>
                <div className="p-3 border-r-[2px] border-slate-900">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Disciplina</p>
                  <p className="font-bold text-sm uppercase">Educação Bíblica</p>
                </div>
                <div className="p-3 border-r-[2px] border-slate-900">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Professor(a)</p>
                  <p className="font-bold text-sm uppercase">{teacher?.name || 'Não atribuído'}</p>
                </div>
                <div className="p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Período</p>
                  <p className="font-bold text-sm uppercase">
                    {filterType === 'month' 
                      ? safeFormat(selectedMonth + '-01', 'MMMM / yyyy', { locale: ptBR }) 
                      : filterType === 'bimestre'
                        ? `${selectedBimestre}º Bimestre / ${selectedMonth.split('-')[0]}`
                        : `${safeFormat(localStartDate, 'dd/MM/yy')} - ${safeFormat(localEndDate, 'dd/MM/yy')}`
                    }
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 print:bg-transparent">
                      <th className="border-[2px] border-slate-900 p-1 w-8">Nº</th>
                      <th className="border-[2px] border-slate-900 p-2 text-left min-w-[200px]">Nome do Aluno</th>
                      {classAttendances.map((a) => (
                        <th key={a.id} className="border-[2px] border-slate-900 w-8 h-12 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center -rotate-90 origin-center whitespace-nowrap font-bold">
                            {safeFormat(a.date, 'dd/MM')}
                          </div>
                        </th>
                      ))}
                      {/* Fill empty columns to maintain grid look if few classes */}
                      {Array.from({ length: Math.max(0, 15 - classAttendances.length) }).map((_, i) => (
                        <th key={i} className="border-[2px] border-slate-900 w-8"></th>
                      ))}
                      <th className="border-[2px] border-slate-900 p-1 w-8 bg-indigo-50 print:bg-transparent">P</th>
                      <th className="border-[2px] border-slate-900 p-1 w-8 bg-amber-50 print:bg-transparent">PA</th>
                      <th className="border-[2px] border-slate-900 p-1 w-8 bg-red-50 print:bg-transparent text-red-600">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedStudents.map((student, idx) => {
                      const isEnrolledAtAttendance = (student: Student, attendanceDate: string) => {
                        const enrollmentDate = student.enrollmentDates?.[classId];
                        const exitDate = student.exitDates?.[classId];
                        const enrollmentStatus = student.enrollmentStatuses?.[classId] || 'ativo';

                        const afterEnroll = !enrollmentDate || attendanceDate >= enrollmentDate;
                        const isActiveStatus = enrollmentStatus === 'ativo';
                        
                        let beforeExit = true;
                        if (exitDate) {
                          if (isActiveStatus) {
                            beforeExit = attendanceDate <= exitDate;
                          } else {
                            beforeExit = attendanceDate < exitDate;
                          }
                        }
                        
                        return afterEnroll && beforeExit;
                      };

                      const validAttendances = classAttendances.filter(a => isEnrolledAtAttendance(student, a.date));
                      
                      const presence = validAttendances.filter(a => a.presentStudentIds.includes(student.id)).length;
                      const partialPresence = validAttendances.filter(a => a.partialStudentIds?.includes(student.id)).length;
                      const absence = validAttendances.filter(a => a.absentStudentIds.includes(student.id)).length;
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                          <td className="border-[2px] border-slate-900 p-1 text-center font-bold">{(idx + 1).toString().padStart(2, '0')}</td>
                          <td className="border-[2px] border-slate-900 p-2 font-semibold uppercase">{student.name}</td>
                          {classAttendances.map(a => {
                            const isEnrolled = isEnrolledAtAttendance(student, a.date);
                            return (
                              <td key={a.id} className="border-[2px] border-slate-900 p-1 text-center font-bold">
                                {isEnrolled ? (a.presentStudentIds.includes(student.id) ? '•' : a.partialStudentIds?.includes(student.id) ? 'PA' : 'F') : ''}
                              </td>
                            );
                          })}
                          {Array.from({ length: Math.max(0, 15 - classAttendances.length) }).map((_, i) => (
                            <td key={i} className="border-[2px] border-slate-900"></td>
                          ))}
                          <td className="border-[2px] border-slate-900 p-1 text-center font-bold">{presence}</td>
                          <td className="border-[2px] border-slate-900 p-1 text-center font-bold">{partialPresence}</td>
                          <td className="border-[2px] border-slate-900 p-1 text-center font-bold text-red-600">{absence}</td>
                        </tr>
                      );
                    })}
                    {/* Fill empty rows to reach at least 25 students for layout */}
                    {Array.from({ length: Math.max(0, 25 - orderedStudents.length) }).map((_, i) => (
                      <tr key={'empty-' + i}>
                        <td className="border-[2px] border-slate-900 h-6 text-center font-bold text-slate-300">{(orderedStudents.length + i + 1).toString().padStart(2, '0')}</td>
                        <td className="border-[2px] border-slate-900 p-2"></td>
                        {Array.from({ length: Math.max(0, 15 - classAttendances.length) + classAttendances.length + 3 }).map((_, j) => (
                           <td key={j} className="border-[2px] border-slate-900"></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 print:bg-white text-[9px] border-t-[2px] border-slate-900">
                <p className="font-bold mb-2 uppercase">Legenda:</p>
                <div className="flex gap-4">
                  <p><strong>•</strong> Presença</p>
                  <p><strong>PA</strong> Presença Parcial</p>
                  <p><strong>F</strong> Falta</p>
                  <p><strong>P</strong> Total Presenças</p>
                  <p><strong>PA</strong> Total Parciais</p>
                  <p><strong>F</strong> Total Faltas</p>
                </div>
              </div>
            </div>

            {/* Section 2: Daily Records */}
            <div className="page-break-before space-y-8 mt-12">
               <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2">
                 <BookOpen className="w-6 h-6 text-indigo-600" />
                 <h4 className="text-xl font-bold uppercase text-slate-900">Registro Individual de Aulas</h4>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {classAttendances.map(a => (
                   <div key={a.id} className="border-[2px] border-slate-300 p-6 rounded-3xl space-y-4 print:border-slate-900 print:rounded-none">
                      <div className="flex justify-between items-center bg-slate-100 p-3 rounded-2xl print:bg-transparent print:border-b print:border-slate-300">
                        <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{safeFormat(a.date, 'EEEE', { locale: ptBR })}</p>
                          <p className="text-lg font-bold">{safeFormat(a.date, 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400">HORÁRIO</p>
                          <p className="font-bold">{a.startTime || '--:--'} às {a.endTime || '--:--'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conteúdo Ministrado</p>
                          <p className="text-sm font-semibold border-l-4 border-indigo-200 pl-3 py-2 italic bg-slate-50 rounded-r-xl print:bg-transparent print:border-indigo-400">
                            {a.contentGiven || 'Nenhum conteúdo registrado.'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Metodologia e Recursos</p>
                          <p className="text-sm font-semibold border-l-4 border-indigo-200 pl-3 py-2 italic bg-slate-50 rounded-r-xl print:bg-transparent print:border-indigo-400">
                            {a.methodology || 'Nenhuma metodologia registrada.'}
                          </p>
                        </div>

                        {a.observation && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Observações Gerais</p>
                            <p className="text-sm font-semibold border-l-4 border-amber-200 pl-3 py-2 italic bg-amber-50 rounded-r-xl print:bg-transparent print:border-amber-400">
                              {a.observation}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                           <div className="bg-slate-50 p-2 rounded-xl print:bg-transparent print:border print:border-slate-200">
                              <p className="text-[9px] font-bold text-slate-400">ATINGIU OBJETIVOS?</p>
                              <p className="text-xs font-bold">{a.aulaObjetivos}</p>
                           </div>
                           <div className="bg-slate-50 p-2 rounded-xl print:bg-transparent print:border print:border-slate-200">
                              <p className="text-[9px] font-bold text-slate-400">PARTICIPAÇÃO ALUNOS</p>
                              <p className="text-xs font-bold">{a.alunosParticiparam}</p>
                           </div>
                           <div className="bg-slate-50 p-2 rounded-xl print:bg-transparent print:border print:border-slate-200">
                              <p className="text-[9px] font-bold text-slate-400">VERSÍCULO CITADO?</p>
                              <p className="text-xs font-bold">{a.versiculoCitado}</p>
                           </div>
                           <div className="bg-slate-50 p-2 rounded-xl print:bg-transparent print:border print:border-slate-200">
                              <p className="text-[9px] font-bold text-slate-400">HOUVE OFERTA?</p>
                              <p className="text-xs font-bold">{a.houveOferta}</p>
                           </div>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
