
import React, { useMemo } from 'react';
import { Project, ProjectStatus } from '../types';
import { Calendar, ChevronRight, Clock, MapPin, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectTimelineProps {
  projects: Project[];
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ projects }) => {
  const navigate = useNavigate();

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [projects]);

  const groupedByYear = useMemo(() => {
    const groups: { [key: string]: Project[] } = {};
    sortedProjects.forEach(p => {
      if (!groups[p.financialYear]) groups[p.financialYear] = [];
      groups[p.financialYear].push(p);
    });
    return groups;
  }, [sortedProjects]);

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'tt-bg-green';
      case ProjectStatus.ONGOING: return 'tt-bg-navy';
      case ProjectStatus.STALLED: return 'tt-bg-orange';
      case ProjectStatus.PLANNING: return 'tt-bg-yellow';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="space-y-16 animate-fade-in relative pb-10">
      {/* Central Timeline Spine for Desktop */}
      <div className="absolute left-1/2 top-0 bottom-0 w-1 tt-bg-green opacity-10 hidden lg:block -translate-x-1/2 rounded-full"></div>

      {/* Fix: Explicitly casting Object.entries result to ensure fyProjects is correctly typed as Project[] to resolve unknown error */}
      {(Object.entries(groupedByYear) as [string, Project[]][]).map(([fy, fyProjects], fyIdx) => (
        <div key={fy} className="space-y-12 relative">
          {/* FY Header Overlay */}
          <div className="flex justify-center sticky top-32 z-10 py-4">
            <div className="px-8 py-3 tt-bg-navy text-white rounded-full shadow-2xl border-4 border-white font-black text-sm uppercase tracking-[0.3em]">
              Cycle: {fy}
            </div>
          </div>

          <div className="space-y-8">
            {fyProjects.map((project, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <div key={project.id} className="relative flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-0">
                  {/* Desktop Alternating layout */}
                  <div className={`w-full lg:w-1/2 px-4 lg:px-12 flex ${isEven ? 'lg:justify-end' : 'lg:justify-start lg:order-2'}`}>
                    <div 
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 hover:shadow-2xl transition-all cursor-pointer group hover:-translate-y-2 relative overflow-hidden"
                    >
                      {/* Status Accent Bar */}
                      <div className={`absolute top-0 left-0 w-2 h-full ${getStatusColor(project.status)}`}></div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{project.department}</span>
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-widest ${getStatusColor(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                        
                        <h4 className="text-xl font-black text-slate-800 leading-tight group-hover:tt-green transition-colors">
                          {project.title}
                        </h4>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                           <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px]">
                              <Calendar size={12} />
                              {new Date(project.startDate).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                           </div>
                           <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px]">
                              <MapPin size={12} />
                              <span className="truncate">{project.ward}</span>
                           </div>
                        </div>

                        <div className="pt-2">
                           <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase mb-1">
                              <span>Progress</span>
                              <span className="tt-green">{project.progress}%</span>
                           </div>
                           <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="tt-bg-green h-full" style={{ width: `${project.progress}%` }}></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="relative z-10 w-10 h-10 rounded-full bg-white border-4 tt-border-green flex items-center justify-center shadow-lg lg:order-1">
                     <div className={`w-3 h-3 rounded-full ${getStatusColor(project.status)}`}></div>
                  </div>

                  {/* Placeholder for alternating layout */}
                  <div className="hidden lg:block lg:w-1/2 lg:order-3"></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sortedProjects.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
           <Clock size={48} className="mx-auto text-slate-200 mb-4" />
           <p className="text-slate-400 font-black uppercase tracking-widest">No historical data in current view</p>
        </div>
      )}
    </div>
  );
};

export default ProjectTimeline;
