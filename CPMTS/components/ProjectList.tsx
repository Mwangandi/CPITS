
import React, { useState, useEffect, useMemo } from 'react';
import { DEPARTMENTS, SUB_COUNTIES, getDepartmentImage, FALLBACK_IMAGE } from '../constants';
import { Project, ProjectStatus } from '../types';
import { Search, MapPin, Building2, Plus, LayoutGrid, List, ChevronRight, FileUp, Map as MapIcon, History } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './Layout';
import ImportModal from './ImportModal';
import ProjectMap from './ProjectMap';
import ProjectTimeline from './ProjectTimeline';
import { fetchFrappeProjects } from '../services/frappeAPI';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSubCounty, setSelectedSubCounty] = useState('All');
  const [selectedFY, setSelectedFY] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map' | 'timeline'>('grid');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchFrappeProjects();
        setProjects(data);
      } catch (err) {
        console.error("Failed to load project: ", err);
      }
    };
    load();
  }, []);

  const financialYears = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];
    return Array.from(new Set(projects.map(p => p.financialYear)))
      .filter(Boolean)
      .sort()
      .reverse();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (!project) return false;
      const title = project.title || '';
      const desc = project.description || '';
      const id = project.id || '';

      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'All' || project.department === selectedDept;
      const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus;
      const matchesSubCounty = selectedSubCounty === 'All' || project.subCounty === selectedSubCounty;
      const matchesFY = selectedFY === 'All' || project.financialYear === selectedFY;

      return matchesSearch && matchesDept && matchesStatus && matchesSubCounty && matchesFY;
    });
  }, [projects, searchTerm, selectedDept, selectedStatus, selectedSubCounty, selectedFY]);

  const handleImportSuccess = async (count: number) => {
    try {
      const data = await fetchFrappeProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to reload after import:", err);
    }
  };

  const getStatusStyles = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'tt-bg-green text-white';
      case ProjectStatus.ONGOING: return 'bg-tt-navy text-white';
      case ProjectStatus.STALLED: return 'tt-bg-orange text-white';
      case ProjectStatus.PLANNING: return 'tt-bg-yellow text-slate-900';
      case ProjectStatus.NOT_STARTED: return 'bg-slate-500 text-white';
      default: return 'bg-slate-700 text-white';
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, department: string) => {
    const target = e.currentTarget;
    const fallback = getDepartmentImage(department);
    if (target.src !== fallback) {
      target.src = fallback;
    } else {
      target.src = FALLBACK_IMAGE;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 mb-4">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Project Inventory</h2>
          <p className="text-slate-500 font-bold text-lg">Detailed catalog of all county-wide developments.</p>
        </div>
        {/* View Modes */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-1.5 flex gap-1 shadow-sm overflow-x-auto">
            <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'tt-bg-green text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Grid View"><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('table')} className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'tt-bg-green text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Table View"><List size={20} /></button>
            <button onClick={() => setViewMode('timeline')} className={`p-3 rounded-xl transition-all ${viewMode === 'timeline' ? 'tt-bg-green text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Timeline View"><History size={20} /></button>
            <button onClick={() => setViewMode('map')} className={`p-3 rounded-xl transition-all ${viewMode === 'map' ? 'tt-bg-green text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Map View"><MapIcon size={20} /></button>
          </div>

          <div className="flex gap-3">
            {hasPermission('import_projects') && (
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 tt-bg-navy text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"><FileUp size={20} /> Bulk Import</button>
            )}
            {hasPermission('add_project') && (
              <button onClick={() => navigate('/projects/new')} className="flex items-center justify-center gap-2 tt-bg-green text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all"><Plus size={20} /> Add Project</button>
            )}
          </div>
        </div>
      </div>
      {/* ===================================== FILTERS ======================================================= */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Name, ID, or Keywords..." className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-tt-green bg-slate-50/50 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Department</label>
            <select className="w-full p-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-sm outline-none focus:border-tt-green transition-all" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="All">All Sectors</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Sub-County</label>
            <select className="w-full p-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-sm outline-none focus:border-tt-green transition-all" value={selectedSubCounty} onChange={(e) => setSelectedSubCounty(e.target.value)}>
              <option value="All">All Regions</option>
              {SUB_COUNTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Cycle</label>
            <select className="w-full p-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-sm outline-none focus:border-tt-green transition-all" value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)}>
              <option value="All">All Years</option>
              {financialYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Status</label>
            <select className="w-full p-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-sm outline-none focus:border-tt-green transition-all" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="All">Any Status</option>
              {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
      {/* ==================================================================================== */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block group">
              <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-lg hover:shadow-2xl transition-all h-full flex flex-col hover:-translate-y-2 border-b-8 border-b-tt-green/10 group-hover:border-b-tt-green">
                <div className="relative h-56 overflow-hidden bg-slate-100">
                  {project.images && project.images.length > 0 && project.images[0] ? (
                    <img
                      src={project.images[0]}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      onError={(e) => {
                        // Hide broken image and show placeholder
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-300"><svg class="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg></div>';
                        }
                      }}
                    />
                  ) : (
                    // No image from Frappe - show placeholder
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-6 left-6"><span className="bg-white/95 backdrop-blur-md text-slate-800 text-[10px] font-black px-3 py-1.5 rounded-xl border border-white shadow-lg uppercase tracking-widest">REF: {project.id}</span></div>
                  <div className="absolute top-6 right-6"><span className={`px-4 py-1.5 rounded-xl text-[10px] font-black shadow-lg uppercase tracking-widest border border-white/20 ${getStatusStyles(project.status)}`}>{project.status}</span></div>
                </div>
                <div className="p-8 space-y-6 flex-grow">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black tt-green uppercase tracking-[0.2em]">{project.department}</p>
                    <h3 className="font-black text-2xl text-slate-800 leading-tight group-hover:tt-navy transition-colors line-clamp-2 min-h-[4rem]">{project.title}</h3>
                  </div>
                  <div className="space-y-3 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-sm"><MapPin size={16} /> <span className="truncate">{project.ward}, {project.subCounty}</span></div>
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-sm"><Building2 size={16} /> <span className="truncate">{project.contractor}</span></div>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Implementation</span> <span className="tt-green font-black">{project.progress}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner"><div className="tt-bg-green h-full" style={{ width: `${project.progress}%` }}></div></div>
                  </div>
                </div>
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center group-hover:bg-white transition-colors">
                  <div><p className="text-slate-400 font-black uppercase text-[9px] tracking-widest mb-1">Total Budget</p><p className="font-black text-slate-800 text-lg">KES {(project.budget / 1000000).toFixed(1)}M</p></div>
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center tt-green group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm group-hover:rotate-45"><ChevronRight size={24} /></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Reference</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Detail</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Budget</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Progress</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map(project => (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6"><span className="font-black text-slate-400 text-xs">#{project.id}</span></td>
                    <td className="px-8 py-6"><div><p className="font-black text-slate-800 text-base leading-tight group-hover:tt-green transition-colors">{project.title}</p><p className="text-xs text-slate-400 font-bold mt-1 tracking-wide">{project.ward}, {project.subCounty}</p></div></td>
                    <td className="px-8 py-6"><div><span className="text-sm font-black text-slate-800">KES {(project.budget / 1000000).toFixed(1)}M</span></div></td>
                    <td className="px-8 py-6 min-w-[180px]"><div className="flex items-center gap-4"><div className="flex-grow bg-slate-100 rounded-full h-2 shadow-inner"><div className="tt-bg-green h-full rounded-full" style={{ width: `${project.progress}%` }}></div></div><span className="text-xs font-black tt-green">{project.progress}%</span></div></td>
                    <td className="px-8 py-6"><span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm ${getStatusStyles(project.status)}`}>{project.status}</span></td>
                    <td className="px-8 py-6 text-center"><button onClick={() => navigate(`/projects/${project.id}`)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:tt-bg-green hover:text-white rounded-2xl transition-all shadow-sm group-hover:scale-110"><ChevronRight size={20} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <ProjectMap projects={filteredProjects} />
      )}

      {viewMode === 'timeline' && (
        <ProjectTimeline projects={filteredProjects} />
      )}

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportSuccess} />
    </div>
  );
};

export default ProjectList;
