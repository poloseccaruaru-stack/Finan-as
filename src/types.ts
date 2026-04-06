export interface Student {
  id: string;
  name: string;
  birthDate: string;
  guardians: string;
  emergencyContact: string;
  phone?: string;
  history: string;
  photoURL?: string;
  classId?: string;
  createdAt: string;
  consecutiveAbsences: number;
  lastAbsenceDate?: string;
  attendancePercentage?: number;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  contact: string;
  classIds: string[];
  role: 'admin' | 'teacher';
  firstLogin: boolean;
  createdAt: string;
  login?: string;
  password?: string;
  allowedTabs?: string[];
}

export interface Class {
  id: string;
  name: string;
  ageRange: string;
  teacherId?: string;
  studentIds: string[];
  schoolYear?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  classId: string;
  date: string;
  presentStudentIds: string[];
  absentStudentIds: string[];
  justifications?: Record<string, string>;
  contentGiven?: string;
  methodology?: string;
  observation?: string;
  aulaObjetivos?: 'SIM' | 'NÃO' | 'NÃO SE APLICA';
  alunosParticiparam?: 'SIM' | 'NÃO' | 'NÃO SE APLICA';
  versiculoCitado?: 'SIM' | 'NÃO' | 'NÃO SE APLICA';
  houveOferta?: 'SIM' | 'NÃO' | 'NÃO SE APLICA';
  createdAt: string;
}

export interface Planning {
  id: string;
  month: string; // YYYY-MM
  classId: string;
  teacherId: string;
  date: string; // Specific Sunday
  content: string;
  methodology: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  teacherIds: string[];
  studentIds: string[];
  startDate: string;
  endDate?: string;
  status: 'EM ANDAMENTO' | 'FINALIZADO';
  evaluation?: string;
  results?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: 'pending' | 'paid';
  createdAt: string;
  estimatedAmount?: number;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM
  totalBudget: number;
  createdAt: string;
}

export interface Regimento {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'holiday' | 'meeting' | 'event' | 'other';
  calendarType: 'ebd' | 'church' | 'convention';
  createdAt: string;
}

export interface SchoolYearConfig {
  id: string;
  startDate: string;
  endDate: string;
  isFixed: boolean;
  updatedAt: string;
}

export interface EstimatedExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdAt: string;
}

export interface StudentReport {
  id: string;
  studentId: string;
  teacherId: string;
  content: string;
  date: string;
  createdAt: string;
}

export interface TeacherReport {
  id: string;
  targetTeacherId: string;
  adminId: string;
  content: string;
  date: string;
  createdAt: string;
}

export interface DashboardConfig {
  highFrequencyLimit: number;
  intermediateFrequencyLimit: number;
}

export interface JustificationOption {
  id: string;
  text: string;
  createdAt: string;
}

export interface OrganogramEntry {
  id: string;
  name: string;
  role: string;
  level: number; // 0: Top, 1: Sub, etc.
  parentId?: string;
  createdAt: string;
}

export interface ManualReport {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt: string;
}

export const CATEGORIES = [
  'Mensalidade',
  'Material',
  'Salário',
  'Manutenção',
  'Eventos',
  'Outros'
];
