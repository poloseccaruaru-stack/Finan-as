/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getDocFromServer,
  doc,
  setDoc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  CheckSquare, 
  FileText, 
  Calendar, 
  Briefcase, 
  DollarSign, 
  Printer, 
  LogOut, 
  PlusCircle,
  Wallet,
  AlertCircle,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import AcademicModule from './components/AcademicModule';
import SidebarEvents from './components/SidebarEvents';
import AdminModule from './components/AdminModule';
import ProjectModule from './components/ProjectModule';
import FinanceModule from './components/FinanceModule';
import ReportModule from './components/ReportModule';
import PlanningModule from './components/PlanningModule';
import PresenceDetailsReport from './components/PresenceDetailsReport';
import OrganogramModule from './components/OrganogramModule';
import LoginForm from './components/LoginForm';
import AISidebarSearch from './components/AISidebarSearch';
import BirthdayBanner from './components/BirthdayBanner';
import HorizontalEventTicker from './components/HorizontalEventTicker';
import { cn } from './lib/utils';
import { Teacher, DashboardConfig } from './types';

type TabId = 'dashboard' | 'academic' | 'admin' | 'students' | 'teachers' | 'classes' | 'attendance' | 'schoolYear' | 'regimento' | 'calendar' | 'system' | 'projects' | 'finance' | 'reports' | 'planning' | 'organogram' | 'comunicados' | 'documentos' | 'meetings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Teacher | null>(null);
  const [originalAdminData, setOriginalAdminData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<string[]>(['academic']);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(new Date().getFullYear().toString());
  const [config, setConfig] = useState<DashboardConfig | null>(null);

  const handleImpersonate = (teacher: Teacher) => {
    if (userData?.role === 'admin') {
      setOriginalAdminData(userData);
      setUserData(teacher);
      setActiveTab('dashboard');
    }
  };

  const handleStopImpersonation = () => {
    if (originalAdminData) {
      setUserData(originalAdminData);
      setOriginalAdminData(null);
      setActiveTab('teachers');
    }
  };

  useEffect(() => {
    let unsubConfig: (() => void) | null = null;
    
    // Check if we are in report mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'presence-details') {
      const type = params.get('type') as any;
      const targetId = params.get('id') || '';
      const start = params.get('start') || '';
      const end = params.get('end') || '';
      const hL = Number(params.get('hL')) || 80;
      const iL = Number(params.get('iL')) || 50;

      // Render standalone report
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUser(user);
          
          // Move listener here to ensure auth exists
          unsubConfig = onSnapshot(
            doc(db, 'config', 'dashboard'), 
            (snap) => {
              if (snap.exists()) {
                setConfig(snap.data() as DashboardConfig);
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'config/dashboard')
          );
          
          testConnection();
          const userDocRef = doc(db, 'users', user.uid);
          
          // Add a timeout for the doc fetch to prevent infinite loading
          const fetchPromise = getDoc(userDocRef);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching user data')), 5000)
          );

          try {
            const userDoc = await Promise.race([fetchPromise, timeoutPromise]) as any;
            if (userDoc.exists()) {
              setUserData({ id: userDoc.id, ...userDoc.data() } as Teacher);
            } else {
              // Default for new Google users
              const newData: Teacher = {
                id: user.uid,
                name: user.displayName || '',
                email: user.email || '',
                contact: '',
                classIds: [],
                role: user.email === 'poloseccaruaru@gmail.com' ? 'admin' : 'professor',
                firstLogin: false,
                createdAt: new Date().toISOString(),
                allowedTabs: ['dashboard', 'academic', 'projects', 'reports']
              };
              await setDoc(userDocRef, newData);
              setUserData(newData);
            }
          } catch (fetchErr) {
            console.error('Error fetching user doc:', fetchErr);
            // Fallback to basic user data if doc fetch fails
            setUserData({
              id: user.uid,
              name: user.displayName || 'Usuário',
              email: user.email || '',
              role: user.email === 'poloseccaruaru@gmail.com' ? 'admin' : 'professor',
              classIds: [],
              allowedTabs: ['dashboard', 'academic', 'projects', 'reports']
            } as any);
          }
        } else {
          // If not Firebase Auth, check if we have a manual session in localStorage
          const manualUser = localStorage.getItem('ebd_manual_user');
          if (manualUser && manualUser !== 'undefined') {
            try {
              const parsed = JSON.parse(manualUser);
              setUserData(parsed);
            } catch (e) {
              console.error('Error parsing manual user:', e);
              localStorage.removeItem('ebd_manual_user');
              setUser(null);
              setUserData(null);
            }
          } else {
            setUser(null);
            setUserData(null);
          }
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      unsubConfig?.();
      unsubscribe();
    };
  }, []);

  const handleManualLogin = (manualUser: any) => {
    setUserData(manualUser);
    localStorage.setItem('ebd_manual_user', JSON.stringify(manualUser));
  };

  const handleLogout = () => {
    signOut(auth);
    localStorage.removeItem('ebd_manual_user');
    setUserData(null);
    setUser(null);
  };

  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error: any) {
      if (error.message?.includes('the client is offline')) {
        setError("Erro de conexão com o Firebase.");
      }
    }
  }

  const toggleModule = (module: string) => {
    setExpandedModules(prev => 
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!userData) {
    return <LoginForm onLoginSuccess={handleManualLogin} />;
  }

  const isAdmin = userData.role === 'admin';
  const isCoordinator = userData.role === 'coordinator' || userData.role === 'professor_ebd';
  const isProfessor = userData.role === 'professor';

  // Handle Detail Report View - Standalone mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'presence-details') {
    return (
      <PresenceDetailsReport 
        type={urlParams.get('type') as any}
        targetId={urlParams.get('id') || ''}
        startDate={urlParams.get('start') || ''}
        endDate={urlParams.get('end') || ''}
        highLimit={Number(urlParams.get('hL')) || config?.highFrequencyLimit || 80}
        interLimit={Number(urlParams.get('iL')) || config?.intermediateFrequencyLimit || 50}
      />
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { 
      id: 'academic', 
      label: 'Acadêmico', 
      icon: GraduationCap,
      subItems: [
        { id: 'students', label: 'Alunos', icon: Users },
        { id: 'teachers', label: 'Equipe EBD', icon: BookOpen },
        { id: 'classes', label: 'Turmas', icon: LayoutDashboard },
        { id: 'attendance', label: 'Chamada', icon: CheckSquare },
        { id: 'planning', label: 'Planejamento', icon: BookOpen },
        { id: 'meetings', label: 'Reuniões', icon: Users },
        { id: 'schoolYear', label: 'Ano Letivo', icon: Calendar },
      ].filter(sub => {
        if (isAdmin) return true;
        if (userData.allowedTabs && userData.allowedTabs.length > 0) {
          return userData.allowedTabs.includes(sub.id);
        }
        if (isCoordinator) return true;
        if (isProfessor) {
          const excluded = ['students', 'teachers', 'classes', 'meetings'];
          return !excluded.includes(sub.id);
        }
        return true;
      })
    },
    { 
      id: 'admin', 
      label: 'Administrativo', 
      icon: Briefcase,
      subItems: [
        { id: 'regimento', label: 'Regimento', icon: FileText },
        { id: 'calendar', label: 'Calendário', icon: Calendar },
        { id: 'comunicados', label: 'Comunicados', icon: FileText },
        { id: 'documentos', label: 'Documentos Gerais', icon: FileText },
        { id: 'organogram', label: 'Organograma', icon: Users },
        { id: 'system', label: 'Sistema', icon: LayoutDashboard },
      ].filter(sub => {
        // If allowedTabs are defined, they are the source of truth for granular permissions
        if (userData.allowedTabs && userData.allowedTabs.length > 0) {
          return userData.allowedTabs.includes(sub.id);
        }
        if (isAdmin) return true;
        if (isCoordinator) return sub.id !== 'system';
        if (isProfessor) return sub.id !== 'system';
        return true;
      })
    },
    { id: 'projects', label: 'Projetos', icon: Briefcase },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'reports', label: 'Relatórios', icon: Printer },
    { id: 'planning', label: 'Planejamento', icon: BookOpen },
  ].filter(item => {
    // If allowedTabs are defined, they are the source of truth for granular permissions
    if (userData.allowedTabs && userData.allowedTabs.length > 0) {
      return userData.allowedTabs.includes(item.id);
    }
    if (isAdmin) return true;
    if (isCoordinator) return true;
    if (isProfessor) {
      const excluded = ['finance', 'reports'];
      return !excluded.includes(item.id);
    }
    return true;
  });

  const hasAccess = (tabId: string): boolean => {
    // Check if the tab (or its parent) is in allowedTabs
    if (userData.allowedTabs && userData.allowedTabs.length > 0) {
      // For sub-items, we need to check if they are in allowedTabs as well
      // But based on App structure, we check the tabId directly
      return userData.allowedTabs.includes(tabId);
    }
    
    if (isAdmin) return true;
    if (isCoordinator) return tabId !== 'system';
    
    if (isProfessor) {
      if (['finance', 'reports', 'meetings'].includes(tabId)) return false;
      if (['students', 'teachers', 'classes', 'system'].includes(tabId)) return false;
      return true;
    }
    
    return true;
  };

  const AccessDenied = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-rose-600" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Acesso Negado</h2>
      <p className="text-slate-500 max-w-md mx-auto">
        Você não tem permissão para acessar este módulo. Se você acredita que isso deve ser diferente, entre em contato com o administrador do sistema.
      </p>
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
      >
        Voltar para o Dashboard
      </button>
    </div>
  );

  const renderContent = () => {
    if (!hasAccess(activeTab)) {
      return <AccessDenied />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={userData} selectedSchoolYear={selectedSchoolYear} />;
      case 'academic': // This handles nested subtabs as well if they share the module
      case 'students':
      case 'teachers':
      case 'classes':
      case 'attendance':
      case 'schoolYear':
      case 'meetings':
        return (
          <AcademicModule 
            user={userData} 
            subTab={activeTab === 'academic' ? 'students' : activeTab as any} 
            selectedSchoolYear={selectedSchoolYear} 
            onImpersonate={handleImpersonate}
          />
        );
      case 'regimento':
      case 'calendar':
      case 'system':
      case 'organogram':
      case 'comunicados':
      case 'documentos':
        return <AdminModule user={userData} subTab={activeTab as any} />;
      case 'projects':
        return <ProjectModule user={userData} selectedSchoolYear={selectedSchoolYear} />;
      case 'finance':
        return <FinanceModule user={userData} />;
      case 'reports':
        return <ReportModule user={userData} selectedSchoolYear={selectedSchoolYear} />;
      case 'planning':
        return <PlanningModule user={userData} selectedSchoolYear={selectedSchoolYear} />;
      default:
        return <Dashboard user={userData} selectedSchoolYear={selectedSchoolYear} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative z-40 h-screen bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-0 md:w-20 overflow-hidden"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-lg shadow-indigo-900/20">
            <img 
              src="https://img.icons8.com/color/96/000000/school.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          {isSidebarOpen && <span className="text-xl font-black text-white truncate tracking-tight">EBD IGBAPI</span>}
        </div>

        <AISidebarSearch isSidebarOpen={isSidebarOpen} />

        {isSidebarOpen && (
          <div className="px-6 py-4 border-b border-slate-800">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ano Letivo Ativo</label>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <select 
                value={selectedSchoolYear}
                onChange={(e) => setSelectedSchoolYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm font-bold rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer transition-all hover:bg-slate-700/50"
              >
                {Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <div key={item.id}>
              {item.subItems ? (
                <div className="space-y-1">
                  <button
                    onClick={() => toggleModule(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors",
                      expandedModules.includes(item.id) && "text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {isSidebarOpen && <span>{item.label}</span>}
                    </div>
                    {isSidebarOpen && (expandedModules.includes(item.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                  </button>
                  {isSidebarOpen && expandedModules.includes(item.id) && (
                    <div className="ml-9 space-y-1">
                      {item.subItems.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as TabId)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                            activeTab === sub.id ? "bg-indigo-600 text-white" : "hover:bg-slate-800"
                          )}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setActiveTab(item.id as TabId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    activeTab === item.id ? "bg-indigo-600 text-white" : "hover:bg-slate-800"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {isSidebarOpen && <span>{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${userData.name}`} className="w-8 h-8 rounded-full" alt="" />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{userData.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {isAdmin ? 'Administrador' : userData.role === 'coordinator' ? 'Coordenador' : userData.role === 'professor_ebd' ? 'Professor EBD' : 'Professor'}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-4">
            {originalAdminData && (
              <button
                onClick={handleStopImpersonation}
                className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-bold hover:bg-amber-200 transition-all"
              >
                <X className="w-4 h-4" />
                Sair do Modo Professor
              </button>
            )}
            <span className="text-sm text-slate-500 hidden md:block">{new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</span>
          </div>
        </header>

        <div className="flex flex-col">
          <BirthdayBanner type="student" />
          <BirthdayBanner type="collaborator" />
        </div>

        {/* Events Bar - Positioned based on config */}
        {userData && config?.eventBarPosition === 'top' && (
          <div className="px-4 md:px-8 pt-4 space-y-4">
            {(config?.eventBarVisibility === 'both' || config?.eventBarVisibility === 'sidebar' || !config?.eventBarVisibility) && (
              <SidebarEvents user={userData} compact />
            )}
            {(config?.eventBarVisibility === 'both' || config?.eventBarVisibility === 'bottom') && (
              <HorizontalEventTicker config={config} />
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
        
        {/* Compact Events at Bottom (Default/Config) */}
        {userData && (!config || config?.eventBarPosition === 'bottom') && (
          <div className="px-4 md:px-8 pb-4 space-y-4">
            {(config?.eventBarVisibility === 'both' || config?.eventBarVisibility === 'sidebar' || !config?.eventBarVisibility) && (
              <SidebarEvents user={userData} compact />
            )}
            {(config?.eventBarVisibility === 'both' || config?.eventBarVisibility === 'bottom') && (
              <HorizontalEventTicker config={config} />
            )}
          </div>
        )}

        {/* Impersonation Indicator Box */}
        {originalAdminData && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            className="fixed bottom-6 right-6 z-[100] bg-white border-2 border-amber-500 rounded-2xl shadow-2xl p-4 flex items-center gap-4 min-w-[300px]"
          >
            <div className="bg-amber-100 p-3 rounded-xl">
              <Eye className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Modo Visualização</p>
              <p className="text-sm font-bold text-slate-900">{userData.name}</p>
              <p className="text-xs text-slate-500">{userData.email}</p>
            </div>
            <button
              onClick={handleStopImpersonation}
              className="group flex flex-col items-center gap-1 p-2 hover:bg-red-50 rounded-xl transition-all"
              title="Fechar e retornar ao Admin"
            >
              <div className="bg-red-100 p-1.5 rounded-lg group-hover:bg-red-200 transition-all">
                <X className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase">Fechar</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>

  );
}
