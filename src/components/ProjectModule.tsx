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
  where
} from 'firebase/firestore';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Users,
  Calendar,
  Search,
  ChevronRight,
  Printer,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';
import { Project, Teacher, Student } from '../types';
import { cn, safeFormat } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
  selectedSchoolYear: string;
  hasFullAccess?: boolean;
}

export default function ProjectModule({ user, selectedSchoolYear, hasFullAccess: propHasFullAccess }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
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
  const [modalInput, setModalInput] = useState('');

  const showAlert = (title: string, message: string) => {
    setModalConfig({ show: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: (inputValue?: string) => void, isPassword = false) => {
    setModalInput('');
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
  const [form, setForm] = useState({
    title: '',
    description: '',
    teacherIds: [] as string[],
    studentIds: [] as string[],
    startDate: safeFormat(new Date(), 'yyyy-MM-dd') || "",
    endDate: '',
    status: 'EM ANDAMENTO' as 'EM ANDAMENTO' | 'FINALIZADO',
    evaluation: '',
    results: ''
  });

  const isAdmin = user.role === 'admin';
  const hasFullAccess = propHasFullAccess ?? isAdmin;
  const isCoordinator = user.role === 'coordinator' || isAdmin;
  const hasEditAccess = hasFullAccess;

  useEffect(() => {
    const q = collection(db, 'projects');

    const unsub = onSnapshot(q, (snap) => {
      const allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setProjects(allProjects.filter(p => p.schoolYear === selectedSchoolYear));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
      setLoading(false);
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(allStudents.filter(s => s.schoolYear === selectedSchoolYear));
    });

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
    });

    return () => {
      unsub();
      unsubStudents();
      unsubTeachers();
    };
  }, [user, isAdmin]);

  const handleDelete = async (id: string) => {
    showAdminConfirm('Excluir Projeto', 'Deseja realmente excluir este projeto?', async () => {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
      }
    });
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      title: project.title,
      description: project.description,
      teacherIds: project.teacherIds,
      studentIds: project.studentIds,
      startDate: project.startDate,
      endDate: project.endDate || '',
      status: project.status || 'EM ANDAMENTO',
      evaluation: project.evaluation || '',
      results: project.results || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedForm = {
        title: form.title || "",
        description: form.description || "",
        teacherIds: form.teacherIds || [],
        studentIds: form.studentIds || [],
        startDate: form.startDate || safeFormat(new Date(), 'yyyy-MM-dd') || "",
        endDate: form.endDate || "",
        status: form.status || 'EM ANDAMENTO',
        evaluation: form.evaluation || "",
        results: form.results || "",
        schoolYear: selectedSchoolYear
      };

      if (editingProject) {
        await updateDoc(doc(db, 'projects', editingProject.id), {
          ...sanitizedForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'projects'), {
          ...sanitizedForm,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingProject(null);
      setForm({ title: '', description: '', teacherIds: [], studentIds: [], startDate: safeFormat(new Date(), 'yyyy-MM-dd') || "", endDate: '', status: 'EM ANDAMENTO', evaluation: '', results: '' });
    } catch (err) {
      handleFirestoreError(err, editingProject ? OperationType.UPDATE : OperationType.CREATE, 'projects');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Expand Button */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Projetos</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Gestão de Projetos e Eventos</p>
          </div>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
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
            {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium">Carregando projetos...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all print:hidden"
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
          {hasEditAccess && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100 print:hidden"
            >
              <Plus className="w-5 h-5" />
              Novo Projeto
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects
          .filter(p => p.status !== 'FINALIZADO')
          .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((project) => (
          <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-1">{project.title}</h3>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                      project.status === 'FINALIZADO' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {project.status || 'EM ANDAMENTO'}
                    </span>
                  </div>
                </div>
                {hasEditAccess && (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEdit(project)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(project.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500 line-clamp-3 mb-4">{project.description}</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Users className="w-4 h-4" />
                  <span>{project.studentIds.length} Alunos • {project.teacherIds.length} Professores</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>Início: {safeFormat(project.startDate, 'dd/MM/yyyy')}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="flex -space-x-2">
                {project.studentIds.slice(0, 4).map(sid => (
                  <div key={sid} className="w-8 h-8 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    {students.find(s => s.id === sid)?.name.charAt(0)}
                  </div>
                ))}
                {project.studentIds.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{project.studentIds.length - 4}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setViewingProject(project)}
                className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-1"
              >
                Ver Detalhes
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* View Project Modal */}
      <AnimatePresence>
        {viewingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-900">{viewingProject.title}</h3>
                <button onClick={() => setViewingProject(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded uppercase",
                    viewingProject.status === 'FINALIZADO' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {viewingProject.status || 'EM ANDAMENTO'}
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase">Descrição</h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{viewingProject.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Professores</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingProject.teacherIds.map(tid => (
                        <span key={tid} className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                          {teachers.find(t => t.id === tid)?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Alunos</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingProject.studentIds.map(sid => (
                        <span key={sid} className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                          {students.find(s => s.id === sid)?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Data de Início</h4>
                    <p className="text-slate-700">{safeFormat(viewingProject.startDate, 'dd/MM/yyyy')}</p>
                  </div>
                  {viewingProject.endDate && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-500 uppercase">Data de Término</h4>
                      <p className="text-slate-700">{safeFormat(viewingProject.endDate, 'dd/MM/yyyy')}</p>
                    </div>
                  )}
                </div>
                {viewingProject.evaluation && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Avaliação do Projeto</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">{viewingProject.evaluation}</p>
                  </div>
                )}
                {viewingProject.results && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Resultados Alcançados</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">{viewingProject.results}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-900">{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</h3>
                <button onClick={() => { setShowForm(false); setEditingProject(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Projeto</label>
                  <input
                    required
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <textarea
                    required
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                      <option value="FINALIZADO">FINALIZADO</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                    <input
                      required
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data de Término (Opcional)</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {form.status === 'FINALIZADO' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Avaliação do Projeto</label>
                      <textarea
                        rows={3}
                        value={form.evaluation}
                        onChange={(e) => setForm({ ...form, evaluation: e.target.value })}
                        placeholder="Como foi a execução do projeto?"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Resultados Alcançados</label>
                      <textarea
                        rows={3}
                        value={form.results}
                        onChange={(e) => setForm({ ...form, results: e.target.value })}
                        placeholder="Quais foram os principais resultados?"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Professores Envolvidos</label>
                    <div className="max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                      {teachers.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm text-slate-600 p-1 hover:bg-white rounded transition-colors">
                          <input 
                            type="checkbox"
                            checked={form.teacherIds.includes(t.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...form.teacherIds, t.id]
                                : form.teacherIds.filter(id => id !== t.id);
                              setForm({ ...form, teacherIds: ids });
                            }}
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Alunos Participantes</label>
                    <div className="max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                      {students.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600 p-1 hover:bg-white rounded transition-colors">
                          <input 
                            type="checkbox"
                            checked={form.studentIds.includes(s.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...form.studentIds, s.id]
                                : form.studentIds.filter(id => id !== s.id);
                              setForm({ ...form, studentIds: ids });
                            }}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reports Section for Finished Projects */}
      <div className="mt-12 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Relatórios de Projetos Finalizados</h3>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Projeto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Período</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Resultados</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.filter(p => p.status === 'FINALIZADO').map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900">{project.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{project.description}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {safeFormat(project.startDate, 'dd/MM/yyyy')} - {project.endDate ? safeFormat(project.endDate, 'dd/MM/yyyy') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <p className="line-clamp-1 italic">{project.results || 'Sem resultados registrados'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setViewingProject(project)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {hasEditAccess && (
                        <>
                          <button 
                            onClick={() => handleEdit(project)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(project.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {projects.filter(p => p.status === 'FINALIZADO').length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum projeto finalizado até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {modalConfig.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                  modalConfig.type === 'confirm' ? "bg-amber-100 text-amber-600 shadow-amber-100" : "bg-red-100 text-red-600 shadow-red-100"
                )}>
                  {modalConfig.type === 'confirm' ? <Settings className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{modalConfig.title}</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Confirmação de Segurança</p>
                </div>
              </div>
              
              <p className="text-slate-600 mb-8 font-medium leading-relaxed">{modalConfig.message}</p>
              
              {modalConfig.isPassword && (
                <div className="mb-8 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Senha do Administrador</label>
                  <input
                    type="password"
                    placeholder="Digite a senha..."
                    autoFocus
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        modalConfig.onConfirm?.(modalInput);
                        setModalConfig(prev => ({ ...prev, show: false }));
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Cancelar
                </button>
                {modalConfig.type === 'confirm' ? (
                  <button
                    onClick={() => {
                      modalConfig.onConfirm?.(modalInput);
                      setModalConfig(prev => ({ ...prev, show: false }));
                    }}
                    className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-100"
                  >
                    Confirmar
                  </button>
                ) : (
                  <button
                    onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                    className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-100"
                  >
                    Entendido
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )}
</motion.div>
    )}
  </AnimatePresence>
</div>
  );
}
