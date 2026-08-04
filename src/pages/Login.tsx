import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionStore } from '../store/permissionStore';
import { Mail, Key, Clock, ArrowLeft, Building2, Wrench, ClipboardList, ChevronRight, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { User } from '../types';

type LoginStep = 'enter-email' | 'choose-method' | 'enter-password' | 'set-initial' | 'enter-code';

const Login: React.FC = () => {
  const [emailId, setEmailId] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<LoginStep>('enter-email');
  const [userPasswordSet, setUserPasswordSet] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const navigate = useNavigate();
  const t = useLanguage();

  // 인증코드 만료 타이머
  useEffect(() => {
    if (step !== 'enter-code') return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStep('choose-method');
          setVerificationCode('');
          setTimeRemaining(300);
          setError(t('verificationExpired'));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, t]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLoginSuccess = async (data: any) => {
    if (!data.user || !data.token) throw new Error(t('userInfoMissing'));
    const ud = data.user;
    const user: User = {
      id: ud.id?.toString() || '1',
      email: ud.email || emailId + '@maintenance-site.com',
      name: ud.name || '',
      role: ud.role?.toLowerCase() || 'user',
      phone: ud.phone || '',
      department: ud.department || '',
      position: ud.position || '',
      projectAssignments: [],
      accountStatus: (ud.active ? 'active' : 'inactive') as 'active' | 'inactive' | 'suspended',
    };
    // 토큰만 먼저 설정 (apiClient가 사용할 수 있도록) — isAuthenticated는 아직 false
    useAuthStore.setState({ user, token: data.token, isAuthenticated: false });
    // 권한 로드 완료 후 인증 처리 — Sidebar가 처음 렌더링될 때 이미 올바른 권한이 반영됨
    await usePermissionStore.getState().fetchPermissions();
    useAuthStore.setState({ isAuthenticated: true });
    navigate('/');
  };

  const goBack = () => {
    setError('');
    setPassword(''); setVerificationCode(''); setNewPassword(''); setConfirmPassword('');
    setTimeRemaining(300);
    if (step === 'choose-method') setStep('enter-email');
    else setStep('choose-method');
  };

  // Step 1: 아이디 확인 → Step 2
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailId.trim()) { setError(t('enterEmailId')); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: emailId.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '사용자를 찾을 수 없습니다');
      }
      const data = await res.json();
      setUserPasswordSet(!!data.passwordSet);
      setStep('choose-method');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 비밀번호 방식 선택
  const handleChoosePassword = () => {
    setError('');
    setStep(userPasswordSet ? 'enter-password' : 'set-initial');
  };

  // Step 2: 이메일 인증코드 방식 선택 → 코드 전송
  const handleChooseEmailCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailId.trim() + '@maintenance-site.com' }),
      });
      if (!res.ok) throw new Error(t('sendCodeFailed'));
      setTimeRemaining(300);
      setStep('enter-code');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sendCodeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3A: 비밀번호 로그인
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError('비밀번호를 입력해주세요'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: emailId.trim(), password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t('loginFailed'));
      }
      const data = await res.json();
      if (data.requiresPasswordSetup) { setStep('set-initial'); setPassword(''); return; }
      await handleLoginSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3B: 최초 비밀번호 설정
  const handleSetInitialPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) { setError('새 비밀번호를 입력해주세요'); return; }
    if (newPassword.length < 6) { setError('비밀번호는 6자 이상이어야 합니다'); return; }
    if (newPassword !== confirmPassword) { setError('비밀번호가 일치하지 않습니다'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/set-initial-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: emailId.trim(), newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '비밀번호 설정에 실패했습니다');
      }
      await handleLoginSuccess(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: 인증코드 확인
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailId.trim() + '@maintenance-site.com', code: verificationCode.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t('invalidCode'));
      }
      const data = await res.json();
      if (!data.user) throw new Error(t('userInfoMissing'));
      await handleLoginSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('verificationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 인증코드 재전송
  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailId.trim() + '@maintenance-site.com' }),
      });
      if (!res.ok) throw new Error(t('sendCodeFailed'));
      setTimeRemaining(300);
      setVerificationCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sendCodeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 공통 입력 스타일
  const inputBg: React.CSSProperties = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)' };
  const onFocusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(59,130,246,0.5)';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  };
  const onBlurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(148,163,184,0.15)';
    e.target.style.boxShadow = 'none';
  };

  const submitBtnStyle = (loading: boolean): React.CSSProperties => ({
    background: loading ? '#475569' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
    boxShadow: loading ? 'none' : '0 4px 14px 0 rgba(59,130,246,0.3)',
  });

  const SpinnerBtn = ({ label }: { label: string }) => (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {label}
    </span>
  );

  const stepTitle: Record<LoginStep, string> = {
    'enter-email': t('loginTitle'),
    'choose-method': '로그인 방법 선택',
    'enter-password': '비밀번호 입력',
    'set-initial': '비밀번호 설정',
    'enter-code': '인증코드 입력',
  };
  const stepSubtitle: Record<LoginStep, string> = {
    'enter-email': t('loginSubtitle'),
    'choose-method': `${emailId}@maintenance-site.com`,
    'enter-password': `${emailId}@maintenance-site.com`,
    'set-initial': '처음 로그인하시는 경우 비밀번호를 설정해주세요',
    'enter-code': '이메일로 전송된 6자리 코드를 입력하세요',
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: '#0F172A', '--color-primary': '#3B82F6' } as React.CSSProperties}>
      {/* 배경 */}
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]" style={{
        background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)',
      }} />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px]" style={{
        background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 60%)',
      }} />

      {/* 왼쪽 브랜딩 (데스크톱) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-16">
        <div>
          <div className="mb-20">
            <span className="text-xl font-bold text-white tracking-tight">유지보수사이트</span>
          </div>
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-white leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
              {t('workSmarter')}<br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('manageEasier')}
              </span>
            </h1>
            <p className="text-lg leading-relaxed whitespace-pre-line" style={{ color: '#94A3B8' }}>
              {t('loginBrandingDesc')}
            </p>
          </div>
          <div className="mt-16 space-y-3">
            {[
              { icon: Building2, title: t('featureCompanyMgmt'), desc: t('featureCompanyMgmtDesc') },
              { icon: Wrench, title: t('featureMaintenanceProcess'), desc: t('featureMaintenanceProcessDesc') },
              { icon: ClipboardList, title: t('featureMaintenanceHistory'), desc: t('featureMaintenanceHistoryDesc') },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <f.icon size={20} style={{ color: '#60A5FA' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: '#475569' }}>© 2026 유지보수사이트. All rights reserved.</p>
      </div>

      {/* 오른쪽: 로그인 카드 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10">
            <span className="text-xl font-bold text-white tracking-tight">유지보수사이트</span>
          </div>

          {/* 카드 */}
          <div className="rounded-2xl p-8 sm:p-10" style={{
            background: 'rgba(30,41,59,0.5)',
            border: '1px solid rgba(148,163,184,0.1)',
            backdropFilter: 'blur(20px)',
          }}>

            {/* 헤더 */}
            <div className="mb-7">
              {step !== 'enter-email' && (
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1.5 text-sm font-medium mb-5 transition-opacity hover:opacity-70"
                  style={{ color: '#60A5FA' }}>
                  <ArrowLeft size={15} />뒤로
                </button>
              )}
              <h2 className="text-2xl font-bold text-white mb-1.5" style={{ letterSpacing: '-0.01em' }}>
                {stepTitle[step]}
              </h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>{stepSubtitle[step]}</p>
            </div>

            {/* 데모 안내 (백엔드 없이 목업 데이터로 동작하는 포트폴리오용 데모입니다) */}
            <div className="mb-5 p-3.5 rounded-xl" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <p className="text-xs leading-relaxed" style={{ color: '#93C5FD' }}>
                데모 계정 — 아이디: <b>admin</b>, 비밀번호: <b>1</b>
              </p>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-medium" style={{ color: '#FCA5A5' }}>{error}</p>
                </div>
              </div>
            )}

            {/* ── Step 1: 이메일 아이디 입력 ── */}
            {step === 'enter-email' && (
              <form onSubmit={handleContinue} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#CBD5E1' }}>{t('emailIdLabel')}</label>
                  <p className="text-xs mb-2.5" style={{ color: '#64748B' }}>{t('emailIdHint')}</p>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail size={18} style={{ color: '#475569' }} />
                    </div>
                    <input
                      type="text" value={emailId} onChange={(e) => setEmailId(e.target.value)}
                      autoComplete="off" required autoFocus
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
                      style={inputBg} onFocus={onFocusInput} onBlur={onBlurInput}
                      placeholder={t('emailIdPlaceholder')}
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  style={submitBtnStyle(isLoading)}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59,130,246,0.4)'; }}
                  onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59,130,246,0.3)'; }}
>                  {isLoading ? <SpinnerBtn label="확인 중..." /> : '계속하기'}
                </button>
              </form>
            )}

            {/* ── Step 2: 로그인 방법 선택 ── */}
            {step === 'choose-method' && (
              <div className="space-y-3">
                <button type="button" onClick={handleChoosePassword} disabled={isLoading}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 disabled:opacity-50 focus:outline-none"
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.07)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)'; }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Lock size={18} style={{ color: '#60A5FA' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-0.5">비밀번호로 로그인</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>계정의 비밀번호를 입력하여 로그인합니다</p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#64748B', flexShrink: 0 }} />
                </button>

                <button type="button" onClick={handleChooseEmailCode} disabled={isLoading}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 disabled:opacity-50 focus:outline-none"
                  style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.15)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)'; }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <Mail size={18} style={{ color: '#818CF8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-0.5">이메일 인증코드로 로그인</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>이메일로 인증코드를 받아 로그인합니다</p>
                  </div>
                  {isLoading
                    ? <svg className="animate-spin w-4 h-4 flex-shrink-0" style={{ color: '#64748B' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    : <ChevronRight size={16} style={{ color: '#64748B', flexShrink: 0 }} />
                  }
                </button>
              </div>
            )}

            {/* ── Step 3A: 비밀번호 입력 ── */}
            {step === 'enter-password' && (
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>{t('password')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key size={18} style={{ color: '#475569' }} />
                    </div>
                    <input
                      type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      required autoFocus
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
                      style={inputBg} onFocus={onFocusInput} onBlur={onBlurInput}
                      placeholder={t('passwordPlaceholder')}
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  style={submitBtnStyle(isLoading)}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59,130,246,0.4)'; }}
                  onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59,130,246,0.3)'; }}
>                  {isLoading ? <SpinnerBtn label={t('loggingIn')} /> : t('login')}
                </button>
              </form>
            )}

            {/* ── Step 3B: 최초 비밀번호 설정 ── */}
            {step === 'set-initial' && (
              <form onSubmit={handleSetInitialPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>새 비밀번호</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key size={18} style={{ color: '#475569' }} />
                    </div>
                    <input
                      type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      required autoFocus
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
                      style={inputBg} onFocus={onFocusInput} onBlur={onBlurInput}
                      placeholder="6자 이상 입력"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>비밀번호 확인</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key size={18} style={{ color: '#475569' }} />
                    </div>
                    <input
                      type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
                      style={inputBg} onFocus={onFocusInput} onBlur={onBlurInput}
                      placeholder="비밀번호 재입력"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  style={submitBtnStyle(isLoading)}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59,130,246,0.4)'; }}
                  onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59,130,246,0.3)'; }}
>                  {isLoading ? <SpinnerBtn label="설정 중..." /> : '설정 및 로그인'}
                </button>

              </form>
            )}

            {/* ── Step 4: 인증코드 입력 ── */}
            {step === 'enter-code' && (
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>{t('verificationCodeLabel')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key size={18} style={{ color: '#475569' }} />
                    </div>
                    <input
                      type="text" value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ''))}
                      autoComplete="off" autoCorrect="off" autoCapitalize="off"
                      spellCheck={false} inputMode="numeric"
                      required autoFocus maxLength={6}
                      className="w-full pl-11 pr-24 py-3 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
                      style={inputBg} onFocus={onFocusInput} onBlur={onBlurInput}
                      placeholder={t('verificationCodePlaceholder')}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${timeRemaining <= 60 ? 'text-red-400' : 'text-blue-400'}`}
                        style={{ background: timeRemaining <= 60 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)' }}>
                        <Clock size={12} /><span>{formatTime(timeRemaining)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={handleResendCode} disabled={isLoading}
                      className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40" style={{ color: '#60A5FA' }}>
                      이메일이 오지 않았나요? 재전송
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  style={submitBtnStyle(isLoading)}
                  onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59,130,246,0.4)'; }}
                  onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59,130,246,0.3)'; }}
>                  {isLoading ? <SpinnerBtn label={t('verifying')} /> : t('login')}
                </button>
              </form>
            )}

          </div>

          <div className="lg:hidden mt-8 text-center">
            <p className="text-xs" style={{ color: '#475569' }}>© 2026 유지보수사이트. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
