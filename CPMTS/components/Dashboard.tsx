import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectStatus } from '../types';
import { SUB_COUNTIES, WARDS } from '../constants';
import { fetchFrappeProjects } from '../services/frappeAPI';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  Briefcase, CheckCircle, Clock, AlertTriangle, TrendingUp,
  Calendar, LayoutDashboard, Building2, MapPin, Navigation,
  Coins, Search, ArrowRight, Circle
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubCountyTab, setActiveSubCountyTab] = useState<string>(SUB_COUNTIES[0]);

  // ── Fetch from Frappe API ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchFrappeProjects();
        setProjects(data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load projects from Frappe.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Financial Years ────────────────────────────────────────────────────────
  const financialYears = useMemo(() =>
    Array.from(new Set(projects.map(p => p.financialYear))).filter(Boolean).sort().reverse(),
    [projects]
  );

  const [selectedFY, setSelectedFY] = useState<string>('');

  useEffect(() => {
    if (financialYears.length > 0 && !selectedFY) {
      setSelectedFY(financialYears[0]);
    }
  }, [financialYears]);

  // ── Filtered Projects ──────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!selectedFY || selectedFY === 'All') return projects;
    return projects.filter(p => p.financialYear === selectedFY);
  }, [selectedFY, projects]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const getStatusStats = (status: ProjectStatus) => {
      const projs = filteredProjects.filter(p => p.status === status);
      return {
        count: projs.length,
        budget: projs.reduce((sum, p) => sum + p.budget, 0)
      };
    };
    return {
      totalCount: filteredProjects.length,
      totalBudget: filteredProjects.reduce((sum, p) => sum + p.budget, 0),
      completed: getStatusStats(ProjectStatus.COMPLETED),
      ongoing: getStatusStats(ProjectStatus.ONGOING),
      stalled: getStatusStats(ProjectStatus.STALLED),
      notStarted: getStatusStats(ProjectStatus.NOT_STARTED),
    };
  }, [filteredProjects]);

  // ── Pie Data ───────────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const rawData = [
      { name: 'Completed', value: stats.completed.count, color: '#00843D' },
      { name: 'Ongoing', value: stats.ongoing.count, color: '#003399' },
      { name: 'Stalled', value: stats.stalled.count, color: '#F37021' },
      { name: 'Not Started', value: stats.notStarted.count, color: '#64748b' },
    ].filter(d => d.value > 0);

    return rawData.map(item => ({
      ...item,
      percentage: stats.totalCount > 0
        ? ((item.value / stats.totalCount) * 100).toFixed(1)
        : '0'
    }));
  }, [stats]);

  // ── Departmental Analysis ──────────────────────────────────────────────────
  const departmentalAnalysis = useMemo(() => {
    const departments = Array.from(new Set(projects.map(p => p.department)));
    return departments.map(dept => {
      const deptProjects = filteredProjects.filter(p => p.department === dept);
      const totalBudget = deptProjects.reduce((sum, p) => sum + p.budget, 0);
      return { name: dept, total: deptProjects.length, budgetM: totalBudget / 1000000 };
    }).filter(d => d.total > 0).sort((a, b) => b.budgetM - a.budgetM);
  }, [filteredProjects, projects]);

  const departmentDetailedAnalysis = useMemo(() => {
    const departments = Array.from(new Set(projects.map(p => p.department)));
    return departments.map(deptName => {
      const deptProjects = filteredProjects.filter(p => p.department === deptName);
      const totalBudget = deptProjects.reduce((sum, p) => sum + p.budget, 0);
      const totalExpenditure = deptProjects.reduce((sum, p) => sum + p.expenditure, 0);
      const avgProgress = deptProjects.length > 0
        ? Math.round(deptProjects.reduce((sum, p) => sum + p.progress, 0) / deptProjects.length)
        : 0;
      return {
        name: deptName,
        total: deptProjects.length,
        budget: totalBudget,
        expenditure: totalExpenditure,
        progress: avgProgress,
        statusBreakdown: {
          completed: deptProjects.filter(p => p.status === ProjectStatus.COMPLETED).length,
          ongoing: deptProjects.filter(p => p.status === ProjectStatus.ONGOING).length,
          stalled: deptProjects.filter(p => p.status === ProjectStatus.STALLED).length,
          notStarted: deptProjects.filter(p => p.status === ProjectStatus.NOT_STARTED).length,
        }
      };
    }).filter(d => d.total > 0).sort((a, b) => b.budget - a.budget);
  }, [filteredProjects, projects]);

  // ── Sub-County Analysis ────────────────────────────────────────────────────
  const subCountyAnalysis = useMemo(() => {
    const subCounties = Array.from(new Set(projects.map(p => p.subCounty)));
    return subCounties.map(sc => {
      const scProjects = filteredProjects.filter(p => p.subCounty === sc);
      return {
        name: sc,
        total: scProjects.length,
        completed: scProjects.filter(p => p.status === ProjectStatus.COMPLETED).length,
        ongoing: scProjects.filter(p => p.status === ProjectStatus.ONGOING).length,
        stalled: scProjects.filter(p => p.status === ProjectStatus.STALLED).length,
        notStarted: scProjects.filter(p => p.status === ProjectStatus.NOT_STARTED).length,
        budget: scProjects.reduce((sum, p) => sum + p.budget, 0),
      };
    }).filter(sc => sc.total > 0);
  }, [filteredProjects, projects]);

  // ── Ward Analysis ──────────────────────────────────────────────────────────
  const wardAnalysis = useMemo(() => {
    const wardsInSelectedSub = WARDS[activeSubCountyTab as keyof typeof WARDS] || [];
    return wardsInSelectedSub.map(wardName => {
      const wardProjects = filteredProjects.filter(
        p => p.ward === wardName && p.subCounty === activeSubCountyTab
      );
      return {
        name: wardName,
        total: wardProjects.length,
        budget: wardProjects.reduce((sum, p) => sum + p.budget, 0),
        expenditure: wardProjects.reduce((sum, p) => sum + p.expenditure, 0),
        progress: wardProjects.length > 0
          ? Math.round(wardProjects.reduce((sum, p) => sum + p.progress, 0) / wardProjects.length)
          : 0,
        statusBreakdown: {
          completed: wardProjects.filter(p => p.status === ProjectStatus.COMPLETED).length,
          ongoing: wardProjects.filter(p => p.status === ProjectStatus.ONGOING).length,
          stalled: wardProjects.filter(p => p.status === ProjectStatus.STALLED).length,
          notStarted: wardProjects.filter(p => p.status === ProjectStatus.NOT_STARTED).length,
        }
      };
    });
  }, [filteredProjects, activeSubCountyTab]);

  // ── Loading / Error States ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-fade-in">
      <div className="w-6 h-6 tt-bg-green rounded-full animate-ping"></div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">
        Loading dashboard data...
      </p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-fade-in">
      <AlertTriangle size={40} className="text-rose-400" />
      <p className="text-slate-700 font-black text-xl">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="tt-bg-green text-white px-6 py-3 rounded-2xl font-black hover:scale-[1.02] transition-all"
      >
        Retry
      </button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 animate-fade-in pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-100/50">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-12 h-1.5 tt-bg-green rounded-full"></span>
            <span className="w-8 h-1.5 tt-bg-yellow rounded-full"></span>
            <span className="w-4 h-1.5 tt-bg-orange rounded-full"></span>
          </div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Wananchi Dashboard</h2>
          <p className="text-slate-500 font-bold mt-1 text-lg">Official service delivery performance metrics.</p>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
          <div className="flex flex-col">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Reporting Financial Year
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 tt-green" size={20} />
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
              >
                <option value="All">All Years</option>  {/* ← Add this */}
                {financialYears.map(fy => (
                  <option key={fy} value={fy}>Budget Cycle: {fy}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Briefcase />} label="Total Projects" value={stats.totalCount} amount={stats.totalBudget} colorClass="tt-bg-navy" shadowColor="shadow-blue-200" />
        <StatCard icon={<CheckCircle />} label="Completed" value={stats.completed.count} amount={stats.completed.budget} colorClass="tt-bg-green" shadowColor="shadow-green-200" />
        <StatCard icon={<Clock />} label="On Schedule" value={stats.ongoing.count} amount={stats.ongoing.budget} colorClass="bg-sky-600" shadowColor="shadow-sky-200" />
        <StatCard icon={<Circle />} label="Not Started" value={stats.notStarted.count} amount={stats.notStarted.budget} colorClass="bg-slate-400" shadowColor="shadow-slate-200" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 tt-bg-green text-white rounded-2xl shadow-lg shadow-green-100">
              <LayoutDashboard size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800">Portfolio Status</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="flex-grow flex items-center justify-center">
              <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No data available</p>
            </div>
          ) : (
            <div className="flex-grow h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="45%"
                    innerRadius={65} outerRadius={95}
                    paddingAngle={8} dataKey="value"
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '16px 20px', fontWeight: 800 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => {
                      const item = pieData.find(d => d.name === value);
                      return (
                        <span className="text-slate-600 font-black">
                          {value} <span className="tt-green ml-1">{item?.percentage}%</span>
                        </span>
                      );
                    }}
                    wrapperStyle={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', paddingTop: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 tt-bg-yellow text-slate-900 rounded-2xl shadow-lg shadow-yellow-100">
              <Coins size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800">
              Departmental Allocation ({selectedFY})
            </h3>
          </div>
          {departmentalAnalysis.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No data for selected year</p>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentalAnalysis}>
                  <XAxis
                    dataKey="name"
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }}
                    tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9', radius: 10 }}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '12px 20px' }}
                    formatter={(value: number) => [`KES ${value.toFixed(1)} Million`, 'Allocation']}
                  />
                  <Bar dataKey="budgetM" fill="#00843D" radius={[12, 12, 0, 0]} name="Allocation" animationDuration={2000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Departmental Implementation Table */}
      <div className="space-y-10 pt-10">
        <div className="flex items-center gap-5">
          <div className="p-4 tt-bg-navy text-white rounded-[1.5rem] shadow-xl shadow-blue-200">
            <Building2 size={32} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Departmental Implementation</h3>
            <p className="text-slate-500 font-bold text-lg">Cross-sector performance and budget utilization.</p>
          </div>
        </div>
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Department</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Projects</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Budget</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg. Progress</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status Mix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentDetailedAnalysis.map((dept) => (
                  <tr key={dept.name} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:tt-bg-navy group-hover:text-white transition-all shadow-sm">
                          <Briefcase size={18} />
                        </div>
                        <span className="font-black text-slate-800 text-lg">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-800">{dept.total}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Entries</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <p className="font-black text-slate-800 text-lg">KES {(dept.budget / 1000000).toFixed(1)}M</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Budget Allocation</p>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="flex-grow max-w-[120px] bg-slate-100 rounded-full h-2 shadow-inner">
                          <div className="tt-bg-navy h-full rounded-full" style={{ width: `${dept.progress}%` }}></div>
                        </div>
                        <span className="text-base font-black tt-navy">{dept.progress}%</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex gap-2">
                        <WardStatusBadge label="Done" count={dept.statusBreakdown.completed} color="tt-bg-green" />
                        <WardStatusBadge label="Run" count={dept.statusBreakdown.ongoing} color="bg-sky-500" />
                        <WardStatusBadge label="Stall" count={dept.statusBreakdown.stalled} color="tt-bg-orange" />
                        <WardStatusBadge label="Wait" count={dept.statusBreakdown.notStarted} color="bg-slate-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {departmentDetailedAnalysis.length === 0 && (
              <div className="p-20 text-center">
                <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                  No department data for {selectedFY}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regional Implementation */}
      <div className="space-y-10">
        <div className="flex items-center gap-5">
          <div className="p-4 tt-bg-navy text-white rounded-[1.5rem] shadow-xl shadow-blue-200">
            <MapPin size={32} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Regional Implementation</h3>
            <p className="text-slate-500 font-bold text-lg">Performance benchmarks across our four sub-counties.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {subCountyAnalysis.map((sc, idx) => (
            <AnalysisCard key={idx} data={sc} type="Sub-County" colorTheme="navy" />
          ))}
        </div>
      </div>

      {/* Ward-Level Distribution */}
      <div className="space-y-10 pt-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 tt-bg-green text-white rounded-[1.5rem] shadow-xl shadow-green-200">
              <Navigation size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Ward-Level Distribution</h3>
              <p className="text-slate-500 font-bold text-lg">Drill down into specific project performance by ward.</p>
            </div>
          </div>
          <div className="flex bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
            {SUB_COUNTIES.map(sc => (
              <button
                key={sc}
                onClick={() => setActiveSubCountyTab(sc)}
                className={`px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeSubCountyTab === sc ? 'tt-bg-navy text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                  }`}
              >
                {sc}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Ward Name</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Projects</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Budget</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg. Progress</th>
                  <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status Mix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wardAnalysis.map((ward) => (
                  <tr key={ward.name} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm">
                          <MapPin size={18} />
                        </div>
                        <span className="font-black text-slate-800 text-lg">{ward.name}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-800">{ward.total}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Entries</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <p className="font-black text-slate-800 text-lg">KES {(ward.budget / 1000000).toFixed(1)}M</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Budget Utilization</p>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="flex-grow max-w-[120px] bg-slate-100 rounded-full h-2 shadow-inner">
                          <div className="tt-bg-green h-full rounded-full" style={{ width: `${ward.progress}%` }}></div>
                        </div>
                        <span className="text-base font-black tt-green">{ward.progress}%</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex gap-2">
                        <WardStatusBadge label="Done" count={ward.statusBreakdown.completed} color="tt-bg-green" />
                        <WardStatusBadge label="Run" count={ward.statusBreakdown.ongoing} color="bg-sky-500" />
                        <WardStatusBadge label="Stall" count={ward.statusBreakdown.stalled} color="tt-bg-orange" />
                        <WardStatusBadge label="Wait" count={ward.statusBreakdown.notStarted} color="bg-slate-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wardAnalysis.length === 0 && (
              <div className="p-20 text-center">
                <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                  No data captured for this region in {selectedFY}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const WardStatusBadge: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div className="flex flex-col items-center justify-center min-w-[45px] py-1.5 rounded-xl border border-slate-100 bg-slate-50/50">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{label}</span>
    <span className={`text-xs font-black ${count > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{count}</span>
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  amount?: number;
  colorClass: string;
  shadowColor: string;
}> = ({ icon, label, value, amount, colorClass, shadowColor }) => (
  <div className={`bg-white p-8 rounded-[2.5rem] shadow-2xl ${shadowColor}/20 border border-slate-100 flex items-center gap-6 transition-all hover:-translate-y-3 hover:shadow-3xl cursor-default group`}>
    <div className={`p-4 rounded-[1.5rem] text-white shadow-xl ${colorClass} transition-transform group-hover:scale-110`}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 28 })}
    </div>
    <div className="flex flex-col">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-800 tracking-tighter leading-none mb-2">{value}</p>
      {amount !== undefined && (
        <div className="flex flex-col border-t border-slate-50 pt-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Total Value</p>
          <p className="text-sm font-black text-slate-800">KES {(amount / 1000000).toFixed(1)}M</p>
        </div>
      )}
    </div>
  </div>
);

const AnalysisCard: React.FC<{ data: any; type: string; colorTheme: 'navy' | 'orange' }> = ({ data, type, colorTheme }) => {
  const accentColor = colorTheme === 'navy' ? 'tt-bg-navy' : 'tt-bg-orange';
  const textAccent = colorTheme === 'navy' ? 'tt-navy' : 'tt-orange';
  return (
    <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 shadow-lg hover:shadow-2xl transition-all group overflow-hidden relative">
      <div className={`absolute -top-10 -right-10 w-40 h-40 ${accentColor} opacity-[0.03] rounded-full`}></div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <h4 className="font-black text-slate-800 text-2xl truncate tracking-tight">{data.name}</h4>
        <span className={`px-4 py-1.5 ${accentColor} text-white text-[10px] font-black rounded-xl uppercase tracking-widest`}>{type}</span>
      </div>
      <div className="space-y-6 relative z-10">
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Active Portfolio</span>
          <span className="font-black text-slate-800 text-2xl">{data.total}</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[11px] font-black tracking-widest uppercase">
            <span className="text-slate-400">Total Allocation</span>
            <span className={`${textAccent} text-sm font-black`}>KES {(data.budget / 1000000).toFixed(1)}M</span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div className="tt-bg-green h-full" style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}></div>
            <div className="bg-sky-500  h-full" style={{ width: `${data.total > 0 ? (data.ongoing / data.total) * 100 : 0}%` }}></div>
            <div className="tt-bg-orange h-full" style={{ width: `${data.total > 0 ? (data.stalled / data.total) * 100 : 0}%` }}></div>
            <div className="bg-slate-400 h-full" style={{ width: `${data.total > 0 ? (data.notStarted / data.total) * 100 : 0}%` }}></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <StatusTinyStat label="Done" value={data.completed} color="tt-green" />
          <StatusTinyStat label="Active" value={data.ongoing} color="text-sky-600" />
          <StatusTinyStat label="Stalled" value={data.stalled} color="tt-orange" />
          <StatusTinyStat label="Wait" value={data.notStarted} color="text-slate-500" />
        </div>
      </div>
    </div>
  );
};

const StatusTinyStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="bg-slate-50/70 p-3 rounded-2xl text-center border border-slate-100">
    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-wider">{label}</p>
    <p className={`text-lg font-black ${color}`}>{value}</p>
  </div>
);

export default Dashboard;
