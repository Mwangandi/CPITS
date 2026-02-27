
import React, { useState, useRef } from 'react';
import { X, FileUp, Download, CheckCircle2, AlertCircle, Loader2, CloudDownload, RefreshCcw, Database, Type, FileText, UploadCloud, FileSpreadsheet } from 'lucide-react';
import { db } from '../services/database';
import { Project, ProjectStatus } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (count: number) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [csvText, setCsvText] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [previewData, setPreviewData] = useState<Project[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const fuzzyMapHeader = (header: string): string => {
    const h = header.toLowerCase().trim();
    if (h.includes('id') || h.includes('code') || h.includes('ref')) return 'id';
    if (h.includes('project name') || h.includes('description') || h.includes('title')) return 'title';
    if (h.includes('dept') || h.includes('sector')) return 'department';
    if (h.includes('subcounty') || h.includes('sub-county')) return 'subCounty';
    if (h.includes('ward')) return 'ward';
    if (h.includes('budget') || h.includes('allocation')) return 'budget';
    if (h.includes('expenditure') || h.includes('certified') || h.includes('amount paid')) return 'expenditure';
    if (h.includes('progress') || h.includes('work done') || h.includes('percentage')) return 'progress';
    if (h.includes('contractor')) return 'contractor';
    if (h.includes('fy') || h.includes('year') || h.includes('financial')) return 'financialYear';
    if (h.includes('start') || h.includes('commencement')) return 'startDate';
    if (h.includes('end') || h.includes('completion')) return 'endDate';
    if (h.includes('status')) return 'status';
    return h;
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV must contain headers and at least one data row.");
      
      const rawHeaders = lines[0].split(',');
      const headers = rawHeaders.map(h => fuzzyMapHeader(h));
      
      const data = lines.slice(1).map((line, rowIdx) => {
        // Simple CSV parser handling basic quotes
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const obj: any = {
          id: `p-imp-${rowIdx}-${Date.now()}`,
          description: "Imported from legacy record.",
          department: "Public Works, Transport & Energy",
          subCounty: "Voi",
          ward: "Voi Central",
          financialYear: "2024/2025",
          status: ProjectStatus.ONGOING,
          progress: 0,
          images: ["https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800"],
          pmcMembers: []
        };

        headers.forEach((header, i) => {
          let val = values[i]?.replace(/"/g, '').trim() || '';
          
          if (header === 'budget' || header === 'expenditure' || header === 'progress') {
            const numericVal = parseFloat(val.replace(/[^\d.-]/g, ''));
            obj[header] = isNaN(numericVal) ? 0 : numericVal;
          } else if (header === 'status') {
            val = val.toLowerCase();
            if (val.includes('comp')) obj.status = ProjectStatus.COMPLETED;
            else if (val.includes('stall') || val.includes('term')) obj.status = ProjectStatus.STALLED;
            else if (val.includes('not') || val.includes('start')) obj.status = ProjectStatus.NOT_STARTED;
            else obj.status = ProjectStatus.ONGOING;
          } else if (header !== '') {
            obj[header] = val;
          }
        });
        
        return obj as Project;
      });

      setPreviewData(data);
      setStatus('idle');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid CSV format. Please check headers and row structure.');
      setStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStatus('parsing');
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseCSV(text);
      };
      reader.onerror = () => {
        setErrorMessage("Could not read file.");
        setStatus('error');
      };
      reader.readAsText(file);
    }
  };

  const handleCsvPaste = () => {
    if (!csvText.trim()) return;
    setStatus('parsing');
    setTimeout(() => parseCSV(csvText), 500);
  };

  const handleFinalImport = () => {
    setStatus('parsing');
    setTimeout(() => {
      previewData.forEach(p => db.projects.save(p));
      setStatus('success');
      setTimeout(() => {
        onImport(previewData.length);
        onClose();
        resetModal();
      }, 1500);
    }, 1200);
  };

  const downloadTemplate = () => {
    const headers = "ID,TITLE,DEPARTMENT,SUB_COUNTY,WARD,FINANCIAL_YEAR,BUDGET,EXPENDITURE,PROGRESS,STATUS,CONTRACTOR,START_DATE,END_DATE";
    const sampleRow = "\nTTC-001,Mwatate Hospital Upgrade,Health Services,Mwatate,Mwatate,2024/2025,50000000,12000000,24,Ongoing,Local Builders Ltd,2024-01-01,2024-12-31";
    const blob = new Blob([headers + sampleRow], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taita_taveta_projects_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStatus('idle');
    setCsvText('');
    setPreviewData([]);
    setErrorMessage('');
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 tt-bg-navy text-white rounded-2xl shadow-lg">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bulk Project Ingestion</h2>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5">County Data Standard v2.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 group">
            <X size={24} className="text-slate-400 group-hover:text-rose-500" />
          </button>
        </div>

        <div className="p-10 space-y-8 overflow-y-auto">
          {status === 'success' ? (
            <div className="text-center py-16 space-y-6">
              <div className="w-24 h-24 bg-green-100 text-tt-green rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 size={56} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-800">Catalog Updated</h3>
                <p className="text-slate-500 font-bold text-lg mt-2">{previewData.length} implementation records committed to inventory.</p>
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="text-center py-16 space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Incompatible Document Format</h3>
                <p className="text-slate-500 font-medium px-10 leading-relaxed">{errorMessage}</p>
              </div>
              <button onClick={() => setStatus('idle')} className="tt-bg-navy text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">Revise Data Payload</button>
            </div>
          ) : (
            <>
              {previewData.length === 0 ? (
                <div className="space-y-8">
                  {/* File Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-4 border-dashed border-slate-100 rounded-[2.5rem] py-16 flex flex-col items-center justify-center gap-6 text-slate-400 hover:border-tt-green hover:bg-green-50/30 cursor-pointer transition-all group relative overflow-hidden"
                  >
                    <div className="p-5 bg-white rounded-3xl group-hover:tt-bg-green group-hover:text-white transition-all shadow-xl group-hover:scale-110">
                      <UploadCloud size={48} />
                    </div>
                    <div className="text-center">
                      <p className="font-black text-slate-800 text-xl tracking-tight">Upload CSV Document</p>
                      <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Click to browse or drag & drop</p>
                    </div>
                    {fileName && (
                      <div className="mt-4 px-4 py-2 bg-tt-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in">
                        Active: {fileName}
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-300"><span className="bg-white px-4">OR PASTE DATA</span></div>
                  </div>

                  <div className="space-y-4">
                    <textarea 
                      className="w-full h-40 p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 font-mono text-[11px] focus:bg-white focus:border-tt-green outline-none transition-all resize-none shadow-inner text-slate-600"
                      placeholder="PASTE CSV ROWS HERE (HEADERS INCLUDED)..."
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                    />
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={handleCsvPaste}
                        disabled={!csvText.trim() || status === 'parsing'}
                        className="flex-grow py-5 tt-bg-green text-white rounded-[1.8rem] font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                      >
                        {status === 'parsing' ? <Loader2 className="animate-spin" size={20} /> : <><FileText size={20} /> Validate Payload</>}
                      </button>
                      <button 
                        onClick={downloadTemplate}
                        className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} /> Template
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex items-start gap-4">
                    <div className="p-2 bg-tt-navy text-white rounded-xl shadow-sm"><Type size={16} /></div>
                    <p className="text-[10px] text-tt-navy font-bold leading-relaxed uppercase tracking-tight">
                      Standard Headers: <span className="font-black text-slate-600">ID, Title, Department, Sub-County, Ward, Budget, Expenditure, Progress, Status</span>. Other headers will be intelligently mapped.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex justify-between items-end px-4">
                    <div>
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Validation Report</h4>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">{previewData.length} Identifiable Entries</p>
                    </div>
                    <button onClick={resetModal} className="text-rose-500 font-black text-[10px] hover:underline uppercase tracking-widest pb-1 flex items-center gap-2">
                      <RefreshCcw size={12} /> Discard & Restart
                    </button>
                  </div>

                  <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl max-h-[350px] overflow-y-auto scrollbar-hide">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10">
                        <tr>
                          <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Project Particulars</th>
                          <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Financials</th>
                          <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Implementation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-6">
                              <p className="font-black text-slate-800 text-base leading-tight truncate max-w-[280px]">{row.title}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ref: {row.id}</p>
                            </td>
                            <td className="px-8 py-6">
                              <p className="font-black text-slate-800">KES {(row.budget / 1000000).toFixed(1)}M</p>
                              <p className="text-[9px] font-black tt-green uppercase tracking-tighter">Approved Budget</p>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${row.status === ProjectStatus.COMPLETED ? 'tt-bg-green' : 'tt-bg-navy'}`}></span>
                                <span className="text-[10px] font-black uppercase text-slate-600">{row.status}</span>
                              </div>
                              <p className="text-[10px] font-black text-slate-400 mt-1">{row.progress}% Progress</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={handleFinalImport}
                      disabled={status === 'parsing'}
                      className="flex-grow py-6 tt-bg-green text-white rounded-[2rem] font-black shadow-2xl shadow-green-100 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-4"
                    >
                      {status === 'parsing' ? <Loader2 className="animate-spin" size={24} /> : <><Database size={24} /> Commit to County Inventory</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
