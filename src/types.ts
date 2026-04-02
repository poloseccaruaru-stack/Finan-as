export interface Transaction {
  id: string;
  userId: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: 'pending' | 'paid';
  dueDate?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  targetAmount: number;
  category?: string;
  createdAt: string;
}

export const CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Trabalho',
  'Outros'
];
