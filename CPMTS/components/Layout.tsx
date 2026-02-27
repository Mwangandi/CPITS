
import React, { useState, createContext, useContext, useEffect } from 'react';
import { TAITA_TAVETA_LOGO_SVG } from '../constants';
import { db } from '../services/database';
import { LayoutDashboard, FolderKanban, MessageSquare, Info, Lock, Settings, Users, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Permission, UserRole, SystemSettings } from '../types';

interface AuthContextType {
  user: User | null;
  login: (payroll: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  settings: SystemSettings;
  updateSettings: (newSettings: SystemSettings) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
  hasPermission: () => false,
  settings: db.settings.get(),
  updateSettings: () => {},
});

export const useAuth = () => useContext(AuthContext);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(db.settings.get());

  useEffect(() => {
    const saved = localStorage.getItem('tt_user_session');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const login = async (payroll: string): Promise<boolean> => {
    const foundUser = db.users.getByPayroll(payroll);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('tt_user_session', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tt_user_session');
    navigate('/');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return user.permissions.includes(permission);
  };

  const updateSettings = (newSettings: SystemSettings) => {
    db.settings.save(newSettings);
    setSettings(newSettings);
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, permission: null },
    { name: 'Projects', path: '/projects', icon: <FolderKanban size={20} />, permission: null },
    { name: 'Feedback', path: '/feedback', icon: <MessageSquare size={20} />, permission: null },
    { name: 'Users', path: '/management/users', icon: <Users size={20} />, permission: 'manage_users' as Permission },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} />, permission: 'manage_settings' as Permission },
    { name: 'About PTS', path: '/about', icon: <Info size={20} />, permission: null },
  ];

  const visibleNavItems = navItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, settings, updateSettings }}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-white border-b-4 border-tt-green sticky top-0 z-50 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 h-28 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-6 hover:opacity-90 transition-opacity">
              <div className="w-20 h-20 flex items-center justify-center p-1 bg-white rounded-2xl overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  TAITA_TAVETA_LOGO_SVG
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-3xl font-black tt-green tracking-tighter leading-none">{settings.countyName}</h1>
                <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1.5">Project Tracking System</p>
              </div>
            </Link>
            
            <nav className="hidden md:flex items-center gap-3">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all duration-300 ${
                    location.pathname === item.path 
                    ? 'tt-bg-green text-white shadow-lg shadow-green-100' 
                    : 'text-slate-600 hover:bg-slate-50 hover:tt-green'
                  }`}
                >
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
            
            <div className="hidden lg:flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{user.name}</p>
                    <p className="text-[10px] font-bold tt-navy uppercase tracking-widest">{user.role}</p>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-xl border border-slate-100 shadow-sm transition-all"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link 
                  to="/login"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl tt-bg-navy text-white font-black shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Lock size={18} />
                  Staff Login
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-10">
          {children}
        </main>

        <footer className="bg-slate-950 text-white mt-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 tt-bg-yellow"></div>
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 items-start">
              <div className="space-y-6">
                <div className="flex items-center gap-5">
                  <div className="bg-white p-2 rounded-2xl shadow-2xl w-20 h-20 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      TAITA_TAVETA_LOGO_SVG
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{settings.countyName}</h2>
                    <p className="text-sm font-bold tt-yellow uppercase tracking-[0.2em]">County Government</p>
                  </div>
                </div>
                <p className="text-base text-slate-300 max-w-xs leading-relaxed font-medium">
                  "Wumweri ni Ndiighi, Bhaisanga ni Lifumwa" - Unity is strength, brotherhood is glory.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <h3 className="font-black tt-yellow uppercase text-xs tracking-[0.3em] mb-8">Quick Access</h3>
                  <ul className="space-y-5 text-sm text-slate-100/90 font-bold">
                    <li><Link to="/" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Wananchi Dashboard</Link></li>
                    <li><Link to="/projects" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Project Inventory</Link></li>
                    <li><Link to="/feedback" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Public Feedback</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-black tt-yellow uppercase text-xs tracking-[0.3em] mb-8">Support</h3>
                  <ul className="space-y-5 text-sm text-slate-100/90 font-bold">
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Reporting Portal</a></li>
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Help Desk</a></li>
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> SDU FAQ</a></li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white/10 border border-white/20 p-8 rounded-[2.5rem] backdrop-blur-md">
                  <h3 className="font-black text-white text-xl mb-3 tracking-tight">Service Delivery Unit</h3>
                  <p className="text-sm text-slate-300 mb-6 font-medium leading-relaxed">Official monitoring and evaluation division for county projects.</p>
                  <div className="flex items-center gap-3">
                     <div className="px-5 py-2.5 rounded-xl tt-bg-green text-white text-[10px] font-black shadow-xl shadow-green-900/50 uppercase tracking-widest">
                        LIVE MONITORING
                     </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <span>© 2026 {settings.countyName}. Transparency through tracking.</span>
              <div className="flex gap-8">
                <a href="#" className="hover:text-white transition-colors">Legal Notices</a>
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              </div>
            </div>
          </div>
          <div className="h-2 tt-bg-green"></div>
          <div className="h-2 tt-bg-orange"></div>
        </footer>
      </div>
    </AuthContext.Provider>
  );
};

export default Layout;
