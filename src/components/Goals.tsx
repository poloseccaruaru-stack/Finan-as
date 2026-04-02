import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Target, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Goal } from '../types';
import { cn } from '../lib/utils';

import { ptBR } from 'date-fns/locale';

interface Props {
  user: User;
}

export default function Goals({ user }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'goals'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      setGoals(data.sort((a, b) => b.month.localeCompare(a.month)));
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !month) return;

    // Check if goal for this month already exists
    const existing = goals.find(g => g.month === month);
    if (existing) {
      alert('Já existe uma meta para este mês. Você pode editá-la ou excluí-la.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'goals'), {
        userId: user.uid,
        month,
        targetAmount: parseFloat(amount),
        createdAt: new Date().toISOString(),
      });
      setAmount('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir esta meta?')) {
      await deleteDoc(doc(db, 'goals', id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Add Goal Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Definir Nova Meta Mensal</h3>
        </div>

        <form onSubmit={handleAddGoal} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mês</label>
            <input
              required
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Limite de Gastos (R$)</label>
            <input
              required
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <button
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Adicionar Meta
          </button>
        </form>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 px-2">Histórico de Metas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <div key={goal.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 capitalize">
                    {format(new Date(goal.month + '-02'), 'MMMM yyyy', { locale: ptBR })}
                  </p>
                  <p className="text-lg font-bold text-blue-600">
                    R$ {goal.targetAmount.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(goal.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {goals.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhuma meta definida ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
