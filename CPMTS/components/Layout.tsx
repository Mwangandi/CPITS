
import React, { useState, createContext, useContext, useEffect } from 'react';
import { TAITA_TAVETA_LOGO_SVG } from '../constants';
import { db } from '../services/database';
import { LayoutDashboard, FolderKanban, MessageSquare, Info, Lock, Settings, Users, LogOut, Menu, X, FileBarChart, Bell } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Permission, UserRole, SystemSettings } from '../types';
import { fetchAllFeedback } from '../services/frappeAPI';

const FRAPPE_API = ''; // proxied via Apache

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  settings: SystemSettings;
  updateSettings: (newSettings: SystemSettings) => void;
  notifCount: number;
  clearNotifications: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => { },
  hasPermission: () => false,
  settings: db.settings.get(),
  updateSettings: () => { },
  notifCount: 0,
  clearNotifications: () => { },
});

export const useAuth = () => useContext(AuthContext);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(db.settings.get());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const saved = localStorage.getItem('tt_user_session');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  // Load notification count: feedback submitted since admin last viewed the feedback page
  useEffect(() => {
    if (!user) { setNotifCount(0); return; }
    const loadNotifs = async () => {
      try {
        const data = await fetchAllFeedback();
        const lastSeen = localStorage.getItem('tt_admin_feedback_seen');
        const count = lastSeen
          ? data.filter(f => f.creation && f.creation > lastSeen).length
          : data.length;
        setNotifCount(count);
      } catch (_) { }
    };
    loadNotifs();
    const interval = setInterval(loadNotifs, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      // Authenticate with Frappe
      const loginRes = await fetch(`${FRAPPE_API}/api/method/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `usr=${encodeURIComponent(identifier)}&pwd=${encodeURIComponent(password)}`,
        credentials: 'include',
      });
      if (!loginRes.ok) return false;
      const loginData = await loginRes.json();
      if (loginData.message !== 'Logged In') return false;

      // Fetch user details from Frappe
      const userRes = await fetch(`${FRAPPE_API}/api/method/frappe.client.get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctype: 'User', name: identifier }),
        credentials: 'include',
      });
      const userData = userRes.ok ? await userRes.json() : null;
      const frappeUser = userData?.message;

      // Determine role from Frappe roles
      const roles: string[] = (frappeUser?.roles || []).map((r: any) => r.role);
      let appRole = UserRole.STAFF;
      if (roles.includes('Administrator') || roles.includes('System Manager')) {
        appRole = UserRole.SUPER_ADMIN;
      } else if (roles.includes('Projects Manager')) {
        appRole = UserRole.ADMIN;
      }

      const allPermissions: Permission[] = [
        'view_dashboard', 'view_projects', 'add_project', 'edit_project',
        'delete_project', 'import_projects', 'manage_users', 'manage_feedback', 'manage_settings',
      ];

      const appUser: User = {
        id: frappeUser?.name || identifier,
        payrollNumber: '',
        name: loginData.full_name || frappeUser?.full_name || identifier,
        email: frappeUser?.email || identifier,
        phone: frappeUser?.mobile_no || '',
        role: appRole,
        department: frappeUser?.department || '',
        permissions: appRole === UserRole.SUPER_ADMIN ? allPermissions : ['view_dashboard', 'view_projects'],
      };

      setUser(appUser);
      localStorage.setItem('tt_user_session', JSON.stringify(appUser));
      return true;
    } catch (err) {
      console.error('Frappe login failed:', err);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${FRAPPE_API}/api/method/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) { /* ignore */ }
    setUser(null);
    localStorage.removeItem('tt_user_session');
    navigate('/');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return user.permissions.includes(permission);
  };

  const clearNotifications = () => {
    localStorage.setItem('tt_admin_feedback_seen', new Date().toISOString());
    setNotifCount(0);
  };

  const updateSettings = (newSettings: SystemSettings) => {
    db.settings.save(newSettings);
    setSettings(newSettings);
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: null },
    { name: 'Projects', path: '/projects', icon: FolderKanban, permission: null },
    { name: 'Feedback', path: '/feedback', icon: MessageSquare, permission: null },
    { name: 'Reports', path: '/reports', icon: FileBarChart, permission: null },
    { name: 'Users', path: '/management/users', icon: Users, permission: 'manage_users' as Permission },
    { name: 'Settings', path: '/settings', icon: Settings, permission: 'manage_settings' as Permission },
    { name: 'About PTS', path: '/about', icon: Info, permission: null },
  ];

  const visibleNavItems = navItems.filter(item =>
    !item.permission || hasPermission(item.permission)
  );

  // ─── ADMIN / STAFF LAYOUT — sidebar ──────────────────────────────────────
  if (user) {
    const sidebarNav = (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-5 border-b border-slate-100 flex-shrink-0">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-11 h-11 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                : TAITA_TAVETA_LOGO_SVG}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black tt-green leading-tight truncate">{settings.countyName}</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.12em] mt-0.5">Project Tracking</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const NavIcon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const isFeedback = item.path === '/feedback';
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { setMobileMenuOpen(false); if (isFeedback) clearNotifications(); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm mb-0.5 transition-all ${isActive
                    ? 'tt-bg-green text-white shadow-md shadow-green-100'
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <NavIcon size={18} />
                <span className="flex-1">{item.name}</span>
                {isFeedback && notifCount > 0 && (
                  <span className={`text-[10px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 ${isActive ? 'bg-white/30 text-white' : 'bg-rose-500 text-white'
                    }`}>
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-9 h-9 rounded-xl tt-bg-navy text-white flex items-center justify-center font-black text-base flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-800 truncate leading-tight">{user.name}</p>
              <p className="text-[9px] font-bold tt-navy uppercase tracking-widest mt-0.5">{user.role}</p>
            </div>
            <button
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className="p-2 bg-white text-slate-400 hover:text-rose-500 rounded-xl border border-slate-100 shadow-sm transition-all flex-shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <AuthContext.Provider value={{ user, login, logout, hasPermission, settings, updateSettings, notifCount, clearNotifications }}>
        <div className="min-h-screen bg-slate-50">
          {/* Desktop sidebar — fixed left */}
          <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-100 shadow-sm z-40">
            {sidebarNav}
          </aside>

          {/* Mobile top bar */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-100 h-14 px-4 flex items-center justify-between shadow-sm">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                {settings.logoUrl
                  ? <img src={settings.logoUrl} alt="" className="w-full h-full object-contain" />
                  : TAITA_TAVETA_LOGO_SVG}
              </div>
              <span className="text-sm font-black tt-green">{settings.countyName}</span>
            </Link>
            <Link
              to="/feedback"
              onClick={clearNotifications}
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Bell size={20} />
              {notifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile sidebar drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-[60] md:hidden">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
              <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl overflow-hidden animate-slide-in">
                {sidebarNav}
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="md:ml-64 pt-14 md:pt-0 min-h-screen">
            <div className="max-w-7xl mx-auto px-3 sm:px-5 py-5 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </AuthContext.Provider>
    );
  }

  // ─── PUBLIC LAYOUT — top nav + footer ────────────────────────────────────
  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, settings, updateSettings, notifCount, clearNotifications }}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-white border-b-4 border-tt-green sticky top-0 z-50 shadow-xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 sm:h-20 md:h-28 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 sm:gap-4 md:gap-6 hover:opacity-90 transition-opacity">
              <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 flex items-center justify-center p-1 bg-white rounded-xl md:rounded-2xl overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  TAITA_TAVETA_LOGO_SVG
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tt-green tracking-tighter leading-none">{settings.countyName}</h1>
                <p className="text-[10px] sm:text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 md:mt-1.5">Project Tracking System</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-3">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all duration-300 ${location.pathname === item.path
                      ? 'tt-bg-green text-white shadow-lg shadow-green-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:tt-green'
                      }`}
                  >
                    <NavIcon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-4">
              <Link
                to="/login"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl tt-bg-navy text-white font-black shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Lock size={18} />
                Staff Login
              </Link>
            </div>

            {/* Mobile hamburger button */}
            <button
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={28} />
            </button>
          </div>
        </header>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col animate-slide-in">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                  <div className="w-12 h-12 flex items-center justify-center bg-white rounded-xl overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      TAITA_TAVETA_LOGO_SVG
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-black tt-green leading-tight">{settings.countyName}</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Project Tracking</p>
                  </div>
                </Link>
                <button
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={22} />
                </button>
              </div>

              <nav className="flex-1 py-4 px-3 overflow-y-auto">
                {visibleNavItems.map((item) => {
                  const NavIcon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-[15px] mb-1 transition-all ${location.pathname === item.path
                        ? 'tt-bg-green text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      <NavIcon size={20} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl tt-bg-navy text-white font-black shadow-lg transition-all"
                >
                  <Lock size={18} />
                  Staff Login
                </Link>
              </div>
            </div>
          </div>
        )}

        <main className="flex-grow max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 md:py-10">
          {children}
        </main>

        <footer className="bg-slate-950 text-white mt-6 sm:mt-8 md:mt-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 tt-bg-yellow"></div>
          <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 md:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 md:gap-16 items-start">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                  <div className="bg-white p-2 rounded-xl sm:rounded-2xl shadow-2xl w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      TAITA_TAVETA_LOGO_SVG
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight">{settings.countyName}</h2>
                    <p className="text-sm font-bold tt-yellow uppercase tracking-[0.2em]">County Government</p>
                  </div>
                </div>
                <p className="text-base text-slate-300 max-w-xs leading-relaxed font-medium">
                  "Wumweri ni Ndiighi, Bhaisanga ni Kifumwa" - Unity is strength, brotherhood is glory.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-10">
                <div>
                  <h3 className="font-black tt-yellow uppercase text-xs tracking-[0.3em] mb-4 sm:mb-6 md:mb-8">Quick Access</h3>
                  <ul className="space-y-3 sm:space-y-4 md:space-y-5 text-sm text-slate-100/90 font-bold">
                    <li><Link to="/" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Wananchi Dashboard</Link></li>
                    <li><Link to="/projects" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Project Inventory</Link></li>
                    <li><Link to="/feedback" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Public Feedback</Link></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-black tt-yellow uppercase text-xs tracking-[0.3em] mb-4 sm:mb-6 md:mb-8">Support</h3>
                  <ul className="space-y-3 sm:space-y-4 md:space-y-5 text-sm text-slate-100/90 font-bold">
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Reporting Portal</a></li>
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> Help Desk</a></li>
                    <li><a href="#" className="hover:tt-yellow transition-all flex items-center gap-2 group"><div className="w-1.5 h-1.5 rounded-full bg-tt-green group-hover:bg-tt-yellow"></div> SDU FAQ</a></li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white/10 border border-white/20 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] backdrop-blur-md">
                  <h3 className="font-black text-white text-base sm:text-lg md:text-xl mb-3 tracking-tight">Service Delivery Unit</h3>
                  <p className="text-sm text-slate-300 mb-6 font-medium leading-relaxed">Official monitoring and evaluation division for county projects.</p>
                  <div className="flex items-center gap-3">
                    <div className="px-5 py-2.5 rounded-xl tt-bg-green text-white text-[10px] font-black shadow-xl shadow-green-900/50 uppercase tracking-widest">
                      LIVE MONITORING
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 sm:mt-12 sm:pt-8 md:mt-16 md:pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <span>© 2026 {settings.countyName}. Transparency through tracking.</span>
              <div className="flex gap-4 sm:gap-6 md:gap-8">
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
