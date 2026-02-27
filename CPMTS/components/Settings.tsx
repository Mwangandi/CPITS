
import React, { useState, useRef } from 'react';
import { useAuth } from './Layout';
// Added missing Info icon to the import list from lucide-react
import { Save, Upload, Image as ImageIcon, CheckCircle2, ShieldCheck, Mail, Building2, Trash2, Info } from 'lucide-react';

const Settings: React.FC = () => {
  const { settings, updateSettings, hasPermission } = useAuth();
  const [formData, setFormData] = useState({ ...settings });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setFormData({ ...formData, logoUrl: undefined });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setTimeout(() => {
      updateSettings(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1000);
  };

  if (!hasPermission('manage_settings')) {
    return <div className="text-center py-20">Access Denied. Super Admin only.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">System Configuration</h2>
          <p className="text-slate-500 font-bold text-lg">Manage global branding and administrative contacts.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 ${
            saveStatus === 'saved' ? 'bg-green-50 text-tt-green border border-green-200' : 'tt-bg-green text-white shadow-green-100 hover:scale-[1.02]'
          }`}
        >
          {saveStatus === 'saving' ? 'Optimizing...' : saveStatus === 'saved' ? <><CheckCircle2 size={20} /> Settings Optimized</> : <><Save size={20} /> Save Configuration</>}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-10">
        <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-10">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="p-3 tt-bg-navy text-white rounded-2xl shadow-lg shadow-blue-100"><ShieldCheck size={24} /></div>
            <h3 className="text-2xl font-black text-slate-800">Branding Identity</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="md:col-span-1 space-y-4 text-center md:text-left">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Official Project Logo</label>
              <div className="relative group mx-auto md:mx-0 w-48 h-48">
                <div className="w-48 h-48 rounded-[2.5rem] bg-slate-50 border-4 border-dashed border-slate-100 flex items-center justify-center overflow-hidden transition-all group-hover:border-tt-green">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="New Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <ImageIcon size={64} className="text-slate-200" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 group-hover:opacity-100 rounded-[2.5rem] transition-all flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-white tt-green rounded-xl hover:scale-110 transition-transform shadow-lg"><Upload size={20} /></button>
                  {formData.logoUrl && <button type="button" onClick={removeLogo} className="p-3 bg-white text-rose-500 rounded-xl hover:scale-110 transition-transform shadow-lg"><Trash2 size={20} /></button>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Recommended: Square PNG with transparent background.</p>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Governance Name</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner"
                    value={formData.countyName}
                    onChange={e => setFormData({ ...formData, countyName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Support/SDU Contact Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="email" 
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner"
                    value={formData.sduEmail}
                    onChange={e => setFormData({ ...formData, sduEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-blue-50/50 p-8 rounded-[3rem] border border-blue-100 flex items-start gap-6">
           <div className="p-4 tt-bg-navy text-white rounded-2xl shadow-lg"><Info size={24} /></div>
           <div className="space-y-1">
             <h4 className="text-lg font-black text-tt-navy">Impact Notice</h4>
             <p className="text-sm text-slate-500 font-bold leading-relaxed max-w-2xl">
               Changes made to the Branding Identity will reflect immediately across all public dashboards, reports, and generated project summaries. 
               This configuration is stored locally and will be maintained across browser sessions.
             </p>
           </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
