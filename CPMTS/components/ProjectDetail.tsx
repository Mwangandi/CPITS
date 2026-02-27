import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFrappeProjectById } from '../services/frappeAPI';
import { Project, ProjectStatus, Feedback } from '../types';
import { getProjectSummary } from '../services/geminiService';
import { getDepartmentImage, FALLBACK_IMAGE } from '../constants';
import { MapPin, Calendar, Building2, Users, FileText, ArrowLeft, Send, Star, Share2, Edit3, Trash2, ShieldCheck, Mail, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { useAuth } from './Layout';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [project, setProject] = useState<Project | undefined>(undefined);
  
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [feedback, setFeedback] = useState({ userName: '', email: '', comment: '', rating: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [activeImage, setActiveImage] = useState<string>('');

const [loading, setLoading] = useState(true);

useEffect(() => {
  if (id) {
    setLoading(true);
    fetchFrappeProjectById(id).then(p => {
      if (p) {
        setProject(p);
        setActiveImage(
          p.images?.[0] || getDepartmentImage(p.department)
        );
      }
      setLoading(false);
    });
  }
}, [id]);

  useEffect(() => {
    if (project) {
      setLoadingAi(true);
      getProjectSummary(project).then(summary => {
        setAiSummary(summary);
        setLoadingAi(false);
      });
    }
  }, [project]);

  if (loading) return (
    <div className="text-center py-20 animate-fade-in">
      <div className="w-6 h-6 bg-tt-green rounded-full animate-ping mx-auto mb-4"></div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading project...</p>
    </div>
  );

  if (!project) return (
    <div className="text-center py-20 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-700">Project not found</h2>
      <button onClick={() => navigate('/projects')} className="mt-4 tt-bg-green text-white px-6 py-2 rounded-lg">Back to Projects</button>
    </div>
  );

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    const fallback = getDepartmentImage(project.department);
    if (target.src !== fallback) {
      target.src = fallback;
    } else {
      target.src = FALLBACK_IMAGE;
    }
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    const newFeedback: Feedback = {
      id: `f${Date.now()}`,
      projectId: project.id,
      userName: feedback.userName,
      email: feedback.email,
      comment: feedback.comment,
      rating: feedback.rating,
      timestamp: new Date().toISOString()
    };
    db.feedback.add(newFeedback);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFeedback({ userName: '', email: '', comment: '', rating: 5 });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you absolutely sure you want to delete "${project.title}"?`)) {
      try {
        const response = await fetch(
          `${REMOTE_URL}/api/resource/Project Investments/${project.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${API_KEY}:${API_SECRET}`,
            },
          }
        );
        if (response.ok) {
          navigate('/projects');
        } else {
          alert('Failed to delete project.');
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const getStatusStyles = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'tt-bg-green text-white';
      case ProjectStatus.ONGOING: return 'bg-tt-navy text-white';
      case ProjectStatus.STALLED: return 'tt-bg-orange text-white';
      case ProjectStatus.NOT_STARTED: return 'bg-slate-500 text-white';
      default: return 'bg-slate-700 text-white';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-3 text-slate-400 hover:text-green-600 font-black text-xs uppercase tracking-widest transition-all group">
          <div className="p-2 bg-white border border-slate-100 rounded-xl group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm"><ArrowLeft size={18} /></div>
          Back to Project Inventory
        </button>
        <div className="flex items-center gap-4">
          {hasPermission('edit_project') && (
            <button onClick={() => navigate(`/projects/${id}/edit`)} className="flex items-center gap-2 tt-bg-navy text-white px-6 py-3 rounded-2xl font-black hover:scale-[1.02] shadow-xl shadow-blue-100 transition-all active:scale-95"><Edit3 size={18} /> Modify Profile</button>
          )}
          {hasPermission('delete_project') && (
            <button onClick={handleDelete} className="flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-2xl font-black hover:bg-rose-600 shadow-xl shadow-rose-100 transition-all active:scale-95"><Trash2 size={18} /> Delete Project</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Gallery Section */}
          <div className="bg-white p-4 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="relative h-[400px] w-full rounded-[2.5rem] overflow-hidden group">
              <img 
                src={activeImage || getDepartmentImage(project.department)} 
                alt={project.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                onError={handleImageError}
              />
              <div className="absolute top-6 left-6">
                <span className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-800 shadow-lg border border-white">
                  Site Visual Capture
                </span>
              </div>
            </div>
            {project.images && project.images.length > 1 && (
              <div className="flex gap-4 mt-6 px-4 pb-4 overflow-x-auto pb-2 scrollbar-hide">
                {project.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(img)}
                    className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-4 transition-all ${activeImage === img ? 'tt-border-green scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" onError={handleImageError} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-3 h-full ${project.status === ProjectStatus.COMPLETED ? 'tt-bg-green' : project.status === ProjectStatus.ONGOING ? 'bg-tt-navy' : 'tt-bg-orange'}`}></div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="px-4 py-1.5 tt-bg-yellow text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">{project.department}</span>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${getStatusStyles(project.status)}`}>{project.status}</span>
            </div>
            <h1 className="text-4xl font-black text-slate-800 mb-8 leading-tight tracking-tight">{project.title}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              <DetailItem icon={<MapPin size={20} />} label="Location Details" value={`${project.ward}, ${project.subCounty}`} />
              <DetailItem icon={<Calendar size={20} />} label="Operational Period" value={`${project.startDate} to ${project.endDate}`} />
              <DetailItem icon={<Building2 size={20} />} label="Contracting Firm" value={project.contractor} />
              <DetailItem icon={<FileText size={20} />} label="Financial Cycle" value={project.financialYear} />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest text-xs">Project Narrative</h3>
              <p className="text-slate-600 leading-relaxed font-medium text-lg">{project.description}</p>
            </div>
            <div className="mt-12 pt-10 border-t border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl tt-bg-green flex items-center justify-center text-white shadow-lg shadow-green-100"><Star size={24} fill="white" /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">SDU Intelligence Report</h3>
              </div>
              <div className="bg-green-50/50 p-8 rounded-[2rem] border-2 border-green-100/50 italic text-green-900 text-base leading-relaxed font-bold">
                {loadingAi ? <div className="flex items-center gap-3"><div className="w-4 h-4 bg-tt-green rounded-full animate-ping"></div> Generating status analysis...</div> : aiSummary}
              </div>
            </div>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4"><div className="p-3 tt-bg-navy text-white rounded-2xl"><Users size={24} /></div> Project Management Committee</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {project.pmcMembers && project.pmcMembers.map((member) => (
                <div key={member.id} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center gap-5 hover:bg-white hover:shadow-lg transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center font-black text-tt-navy text-lg shadow-sm">{member.name.split(' ').map(n => n[0]).join('')}</div>
                  <div><p className="font-black text-slate-800 text-lg">{member.name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{member.role}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 sticky top-32">
            <div className="space-y-10">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Implementation Index</p>
                <div className="flex justify-between items-end mb-3"><span className="text-5xl font-black tt-green tracking-tighter">{project.progress}%</span><span className="text-[10px] font-black text-slate-300 uppercase pb-1 tracking-widest">Target 100%</span></div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner"><div className="tt-bg-green h-full shadow-lg shadow-green-200 transition-all duration-1000" style={{ width: `${project.progress}%` }}></div></div>
              </div>
              <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-6">
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project Budget</p><p className="font-black text-slate-800 text-xl tracking-tight">KES {(project.budget / 1000000).toFixed(1)}M</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Certified Exp.</p><p className="font-black tt-navy text-xl tracking-tight">KES {(project.expenditure / 1000000).toFixed(1)}M</p></div>
              </div>
              <div className="pt-8 border-t border-slate-100">
                <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><MessageCircle className="tt-green" size={20} /> Public Feedback</h4>
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <input type="text" required placeholder="Wananchi Name" className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all" value={feedback.userName} onChange={e => setFeedback({...feedback, userName: e.target.value})} />
                  <textarea required rows={4} placeholder="Enter your observations..." className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none resize-none transition-all" value={feedback.comment} onChange={e => setFeedback({...feedback, comment: e.target.value})} />
                  <button disabled={submitted} className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl ${submitted ? 'bg-green-50 text-tt-green border border-green-200' : 'tt-bg-green text-white shadow-green-100 hover:scale-[1.02] active:scale-95'}`}>{submitted ? <><ShieldCheck size={20} /> Feedback Sent</> : <><Send size={18} /> Submit Report</>}</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 p-5 rounded-[2rem] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
    <div className="text-slate-300 mt-1 transition-colors group-hover:tt-green">{icon}</div>
    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p><p className="text-base font-black text-slate-800 tracking-tight">{value}</p></div>
  </div>
);

export default ProjectDetail;
