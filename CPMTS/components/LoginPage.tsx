
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Layout';
import { TAITA_TAVETA_LOGO_SVG } from '../constants';
import { notificationService, DeliveryStatus } from '../services/notificationService';
import { User, UserRole, Permission } from '../types';
import {
  ShieldCheck, Mail, ArrowRight, Loader2,
  AlertCircle, Lock, Phone, Eye, EyeOff,
  CheckCircle2, ArrowLeft
} from 'lucide-react';

type LoginStep = 'credentials' | 'otp-verify';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user: authUser } = useAuth();

  // Step management
  const [step, setStep] = useState<LoginStep>('credentials');

  // Step 1: Credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pending user (authenticated but not OTP-verified)
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Step 2/3: OTP
  const otpMethod = 'sms' as const;
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpStatus, setOtpStatus] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Focus first OTP input when entering verify step
  useEffect(() => {
    if (step === 'otp-verify') {
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
  }, [step]);

  // Step 1: Login with Frappe (authenticate but don't set user in context yet)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Authenticate with Frappe directly
      const loginRes = await fetch('/api/method/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `usr=${encodeURIComponent(identifier)}&pwd=${encodeURIComponent(password)}`,
        credentials: 'include',
      });
      if (!loginRes.ok) {
        setError('Invalid credentials. Please check your email and password.');
        setLoading(false);
        return;
      }
      const loginData = await loginRes.json();
      if (loginData.message !== 'Logged In') {
        setError('Invalid credentials. Please check your email and password.');
        setLoading(false);
        return;
      }

      // Fetch user details
      const userRes = await fetch('/api/method/frappe.client.get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctype: 'User', name: identifier }),
        credentials: 'include',
      });
      const userData = userRes.ok ? await userRes.json() : null;
      const frappeUser = userData?.message;

      const roles: string[] = (frappeUser?.roles || []).map((r: any) => r.role);
      let appRole = UserRole.STAFF;
      if (roles.includes('Administrator') || roles.includes('System Manager')) {
        appRole = UserRole.SUPER_ADMIN;
      } else if (roles.includes('Projects Manager')) {
        appRole = UserRole.ADMIN;
      }

      const allPermissions: Permission[] = [
        'view_dashboard', 'view_projects', 'add_project', 'edit_project',
        'delete_project', 'import_projects', 'manage_users', 'manage_feedback', 'manage_settings',
      ];

      const appUser: User = {
        id: frappeUser?.name || identifier,
        payrollNumber: '',
        name: loginData.full_name || frappeUser?.full_name || identifier,
        email: frappeUser?.email || identifier,
        phone: frappeUser?.mobile_no || '',
        role: appRole,
        department: frappeUser?.department || '',
        permissions: appRole === UserRole.SUPER_ADMIN ? allPermissions : ['view_dashboard', 'view_projects'],
      };

      // Store pending user for OTP but do NOT set in auth context yet
      setPendingUser(appUser);

      // Auto-send SMS OTP (email SMTP is blocked on this server)
      setOtpSending(true);
      setOtpError('');
      setOtpStatus('');
      const code = notificationService.generateOTP();
      setGeneratedOtp(code);
      const result: DeliveryStatus = await notificationService.sendOTP(appUser, 'sms', code);
      if (result.success) {
        setOtpStatus(result.message);
        setStep('otp-verify');
        setOtpDigits(['', '', '', '']);
      } else {
        setOtpError(result.message);
      }
      setOtpSending(false);
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Send OTP via chosen method
  const handleSendOtp = async () => {
    if (!pendingUser) return;
    setOtpSending(true);
    setOtpError('');
    setOtpStatus('');

    const code = notificationService.generateOTP();
    setGeneratedOtp(code);

    const result: DeliveryStatus = await notificationService.sendOTP(pendingUser, otpMethod, code);

    if (result.success) {
      setOtpStatus(result.message);
      setStep('otp-verify');
      setOtpDigits(['', '', '', '']);
    } else {
      setOtpError(result.message);
    }
    setOtpSending(false);
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = () => {
    const entered = otpDigits.join('');
    if (entered === generatedOtp) {
      // OTP verified — save user session and navigate
      if (pendingUser) {
        localStorage.setItem('tt_user_session', JSON.stringify(pendingUser));
        window.location.hash = '#/';
        window.location.reload();
      }
    } else {
      setOtpError('Invalid verification code. Please try again.');
      setOtpDigits(['', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
  };

  // OTP digit input handler
  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    setOtpError('');

    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-verify when all 4 digits entered
    if (value && index === 3 && newDigits.every(d => d !== '')) {
      setTimeout(() => {
        const entered = newDigits.join('');
        if (entered === generatedOtp) {
          if (pendingUser) {
            localStorage.setItem('tt_user_session', JSON.stringify(pendingUser));
            window.location.hash = '#/';
            window.location.reload();
          }
        } else {
          setOtpError('Invalid verification code. Please try again.');
          setOtpDigits(['', '', '', '']);
          setTimeout(() => otpRefs[0].current?.focus(), 100);
        }
      }, 200);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // Resend OTP
  const handleResend = async () => {
    await handleSendOtp();
  };

  // Step indicator
  const steps = [
    { num: 1, label: 'Sign In' },
    { num: 2, label: 'OTP' },
  ];
  const currentStepNum = step === 'credentials' ? 1 : 2;

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8 sm:py-12 px-4 animate-fade-in">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-white p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden">

        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-4 sm:gap-6 pt-2 sm:pt-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white rounded-2xl sm:rounded-3xl flex items-center justify-center p-2 sm:p-3 shadow-md border border-slate-100 overflow-hidden">
            {TAITA_TAVETA_LOGO_SVG}
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Staff Access</h2>
            <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">County Government of Taita Taveta</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 py-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${s.num < currentStepNum
                  ? 'bg-green-500 text-white scale-90'
                  : s.num === currentStepNum
                    ? 'tt-bg-navy text-white scale-110 shadow-lg shadow-blue-200'
                    : 'bg-slate-100 text-slate-400'
                  }`}>
                  {s.num < currentStepNum ? <CheckCircle2 size={20} /> : s.num}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${s.num === currentStepNum ? 'tt-navy' : 'text-slate-400'
                  }`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 mb-5 transition-all ${s.num < currentStepNum ? 'bg-green-400' : 'bg-slate-200'
                  }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error / Status Messages */}
        {(error || otpError) && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold text-left">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p>{error || otpError}</p>
          </div>
        )}
        {otpStatus && step === 'otp-verify' && (
          <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center gap-3 text-green-700 text-sm font-bold text-left">
            <CheckCircle2 size={20} className="flex-shrink-0" />
            <p>{otpStatus}</p>
          </div>
        )}

        {/* ──────── STEP 1: Credentials ──────── */}
        {step === 'credentials' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email or Mobile Number</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  required
                  placeholder="e.g. user@taitataveta.go.ke"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all text-sm shadow-inner"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-tt-green outline-none font-bold text-slate-700 transition-all text-sm shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                Authorized personnel only. Sessions are monitored by the Service Delivery Unit (SDU).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : (
                <>
                  <ShieldCheck size={20} />
                  Sign In
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}

        {/* OTP method selection removed — SMS only (SMTP blocked on server) */}

        {/* ──────── STEP 3: Enter OTP ──────── */}
        {step === 'otp-verify' && (
          <div className="space-y-6">
            <div className="text-left">
              <p className="text-sm text-slate-600 font-bold mb-1">Enter the 4-digit code</p>
              <p className="text-xs text-slate-400 font-bold">
                Sent via SMS to{' '}
                <span className="text-slate-600">
                  {pendingUser?.phone?.slice(0, 4) + '***' + (pendingUser?.phone?.slice(-3) || '')}
                </span>
              </p>
            </div>

            {/* 4 digit boxes */}
            <div className="flex justify-center gap-3 sm:gap-4">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-14 h-14 sm:w-16 sm:h-16 text-center text-xl sm:text-2xl font-black rounded-xl sm:rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-tt-navy outline-none transition-all shadow-inner"
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('credentials'); setError(''); setPendingUser(null); setOtpError(''); setOtpStatus(''); }}
                className="px-6 py-4 rounded-2xl border-2 border-slate-100 text-slate-500 font-black hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <ArrowLeft size={18} />
                Back
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={otpDigits.some(d => d === '')}
                className="flex-1 py-4 tt-bg-green text-white rounded-2xl font-black shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <ShieldCheck size={20} />
                Verify & Continue
              </button>
            </div>

            <button
              onClick={handleResend}
              disabled={otpSending}
              className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-tt-navy transition-colors disabled:opacity-50"
            >
              {otpSending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        )}

        {/* Footer */}
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
