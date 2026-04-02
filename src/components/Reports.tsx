import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  FileText, 
  Download, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from '../types';
import { cn } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  user: User;
}

export default function Reports({ user }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState(format(new Date().setDate(1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const filteredTransactions = transactions.filter(t => {
    const date = parseISO(t.date);
    return isWithinInterval(date, {
      start: startOfDay(parseISO(startDate)),
      end: endOfDay(parseISO(endDate))
    });
  });

  const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const categoryData = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: t.category, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#71717a'];

  return (
    <div className="space-y-8">
      {/* Date Filter */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Inicial</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Final</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl transition-all">
          <Download className="w-5 h-5" />
          Exportar PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Total Receitas no Período</p>
            <h3 className="text-3xl font-bold text-slate-900">R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <p className="text-slate-500 font-medium">Total Despesas no Período</p>
            <h3 className="text-3xl font-bold text-slate-900">R$ {expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Distribuição por Categoria</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Resumo de Categorias</h3>
          <div className="space-y-4">
            {categoryData.sort((a: any, b: any) => b.value - a.value).map((cat: any, index: number) => (
              <div key={cat.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">R$ {cat.value.toLocaleString('pt-BR')}</span>
              </div>
            ))}
            {categoryData.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Sem despesas no período.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
