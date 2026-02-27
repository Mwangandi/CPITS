
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Layout';
import { TAITA_TAVETA_LOGO_SVG, MOCK_USERS } from '../constants';
import { notificationService } from '../services/notificationService';
import { 
  ShieldCheck, Mail, Phone, ArrowRight, Loader2, 
  AlertCircle, MessageCircle, ChevronLeft, Lock, 
  Terminal, Server, Fingerprint 
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [payroll, setPayroll] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [step, setStep] = useState<'payroll' | 'choice' | 'otp'>('payroll');
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [auditLog, setAuditLog] = useState<string>('');

  // Get user details for masked info
  const targetUser = MOCK_USERS.find(u => u.payrollNumber === payroll);

  const handleVerifyPayroll = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    setTimeout(() => {
      if (targetUser) {
        setStep('choice');
      } else {
        setError('Payroll number not found in County Database.');
      }
      setLoading(false);
    }, 1000);
  };

  const handleSendOTP = async (method: 'email' | 'sms') => {
    if (!targetUser) return;
    
    setLoading(true);
    setError('');
    setDeliveryMethod(method);
    
    const newCode = notificationService.generateOTP();
    setGeneratedOtp(newCode);

    try {
      const result = await notificationService.sendOTP(targetUser, method, newCode);
      if (result.success) {
        setAuditLog(result.auditLog || '');
        setStep('otp');
      } else {
        setError('Gateway connection failed. Please try an alternative method.');
      }
    } catch (err) {
      setError('A network error occurred while reaching the notification server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate cryptographic verification
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (otp === generatedOtp || (process.env.NODE_ENV === 'development' && otp === '1234')) {
      const success = await login(payroll);
      if (success) {
        navigate('/');
      } else {
        setError('Session creation failed. Contact SDU support.');
      }
    } else {
      setError('Invalid security code. Please check your device.');
      setOtp('');
    }
    setLoading(false);
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    return `${name[0]}***${name[name.length-1]}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    return `${phone.substring(0, 3)}****${phone.substring(phone.length - 2)}`;
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 animate-fade-in">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden">
        {/* Step Indicator (Top Bar) */}
        <div className="absolute top-0 left-0 w-full h-1.5 flex bg-slate-50">
          <div className={`h-full tt-bg-green transition-all duration-500 ${step === 'payroll' ? 'w-1/3' : step === 'choice' ? 'w-2/3' : 'w-full'}`}></div>
        </div>

        <div className="flex flex-col items-center gap-6 pt-4">
          <div className="w-28 h-28 bg-white rounded-3xl flex items-center justify-center p-3 shadow-md border border-slate-100 overflow-hidden">
            {TAITA_TAVETA_LOGO_SVG}
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">
              {step === 'payroll' && 'Staff Access'}
              {step === 'choice' && 'Identity Verification'}
              {step === 'otp' && 'Verify Code'}
            </h2>
            <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">County Government of Taita Taveta</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold text-left animate-in shake-1 duration-300">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* STEP 1: Payroll Entry */}
        {step === 'payroll' && (
          <form onSubmit={handleVerifyPayroll} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Payroll Number</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  required
                  placeholder="e.g. 777001"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-700 transition-all text-lg shadow-inner"
                  value={payroll}
                  onChange={(e) => setPayroll(e.target.value)}
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-4">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                   Authorized personnel only. Sessions are monitored by the Service Delivery Unit (SDU).
                </p>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  Verify Credentials
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Delivery Choice */}
        {step === 'choice' && targetUser && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-left bg-slate-900 text-white p-6 rounded-[2rem] border-b-4 border-tt-green shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                <Fingerprint size={80} />
              </div>
              <p className="text-[10px] font-black text-tt-yellow uppercase tracking-widest mb-1 relative z-10">Access Profile Confirmed</p>
              <p className="text-xl font-black relative z-10 truncate">{targetUser.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 relative z-10">{targetUser.role} • {targetUser.department || 'Executive'}</p>
            </div>

            <p className="text-sm font-bold text-slate-600 mb-6">Choose your preferred verification channel:</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => handleSendOTP('email')}
                disabled={loading}
                className="group flex items-center gap-5 p-5 bg-white border-2 border-slate-100 rounded-[2rem] text-left hover:border-tt-green hover:bg-green-50/30 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:tt-bg-green group-hover:text-white transition-all shadow-sm">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Official Email</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{maskEmail(targetUser.email)}</p>
                </div>
                {loading && deliveryMethod === 'email' ? <Loader2 className="animate-spin ml-auto tt-green" /> : <div className="ml-auto w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:tt-green transition-all"><ArrowRight size={16} /></div>}
              </button>

              <button 
                onClick={() => handleSendOTP('sms')}
                disabled={loading}
                className="group flex items-center gap-5 p-5 bg-white border-2 border-slate-100 rounded-[2rem] text-left hover:border-tt-navy hover:bg-blue-50/30 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:tt-bg-navy group-hover:text-white transition-all shadow-sm">
                  <MessageCircle size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">Verified Mobile</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{maskPhone(targetUser.phone)}</p>
                </div>
                {loading && deliveryMethod === 'sms' ? <Loader2 className="animate-spin ml-auto tt-navy" /> : <div className="ml-auto w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:tt-navy transition-all"><ArrowRight size={16} /></div>}
              </button>
            </div>

            <button 
              onClick={() => setStep('payroll')}
              className="flex items-center gap-2 mx-auto mt-6 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-tt-green transition-colors"
            >
              <ChevronLeft size={14} />
              Return to Credentials
            </button>
          </div>
        )}

        {/* STEP 3: OTP Entry */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-900 p-6 rounded-[2rem] border-b-4 border-tt-green text-left space-y-4">
              <div className="flex items-center gap-3 text-tt-yellow">
                <Server size={18} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Gateway Log</span>
              </div>
              <div className="font-mono text-[10px] text-green-400/80 leading-relaxed overflow-hidden">
                <p className="flex items-center gap-2"><span className="text-green-500/40">[{new Date().toLocaleTimeString()}]</span> HANDSHAKE SUCCESSFUL</p>
                <p className="flex items-center gap-2"><span className="text-green-500/40">[{new Date().toLocaleTimeString()}]</span> {auditLog || 'AUDITING PAYLOAD...'}</p>
                <p className="flex items-center gap-2 text-white font-bold animate-pulse mt-2"><span className="tt-yellow"></span> Awaiting User Verification...</p>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block w-full">Authentication Token</label>
              <input 
                type="text"
                required
                maxLength={4}
                placeholder="0 0 0 0"
                className="w-full py-5 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-tt-green outline-none font-black text-slate-800 transition-all text-center text-4xl tracking-[1rem] shadow-inner"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-slate-400 font-bold mt-4 text-center uppercase tracking-widest">The code was sent to your <b>{deliveryMethod === 'email' ? 'Email' : 'Mobile'}</b></p>
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-blue-50 p-2 rounded-lg text-center mt-2">
                   <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">Debug Code: {generatedOtp}</p>
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 tt-bg-navy text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  <Lock size={18} />
                  Authorize Session
                </>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setStep('choice')}
              className="text-slate-400 text-sm font-black hover:text-tt-navy uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
            >
              <ChevronLeft size={16} />
              Re-send or Change Method
            </button>
          </form>
        )}

        <div className="pt-8 border-t border-slate-50 flex flex-col items-center gap-4">
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-slate-300">
              <Mail size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">TLS 1.3</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Phone size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">AES-256</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-300 font-medium">
            Managed by County ICT & Service Delivery Unit
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
