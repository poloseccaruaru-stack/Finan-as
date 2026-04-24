import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  query,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { 
  Book, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  ChevronRight,
  GripVertical,
  FileText,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Calendar as CalendarIcon,
  Printer,
  Lock,
  Unlock,
  ShieldAlert,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  Eye
} from 'lucide-react';
import { Regimento, OrganogramEntry, Teacher, CalendarEvent, SchoolYearConfig, GeneralCalendar } from '../types';
import OrganogramModule from './OrganogramModule';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeFormat } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
  subTab: 'regimento' | 'calendar' | 'system' | 'organogram' | 'meetings' | 'comunicados' | 'documentos';
}

export default function AdminModule({ user, subTab }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [regimentos, setRegimentos] = useState<Regimento[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [schoolYear, setSchoolYear] = useState<SchoolYearConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showComunicadoForm, setShowComunicadoForm] = useState(false);
  const [showDocumentoForm, setShowDocumentoForm] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingComunicadoId, setEditingComunicadoId] = useState<string | null>(null);
  const [editingDocumentoId, setEditingDocumentoId] = useState<string | null>(null);

  const [comunicadoForm, setComunicadoForm] = useState({ target: 'equipe', text: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [documentoForm, setDocumentoForm] = useState({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [meetingForm, setMeetingForm] = useState({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd'), participants: '', type: 'GERAL' as any });
  const [activeCalendarType, setActiveCalendarType] = useState<'ebd' | 'church' | 'convention' | 'geral'>('ebd');
  const [generalCalendars, setGeneralCalendars] = useState<GeneralCalendar[]>([]);
  const [showGeneralCalendarForm, setShowGeneralCalendarForm] = useState(false);
  const [editingGeneralCalendarId, setEditingGeneralCalendarId] = useState<string | null>(null);
  const [generalCalendarForm, setGeneralCalendarForm] = useState({ title: '', content: '' });
  const [viewingGeneralCalendar, setViewingGeneralCalendar] = useState<GeneralCalendar | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [expandedRegimentoId, setExpandedRegimentoId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', order: 0 });
  const [calendarForm, setCalendarForm] = useState({ title: '', date: '', type: 'event' as any, description: '' });
  const [schoolYearForm, setSchoolYearForm] = useState({ startDate: '', endDate: '' });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetType, setResetType] = useState<'total' | 'partial' | 'selective'>('partial');
  
  // Alert/Confirm State
  const [alertConfig, setAlertConfig] = useState<{ show: boolean, title: string, message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ 
    show: boolean, 
    title: string, 
    message: string, 
    onConfirm: (inputValue?: string) => void,
    isPassword?: boolean 
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ show: true, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: (inputValue?: string) => void, isPassword = false) => {
    setConfirmConfig({ show: true, title, message, onConfirm, isPassword });
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
  const [selectiveOptions, setSelectiveOptions] = useState({
    teachers: false,
    students: false,
    classes: false,
    calendar: false,
    regimento: false,
    organogram: false,
    projects: false,
    planning: false,
    meetings: false,
    studentReports: false,
    teacherReports: false,
    justifications: false,
    manualReports: false,
    finance: false
  });

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator';
  const isProfessor = user.role === 'professor';
  const hasEditAccess = isAdmin || isCoordinator;

  const COLLECTIONS = [
    'users', 'students', 'classes', 'attendance', 'regimento', 
    'projects', 'transactions', 'budgets', 'planning', 'justificationOptions',
    'calendarEvents', 'events', 'organogram', 'student_reports', 'teacher_reports',
    'manual_reports', 'estimated_expenses', 'config', 'enrollments', 'ai_actions',
    'meetings', 'general_calendars'
  ];

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMeetingId) {
        await updateDoc(doc(db, 'meetings', editingMeetingId), {
          ...meetingForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'meetings'), {
          ...meetingForm,
          createdAt: new Date().toISOString()
        });
      }
      setShowMeetingForm(false);
      setMeetingForm({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd'), participants: '', type: 'GERAL' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'meetings');
    }
  };

  const handleSaveComunicado = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComunicadoId) {
        await updateDoc(doc(db, 'comunicados', editingComunicadoId), comunicadoForm);
      } else {
        await addDoc(collection(db, 'comunicados'), { ...comunicadoForm, createdAt: new Date().toISOString() });
      }
      setShowComunicadoForm(false);
      setEditingComunicadoId(null);
      setComunicadoForm({ target: 'equipe', text: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      handleFirestoreError(err, editingComunicadoId ? OperationType.UPDATE : OperationType.CREATE, 'comunicados');
    }
  };

  const handleSaveDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDocumentoId) {
        await updateDoc(doc(db, 'documentos', editingDocumentoId), documentoForm);
      } else {
        await addDoc(collection(db, 'documentos'), { ...documentoForm, createdAt: new Date().toISOString() });
      }
      setShowDocumentoForm(false);
      setEditingDocumentoId(null);
      setDocumentoForm({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      handleFirestoreError(err, editingDocumentoId ? OperationType.UPDATE : OperationType.CREATE, 'documentos');
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Deseja excluir este registro de reunião?')) return;
    try {
      await deleteDoc(doc(db, 'meetings', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meetings/${id}`);
    }
  };

  const handleDeleteComunicado = async (id: string) => {
    if (!confirm('Deseja excluir este comunicado?')) return;
    try {
      await deleteDoc(doc(db, 'comunicados', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `comunicados/${id}`);
    }
  };

  const handleDeleteDocumento = async (id: string) => {
    if (!confirm('Deseja excluir este documento?')) return;
    try {
      await deleteDoc(doc(db, 'documentos', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `documentos/${id}`);
    }
  };
  const handleBackup = async () => {
    if (!confirm('Deseja gerar um arquivo de backup com todos os dados do sistema?')) return;
    setIsBackingUp(true);
    try {
      const backupData: Record<string, any[]> = {};
      
      for (const collName of COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, collName));
          // Store each record as a stringified JSON to ensure data integrity during backup/restore
          backupData[collName] = snap.docs.map(d => ({ 
            id: d.id, 
            record: JSON.stringify(d.data()) 
          }));
        } catch (e) {
          console.warn(`Could not backup collection ${collName}:`, e);
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_ebd_completo_${safeFormat(new Date(), 'yyyy-MM-dd_HH-mm')}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showAdminConfirm('Confirmar Restauração', 'ATENÇÃO: A restauração irá sobrescrever os dados existentes com os dados do arquivo. Deseja continuar?', async () => {
      setIsRestoring(true);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            
            for (const collName of COLLECTIONS) {
              if (data[collName] && Array.isArray(data[collName])) {
                // Clear existing collection
                const existingSnap = await getDocs(collection(db, collName));
                for (const docSnap of existingSnap.docs) {
                  await deleteDoc(doc(db, collName, docSnap.id));
                }

                // Restore from backup
                for (const item of data[collName]) {
                  try {
                    const { id, record } = item;
                    const docData = typeof record === 'string' ? JSON.parse(record) : (({ id: _, ...rest }) => rest)(item);
                    await setDoc(doc(db, collName, id), docData);
                  } catch (docErr) {
                    console.error(`Error restoring document in ${collName}:`, docErr);
                  }
                }
              }
            }
            showAlert('Sucesso', 'Dados restaurados com sucesso!');
          } catch (err) {
            showAlert('Erro', 'Erro ao processar arquivo de backup.');
          } finally {
            setIsRestoring(false);
          }
        };
        reader.readAsText(file);
      } catch (err) {
        showAlert('Erro', 'Erro ao ler arquivo.');
        setIsRestoring(false);
      }
    });
    e.target.value = '';
  };

  useEffect(() => {
    if (subTab === 'regimento') {
      const q = query(collection(db, 'regimento'), orderBy('order', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        setRegimentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Regimento)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'regimento'));
      return () => unsub();
    }
    if (subTab === 'calendar') {
      const unsubEvents = onSnapshot(collection(db, 'calendarEvents'), (snap) => {
        setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents'));

      const unsubGeneral = onSnapshot(collection(db, 'general_calendars'), (snap) => {
        setGeneralCalendars(snap.docs.map(d => ({ id: d.id, ...d.data() } as GeneralCalendar)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'general_calendars'));

      return () => {
        unsubEvents();
        unsubGeneral();
      };
    }
    if (subTab === 'system') {
      const unsubYear = onSnapshot(doc(db, 'config', 'schoolYear'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SchoolYearConfig;
          setSchoolYear(data);
          setSchoolYearForm({ startDate: data.startDate, endDate: data.endDate });
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'config/schoolYear'));
      return () => unsubYear();
    }
    if (subTab === 'meetings') {
      const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'meetings'));
      return () => unsub();
    }
    if (subTab === 'comunicados') {
      const q = query(collection(db, 'comunicados'), orderBy('date', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setComunicados(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'comunicados'));
      return () => unsub();
    }
    if (subTab === 'documentos') {
      const q = query(collection(db, 'documentos'), orderBy('date', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setDocumentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'documentos'));
      return () => unsub();
    }
  }, [subTab]);

  const handleSaveSchoolYear = async () => {
    try {
      await setDoc(doc(db, 'config', 'schoolYear'), {
        startDate: schoolYearForm.startDate,
        endDate: schoolYearForm.endDate,
        isFixed: true,
        updatedAt: new Date().toISOString()
      });
      alert('Ano letivo fixado com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'config/schoolYear');
    }
  };

  const handleSaveGeneralCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...generalCalendarForm,
        updatedAt: new Date().toISOString()
      };
      if (editingGeneralCalendarId) {
        await updateDoc(doc(db, 'general_calendars', editingGeneralCalendarId), data);
      } else {
        await addDoc(collection(db, 'general_calendars'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setShowGeneralCalendarForm(false);
      setEditingGeneralCalendarId(null);
      setGeneralCalendarForm({ title: '', content: '' });
      alert('Calendário Geral salvo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, editingGeneralCalendarId ? OperationType.UPDATE : OperationType.CREATE, 'general_calendars');
    }
  };

  const handleDeleteGeneralCalendar = (id: string) => {
    showAdminConfirm('Excluir Calendário', 'Deseja realmente excluir este calendário?', async () => {
      try {
        await deleteDoc(doc(db, 'general_calendars', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `general_calendars/${id}`);
      }
    });
  };

  const handleSaveCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventData = {
        title: calendarForm.title || "",
        date: calendarForm.date || "",
        type: calendarForm.type || 'event',
        description: calendarForm.description || "",
        calendarType: activeCalendarType,
        createdAt: new Date().toISOString()
      };

      if (editingCalendarId) {
        await updateDoc(doc(db, 'calendarEvents', editingCalendarId), eventData);
      } else {
        await addDoc(collection(db, 'calendarEvents'), eventData);
      }
      setShowCalendarForm(false);
      setEditingCalendarId(null);
      setCalendarForm({ title: '', date: '', type: 'event', description: '' });
    } catch (err) {
      handleFirestoreError(err, editingCalendarId ? OperationType.UPDATE : OperationType.CREATE, 'calendarEvents');
    }
  };

  const handleDeleteCalendarEvent = (id: string) => {
    showAdminConfirm('Excluir Evento', 'Deseja realmente excluir este evento?', async () => {
      try {
        await deleteDoc(doc(db, 'calendarEvents', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'calendarEvents');
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedForm = {
        title: form.title || "",
        content: form.content || "",
        order: form.order || 0
      };

      if (editingId) {
        await updateDoc(doc(db, 'regimento', editingId), sanitizedForm);
      } else {
        await addDoc(collection(db, 'regimento'), {
          ...sanitizedForm,
          order: regimentos.length + 1
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', order: 0 });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'regimento');
    }
  };

  const handleEdit = (reg: Regimento) => {
    setForm({ title: reg.title, content: reg.content, order: reg.order });
    setEditingId(reg.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    showAdminConfirm('Excluir Capítulo', 'Tem certeza que deseja excluir este capítulo do regimento?', async () => {
      try {
        await deleteDoc(doc(db, 'regimento', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'regimento');
      }
    });
  };

  const handleReset = async () => {
    const collectionsToDelete: string[] = [];

    if (resetType === 'total') {
      collectionsToDelete.push(...COLLECTIONS);
    } else if (resetType === 'partial') {
      collectionsToDelete.push('attendance');
    } else if (resetType === 'selective') {
      if (selectiveOptions.teachers) collectionsToDelete.push('users');
      if (selectiveOptions.students) collectionsToDelete.push('students', 'enrollments');
      if (selectiveOptions.classes) collectionsToDelete.push('classes', 'attendance');
      if (selectiveOptions.calendar) collectionsToDelete.push('calendarEvents', 'events');
      if (selectiveOptions.regimento) collectionsToDelete.push('regimento');
      if (selectiveOptions.organogram) collectionsToDelete.push('organogram');
      if (selectiveOptions.projects) collectionsToDelete.push('projects');
      if (selectiveOptions.planning) collectionsToDelete.push('planning');
      if (selectiveOptions.meetings) collectionsToDelete.push('meetings');
      if (selectiveOptions.studentReports) collectionsToDelete.push('student_reports');
      if (selectiveOptions.teacherReports) collectionsToDelete.push('teacher_reports');
      if (selectiveOptions.justifications) collectionsToDelete.push('justificationOptions');
      if (selectiveOptions.manualReports) collectionsToDelete.push('manual_reports');
      if (selectiveOptions.finance) collectionsToDelete.push('transactions', 'budgets', 'estimated_expenses');
    }

    showAdminConfirm(
      'Confirmar Reset', 
      `Tem certeza que deseja realizar o reset ${resetType}? Esta ação é irreversível e apagará todos os dados selecionados das coleções: ${collectionsToDelete.join(', ')}.`,
      async () => {
        try {
          for (const coll of collectionsToDelete) {
            const snap = await getDocs(collection(db, coll));
            for (const d of snap.docs) {
              if (coll === 'users' && d.id === user.id) continue;
              await deleteDoc(doc(db, coll, d.id));
            }
          }
          showAlert('Reset Concluído', 'O reset do sistema foi realizado com sucesso.');
          setResetPassword('');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'multiple');
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          {subTab === 'regimento' ? 'Regimento Interno EBD' : 
           subTab === 'calendar' ? 'Calendário Escolar' : 
           subTab === 'organogram' ? 'Organograma' : 
           subTab === 'comunicados' ? 'Comunicados' :
           subTab === 'documentos' ? 'Documentos Gerais' :
           subTab === 'meetings' ? 'Registro de Reuniões' : 'Configurações do Sistema'}
        </h2>
        <div className="flex items-center gap-3">
          {hasEditAccess && subTab === 'regimento' && (
            <button
              onClick={() => {
                setForm({ title: '', content: '', order: regimentos.length + 1 });
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Novo Capítulo
            </button>
          )}

          {hasEditAccess && subTab === 'comunicados' && (
            <button
              onClick={() => {
                setEditingComunicadoId(null);
                setComunicadoForm({ target: 'equipe', text: '', date: format(new Date(), 'yyyy-MM-dd') });
                setShowComunicadoForm(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Novo Comunicado
            </button>
          )}

          {hasEditAccess && subTab === 'documentos' && (
            <button
              onClick={() => {
                setEditingDocumentoId(null);
                setDocumentoForm({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd') });
                setShowDocumentoForm(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Novo Documento
            </button>
          )}

          {hasEditAccess && subTab === 'meetings' && (
            <button
              onClick={() => {
                setEditingMeetingId(null);
                setMeetingForm({ title: '', content: '', date: format(new Date(), 'yyyy-MM-dd'), participants: '', type: 'GERAL' });
                setShowMeetingForm(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-5 h-5" />
              Nova Reunião
            </button>
          )}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
        </button>
      </div>

      <motion.div
        initial={false}
        animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden space-y-6"
      >
        {subTab === 'organogram' && <OrganogramModule user={user} />}

        {/* Comunicados List */}
        {subTab === 'comunicados' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comunicados.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 group relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded uppercase tracking-widest border border-indigo-100">
                      {c.target === 'equipe' ? 'Equipe' : c.target === 'professores' ? 'Professores' : 'Alunos'}
                    </span>
                    <p className="text-sm font-bold text-slate-500 mt-2">
                      {safeFormat(c.date, 'dd/MM/yyyy')}
                    </p>
                  </div>
                  {hasEditAccess && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          setEditingComunicadoId(c.id);
                          setComunicadoForm({ target: c.target, text: c.text, date: c.date });
                          setShowComunicadoForm(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteComunicado(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documentos List */}
        {subTab === 'documentos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentos.map(d => (
              <div key={d.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 group relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{d.title}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{safeFormat(d.date, 'dd/MM/yyyy')}</p>
                  </div>
                  {hasEditAccess && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          setEditingDocumentoId(d.id);
                          setDocumentoForm({ title: d.title, content: d.content, date: d.date });
                          setShowDocumentoForm(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDocumento(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 h-32 overflow-y-auto">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{d.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      {subTab === 'system' && isAdmin && (
        <div className="space-y-6">
          {/* School Year Config */}
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Configuração do Ano Letivo</h3>
                <p className="text-sm text-slate-500">Defina as datas de início e término do ano letivo atual.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                <input
                  type="date"
                  value={schoolYearForm.startDate}
                  onChange={(e) => setSchoolYearForm({ ...schoolYearForm, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Data de Término</label>
                <input
                  type="date"
                  value={schoolYearForm.endDate}
                  onChange={(e) => setSchoolYearForm({ ...schoolYearForm, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSchoolYear}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100"
            >
              {schoolYear?.isFixed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              Fixar Ano Letivo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reset Section */}
            <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-sm space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reset do Sistema</h3>
                  <p className="text-sm text-slate-500">Limpeza de dados do banco de dados.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['total', 'partial', 'selective'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setResetType(type)}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-xl text-xs font-bold border transition-all",
                        resetType === type
                          ? "bg-red-600 border-red-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:border-red-300"
                      )}
                    >
                      {type === 'total' ? 'Total' : type === 'partial' ? 'Parcial' : 'Seletivo'}
                    </button>
                  ))}
                </div>

                {resetType === 'selective' && (
                  <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    {Object.entries(selectiveOptions).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setSelectiveOptions(prev => ({ ...prev, [key]: !value }))}
                        className="flex items-center gap-2 text-xs text-slate-600 hover:text-red-600 transition-colors"
                      >
                        {value ? <CheckSquare className="w-4 h-4 text-red-600" /> : <Square className="w-4 h-4" />}
                        {key === 'teachers' ? 'Professores' :
                         key === 'students' ? 'Alunos' :
                         key === 'classes' ? 'Turmas' :
                         key === 'calendar' ? 'Calendário' :
                         key === 'regimento' ? 'Regimento' :
                         key === 'organogram' ? 'Organograma' :
                         key === 'projects' ? 'Projetos' :
                         key === 'planning' ? 'Planejamento' :
                         key === 'meetings' ? 'Reuniões' :
                         key === 'studentReports' ? 'Relat. Alunos' :
                         key === 'teacherReports' ? 'Relat. Prof.' :
                         key === 'justifications' ? 'Justificativas' :
                         key === 'manualReports' ? 'Relat. Manuais' : 'Financeiro'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Senha de Segurança</label>
                  <input
                    type="password"
                    placeholder="Digite a senha para resetar"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <button
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-100"
                >
                  <Trash2 className="w-5 h-5" />
                  Executar Reset {resetType === 'total' ? 'Total' : resetType === 'partial' ? 'Parcial' : 'Seletivo'}
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Backup de Dados</h3>
                <p className="text-sm text-slate-500">Baixe todos os dados do sistema em um arquivo JSON.</p>
              </div>
            </div>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
            >
              {isBackingUp ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              Fazer Backup Agora
            </button>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Restaurar Dados</h3>
                <p className="text-sm text-slate-500">Importe dados a partir de um arquivo de backup anterior.</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                disabled={isRestoring}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all">
                {isRestoring ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                Selecionar Arquivo e Restaurar
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>Aviso: Esta ação é irreversível e substituirá os dados atuais pelos dados do arquivo.</p>
            </div>
          </div>
        </div>
      </div>
      )}
      {subTab === 'calendar' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveCalendarType('ebd')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'ebd' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário EBD
            </button>
            <button 
              onClick={() => setActiveCalendarType('church')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'church' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário Igreja
            </button>
            <button 
              onClick={() => setActiveCalendarType('convention')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'convention' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário Convenção
            </button>
            <button 
              onClick={() => setActiveCalendarType('geral')}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all border",
                activeCalendarType === 'geral' ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              )}
            >
              Calendário Geral
            </button>
          </div>

          {activeCalendarType === 'geral' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">Calendários Gerais</h3>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setGeneralCalendarForm({ title: '', content: '' });
                      setEditingGeneralCalendarId(null);
                      setShowGeneralCalendarForm(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Calendário
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {generalCalendars.map(cal => (
                  <div key={cal.id} className="group flex flex-col items-center space-y-3 p-4 bg-white rounded-2xl border border-slate-100 hover:shadow-md transition-all cursor-pointer" onClick={() => setViewingGeneralCalendar(cal)}>
                    <div className="relative">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:scale-110 shadow-sm">
                        <CalendarIcon className="w-8 h-8" />
                      </div>
                      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {isAdmin && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setGeneralCalendarForm({ title: cal.title, content: cal.content });
                                setEditingGeneralCalendarId(cal.id);
                                setShowGeneralCalendarForm(true);
                              }}
                              className="p-1.5 bg-white text-slate-400 hover:text-amber-600 rounded-full shadow-lg border border-slate-100"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGeneralCalendar(cal.id);
                              }}
                              className="p-1.5 bg-white text-slate-400 hover:text-red-600 rounded-full shadow-lg border border-slate-100"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs text-center uppercase tracking-tight line-clamp-2">{cal.title}</h4>
                  </div>
                ))}
                {generalCalendars.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 w-full">
                    <p className="text-slate-400 text-sm">Nenhum calendário geral cadastrado.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 capitalize">
              {activeCalendarType === 'ebd' ? 'Eventos EBD' : activeCalendarType === 'church' ? 'Eventos da Igreja' : 'Eventos da Convenção'}
            </h3>
            {isAdmin && (
              <button
                onClick={() => {
                  setCalendarForm({ title: '', date: '', type: 'event', description: '' });
                  setEditingCalendarId(null);
                  setShowCalendarForm(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-5 h-5" />
                Cadastrar Evento
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {calendarEvents
              .filter(e => e.calendarType === activeCalendarType)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map(event => (
                <div key={event.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3 group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600">
                        <span className="text-[10px] uppercase leading-none">{safeFormat(event.date, 'MMM', { locale: ptBR })}</span>
                        <span className="text-lg leading-none">{safeFormat(event.date, 'dd')}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{event.title}</h4>
                        <p className="text-xs text-slate-500">{safeFormat(event.date, 'EEEE', { locale: ptBR })}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setCalendarForm({ title: event.title, date: event.date, type: event.type, description: event.description || '' });
                            setEditingCalendarId(event.id);
                            setShowCalendarForm(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCalendarEvent(event.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {event.description && <p className="text-sm text-slate-600 line-clamp-2">{event.description}</p>}
                </div>
              ))}
          </div>
            </>
          )}
        </div>
      )}

      {/* Calendar Form Modal */}
      <AnimatePresence>
        {showCalendarForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingCalendarId ? 'Editar Evento' : 'Novo Evento'}
                </h3>
                <button onClick={() => setShowCalendarForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveCalendarEvent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Evento</label>
                  <input
                    required
                    type="text"
                    value={calendarForm.title}
                    onChange={(e) => setCalendarForm({ ...calendarForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <input
                      required
                      type="date"
                      value={calendarForm.date}
                      onChange={(e) => setCalendarForm({ ...calendarForm, date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <select
                      value={calendarForm.type}
                      onChange={(e) => setCalendarForm({ ...calendarForm, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="event">Evento</option>
                      <option value="meeting">Reunião</option>
                      <option value="holiday">Feriado</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição (Opcional)</label>
                  <textarea
                    rows={3}
                    value={calendarForm.description}
                    onChange={(e) => setCalendarForm({ ...calendarForm, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingCalendarId ? 'Atualizar Evento' : 'Salvar Evento'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* General Calendar Form Modal */}
      <AnimatePresence>
        {showGeneralCalendarForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingGeneralCalendarId ? 'Editar Calendário' : 'Novo Calendário Geral'}
                </h3>
                <button onClick={() => setShowGeneralCalendarForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveGeneralCalendar} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Calendário</label>
                  <input
                    required
                    type="text"
                    value={generalCalendarForm.title}
                    onChange={(e) => setGeneralCalendarForm({ ...generalCalendarForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo</label>
                  <textarea
                    required
                    rows={15}
                    value={generalCalendarForm.content}
                    onChange={(e) => setGeneralCalendarForm({ ...generalCalendarForm, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingGeneralCalendarId ? 'Atualizar Calendário' : 'Salvar Calendário'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* General Calendar View Modal */}
      <AnimatePresence>
        {viewingGeneralCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-xl font-bold text-slate-900">{viewingGeneralCalendar.title}</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                    title="Imprimir"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button onClick={() => setViewingGeneralCalendar(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="p-8 overflow-y-auto flex-1">
                <div className="prose prose-slate max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700">
                  {viewingGeneralCalendar.content}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Meeting Form Modal */}
      <AnimatePresence>
        {showMeetingForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingMeetingId ? 'Editar Registro de Reunião' : 'Novo Registro de Reunião'}
                </h3>
                <button onClick={() => setShowMeetingForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSaveMeeting} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Título da Reunião</label>
                    <input
                      required
                      type="text"
                      value={meetingForm.title}
                      onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <select
                      value={meetingForm.type}
                      onChange={(e) => setMeetingForm({ ...meetingForm, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ADMINISTRATIVA">Administrativa</option>
                      <option value="PEDAGÓGICA">Pedagógica</option>
                      <option value="PAIS">Pais</option>
                      <option value="ALUNOS">Alunos</option>
                      <option value="GERAL">Geral</option>
                      <option value="OUTRAS">Outras</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Participantes</label>
                    <input
                      type="text"
                      placeholder="Ex: Pedro, Maria, Todos os professores..."
                      value={meetingForm.participants}
                      onChange={(e) => setMeetingForm({ ...meetingForm, participants: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ata da Reunião / Conteúdo</label>
                  <textarea
                    required
                    rows={8}
                    value={meetingForm.content}
                    onChange={(e) => setMeetingForm({ ...meetingForm, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingMeetingId ? 'Atualizar Registro' : 'Salvar Registro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {subTab === 'meetings' && (
        <div className="space-y-4">
          {meetings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma reunião registrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 mb-2">
                        {meeting.type}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {meeting.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {format(parseISO(meeting.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingMeetingId(meeting.id);
                            setMeetingForm({ ...meeting });
                            setShowMeetingForm(true);
                          }}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {meeting.participants && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Participantes</p>
                      <p className="text-xs text-slate-600 font-bold">{meeting.participants}</p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4 leading-relaxed italic">
                      "{meeting.content}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'regimento' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regimentos.sort((a, b) => a.order - b.order).map((reg) => {
            return (
              <div 
                key={reg.id} 
                className={cn(
                  "bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group transition-all duration-300",
                  expandedRegimentoId === reg.id ? "md:col-span-2 lg:col-span-3" : "hover:shadow-md cursor-pointer"
                )}
                onClick={() => expandedRegimentoId !== reg.id && setExpandedRegimentoId(reg.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                          {reg.order}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">{reg.title}</h3>
                      </div>
                      
                      {expandedRegimentoId === reg.id ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4"
                        >
                          <div className="prose prose-slate max-w-none text-slate-600 text-sm whitespace-pre-wrap border-t border-slate-50 pt-4">
                            {reg.content}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRegimentoId(null);
                            }}
                            className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                          >
                            Fechar Leitura
                          </button>
                        </motion.div>
                      ) : (
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-2">Clique para ler o capítulo</p>
                      )}
                    </div>
                    
                    {isAdmin && (
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(reg);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(reg.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>

      {/* Regimento Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Editar Capítulo' : 'Novo Capítulo'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Título do Capítulo</label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Ordem</label>
                    <input
                      required
                      type="number"
                      value={form.order}
                      onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo</label>
                  <textarea
                    required
                    rows={12}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingId ? 'Atualizar Capítulo' : 'Salvar Capítulo'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Documento Form Modal */}
      <AnimatePresence>
        {showDocumentoForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 uppercase">
                  {editingDocumentoId ? 'Editar Documento' : 'Novo Documento'}
                </h3>
                <button onClick={() => setShowDocumentoForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSaveDocumento} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Documento</label>
                  <input
                    required
                    type="text"
                    value={documentoForm.title}
                    onChange={(e) => setDocumentoForm({ ...documentoForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                  <input
                    required
                    type="date"
                    value={documentoForm.date}
                    onChange={(e) => setDocumentoForm({ ...documentoForm, date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo</label>
                  <textarea
                    required
                    rows={8}
                    value={documentoForm.content}
                    onChange={(e) => setDocumentoForm({ ...documentoForm, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Documento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comunicado Form Modal */}
      <AnimatePresence>
        {showComunicadoForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 uppercase">
                  {editingComunicadoId ? 'Editar Comunicado' : 'Novo Comunicado'}
                </h3>
                <button onClick={() => setShowComunicadoForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSaveComunicado} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Para quem?</label>
                  <select
                    value={comunicadoForm.target}
                    onChange={(e) => setComunicadoForm({ ...comunicadoForm, target: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="equipe">Equipe</option>
                    <option value="professores">Professores</option>
                    <option value="alunos">Alunos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                  <input
                    required
                    type="date"
                    value={comunicadoForm.date}
                    onChange={(e) => setComunicadoForm({ ...comunicadoForm, date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Texto do Comunicado</label>
                  <textarea
                    required
                    rows={6}
                    value={comunicadoForm.text}
                    onChange={(e) => setComunicadoForm({ ...comunicadoForm, text: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Comunicado
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      <AnimatePresence>
        {alertConfig?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{alertConfig.title}</h3>
                  <p className="text-slate-600 mt-2">{alertConfig.message}</p>
                </div>
                <button
                  onClick={() => setAlertConfig(null)}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmConfig?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{confirmConfig.title}</h3>
                  <p className="text-slate-600 mt-2">{confirmConfig.message}</p>
                </div>
                {confirmConfig.isPassword && (
                  <div className="mb-4">
                    <input
                      id="admin-modal-password-input"
                      type="password"
                      placeholder="Digite a senha..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget.value;
                          confirmConfig.onConfirm(input);
                          setConfirmConfig(null);
                        }
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setConfirmConfig(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const input = (document.getElementById('admin-modal-password-input') as HTMLInputElement)?.value;
                      confirmConfig.onConfirm(input);
                      setConfirmConfig(null);
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Confirmar
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
