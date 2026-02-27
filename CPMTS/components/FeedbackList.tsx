
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/database';
import { Feedback, Project } from '../types';
import { analyzeFeedback } from '../services/geminiService';
import { 
  MessageSquare, Star, Calendar, User, 
  Search, Filter, BrainCircuit, Loader2, 
  ArrowRight, Quote, CheckCircle2, AlertCircle,
  Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const FeedbackList: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setFeedbacks(db.feedback.getAll());
    setProjects(db.projects.getAll());
  }, []);

  const getProjectTitle = (id: string) => {
    return projects.find(p => p.id === id)?.title || 'Unknown Project';
  };

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(f => 
      f.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProjectTitle(f.projectId).toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedbacks, searchTerm, projects]);

  const handleAnalyze = async () => {
    if (filteredFeedbacks.length === 0) return;
    setIsAnalyzing(true);
    try {
      const summary = await analyzeFeedback(filteredFeedbacks);
      setAiAnalysis(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const averageRating = useMemo(() => {
    if (feedbacks.length === 0) return 0;
    return (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 mb-4">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Citizen Feedback Hub</h2>
          <p className="text-slate-500 font-bold text-lg">Direct voices from the Taita Taveta community.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="text-right px-4 border-r border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Satisfaction</p>
            <div className="flex items-center justify-end gap-2">
              <span className="text-2xl font-black text-slate-800">{averageRating}</span>
              <Star size={18} className="text-tt-yellow fill-tt-yellow" />
            </div>
          </div>
          <div className="text-right px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Submissions</p>
            <p className="text-2xl font-black tt-green">{feedbacks.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Filter feedback by keywords, user, or project name..." 
                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-6">
            {filteredFeedbacks.length > 0 ? (
              filteredFeedbacks.map((f) => (
                <div key={f.id} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-lg hover:shadow-xl transition-all group">
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl tt-bg-navy text-white flex items-center justify-center font-black">
                          {f.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800">{f.userName}</p>
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            <Calendar size={12} />
                            {new Date(f.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < f.rating ? "text-tt-yellow fill-tt-yellow" : "text-slate-200"} />
                        ))}
                      </div>
                    </div>

                    <div className="relative p-6 bg-slate-50 rounded-3xl italic text-slate-600 font-medium border-l-4 border-tt-green">
                      <Quote className="absolute -top-2 -left-2 text-slate-100" size={40} />
                      <p className="relative z-10 leading-relaxed text-lg">"{f.comment}"</p>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="text-slate-300" size={18} />
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Regarding Project</p>
                          <Link to={`/projects/${f.projectId}`} className="text-sm font-black tt-navy hover:tt-green transition-colors line-clamp-1">{getProjectTitle(f.projectId)}</Link>
                        </div>
                      </div>
                      <Link 
                        to={`/projects/${f.projectId}`}
                        className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-tt-green transition-colors"
                      >
                        Visit Project Page
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-[3rem] border border-slate-100 p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare size={32} className="text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800">No Citizen Voices Recorded</h3>
                <p className="text-slate-400 font-bold max-w-xs mx-auto">Submitted project feedback will appear here for public monitoring.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border-b-8 border-tt-green relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
              <BrainCircuit size={100} className="text-tt-yellow" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tt-green/20 text-tt-green border border-tt-green/30 text-[10px] font-black uppercase tracking-widest mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-tt-green animate-pulse"></div>
                AI Governance Insights
              </div>
              
              <h3 className="text-2xl font-black text-white mb-4">Sentiment Intelligence</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Use Gemini to process collective feedback and generate executive summaries for faster government response.
              </p>

              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || filteredFeedbacks.length === 0}
                className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-900/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <><BrainCircuit size={20} /> Generate Analysis</>}
              </button>

              {aiAnalysis && (
                <div className="mt-8 space-y-6 animate-in fade-in duration-700">
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 font-mono text-[11px] leading-relaxed text-blue-100/80">
                    <p className="mb-4 flex items-center gap-2 text-tt-yellow font-black uppercase tracking-tighter">
                      <CheckCircle2 size={14} /> Execution Summary:
                    </p>
                    {aiAnalysis}
                  </div>
                  <button 
                    onClick={() => setAiAnalysis('')}
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Clear Analysis
                  </button>
                </div>
              )}

              {!aiAnalysis && !isAnalyzing && (
                <div className="mt-10 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Trends</p>
                    <CheckCircle2 size={16} className="mx-auto text-tt-green" />
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Actions</p>
                    <AlertCircle size={16} className="mx-auto text-tt-yellow" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-lg">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">M&E Standards</h4>
            <div className="space-y-4">
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Verified Public Submissions" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Direct Linkage to Project IDs" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Real-time SDU Oversight" />
              <StandardItem icon={<CheckCircle2 size={16} className="text-tt-green" />} text="Transparency Compliance" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StandardItem: React.FC<{ icon: React.ReactNode, text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
    {icon}
    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{text}</span>
  </div>
);

export default FeedbackList;
