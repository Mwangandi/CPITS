import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllProjectsForReport, ReportProject, fetchAllFeedback, FrappeFeedback } from '../services/frappeAPI';
import { loadFeedbackReplies, FeedbackReply } from './FeedbackList';
import { useAuth } from './Layout';
import { DEPARTMENTS, SUB_COUNTIES, SUB_COUNTY_WARDS } from '../constants';
import {
    FileDown, FileSpreadsheet, FileText, Filter,
    CheckSquare, Square, ChevronDown, ChevronUp,
    Loader2, Download, Table, BarChart3,
    MessageSquare, Star, Calendar,
} from 'lucide-react';

// ─── Field definitions ───────────────────────────────────────────────────────

interface FieldOption {
    key: keyof ReportProject;
    label: string;
    defaultSelected: boolean;
}

const AVAILABLE_FIELDS: FieldOption[] = [
    { key: 'projectNumber', label: 'Project Number', defaultSelected: true },
    { key: 'title', label: 'Project Title', defaultSelected: true },
    { key: 'department', label: 'Department', defaultSelected: true },
    { key: 'subCounty', label: 'Sub-County', defaultSelected: true },
    { key: 'ward', label: 'Ward', defaultSelected: true },
    { key: 'financialYear', label: 'Financial Year', defaultSelected: true },
    { key: 'status', label: 'Status', defaultSelected: true },
    { key: 'estimatedCost', label: 'Estimated Cost (KES)', defaultSelected: true },
    { key: 'amountPaid', label: 'Amount Paid (KES)', defaultSelected: true },
    { key: 'progress', label: 'Completion Level (%)', defaultSelected: true },
    { key: 'contractor', label: 'Contractor', defaultSelected: false },
    { key: 'implementedBy', label: 'Implemented By', defaultSelected: false },
    { key: 'partner', label: 'Partner', defaultSelected: false },
    { key: 'startDate', label: 'Expected Start Date', defaultSelected: false },
    { key: 'endDate', label: 'Expected End Date', defaultSelected: false },
    { key: 'contractPeriod', label: 'Contract Period (Days)', defaultSelected: false },
    { key: 'approvalNumber', label: 'Approval/Contract Number', defaultSelected: false },
    { key: 'technicalRating', label: 'Technical Rating', defaultSelected: false },
    { key: 'description', label: 'Project Scope', defaultSelected: false },
];

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

// ─── Export helpers ──────────────────────────────────────────────────────────

const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
};

const exportCSV = (projects: ReportProject[], fields: FieldOption[]) => {
    const header = fields.map(f => escapeCSV(f.label)).join(',');
    const rows = projects.map(p =>
        fields.map(f => {
            const val = (p as any)[f.key];
            return escapeCSV(val == null ? '' : String(val));
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'CPMTS_Report.csv');
};

const exportXLSX = async (projects: ReportProject[], fields: FieldOption[]) => {
    // Build a simple XML spreadsheet (Excel-compatible)
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    const styles = `<Styles>
    <Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#0F4C3A" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>
    <Style ss:ID="num"><NumberFormat ss:Format="#,##0"/></Style>
    <Style ss:ID="pct"><NumberFormat ss:Format="0.0%"/></Style>
  </Styles>`;

    const headerRow = '<Row ss:StyleID="header">' + fields.map(f => `<Cell><Data ss:Type="String">${f.label}</Data></Cell>`).join('') + '</Row>';

    const dataRows = projects.map(p => {
        const cells = fields.map(f => {
            const val = (p as any)[f.key];
            if (f.key === 'estimatedCost' || f.key === 'amountPaid') {
                return `<Cell ss:StyleID="num"><Data ss:Type="Number">${val || 0}</Data></Cell>`;
            }
            if (f.key === 'progress') {
                return `<Cell ss:StyleID="pct"><Data ss:Type="Number">${(val || 0) / 100}</Data></Cell>`;
            }
            return `<Cell><Data ss:Type="String">${String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
    }).join('\n');

    const xml = `${xmlHeader}<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${styles}
<Worksheet ss:Name="Projects Report">
<Table>${headerRow}\n${dataRows}</Table>
</Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    downloadBlob(blob, 'CPMTS_Report.xls');
};

const exportPDF = (projects: ReportProject[], fields: FieldOption[]) => {
    // Generate a printable HTML table and trigger print dialog
    const headerCells = fields.map(f => `<th style="background:#0F4C3A;color:#fff;padding:8px 12px;text-align:left;font-size:11px;border:1px solid #ddd;">${f.label}</th>`).join('');
    const rows = projects.map((p, i) => {
        const cells = fields.map(f => {
            let val = (p as any)[f.key];
            if (f.key === 'estimatedCost' || f.key === 'amountPaid') val = `KES ${Number(val || 0).toLocaleString()}`;
            if (f.key === 'progress') val = `${val || 0}%`;
            return `<td style="padding:6px 12px;font-size:10px;border:1px solid #eee;">${val ?? ''}</td>`;
        }).join('');
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>CPMTS Report</title>
<style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}
h1{font-size:16px;color:#0F4C3A}p{font-size:11px;color:#666}
@media print{button{display:none}}</style></head><body>
<h1>Taita Taveta County — Project Tracking Report</h1>
<p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} • ${projects.length} projects</p>
<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ─── Feedback export helpers ──────────────────────────────────────────────────

interface FeedbackRow {
    date: string;
    project: string;
    submitter: string;
    category: string;
    rating: string;
    comment: string;
    reply: string;
    repliedAt: string;
    repliedBy: string;
}

const FB_HEADERS: { key: keyof FeedbackRow; label: string }[] = [
    { key: 'date', label: 'Date Submitted' },
    { key: 'project', label: 'Project' },
    { key: 'submitter', label: 'Submitted By' },
    { key: 'category', label: 'Category' },
    { key: 'rating', label: 'Rating' },
    { key: 'comment', label: 'Feedback Comment' },
    { key: 'reply', label: 'Staff Reply' },
    { key: 'repliedAt', label: 'Replied On' },
    { key: 'repliedBy', label: 'Replied By' },
];

function buildFeedbackRows(items: FrappeFeedback[], replies: Record<string, FeedbackReply>): FeedbackRow[] {
    return items.map(f => {
        const rep = replies[f.name];
        const rawDate = f.creation ?? '';
        const formatted = rawDate ? new Date(rawDate).toLocaleString('en-GB') : '';
        return {
            date: formatted,
            project: f.project_name || f.project || '',
            submitter: f.full_name,
            category: f.category ?? '',
            rating: f.rating != null ? String(f.rating) : '',
            comment: f.description,
            reply: rep?.reply ?? '',
            repliedAt: rep?.repliedAt ? new Date(rep.repliedAt).toLocaleString('en-GB') : '',
            repliedBy: rep?.repliedBy ?? '',
        };
    });
}

const exportFeedbackCSV = (rows: FeedbackRow[], period: string) => {
    const header = FB_HEADERS.map(h => escapeCSV(h.label)).join(',');
    const body = rows.map(r => FB_HEADERS.map(h => escapeCSV(r[h.key])).join(','));
    const csv = [header, ...body].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Feedback_Report${period}.csv`);
};

const exportFeedbackXLSX = (rows: FeedbackRow[], period: string) => {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    const styles = `<Styles>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#0F4C3A" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>
</Styles>`;
    const headerRow = '<Row ss:StyleID="header">' + FB_HEADERS.map(h => `<Cell><Data ss:Type="String">${h.label}</Data></Cell>`).join('') + '</Row>';
    const dataRows = rows.map(r => {
        const cells = FB_HEADERS.map(h => `<Cell><Data ss:Type="String">${String(r[h.key]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`).join('');
        return `<Row>${cells}</Row>`;
    }).join('\n');
    const xml = `${xmlHeader}<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${styles}
<Worksheet ss:Name="Feedback Report">
<Table>${headerRow}\n${dataRows}</Table>
</Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    downloadBlob(blob, `Feedback_Report${period}.xls`);
};

const exportFeedbackPDF = (rows: FeedbackRow[], period: string, stats: { total: number; replied: number; avgRating: string; projects: number }) => {
    const headerCells = FB_HEADERS.map(h => `<th style="background:#0F4C3A;color:#fff;padding:7px 10px;text-align:left;font-size:10px;border:1px solid #ccc;white-space:nowrap">${h.label}</th>`).join('');
    const bodyRows = rows.map((r, i) => {
        const cells = FB_HEADERS.map(h => {
            let val = r[h.key];
            if (h.key === 'reply' && val) val = `<em style="color:#166534">${val}</em>`;
            return `<td style="padding:6px 10px;font-size:9.5px;border:1px solid #eee;vertical-align:top">${val ?? ''}</td>`;
        }).join('');
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Feedback Report${period}</title>
<style>body{font-family:Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}
h1{font-size:16px;color:#0F4C3A;margin:0}h2{font-size:12px;color:#555;margin:4px 0 16px}
.stats{display:flex;gap:24px;margin-bottom:20px}.stat{background:#f1f5f9;padding:10px 18px;border-radius:8px}
.stat-val{font-size:18px;font-weight:900;color:#0F4C3A}.stat-lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.08em}
@media print{button{display:none}}</style></head><body>
<h1>Taita Taveta County — Feedback Report</h1>
<h2>${period || 'All Periods'} &bull; Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
<div class="stats">
  <div class="stat"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Total Feedback</div></div>
  <div class="stat"><div class="stat-val">${stats.replied}</div><div class="stat-lbl">Replied</div></div>
  <div class="stat"><div class="stat-val">${stats.projects}</div><div class="stat-lbl">Projects</div></div>
  <div class="stat"><div class="stat-val">${stats.avgRating}</div><div class="stat-lbl">Avg Rating</div></div>
</div>
<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
};

// ─── Component ───────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
    // Tab
    const { user } = useAuth();
    const isStaff = user != null;
    const [activeTab, setActiveTab] = useState<'projects' | 'feedback'>('projects');

    // ── Projects report state ──────────────────────────────────────────────
    // Filters
    const [department, setDepartment] = useState('');
    const [subCounty, setSubCounty] = useState('');
    const [ward, setWard] = useState('');
    const [status, setStatus] = useState('');
    const [cycle, setCycle] = useState('');
    const [format, setFormat] = useState<ExportFormat>('csv');

    // Field selection
    const [selectedFields, setSelectedFields] = useState<Set<string>>(
        new Set(AVAILABLE_FIELDS.filter(f => f.defaultSelected).map(f => f.key))
    );

    // UI state
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [fieldsOpen, setFieldsOpen] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    // ── Feedback report state ────────────────────────────────────────────────
    const [fbDateFrom, setFbDateFrom] = useState('');
    const [fbDateTo, setFbDateTo] = useState('');
    const [fbProject, setFbProject] = useState('');
    const [fbCategory, setFbCategory] = useState('');
    const [fbFormat, setFbFormat] = useState<ExportFormat>('csv');
    const [fbExporting, setFbExporting] = useState(false);
    const [fbPreviewOpen, setFbPreviewOpen] = useState(false);

    const { data: allFeedback, isLoading: fbLoading } = useQuery({
        queryKey: ['reports-all-feedback'],
        queryFn: () => fetchAllFeedback(500),
        staleTime: 1000 * 60 * 5,
    });

    const fbReplies = useMemo<Record<string, FeedbackReply>>(loadFeedbackReplies, []);

    const filteredFeedback = useMemo(() => {
        if (!allFeedback) return [];
        return allFeedback.filter(f => {
            if (fbProject && f.project !== fbProject) return false;
            if (fbCategory && f.category !== fbCategory) return false;
            const created = f.creation ?? '';
            if (fbDateFrom && created && created.substring(0, 10) < fbDateFrom) return false;
            if (fbDateTo && created && created.substring(0, 10) > fbDateTo) return false;
            return true;
        });
    }, [allFeedback, fbProject, fbCategory, fbDateFrom, fbDateTo]);

    const fbProjects = useMemo(() => {
        if (!allFeedback) return [] as { id: string; name: string }[];
        const map = new Map<string, string>();
        allFeedback.forEach(f => { if (f.project) map.set(f.project, f.project_name || f.project); });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [allFeedback]);

    const fbCategories = useMemo(() => {
        if (!allFeedback) return [] as string[];
        return Array.from(new Set(allFeedback.map(f => f.category).filter(Boolean))) as string[];
    }, [allFeedback]);

    const fbStats = useMemo(() => {
        const total = filteredFeedback.length;
        const replied = filteredFeedback.filter(f => fbReplies[f.name]).length;
        const rated = filteredFeedback.filter(f => f.rating != null);
        const avgRating = rated.length ? (rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1) : '—';
        const projects = new Set(filteredFeedback.map(f => f.project)).size;
        return { total, replied, avgRating, projects };
    }, [filteredFeedback, fbReplies]);

    const fbPeriod = fbDateFrom || fbDateTo
        ? `_${fbDateFrom || 'start'}_to_${fbDateTo || 'now'}`
        : '';

    const handleFbExport = async () => {
        if (!filteredFeedback.length) return;
        setFbExporting(true);
        try {
            await new Promise(r => setTimeout(r, 200));
            const rows = buildFeedbackRows(filteredFeedback, fbReplies);
            const label = fbDateFrom || fbDateTo
                ? ` (${fbDateFrom || '…'} to ${fbDateTo || '…'})`
                : '';
            if (fbFormat === 'csv') exportFeedbackCSV(rows, fbPeriod);
            else if (fbFormat === 'xlsx') exportFeedbackXLSX(rows, fbPeriod);
            else exportFeedbackPDF(rows, label, fbStats);
        } finally {
            setFbExporting(false);
        }
    };

    // Wards for selected sub-county
    const availableWards = subCounty ? (SUB_COUNTY_WARDS[subCounty] || []) : [];

    // Fetch ALL projects from Frappe (single cached request)
    const { data: allProjects, isLoading } = useQuery({
        queryKey: ['reports-all-projects'],
        queryFn: fetchAllProjectsForReport,
        staleTime: 1000 * 60 * 5,
    });

    // Apply filters client-side
    const projects = useMemo(() => {
        if (!allProjects) return [];
        return allProjects.filter(p => {
            if (department && p.department !== department) return false;
            if (subCounty && p.subCounty !== subCounty) return false;
            if (ward && p.ward !== ward) return false;
            if (status && p.status !== status) return false;
            if (cycle && p.financialYear !== cycle) return false;
            return true;
        });
    }, [allProjects, department, subCounty, ward, status, cycle]);

    // Get unique cycles from all projects
    const cycles = useMemo(() => {
        if (!allProjects) return [];
        return Array.from(new Set(allProjects.map(p => p.financialYear))).filter(Boolean).sort().reverse();
    }, [allProjects]);

    const activeFields = AVAILABLE_FIELDS.filter(f => selectedFields.has(f.key));

    const toggleField = (key: string) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size > 1) next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAllFields = () => setSelectedFields(new Set(AVAILABLE_FIELDS.map(f => f.key)));
    const selectDefaultFields = () => setSelectedFields(new Set(AVAILABLE_FIELDS.filter(f => f.defaultSelected).map(f => f.key)));

    const handleExport = async () => {
        if (projects.length === 0) return;
        setExporting(true);

        try {
            // Small delay for UX feedback
            await new Promise(r => setTimeout(r, 300));

            switch (format) {
                case 'csv':
                    exportCSV(projects, activeFields);
                    break;
                case 'xlsx':
                    await exportXLSX(projects, activeFields);
                    break;
                case 'pdf':
                    exportPDF(projects, activeFields);
                    break;
            }
        } finally {
            setExporting(false);
        }
    };

    const selectClass = "w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all appearance-none cursor-pointer";

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Reports & Export</h1>
                    <p className="text-slate-500 font-medium mt-2">Generate filtered reports in your preferred format.</p>
                </div>
            </div>

            {/* Tabs — Feedback tab only shown to logged-in staff */}
            {isStaff && (
                <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'projects' ? 'bg-white text-slate-800 shadow' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <BarChart3 size={16} />
                        Projects Report
                    </button>
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'feedback' ? 'bg-white text-slate-800 shadow' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MessageSquare size={16} />
                        Feedback Report
                    </button>
                </div>
            )}

            {/* ── PROJECTS REPORT ────────────────────────────────────────────── */}
            {activeTab === 'projects' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Filters + Fields */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Stats card */}
                        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm">
                            <BarChart3 size={20} className="tt-green" />
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matching Projects</p>
                                <p className="text-2xl font-black text-slate-800">{isLoading ? '…' : projects.length}</p>
                            </div>
                        </div>
                        {/* Filters */}
                        <div className="bg-white rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
                            <button onClick={() => setFiltersOpen(!filtersOpen)} className="w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 flex items-center justify-between text-left">
                                <div className="flex items-center gap-3">
                                    <Filter size={20} className="tt-green" />
                                    <h3 className="font-black text-slate-800">Filters</h3>
                                </div>
                                {filtersOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                            </button>
                            {filtersOpen && (
                                <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 space-y-4">
                                    <select className={selectClass} value={department} onChange={e => setDepartment(e.target.value)}>
                                        <option value="">All Departments</option>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select className={selectClass} value={subCounty} onChange={e => { setSubCounty(e.target.value); setWard(''); }}>
                                        <option value="">All Sub-Counties</option>
                                        {SUB_COUNTIES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {subCounty && (
                                        <select className={selectClass} value={ward} onChange={e => setWard(e.target.value)}>
                                            <option value="">All Wards in {subCounty}</option>
                                            {availableWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    )}
                                    <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
                                        <option value="">All Statuses</option>
                                        <option value="Complete">Complete</option>
                                        <option value="Ongoing">Ongoing</option>
                                        <option value="Stalled">Stalled</option>
                                        <option value="Not Started">Not Started</option>
                                    </select>
                                    <select className={selectClass} value={cycle} onChange={e => setCycle(e.target.value)}>
                                        <option value="">All Financial Years</option>
                                        {cycles.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {(department || subCounty || ward || status || cycle) && (
                                        <button
                                            onClick={() => { setDepartment(''); setSubCounty(''); setWard(''); setStatus(''); setCycle(''); }}
                                            className="text-xs font-black text-rose-500 uppercase tracking-widest hover:underline"
                                        >
                                            Clear All Filters
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Field Selection */}
                        <div className="bg-white rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
                            <button onClick={() => setFieldsOpen(!fieldsOpen)} className="w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 flex items-center justify-between text-left">
                                <div className="flex items-center gap-3">
                                    <Table size={20} className="tt-green" />
                                    <h3 className="font-black text-slate-800">Report Fields</h3>
                                    <span className="text-xs font-bold text-slate-400">({selectedFields.size}/{AVAILABLE_FIELDS.length})</span>
                                </div>
                                {fieldsOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                            </button>
                            {fieldsOpen && (
                                <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 space-y-3">
                                    <div className="flex gap-3 mb-4">
                                        <button onClick={selectAllFields} className="text-[10px] font-black text-tt-green uppercase tracking-widest hover:underline">Select All</button>
                                        <span className="text-slate-200">|</span>
                                        <button onClick={selectDefaultFields} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline">Reset</button>
                                    </div>
                                    {AVAILABLE_FIELDS.map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => toggleField(f.key)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${selectedFields.has(f.key)
                                                ? 'bg-green-50 text-tt-green border border-green-100'
                                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                }`}
                                        >
                                            {selectedFields.has(f.key) ? <CheckSquare size={18} /> : <Square size={18} />}
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Format + Preview + Export */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Export Format */}
                        <div className="bg-white rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg p-4 sm:p-6 md:p-8">
                            <h3 className="font-black text-slate-800 mb-4 sm:mb-6 flex items-center gap-3">
                                <FileDown size={20} className="tt-green" />
                                Export Format
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                {([
                                    { val: 'csv' as ExportFormat, label: 'CSV', desc: 'Comma-separated values', icon: <FileText size={24} /> },
                                    { val: 'xlsx' as ExportFormat, label: 'Excel', desc: 'Spreadsheet format', icon: <FileSpreadsheet size={24} /> },
                                    { val: 'pdf' as ExportFormat, label: 'PDF', desc: 'Print-ready document', icon: <FileDown size={24} /> },
                                ]).map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setFormat(opt.val)}
                                        className={`p-6 rounded-2xl border-2 text-center transition-all ${format === opt.val
                                            ? 'border-tt-green bg-green-50/50 shadow-md'
                                            : 'border-slate-100 hover:border-slate-200 bg-white'
                                            }`}
                                    >
                                        <div className={`mx-auto mb-3 ${format === opt.val ? 'tt-green' : 'text-slate-400'}`}>{opt.icon}</div>
                                        <p className="font-black text-sm text-slate-800">{opt.label}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
                            <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 flex items-center justify-between border-b border-slate-100">
                                <h3 className="font-black text-slate-800 flex items-center gap-3">
                                    <Table size={20} className="tt-green" />
                                    Data Preview
                                </h3>
                                <button onClick={() => setPreviewOpen(!previewOpen)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-tt-green">
                                    {previewOpen ? 'Hide' : 'Show'} Preview
                                </button>
                            </div>
                            {previewOpen && (
                                <div className="overflow-x-auto">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-16 text-slate-400">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="ml-3 font-bold">Loading projects...</span>
                                        </div>
                                    ) : projects.length === 0 ? (
                                        <div className="text-center py-16 text-slate-400 font-bold">
                                            No projects match the current filters.
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    {activeFields.map(f => (
                                                        <th key={f.key} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{f.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projects.slice(0, 10).map((p, i) => (
                                                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                        {activeFields.map(f => {
                                                            let val = (p as any)[f.key];
                                                            if (f.key === 'estimatedCost' || f.key === 'amountPaid') val = `KES ${Number(val || 0).toLocaleString()}`;
                                                            if (f.key === 'progress') val = `${val || 0}%`;
                                                            return (
                                                                <td key={f.key} className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap max-w-[200px] truncate">{val ?? ''}</td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {projects.length > 10 && (
                                        <div className="px-8 py-3 bg-slate-50 text-center text-xs font-bold text-slate-400">
                                            Showing 10 of {projects.length} projects • Full data will be exported
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            disabled={exporting || isLoading || projects.length === 0}
                            className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                        >
                            {exporting ? (
                                <><Loader2 size={22} className="animate-spin" /> Generating Report...</>
                            ) : (
                                <><Download size={22} /> Export {projects.length} Projects as {format.toUpperCase()}</>
                            )}
                        </button>
                    </div>
                </div>
            )} {/* end projects tab */}

            {/* ── FEEDBACK REPORT — staff only ────────────────────────────── */}
            {activeTab === 'feedback' && isStaff && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Filters */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
                                <Filter size={18} className="tt-green" />
                                <h3 className="font-black text-slate-800">Filters</h3>
                            </div>
                            <div className="px-8 pb-8 pt-6 space-y-4">
                                {/* Date range */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Calendar size={11} /> Date From
                                    </label>
                                    <input
                                        type="date"
                                        className={selectClass}
                                        value={fbDateFrom}
                                        max={fbDateTo || undefined}
                                        onChange={e => setFbDateFrom(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Calendar size={11} /> Date To
                                    </label>
                                    <input
                                        type="date"
                                        className={selectClass}
                                        value={fbDateTo}
                                        min={fbDateFrom || undefined}
                                        onChange={e => setFbDateTo(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project</label>
                                    <select className={selectClass} value={fbProject} onChange={e => setFbProject(e.target.value)}>
                                        <option value="">All Projects</option>
                                        {fbProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                {fbCategories.length > 0 && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                                        <select className={selectClass} value={fbCategory} onChange={e => setFbCategory(e.target.value)}>
                                            <option value="">All Categories</option>
                                            {fbCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                                {(fbDateFrom || fbDateTo || fbProject || fbCategory) && (
                                    <button
                                        onClick={() => { setFbDateFrom(''); setFbDateTo(''); setFbProject(''); setFbCategory(''); }}
                                        className="text-xs font-black text-rose-500 uppercase tracking-widest hover:underline"
                                    >
                                        Clear All Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Format */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg p-8">
                            <h3 className="font-black text-slate-800 mb-5 flex items-center gap-3">
                                <FileDown size={18} className="tt-green" />
                                Export Format
                            </h3>
                            <div className="space-y-3">
                                {([
                                    { val: 'csv' as ExportFormat, label: 'CSV', desc: 'Comma-separated values', icon: <FileText size={20} /> },
                                    { val: 'xlsx' as ExportFormat, label: 'Excel (.xls)', desc: 'Spreadsheet format', icon: <FileSpreadsheet size={20} /> },
                                    { val: 'pdf' as ExportFormat, label: 'PDF / Print', desc: 'Print-ready document', icon: <FileDown size={20} /> },
                                ]).map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setFbFormat(opt.val)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${fbFormat === opt.val ? 'border-tt-green bg-green-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <span className={fbFormat === opt.val ? 'tt-green' : 'text-slate-400'}>{opt.icon}</span>
                                        <div>
                                            <p className="font-black text-sm text-slate-800">{opt.label}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{opt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats + Preview + Export */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Feedback', val: fbLoading ? '…' : fbStats.total },
                                { label: 'Replied', val: fbLoading ? '…' : fbStats.replied },
                                { label: 'Projects', val: fbLoading ? '…' : fbStats.projects },
                                { label: 'Avg Rating', val: fbLoading ? '…' : fbStats.avgRating },
                            ].map(s => (
                                <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                                    <p className="text-2xl font-black text-slate-800">{s.val}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Preview */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden">
                            <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100">
                                <h3 className="font-black text-slate-800 flex items-center gap-3">
                                    <Table size={18} className="tt-green" />
                                    Preview
                                    {!fbLoading && filteredFeedback.length > 0 && (
                                        <span className="text-xs font-bold text-slate-400">({filteredFeedback.length} records)</span>
                                    )}
                                </h3>
                                <button onClick={() => setFbPreviewOpen(!fbPreviewOpen)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-tt-green">
                                    {fbPreviewOpen ? 'Hide' : 'Show'} Preview
                                </button>
                            </div>
                            {fbPreviewOpen && (
                                <div className="overflow-x-auto">
                                    {fbLoading ? (
                                        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 font-bold">
                                            <Loader2 size={22} className="animate-spin" /> Loading feedback…
                                        </div>
                                    ) : filteredFeedback.length === 0 ? (
                                        <div className="text-center py-16 text-slate-400 font-bold">
                                            No feedback matches the selected filters.
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Project</th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Submitted By</th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rating</th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Comment</th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Replied</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredFeedback.slice(0, 12).map((f, i) => {
                                                    const hasReply = !!fbReplies[f.name];
                                                    return (
                                                        <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                            <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap text-xs">
                                                                {f.creation ? new Date(f.creation).toLocaleDateString('en-GB') : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700 font-bold text-xs max-w-[140px] truncate">{f.project_name || f.project}</td>
                                                            <td className="px-4 py-3 text-slate-600 font-medium text-xs whitespace-nowrap">{f.full_name}</td>
                                                            <td className="px-4 py-3 text-xs">
                                                                {f.rating != null ? (
                                                                    <span className="flex items-center gap-0.5 text-amber-500 font-black">
                                                                        <Star size={12} fill="currentColor" />{f.rating}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600 font-medium text-xs max-w-[260px] truncate">{f.description}</td>
                                                            <td className="px-4 py-3 text-xs">
                                                                {hasReply
                                                                    ? <span className="px-2 py-0.5 bg-green-100 text-green-700 font-black rounded-full text-[10px]">Yes</span>
                                                                    : <span className="px-2 py-0.5 bg-amber-50 text-amber-600 font-black rounded-full text-[10px]">No</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                    {filteredFeedback.length > 12 && (
                                        <div className="px-8 py-3 bg-slate-50 text-center text-xs font-bold text-slate-400">
                                            Showing 12 of {filteredFeedback.length} records • Full data will be exported
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleFbExport}
                            disabled={fbExporting || fbLoading || filteredFeedback.length === 0}
                            className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                        >
                            {fbExporting ? (
                                <><Loader2 size={22} className="animate-spin" /> Generating Report…</>
                            ) : (
                                <><Download size={22} /> Export {filteredFeedback.length} Feedback Records as {fbFormat.toUpperCase()}</>
                            )}
                        </button>
                    </div>
                </div>
            )} {/* end feedback tab */}

        </div>
    );
};

export default Reports;
