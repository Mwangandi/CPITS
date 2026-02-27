
import React, { useState } from 'react';
import { MOCK_USERS, DEPARTMENTS } from '../constants';
import { User, UserRole, Permission } from '../types';
import { 
  UserPlus, Search, Shield, ShieldAlert, ShieldCheck, 
  Mail, Phone, Edit3, Trash2, X, Check, 
  Key, Building, ClipboardCheck, AlertCircle
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    phone: '',
    payrollNumber: '',
    role: UserRole.STAFF,
    department: DEPARTMENTS[0],
    permissions: ['view_dashboard', 'view_projects']
  });

  const allPermissions: Permission[] = [
    'view_dashboard', 'view_projects', 'add_project', 'edit_project', 
    'import_projects', 'manage_users', 'manage_feedback'
  ];

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.payrollNumber.includes(searchTerm)) &&
    (selectedRoleFilter === 'All' || u.role === selectedRoleFilter)
  );

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      payrollNumber: '',
      role: UserRole.STAFF,
      department: DEPARTMENTS[0],
      permissions: ['view_dashboard', 'view_projects']
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user });
    setIsModalOpen(true);
  };

  const togglePermission = (perm: Permission) => {
    const current = formData.permissions || [];
    if (current.includes(perm)) {
      setFormData({ ...formData, permissions: current.filter(p => p !== perm) });
    } else {
      setFormData({ ...formData, permissions: [...current, perm] });
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData as User } : u));
    } else {
      const newUser: User = {
        ...formData as User,
        id: `u${Date.now()}`,
      };
      setUsers([...users, newUser]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm('Are you sure you want to revoke access for this staff member?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch(role) {
      case UserRole.SUPER_ADMIN: return <ShieldAlert className="text-tt-orange" size={18} />;
      case UserRole.ADMIN: return <ShieldCheck className="text-tt-green" size={18} />;
      default: return <Shield className="text-tt-navy" size={18} />;
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Staff Management</h2>
          <p className="text-slate-500 font-bold text-lg">Control access and permissions for county officials.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 tt-bg-green text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <UserPlus size={20} />
          Register New Staff
        </button>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-100/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Find Staff Member</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by Name or Payroll Number..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-tt-green bg-slate-50/50 focus:bg-white outline-none font-bold text-slate-700 transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Filter by Role</label>
            <select 
              className="w-full p-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-sm outline-none focus:border-tt-green transition-all"
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Officer</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Role & Dept</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Permissions</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl tt-bg-navy text-white flex items-center justify-center font-black text-lg">
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base leading-none mb-1.5">{u.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">PR NO: {u.payrollNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Mail size={14} className="text-slate-300" />
                        {u.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Phone size={14} className="text-slate-300" />
                        {u.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(u.role)}
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{u.role}</span>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{u.department || 'All Departments'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {u.permissions.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 uppercase rounded-md tracking-tighter border border-slate-200">
                          {p.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => openEditModal(u)}
                        className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:tt-green hover:border-tt-green rounded-xl transition-all shadow-sm"
                        title="Edit Officer"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                        title="Revoke Access"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-20 bg-slate-50">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No staff records match your criteria.</p>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center tt-bg-navy text-white">
              <div>
                <h2 className="text-2xl font-black">{editingUser ? 'Edit Officer Profile' : 'Register New Staff'}</h2>
                <p className="text-sm text-blue-100/70 font-bold uppercase tracking-widest mt-1">County Security Access Control</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="overflow-y-auto p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <input 
                      type="text" required
                      className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Payroll Number (PR NO)</label>
                    <input 
                      type="text" required
                      className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                      value={formData.payrollNumber}
                      onChange={e => setFormData({...formData, payrollNumber: e.target.value})}
                      placeholder="e.g. 777123"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input 
                        type="email" required
                        className="w-full pl-12 pr-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="officer@taitataveta.go.ke"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input 
                        type="tel" required
                        className="w-full pl-12 pr-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-bold focus:bg-white focus:border-tt-green outline-none transition-all"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="07XX XXX XXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                    <Key size={12} /> Access Role
                  </label>
                  <select 
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-black focus:bg-white focus:border-tt-green outline-none transition-all"
                    value={formData.role}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      let perms = ['view_dashboard', 'view_projects'];
                      if (newRole === UserRole.SUPER_ADMIN) perms = [...allPermissions];
                      if (newRole === UserRole.ADMIN) perms = ['view_dashboard', 'view_projects', 'add_project', 'edit_project', 'manage_feedback'];
                      setFormData({...formData, role: newRole, permissions: perms as Permission[]});
                    }}
                  >
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                    <Building size={12} /> Assigned Sector
                  </label>
                  <select 
                    className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-black focus:bg-white focus:border-tt-green outline-none transition-all"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  >
                    <option value="">All Departments (Executive)</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-6">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                  <ClipboardCheck size={12} /> System Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  {allPermissions.map(perm => (
                    <label key={perm} className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        onClick={() => togglePermission(perm)}
                        className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${formData.permissions?.includes(perm) ? 'tt-bg-green' : 'bg-slate-200'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ${formData.permissions?.includes(perm) ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className={`text-[11px] font-black uppercase tracking-widest group-hover:text-tt-green transition-colors ${formData.permissions?.includes(perm) ? 'text-slate-800' : 'text-slate-400'}`}>
                        {perm.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-start gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mt-2">
                  <AlertCircle size={16} className="text-tt-navy mt-0.5" />
                  <p className="text-[10px] text-tt-navy font-bold leading-relaxed">
                    Permissions granted here provide immediate access to the specified modules. 
                    Ensure the staff member has undergone the prerequisite SDU digital training.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-6 pb-2 sticky bottom-0 bg-white">
                <button 
                  type="submit"
                  className="flex-grow py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  {editingUser ? 'Commit Changes' : 'Confirm Registration'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all uppercase text-xs tracking-widest"
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
