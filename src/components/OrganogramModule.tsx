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
  query
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  ChevronRight,
  ChevronDown,
  UserPlus,
  Network
} from 'lucide-react';
import { OrganogramEntry, Teacher } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: Teacher;
}

export default function OrganogramModule({ user }: Props) {
  const [entries, setEntries] = useState<OrganogramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OrganogramEntry | null>(null);
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
  const [form, setForm] = useState({
    name: '',
    role: '',
    level: 0,
    parentId: ''
  });

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator';
  const hasEditAccess = isAdmin || isCoordinator;

  useEffect(() => {
    const q = query(collection(db, 'organogram'), orderBy('level', 'asc'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrganogramEntry)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'organogram');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const entryData = {
        name: form.name,
        role: form.role,
        level: parseInt(form.level.toString()),
        parentId: form.parentId || null,
        updatedAt: new Date().toISOString()
      };

      if (editingEntry) {
        await updateDoc(doc(db, 'organogram', editingEntry.id), entryData);
      } else {
        await addDoc(collection(db, 'organogram'), {
          ...entryData,
          createdAt: new Date().toISOString()
        });
      }
      setShowForm(false);
      setEditingEntry(null);
      setForm({ name: '', role: '', level: 0, parentId: '' });
    } catch (err) {
      handleFirestoreError(err, editingEntry ? OperationType.UPDATE : OperationType.CREATE, 'organogram');
    }
  };

  const handleDelete = async (id: string) => {
    showAdminConfirm('Excluir Membro', 'Deseja realmente excluir este registro do organograma?', async () => {
      try {
        await deleteDoc(doc(db, 'organogram', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `organogram/${id}`);
      }
    });
  };

  const handleEdit = (entry: OrganogramEntry) => {
    setEditingEntry(entry);
    setForm({
      name: entry.name,
      role: entry.role,
      level: entry.level,
      parentId: entry.parentId || ''
    });
    setShowForm(true);
  };

  const renderTree = (parentId: string | null = null, level: number = 0) => {
    const children = entries.filter(e => {
      if (parentId === null) {
        return !e.parentId || e.parentId === '';
      }
      return e.parentId === parentId;
    });
    if (children.length === 0) return null;

    return (
      <div className={cn("space-y-4", level > 0 && "ml-8 border-l-2 border-slate-200 pl-8 mt-4")}>
        {children.map(entry => (
          <div key={entry.id} className="relative">
            {level > 0 && (
              <div className="absolute -left-8 top-6 w-8 h-0.5 bg-slate-200"></div>
            )}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg",
                  level === 0 ? "bg-indigo-600" : level === 1 ? "bg-blue-500" : "bg-slate-500"
                )}>
                  {entry.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{entry.name}</h4>
                  <p className="text-sm text-indigo-600 font-medium uppercase tracking-wider">{entry.role}</p>
                </div>
              </div>
              {hasEditAccess && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleEdit(entry)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {renderTree(entry.id, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Organograma EBD</h2>
          <p className="text-slate-500">Estrutura hierárquica e funções da Escola Bíblica Dominical.</p>
        </div>
        {hasEditAccess && (
          <button
            onClick={() => {
              setForm({ name: '', role: '', level: 0, parentId: '' });
              setEditingEntry(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-indigo-100"
          >
            <UserPlus className="w-5 h-5" />
            Adicionar Membro
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium">Carregando organograma...</p>
        </div>
      ) : (
        <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 min-h-[400px]">
          {entries.length === 0 ? (
            <div className="text-center py-20">
              <Network className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Nenhum membro registrado no organograma.</p>
            </div>
          ) : (
            renderTree(null)
          )}
        </div>
      )}

      {/* Form Modal */}
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
                  {editingEntry ? 'Editar Membro' : 'Novo Membro'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Função / Cargo</label>
                  <input
                    required
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nível Hierárquico</label>
                    <select
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0}>Nível 1 (Topo)</option>
                      <option value={1}>Nível 2</option>
                      <option value={2}>Nível 3</option>
                      <option value={3}>Nível 4</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Superior Direto</label>
                    <select
                      value={form.parentId}
                      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Nenhum (Raiz)</option>
                      {entries
                        .filter(e => !editingEntry || e.id !== editingEntry.id)
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                        ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {editingEntry ? 'Atualizar Membro' : 'Salvar Membro'}
                </button>
              </form>
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
                  {modalConfig.type === 'confirm' ? <Network className="w-8 h-8" /> : <X className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{modalConfig.title}</h3>
                <p className="text-slate-500 font-medium mb-8">{modalConfig.message}</p>

                {modalConfig.isPassword && (
                  <div className="mb-6">
                    <input
                      id="organogram-modal-password-input"
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
                        const input = (document.getElementById('organogram-modal-password-input') as HTMLInputElement)?.value;
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
    </div>
  );
}
