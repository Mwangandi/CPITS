
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout, { useAuth } from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import AddProjectForm from './components/AddProjectForm';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import FeedbackList from './components/FeedbackList';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { Mail, Info, Shield } from 'lucide-react';
import TestFrappeConnection from './components/testAPI';

const ProtectedRoute: React.FC<{ children: React.ReactNode, permission?: string }> = ({ children, permission }) => {
  const { user, hasPermission } = useAuth();

  if (!user) return <Navigate to="/login" />;
  if (permission && !hasPermission(permission as any)) return <Navigate to="/" />;

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<ProjectList />} />

          <Route path="/projects/new" element={
            <ProtectedRoute permission="add_project">
              <AddProjectForm />
            </ProtectedRoute>
          } />

          {/* Wildcard routes to handle Frappe IDs that contain slashes e.g. 006/133/404/13-14 */}
          <Route path="/projects/*/edit" element={
            <ProtectedRoute permission="edit_project">
              <AddProjectForm />
            </ProtectedRoute>
          } />

          <Route path="/projects/*" element={<ProjectDetail />} />

          <Route path="/management/users" element={
            <ProtectedRoute permission="manage_users">
              <UserManagement />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute permission="manage_settings">
              <Settings />
            </ProtectedRoute>
          } />

          <Route path="/feedback" element={<FeedbackList />} />

          <Route path="/reports" element={<Reports />} />
          {/* This route is for testing the Frappe API connection */}
          <Route path="/test-api" element={<TestFrappeConnection />} />

          <Route path="/about" element={
            <AboutPage />
          } />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

const AboutPage: React.FC = () => {
  const { settings } = useAuth();
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-16 animate-fade-in">
      <div className="space-y-4 text-center">
        <h2 className="text-5xl font-black text-slate-800 tracking-tight">About PTS</h2>
        <div className="w-24 h-2 tt-bg-yellow rounded-full mx-auto"></div>
      </div>

      <p className="text-2xl text-slate-600 leading-relaxed font-medium text-center max-w-3xl mx-auto">
        The Project Tracking System (PTS) is an initiative by the {settings.countyName}
        to enhance transparency, accountability, and citizen engagement in the implementation of development projects.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all">
          <h3 className="text-xl font-black text-tt-navy mb-4 uppercase tracking-widest flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg tt-bg-navy flex items-center justify-center text-white"><Shield size={16} /></div>
            Transparency
          </h3>
          <p className="text-slate-500 font-bold text-base leading-relaxed">Providing real-time updates on project status and financial expenditure for public oversight.</p>
        </div>
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all">
          <h3 className="text-xl font-black text-tt-green mb-4 uppercase tracking-widest flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg tt-bg-green flex items-center justify-center text-white"><Info size={16} /></div>
            Feedback
          </h3>
          <p className="text-slate-500 font-bold text-base leading-relaxed">Enabling direct communication between residents and project implementation committees.</p>
        </div>
      </div>

      <div className="p-12 bg-white rounded-[4rem] border-4 border-tt-navy shadow-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 tt-bg-navy opacity-[0.03] -mr-32 -mt-32 rounded-full group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 tt-bg-yellow opacity-[0.03] -ml-20 -mb-20 rounded-full"></div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-5">
            <div className="p-4 tt-bg-navy text-white rounded-[1.5rem] shadow-xl shadow-blue-100">
              <Mail size={32} />
            </div>
            <div>
              <h3 className="text-sm font-black tt-navy uppercase tracking-[0.4em]">Official Inquiries</h3>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Service Delivery Unit Access</p>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="text-2xl text-slate-700 font-bold leading-tight">
              For system support, data verification requests, or official reporting, please reach out to our dedicated <span className="tt-navy">Service Delivery Unit (SDU)</span> technical team.
            </p>
          </div>

          <div className="pt-4">
            <a
              href={`mailto:${settings.sduEmail}`}
              className="inline-block text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter hover:tt-green transition-all border-b-8 border-tt-yellow pb-2 hover:border-tt-green"
            >
              {settings.sduEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;