export interface Student {
  id: string;
  name: string;
  birthDate?: string;
  guardians: string;
  emergencyContact: string;
  phone?: string;
  history: string;
  photoURL?: string;
  address?: string;
  classId?: string;
  classIds?: string[];
  schoolYear?: string;
  createdAt: string;
  consecutiveAbsences: number;
  lastAbsenceDate?: string;
  attendancePercentage?: number;
  registrationNumber?: string;
  doNotRenew?: boolean;
  status?: 'ativo' | 'concluído' | 'transferido' | 'evadido';
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  contact: string;
  birthDate?: string;
  classIds: string[];
  role: string;
  profession?: string;
  startDateEBD?: string;
  generalProfile?: string;
  firstLogin: boolean;
  createdAt: string;
  login?: string;
  password?: string;
  allowedTabs?: string[];
  registrationNumber?: string;
  address?: string;
  academicBackground?: string;
  theologicalBackground?: string;
}

export interface AccessProfile {
  id: string;
  name: string;
  allowedTabs: string[];
  isImmutable?: boolean;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  ageRange: string;
  teacherId?: string;
  teacherIds?: string[];
  studentIds: string[];
  studentOrder?: string[];
  isOrderFixed?: boolean;
  schoolYear?: string;
  createdAt: string;
  status?: 'ATIVA' | 'ENCERRADA';
  gradeLevel?: number;
  isFinalGrade?: boolean;
  originalClassId?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  schoolYear: string;
  status: string;
  registrationNumber?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  classId: string;
  date: string;
  presentStudentIds: string[];
  absentStudentIds: string[];
  partialStudentIds?: string[];
  startTime?: string;
  endTime?: string;
  justifications?: Record<string, string>;
  contentGiven?: string;
  methodology?: string;
  observation?: string;
  aulaObjetivos?: 'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA';
  alunosParticiparam?: 'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA';
  versiculoCitado?: 'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA';
  houveOferta?: 'SIM' | 'NÃO' | 'PARCIALMENTE' | 'NÃO SE APLICA';
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
  schoolYear?: string;
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
  consecutiveAbsencesLimit: number;
  frequencyStartDate?: string;
  frequencyEndDate?: string;
  rankStartDate?: string;
  rankEndDate?: string;
  classificationStartDate?: string;
  classificationEndDate?: string;
  colabBirthdayStartDate?: string;
  colabBirthdayEndDate?: string;
  layout?: string[];
  eventBarPosition: 'top' | 'bottom';
  eventBarVisibility?: 'both' | 'sidebar' | 'bottom' | 'none';
}

export interface AbsenceResolution {
  id: string;
  studentId: string;
  teacherId: string;
  note: string;
  consecutiveAbsences: number;
  date: string;
  createdAt: string;
}

export interface PreDefinedResolution {
  id: string;
  text: string;
  createdAt: string;
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

export interface Meeting {
  id: string;
  type: 'ADMINISTRATIVA' | 'PEDAGÓGICA' | 'PAIS' | 'ALUNOS' | 'GERAL' | 'OUTRAS';
  title: string;
  content: string;
  date: string;
  participants?: string;
  createdAt: string;
}

export interface GeneralCalendar {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Comunicado {
  id: string;
  target: string; // "professores", "alunos", "equipe" or comma separated
  date: string;
  text: string;
  createdAt: string;
}

export interface GeneralDocument {
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
