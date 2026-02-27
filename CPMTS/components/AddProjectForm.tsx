
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEPARTMENTS, SUB_COUNTIES, WARDS, getDepartmentImage } from '../constants';
import { db } from '../services/database';
import { ProjectStatus, Project, PMCMember } from '../types';
import { 
  Save, X, Plus, Trash2, Building2, MapPin, 
  Calculator, Calendar, Image as ImageIcon, 
  Upload, Edit2, Users, LayoutDashboard, TrendingUp 
} from 'lucide-react';

const AddProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!id;

  const getDefaultFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: DEPARTMENTS[0],
    subCounty: SUB_COUNTIES[0],
    ward: WARDS[SUB_COUNTIES[0] as keyof typeof WARDS][0],
    financialYear: getDefaultFY(),
    budget: '',
    expenditure: '',
    contractor: '',
    startDate: '',
    endDate: '',
    status: ProjectStatus.NOT_STARTED,
    progress: 0,
  });

  const [pmcMembers, setPmcMembers] = useState<{ name: string; role: string }[]>([{ name: '', role: '' }]);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (isEditMode) {
      const existingProject = db.projects.getById(id);
      if (existingProject) {
        setFormData({
          title: existingProject.title,
          description: existingProject.description,
          department: existingProject.department,
          subCounty: existingProject.subCounty,
          ward: existingProject.ward,
          financialYear: existingProject.financialYear,
          budget: existingProject.budget.toString(),
          expenditure: existingProject.expenditure.toString(),
          contractor: existingProject.contractor,
          startDate: existingProject.startDate,
          endDate: existingProject.endDate,
          status: existingProject.status,
          progress: existingProject.progress,
        });
        setPmcMembers(existingProject.pmcMembers.map(m => ({ name: m.name, role: m.role })));
        setImages(existingProject.images || []);
      }
    }
  }, [id, isEditMode]);

  const handleSubCountyChange = (val: string) => {
    const subCountyWards = WARDS[val as keyof typeof WARDS] || [];
    setFormData({ ...formData, subCounty: val, ward: subCountyWards[0] || '' });
  };

  const handleAddPMC = () => setPmcMembers([...pmcMembers, { name: '', role: '' }]);
  const handleRemovePMC = (index: number) => setPmcMembers(pmcMembers.filter((_, i) => i !== index));
  const handlePMCChange = (index: number, field: 'name' | 'role', value: string) => {
    const updated = [...pmcMembers];
    updated[index][field] = value;
    setPmcMembers(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map((file: File) => URL.createObjectURL(file));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const projectToSave: Project = {
      id: isEditMode ? id! : `p${Date.now()}`,
      title: formData.title,
      description: formData.description,
      department: formData.department,
      subCounty: formData.subCounty,
      ward: formData.ward,
      financialYear: formData.financialYear,
      budget: parseFloat(formData.budget) || 0,
      expenditure: parseFloat(formData.expenditure) || 0,
      contractor: formData.contractor,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: formData.status,
      progress: formData.progress,
      images: images.length > 0 ? images : [getDepartmentImage(formData.department)],
      pmcMembers: pmcMembers
        .filter(m => m.name.trim() !== '')
        .map((m, i) => ({ id: `pmc-${i}-${Date.now()}`, ...m }))
    };
    db.projects.save(projectToSave);
    navigate(isEditMode ? `/projects/${id}` : '/projects');
  };

  return (
    <div className="max-w-4xl mx-auto py-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">{isEditMode ? 'Modify Project Profile' : 'Register New Project'}</h2>
          <p className="text-slate-500 font-bold mt-1">Official service delivery record management.</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 shadow-sm transition-all">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Basic Information */}
        <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="p-3 tt-bg-green text-white rounded-2xl shadow-lg shadow-green-100"><Building2 size={24} /></div>
            <h3 className="text-2xl font-black text-slate-800">General Identification</h3>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Project Title</label>
              <input 
                type="text" required 
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all shadow-inner" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                placeholder="e.g. Construction of Mwatate Social Hall"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Narrative Description</label>
              <textarea 
                required rows={4} 
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-medium text-slate-700 transition-all shadow-inner resize-none" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Detailed scope of works and target community impact..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sector/Department</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner"
                  value={formData.department} 
                  onChange={e => setFormData({...formData, department: e.target.value})}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Governance Status</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner"
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value as ProjectStatus})}
                >
                  {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Location & Financials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="p-3 tt-bg-navy text-white rounded-2xl shadow-lg shadow-blue-100"><MapPin size={24} /></div>
              <h3 className="text-2xl font-black text-slate-800">Regional Data</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sub-County</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all"
                  value={formData.subCounty} 
                  onChange={e => handleSubCountyChange(e.target.value)}
                >
                  {SUB_COUNTIES.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ward</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all"
                  value={formData.ward} 
                  onChange={e => setFormData({...formData, ward: e.target.value})}
                >
                  {(WARDS[formData.subCounty as keyof typeof WARDS] || []).map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="p-3 tt-bg-yellow text-slate-900 rounded-2xl shadow-lg shadow-yellow-100"><Calculator size={24} /></div>
              <h3 className="text-2xl font-black text-slate-800">Financial Audit</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Approved Budget (KES)</label>
                <input 
                  type="number" required 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner" 
                  value={formData.budget} 
                  onChange={e => setFormData({...formData, budget: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Certified Expenditure (KES)</label>
                <input 
                  type="number" required 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all shadow-inner" 
                  value={formData.expenditure} 
                  onChange={e => setFormData({...formData, expenditure: e.target.value})} 
                />
              </div>
            </div>
          </section>
        </div>

        {/* Implementation Logic */}
        <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 tt-bg-orange text-white rounded-2xl shadow-lg shadow-orange-100"><TrendingUp size={24} /></div>
              <h3 className="text-2xl font-black text-slate-800">Execution Timeline</h3>
            </div>
            <div className="bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100 font-black tt-green">{formData.progress}% Complete</div>
          </div>
          
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Start Date</label>
                <input type="date" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 font-black text-slate-700" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Est. Completion</label>
                <input type="date" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 font-black text-slate-700" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Main Contractor</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-50 font-black text-slate-700" value={formData.contractor} onChange={e => setFormData({...formData, contractor: e.target.value})} placeholder="Company Name" />
              </div>
            </div>
            
            <div className="pt-4">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Real-time Progress Verification</label>
              <input 
                type="range" min="0" max="100" 
                className="w-full h-3 tt-bg-green rounded-lg appearance-none cursor-pointer accent-tt-navy" 
                value={formData.progress} 
                onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} 
              />
            </div>
          </div>
        </section>

        {/* PMC Members */}
        <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><Users size={24} /></div>
              <h3 className="text-2xl font-black text-slate-800">Project Management Committee</h3>
            </div>
            <button type="button" onClick={handleAddPMC} className="p-3 tt-bg-navy text-white rounded-xl hover:scale-110 transition-transform"><Plus size={20} /></button>
          </div>
          <div className="space-y-4">
            {pmcMembers.map((member, index) => (
              <div key={index} className="flex gap-4 animate-in slide-in-from-left-4 duration-300">
                <input 
                  type="text" placeholder="Member Name" 
                  className="flex-grow px-6 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 font-bold text-slate-700"
                  value={member.name} onChange={e => handlePMCChange(index, 'name', e.target.value)}
                />
                <input 
                  type="text" placeholder="Designation" 
                  className="w-1/3 px-6 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 font-bold text-slate-700"
                  value={member.role} onChange={e => handlePMCChange(index, 'role', e.target.value)}
                />
                <button type="button" onClick={() => handleRemovePMC(index)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={20} /></button>
              </div>
            ))}
          </div>
        </section>

        {/* Image Gallery */}
        <section className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-8">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 tt-bg-navy text-white rounded-2xl shadow-lg"><ImageIcon size={24} /></div>
              <h3 className="text-2xl font-black text-slate-800">Visual Evidence & Gallery</h3>
            </div>
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 tt-bg-green text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 transition-all hover:scale-105 active:scale-95"
            >
              <Upload size={16} /> Upload Media
            </button>
          </div>
          
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {images.map((img, index) => (
              <div key={index} className="relative aspect-video rounded-3xl overflow-hidden group border-2 border-slate-100 shadow-sm">
                <img src={img} alt={`Project ${index}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <button 
                  type="button" 
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {images.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="col-span-full border-4 border-dashed border-slate-100 rounded-[2.5rem] py-16 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-tt-green hover:bg-green-50/30 cursor-pointer transition-all group"
              >
                <div className="p-5 bg-slate-50 rounded-2xl group-hover:tt-bg-green group-hover:text-white transition-all"><ImageIcon size={40} /></div>
                <p className="font-black uppercase text-xs tracking-[0.2em]">No visual evidence captured yet</p>
                <p className="text-[10px] font-bold text-slate-300">A sector-specific placeholder will be used.</p>
              </div>
            )}
          </div>
        </section>

        <div className="flex gap-6 pt-10">
          <button type="submit" className={`flex-grow py-6 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 ${isEditMode ? 'tt-bg-navy shadow-blue-200' : 'tt-bg-green shadow-green-200'}`}>
            {isEditMode ? <><Edit2 size={24} /> Update implementation Record</> : <><Save size={24} /> Publish Project Catalog</>}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-12 py-6 bg-white border-2 border-slate-100 text-slate-400 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-50 transition-all">
            Discard
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProjectForm;
