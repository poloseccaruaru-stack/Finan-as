import { useState, useEffect, useMemo } from 'react';
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
  where,
  limit
} from 'firebase/firestore';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Filter,
  Download,
  PieChart as PieChartIcon,
  Search,
  X,
  Wallet,
  Printer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Transaction, Budget, CATEGORIES, Teacher, EstimatedExpense } from '../types';
import { cn, safeFormat } from '../lib/utils';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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

interface Props {
  user: Teacher;
  hasFullAccess?: boolean;
}

export default function FinanceModule({ user, hasFullAccess: propHasFullAccess }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: (val?: string) => void;
    isPassword?: boolean;
    val?: string;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isPassword: false,
    val: ''
  });
  const [filterMonth, setFilterMonth] = useState(safeFormat(new Date(), 'yyyy-MM'));
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    description: '',
    amount: 0,
    type: 'expense' as 'income' | 'expense',
    category: CATEGORIES[0],
    date: safeFormat(new Date(), 'yyyy-MM-dd'),
    status: 'paid' as 'pending' | 'paid'
  });

  const [budgetForm, setBudgetForm] = useState({
    month: safeFormat(new Date(), 'yyyy-MM'),
    totalBudget: 0
  });

  const [estimatedExpenses, setEstimatedExpenses] = useState<EstimatedExpense[]>([]);
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [estimateForm, setEstimateForm] = useState({
    description: '',
    amount: 0,
    category: CATEGORIES[0]
  });

  const isAdmin = user.role === 'admin';
  const isCoordinator = user.role === 'coordinator' || isAdmin;
  const hasFullAccess = propHasFullAccess ?? (
    isAdmin || 
    (user.permissions && user.permissions['finance'] === 'full') ||
    (!user.permissions && user.allowedTabs && user.allowedTabs.includes('finance')) ||
    (!user.permissions && !user.allowedTabs && (isAdmin || isCoordinator))
  );

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const bQ = query(collection(db, 'budgets'), orderBy('month', 'desc'));
    const unsubBudgets = onSnapshot(bQ, (snap) => {
      setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    const eQ = query(collection(db, 'estimated_expenses'), orderBy('createdAt', 'desc'));
    const unsubEstimates = onSnapshot(eQ, (snap) => {
      setEstimatedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as EstimatedExpense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'estimated_expenses'));

    return () => {
      unsub();
      unsubBudgets();
      unsubEstimates();
    };
  }, []);

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesMonth = t.date && t.date.startsWith(filterMonth);
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesMonth && matchesStatus && matchesSearch;
    });
  }, [transactions, filterMonth, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;
    const currentBudget = budgets.find(b => b.month === filterMonth)?.totalBudget || 0;
    const budgetUsage = currentBudget > 0 ? (expense / currentBudget) * 100 : 0;

    const estimatedTotal = estimatedExpenses.reduce((acc, e) => acc + e.amount, 0);

    return { income, expense, balance, budgetUsage, currentBudget, estimatedTotal };
  }, [currentMonthTransactions, budgets, filterMonth, estimatedExpenses]);

  const categoryData = useMemo(() => {
    const data: { name: string, value: number }[] = [];
    CATEGORIES.forEach(cat => {
      const value = currentMonthTransactions
        .filter(t => t.category === cat && t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);
      if (value > 0) data.push({ name: cat, value });
    });
    return data;
  }, [currentMonthTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        description: form.description || "",
        amount: form.amount || 0,
        type: form.type || 'expense',
        category: form.category || CATEGORIES[0],
        date: form.date || safeFormat(new Date(), 'yyyy-MM-dd'),
        status: form.status || 'paid',
        createdAt: new Date().toISOString()
      });
      setShowForm(false);
      setForm({ description: '', amount: 0, type: 'expense', category: CATEGORIES[0], date: safeFormat(new Date(), 'yyyy-MM-dd'), status: 'paid' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    }
  };

  const handleEstimateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'estimated_expenses'), {
        description: estimateForm.description || "",
        amount: estimateForm.amount || 0,
        category: estimateForm.category || CATEGORIES[0],
        createdAt: new Date().toISOString()
      });
      setShowEstimateForm(false);
      setEstimateForm({ description: '', amount: 0, category: CATEGORIES[0] });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'estimated_expenses');
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if budget for this month already exists
      const existing = budgets.find(b => b.month === budgetForm.month);
      if (existing) {
        await updateDoc(doc(db, 'budgets', existing.id), {
          totalBudget: budgetForm.totalBudget || 0
        });
      } else {
        await addDoc(collection(db, 'budgets'), {
          month: budgetForm.month || safeFormat(new Date(), 'yyyy-MM'),
          totalBudget: budgetForm.totalBudget || 0,
          createdAt: new Date().toISOString()
        });
      }
      setShowBudgetForm(false);
      setBudgetForm({ month: safeFormat(new Date(), 'yyyy-MM'), totalBudget: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'budgets');
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Transação',
      message: 'Para excluir esta transação permanentemente, digite a senha do sistema:',
      isPassword: true,
      onConfirm: async (pass) => {
        if (pass === 'SISTEMA') {
          try {
            await deleteDoc(doc(db, 'transactions', id));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
          }
        } else {
          alert('Senha do sistema incorreta!');
        }
      }
    });
  };

  const handleDeleteEstimate = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Previsto',
      message: 'Para excluir este gasto previsto, digite a senha do sistema:',
      isPassword: true,
      onConfirm: async (pass) => {
        if (pass === 'SISTEMA') {
          try {
            await deleteDoc(doc(db, 'estimated_expenses', id));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `estimated_expenses/${id}`);
          }
        } else {
          alert('Senha do sistema incorreta!');
        }
      }
    });
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Financeiro</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">Gestão de Fluxo de Caixa</p>
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Entradas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-bold">
            <TrendingUp className="w-3 h-3" />
            <span>+12% vs mês anterior</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
              <ArrowDownCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Saídas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-bold">
            <TrendingDown className="w-3 h-3" />
            <span>+5% vs mês anterior</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Saldo</span>
          </div>
          <p className={cn(
            "text-2xl font-black",
            stats.balance >= 0 ? "text-slate-900" : "text-red-600"
          )}>
            R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-xs text-slate-500 font-medium">Disponível em caixa</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <PieChartIcon className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Orçamento</span>
          </div>
          <div className="flex items-end justify-between mb-1">
            <p className="text-2xl font-black text-slate-900">{stats.budgetUsage.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 font-bold">Meta: R$ {stats.currentBudget}</p>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                stats.budgetUsage > 90 ? "bg-red-500" : stats.budgetUsage > 70 ? "bg-amber-500" : "bg-indigo-500"
              )}
              style={{ width: `${Math.min(stats.budgetUsage, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Distribuição por Categoria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">R$ {item.value.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900">Transações Recentes</h3>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar transação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todos os Status</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </select>
              <input 
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {hasFullAccess && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all print:hidden"
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir
                  </button>
                  <button 
                    onClick={() => setShowEstimateForm(true)}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-amber-100"
                  >
                    <Plus className="w-5 h-5" />
                    Previsto
                  </button>
                  <button 
                    onClick={() => {
                      setForm({ ...form, type: 'expense' });
                      setShowForm(true);
                    }}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-100"
                  >
                    <Plus className="w-5 h-5" />
                    Gasto
                  </button>
                  <button 
                    onClick={() => {
                      setForm({ ...form, type: 'income' });
                      setShowForm(true);
                    }}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-green-100"
                  >
                    <Plus className="w-5 h-5" />
                    Entrada
                  </button>
                  <button 
                    onClick={() => setShowBudgetForm(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-100"
                  >
                    <Wallet className="w-5 h-5" />
                    Orçamento
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMonthTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {safeFormat(t.date, 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{t.description}</p>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        t.status === 'paid' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {t.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {t.category}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm font-black text-right",
                      t.type === 'income' ? "text-green-600" : "text-red-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right print:hidden">
                      {hasFullAccess && (
                        <button 
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {currentMonthTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                      Nenhuma transação encontrada para este mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Estimated Expense Form Modal */}
      <AnimatePresence>
        {showEstimateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Lançar Gasto Previsto</h3>
                <button onClick={() => setShowEstimateForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleEstimateSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <input
                    required
                    type="text"
                    value={estimateForm.description}
                    onChange={(e) => setEstimateForm({ ...estimateForm, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={estimateForm.amount}
                      onChange={(e) => setEstimateForm({ ...estimateForm, amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                    <select
                      value={estimateForm.category}
                      onChange={(e) => setEstimateForm({ ...estimateForm, category: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-100">
                  Salvar Previsto
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Nova Transação</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {estimatedExpenses.length > 0 && form.type === 'expense' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Usar Previsto</label>
                    <select
                      onChange={(e) => {
                        const est = estimatedExpenses.find(ex => ex.id === e.target.value);
                        if (est) {
                          setForm({ ...form, description: est.description, amount: est.amount, category: est.category });
                        }
                      }}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Selecione um gasto previsto...</option>
                      {estimatedExpenses.map(est => (
                        <option key={est.id} value={est.id}>{est.description} (R$ {est.amount})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <input
                    required
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="expense">Saída (Despesa)</option>
                      <option value="income">Entrada (Receita)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input 
                        type="radio" 
                        checked={form.status === 'paid'} 
                        onChange={() => setForm({ ...form, status: 'paid' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Pago
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input 
                        type="radio" 
                        checked={form.status === 'pending'} 
                        onChange={() => setForm({ ...form, status: 'pending' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Pendente
                    </label>
                  </div>
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Transação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Budget Form Modal */}
      <AnimatePresence>
        {showBudgetForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Definir Orçamento Mensal</h3>
                <button onClick={() => setShowBudgetForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleBudgetSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mês</label>
                  <input
                    required
                    type="month"
                    value={budgetForm.month}
                    onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Valor Total do Orçamento (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={budgetForm.totalBudget}
                    onChange={(e) => setBudgetForm({ ...budgetForm, totalBudget: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100">
                  Salvar Orçamento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{confirmModal.message}</p>
              </div>
              <div className="p-6 space-y-4">
                {confirmModal.isPassword && (
                    <input
                      type="password"
                      autoFocus
                      placeholder="Digite a senha do sistema"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          confirmModal.onConfirm(e.currentTarget.value);
                          setConfirmModal({ ...confirmModal, show: false });
                        }
                      }}
                      onChange={(e) => setConfirmModal({ ...confirmModal, val: e.target.value })}
                    />
                )}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                    className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm(confirmModal.val);
                      setConfirmModal({ ...confirmModal, show: false });
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-100 transition-all"
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
