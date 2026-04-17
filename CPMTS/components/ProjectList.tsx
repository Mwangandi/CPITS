
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DEPARTMENTS, SUB_COUNTIES, SUB_COUNTY_WARDS, getDepartmentImage, FALLBACK_IMAGE } from '../constants';
import { Project, ProjectStatus } from '../types';
import { Search, MapPin, Building2, Plus, LayoutGrid, List, ChevronRight, FileUp, Map as MapIcon, History, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './Layout';
import ImportModal from './ImportModal';
import ProjectMap from './ProjectMap';
import ProjectTimeline from './ProjectTimeline';
import { fetchProjectsForList, fetchFirstGalleryImage, fetchAuthenticatedImageUrl, fetchAllFeedback, fetchProjectIdsWithGallery } from '../services/frappeAPI';
import type { FrappeFilters, PaginatedProjects } from '../services/frappeAPI';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';

// Component that fetches gallery image for a project card with lazy loading
const ProjectCardImage: React.FC<{ projectId: string; alt: string; className: string }> = ({ projectId, alt, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Only start fetching when the card scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading slightly before visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch only the first gallery image path (lightweight — no image data yet)
  const { data: firstImagePath = '' } = useQuery({
    queryKey: ['gallery-first', projectId],
    queryFn: () => fetchFirstGalleryImage(projectId),
    staleTime: 1000 * 60 * 10,
    retry: 1,
    enabled: isVisible,
  });

  const [blobUrl, setBlobUrl] = React.useState('');

  React.useEffect(() => {
    if (!firstImagePath) return;
    let cancelled = false;
    fetchAuthenticatedImageUrl(firstImagePath, { w: 400, q: 65 })
      .then(url => {
        if (!cancelled && url) setBlobUrl(url);
      });
    return () => { cancelled = true; };
  }, [firstImagePath]);

  const placeholder = (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
      <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    </div>
  );

  if (!blobUrl) return placeholder;
  return <img ref={containerRef as any} src={blobUrl} alt={alt} className={className} />;
};

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSubCounty, setSelectedSubCounty] = useState('All');
  const [selectedWard, setSelectedWard] = useState('All');
  const [selectedFY, setSelectedFY] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map' | 'timeline'>('grid');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [loadedPages, setLoadedPages] = useState<number[]>([0]);
  const loadTriggerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Debounce search input (400ms)
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setLoadedPages([0]); // Reset to first page on new search
    }, 400);
  }, []);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (value: string) => {
      setter(value);
      setLoadedPages([0]);
    };
  }, []);

  // When sub-county changes, reset ward selection
  const handleSubCountyChange = useCallback((value: string) => {
    setSelectedSubCounty(value);
    setSelectedWard('All');
    setLoadedPages([0]);
  }, []);

  // Available wards based on selected sub-county
  const availableWards = useMemo(() => {
    if (selectedSubCounty === 'All') {
      return Object.values(SUB_COUNTY_WARDS).flat().sort((a, b) => a.localeCompare(b));
    }
    return SUB_COUNTY_WARDS[selectedSubCounty] || [];
  }, [selectedSubCounty]);

  // Build server-side filters
  const serverFilters: FrappeFilters = useMemo(() => {
    const f: FrappeFilters = {};
    if (debouncedSearch) f.search = debouncedSearch;
    if (selectedDept !== 'All') f.department = selectedDept;
    if (selectedStatus !== 'All') f.status = selectedStatus;
    if (selectedFY !== 'All') f.financial_year = selectedFY;
    if (selectedWard !== 'All') {
      // Specific ward selected — exact match
      f.ward = selectedWard;
    } else if (selectedSubCounty !== 'All') {
      // Sub-county selected — filter by all its wards
      f.wards = SUB_COUNTY_WARDS[selectedSubCounty] || [];
    }
    return f;
  }, [debouncedSearch, selectedDept, selectedStatus, selectedFY, selectedWard, selectedSubCounty]);

  // Fetch all loaded pages with React Query
  const pageResults = useQueries({
    queries: loadedPages.map(page => ({
      queryKey: ['projects:list', page, serverFilters] as const,
      queryFn: (): Promise<PaginatedProjects> => fetchProjectsForList(page, serverFilters),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    })),
  });

  const isLoading = pageResults.some(r => r.isLoading);
  const error = pageResults.find(r => r.error)?.error;

  // Merge all pages' projects into one array
  const allProjects = useMemo(() => {
    const merged: Project[] = [];
    for (const result of pageResults) {
      const data = result.data as PaginatedProjects | undefined;
      if (data?.projects) {
        merged.push(...data.projects);
      }
    }
    return merged;
  }, [pageResults.map(r => r.data)]);

  // Check if the last loaded page has more
  const lastPageData = pageResults[pageResults.length - 1]?.data as PaginatedProjects | undefined;
  const hasMore = lastPageData?.hasMore ?? false;

  // Infinite scroll: observe a trigger element at the bottom
  useEffect(() => {
    const el = loadTriggerRef.current;
    if (!el || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          const nextPage = Math.max(...loadedPages) + 1;
          setIsLoadingMore(true);
          setLoadedPages(prev => [...prev, nextPage]);
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadedPages]);

  // Reset loadingMore flag when new page data arrives
  useEffect(() => {
    if (!isLoading) setIsLoadingMore(false);
  }, [isLoading]);

  // Fetch set of project IDs that have gallery images — used to sort them first
  const { data: galleryProjectIds = new Set<string>() } = useQuery({
    queryKey: ['gallery:project-ids'],
    queryFn: fetchProjectIdsWithGallery,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch all feedback once and build a projectId → count map
  const { data: allFeedback = [] } = useQuery({
    queryKey: ['feedback:all'],
    queryFn: fetchAllFeedback,
    staleTime: 1000 * 60 * 5,
  });
  const feedbackCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of allFeedback) {
      if (f.project) map[f.project] = (map[f.project] ?? 0) + 1;
    }
    return map;
  }, [allFeedback]);

  const projects = allProjects;
  const currentPageCount = loadedPages.length;
  const financialYears = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];
    return Array.from(new Set(projects.map(p => p.financialYear)))
      .filter(Boolean)
      .sort()
      .reverse();
  }, [projects]);

  // Client-side filtering on top of server results for instant feedback
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (!project) return false;
      const title = project.title || '';
      const desc = project.description || '';
      const id = project.id || '';

      const matchesSearch = !searchTerm ||
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'All' || project.department === selectedDept;
      const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus;
      const matchesSubCounty = selectedSubCounty === 'All' || project.subCounty === selectedSubCounty;
      const matchesWard = selectedWard === 'All' || (project.ward && project.ward.toLowerCase().includes(selectedWard.toLowerCase()));
      const matchesFY = selectedFY === 'All' || project.financialYear === selectedFY;

      return matchesSearch && matchesDept && matchesStatus && matchesSubCounty && matchesWard && matchesFY;
    });
  }, [projects, searchTerm, selectedDept, selectedStatus, selectedSubCounty, selectedFY]);

  const handleImportSuccess = async (count: number) => {
    try {
      // Invalidate list cache to refetch
      queryClient.invalidateQueries({ queryKey: ['projects:list'] });
    } catch (err) {
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
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4 sm:gap-6 mb-2 sm:mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 tracking-tight">Project Inventory</h2>
          <p className="text-slate-500 font-bold text-sm sm:text-base lg:text-lg">Detailed catalog of all county-wide developments.</p>
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
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 sm:gap-4 lg:gap-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Name, ID, or Keywords..." className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 lg:py-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 focus:border-tt-green bg-slate-50/50 focus:bg-white outline-none font-bold text-xs sm:text-sm text-slate-700 transition-all shadow-sm" value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Department</label>
            <select className="w-full p-2.5 sm:p-3 lg:p-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-xs sm:text-sm outline-none focus:border-tt-green transition-all" value={selectedDept} onChange={(e) => handleFilterChange(setSelectedDept)(e.target.value)}>
              <option value="All">All Sectors</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Sub-County</label>
            <select className="w-full p-2.5 sm:p-3 lg:p-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-xs sm:text-sm outline-none focus:border-tt-green transition-all" value={selectedSubCounty} onChange={(e) => handleSubCountyChange(e.target.value)}>
              <option value="All">All Regions</option>
              {SUB_COUNTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Ward</label>
            <select className="w-full p-2.5 sm:p-3 lg:p-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-xs sm:text-sm outline-none focus:border-tt-green transition-all" value={selectedWard} onChange={(e) => handleFilterChange(setSelectedWard)(e.target.value)}>
              <option value="All">All Wards</option>
              {availableWards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Cycle</label>
            <select className="w-full p-2.5 sm:p-3 lg:p-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-xs sm:text-sm outline-none focus:border-tt-green transition-all" value={selectedFY} onChange={(e) => handleFilterChange(setSelectedFY)(e.target.value)}>
              <option value="All">All Years</option>
              {financialYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 sm:mb-2 ml-1">Status</label>
            <select className="w-full p-2.5 sm:p-3 lg:p-3.5 rounded-xl sm:rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-xs sm:text-sm outline-none focus:border-tt-green transition-all" value={selectedStatus} onChange={(e) => handleFilterChange(setSelectedStatus)(e.target.value)}>
              <option value="All">Any Status</option>
              {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

        </div>
      </div>
      {/* ==================================================================================== */}
      {viewMode === 'grid' && (
        <>
          {loadedPages.map((page, pageIdx) => {
            const pageData = pageResults[pageIdx]?.data as PaginatedProjects | undefined;
            const pageProjects = pageData?.projects || [];
            // Apply client-side filtering
            const filtered = pageProjects.filter(project => {
              if (!project) return false;
              const title = project.title || '';
              const desc = project.description || '';
              const id = project.id || '';
              const matchesSearch = !searchTerm || title.toLowerCase().includes(searchTerm.toLowerCase()) || desc.toLowerCase().includes(searchTerm.toLowerCase()) || id.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesDept = selectedDept === 'All' || project.department === selectedDept;
              const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus;
              const matchesSubCounty = selectedSubCounty === 'All' || project.subCounty === selectedSubCounty;
              const matchesWard = selectedWard === 'All' || (project.ward && project.ward.toLowerCase().includes(selectedWard.toLowerCase()));
              const matchesFY = selectedFY === 'All' || project.financialYear === selectedFY;
              return matchesSearch && matchesDept && matchesStatus && matchesSubCounty && matchesWard && matchesFY;
            });
            // Sort: projects with gallery images first
            const sorted = galleryProjectIds.size > 0
              ? [...filtered].sort((a, b) => {
                const aHas = galleryProjectIds.has(a.id) ? 0 : 1;
                const bHas = galleryProjectIds.has(b.id) ? 0 : 1;
                return aHas - bHas;
              })
              : filtered;
            if (sorted.length === 0 && pageIdx > 0) return null;
            return (
              <React.Fragment key={page}>
                {pageIdx > 0 && (
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4 py-2 bg-slate-100 rounded-full">
                      Page {page + 1}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {sorted.map(project => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="block group">
                      <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-lg hover:shadow-2xl transition-all h-full flex flex-col hover:-translate-y-2 border-b-8 border-b-tt-green/10 group-hover:border-b-tt-green">
                        <div className="relative h-40 sm:h-48 md:h-56 overflow-hidden bg-slate-100">
                          <ProjectCardImage
                            projectId={project.id}
                            alt={project.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                          />
                          <div className="absolute top-4 left-4 sm:top-6 sm:left-6"><span className="bg-white/95 backdrop-blur-md text-slate-800 text-[9px] sm:text-[10px] font-black px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-white shadow-lg uppercase tracking-widest">REF: {project.id}</span></div>
                          <div className="absolute top-4 right-4 sm:top-6 sm:right-6"><span className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black shadow-lg uppercase tracking-widest border border-white/20 ${getStatusStyles(project.status)}`}>{project.status}</span></div>
                        </div>
                        <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 flex-grow">
                          <div className="space-y-1.5 sm:space-y-2">
                            <p className="text-[10px] sm:text-[11px] font-black tt-green uppercase tracking-[0.2em]">{project.department}</p>
                            <h3 className="font-black text-lg sm:text-xl md:text-2xl text-slate-800 leading-tight group-hover:tt-navy transition-colors line-clamp-2 min-h-[3rem] sm:min-h-[4rem]">{project.title}</h3>
                          </div>
                          <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-6 border-t border-slate-50">
                            <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm"><MapPin size={14} /> <span className="truncate">{project.ward}, {project.subCounty}</span></div>
                            {project.financialYear && <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm"><History size={14} /> <span>{project.financialYear}</span></div>}
                            {project.contractor && project.contractor !== 'TBD' && project.contractor !== 'n/a' && (<div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm"><Building2 size={14} /> <span className="truncate">{project.contractor}</span></div>)}
                          </div>
                          <div className="pt-4 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Implementation</span> <span className="tt-green font-black">{project.progress}%</span></div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner"><div className="tt-bg-green h-full" style={{ width: `${project.progress}%` }}></div></div>
                          </div>
                        </div>
                        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center group-hover:bg-white transition-colors">
                          <div className="flex items-center gap-4 sm:gap-5">
                            <div><p className="text-slate-400 font-black uppercase text-[8px] sm:text-[9px] tracking-widest mb-0.5 sm:mb-1">Total Budget</p><p className="font-black text-slate-800 text-base sm:text-lg">KES {(project.budget / 1000000).toFixed(1)}M</p></div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm" title="Citizen feedback submissions">
                              <MessageSquare size={13} className="text-tt-green" />
                              <span className="text-[11px] font-black text-slate-700">{feedbackCountMap[project.id] ?? 0}</span>
                            </div>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-slate-100 flex items-center justify-center tt-green group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm group-hover:rotate-45"><ChevronRight size={20} /></div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </React.Fragment>
            );
          })}

          {/* Scroll trigger for loading more */}
          <div ref={loadTriggerRef} className="h-1" />

          {/* Loading indicator */}
          {(isLoading || isLoadingMore) && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="w-3 h-3 bg-tt-green rounded-full animate-pulse" />
              <span className="text-sm font-bold text-slate-500">Loading more projects...</span>
            </div>
          )}

          {/* End of results */}
          {!hasMore && !isLoading && projects.length > 0 && (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Showing all {filteredProjects.length} projects
              </span>
            </div>
          )}
        </>
      )}

      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Reference</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Project Detail</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Budget</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Progress</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Status</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map(project => (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6"><span className="font-black text-slate-400 text-xs">#{project.id}</span></td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6"><div><p className="font-black text-slate-800 text-sm sm:text-base leading-tight group-hover:tt-green transition-colors">{project.title}</p><p className="text-[10px] sm:text-xs text-slate-400 font-bold mt-1 tracking-wide">{project.ward}, {project.subCounty}</p></div></td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6"><div><span className="text-xs sm:text-sm font-black text-slate-800">KES {(project.budget / 1000000).toFixed(1)}M</span></div></td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 min-w-[140px] sm:min-w-[180px]"><div className="flex items-center gap-3 sm:gap-4"><div className="flex-grow bg-slate-100 rounded-full h-2 shadow-inner"><div className="tt-bg-green h-full rounded-full" style={{ width: `${project.progress}%` }}></div></div><span className="text-xs font-black tt-green">{project.progress}%</span></div></td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6"><span className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm ${getStatusStyles(project.status)}`}>{project.status}</span></td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-center"><button onClick={() => navigate(`/projects/${project.id}`)} className="p-2.5 sm:p-3 bg-white border border-slate-100 text-slate-400 hover:tt-bg-green hover:text-white rounded-xl sm:rounded-2xl transition-all shadow-sm group-hover:scale-110"><ChevronRight size={18} /></button></td>
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

      {/* Status bar */}
      <div className="flex items-center justify-between mt-6 px-4 sm:px-6 lg:px-8 py-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          {currentPageCount > 1 && (
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {currentPageCount} pages loaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm font-bold text-rose-500">Error loading projects</span>
          )}
          <span className="text-xs sm:text-sm font-bold text-slate-600">
            {filteredProjects.length} projects shown
          </span>
        </div>
      </div>

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportSuccess} />
    </div>
  );
};

export default ProjectList;
