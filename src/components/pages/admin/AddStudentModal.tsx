import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { authApi, adminApi } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import CreateOrgModal from './CreateOrgModal';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  preselectedOrgId?:    string;
  preselectedOrgName?:  string;
  preselectedDistrict?: string;
}

const CLASSES = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

export default function AddStudentModal({ onClose, onSuccess, preselectedOrgId, preselectedOrgName, preselectedDistrict }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isSubAdmin   = user?.role === 'sub_admin';

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,         setName]         = useState('');
  const [gender,       setGender]       = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [rollNo,       setRollNo]       = useState('');
  const [contacts,     setContacts]     = useState<string[]>(['']);
  const [email,        setEmail]        = useState('');
  const [emailStatus,  setEmailStatus]  = useState<'idle'|'checking'|'ok'|'taken'>('idle');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [orgId,        setOrgId]        = useState(preselectedOrgId || (isSubAdmin ? (user as any)?.orgId || (user as any)?.managedSchoolId || '' : ''));
  const [orgName,      setOrgName]      = useState(preselectedOrgName || (isSubAdmin ? (user as any)?.managedSchoolName || '' : ''));
  const [orgs,         setOrgs]         = useState<any[]>([]);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{email:string;password:string}|null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Load orgs for super_admin
  useEffect(() => {
    if (isSuperAdmin) {
      adminApi.getOrganizations().then((d: any) => setOrgs(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  // ── Email generation ────────────────────────────────────────────────────────
  const handleGenerateEmail = async () => {
    if (!name.trim()) { setError('Enter the student name first to generate an email.'); return; }
    setEmailStatus('checking');
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).join('.');
    let candidate = `${slug}@sigaram64.com`;
    try {
      const res = await authApi.checkEmail(candidate);
      if (res.available) {
        setEmail(candidate); setEmailStatus('ok');
      } else {
        for (let i = 1; i <= 99; i++) {
          const next = `${slug}${i}@sigaram64.com`;
          const r2 = await authApi.checkEmail(next);
          if (r2.available) { setEmail(next); setEmailStatus('ok'); break; }
        }
      }
    } catch { setEmailStatus('idle'); }
  };

  // ── Real-time email check ───────────────────────────────────────────────────
  const handleEmailChange = useCallback((val: string) => {
    setEmail(val);
    setEmailStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const res = await authApi.checkEmail(val.trim());
        setEmailStatus(res.available ? 'ok' : 'taken');
      } catch { setEmailStatus('idle'); }
    }, 500);
  }, []);

  // ── Org picker ──────────────────────────────────────────────────────────────
  const handleOrgSelect = (id: string) => {
    if (id === '__create__') { setShowCreateOrg(true); return; }
    setOrgId(id);
    const found = orgs.find(o => o.id === id);
    if (found) setOrgName(found.name);
  };

  // ── Contacts ────────────────────────────────────────────────────────────────
  const setContact = (idx: number, val: string) =>
    setContacts(prev => prev.map((c, i) => i === idx ? val : c));
  const addContact = () => { if (contacts.length < 2) setContacts(prev => [...prev, '']); };
  const removeContact = (idx: number) => setContacts(prev => prev.filter((_, i) => i !== idx));

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (isSuperAdmin && !orgId) { setError('Please select an organization.'); return; }
    if (emailStatus === 'taken') { setError('This email is already in use. Generate one or use a different email.'); return; }

    setLoading(true); setError('');
    try {
      const payload: any = {
        name: name.trim(),
        orgId: orgId || (isSubAdmin ? (user as any)?.orgId || (user as any)?.managedSchoolId : undefined),
        ...(gender       ? { gender }       : {}),
        ...(studentClass ? { studentClass }  : {}),
        ...(rollNo.trim() ? { rollNo: rollNo.trim() } : {}),
        contact: contacts.filter(Boolean),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(password.trim() ? { password: password.trim() } : {}),
      };
      const res: any = await authApi.signup(payload);
      setCreatedCreds({
        email: res.user?.email || payload.email || email || '',
        password: res.generatedPassword || payload.password || '(auto-generated)',
      });
      setSuccessMsg(`✅ Student "${name}" created successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to create student');
    } finally {
      setLoading(false);
    }
  };

  // ── Email status indicator ──────────────────────────────────────────────────
  const emailIndicator = emailStatus === 'ok'       ? <span className="text-green-400 text-[10px] ml-1">✓ Available</span>
                       : emailStatus === 'taken'     ? <span className="text-red-400 text-[10px] ml-1">✗ Already in use</span>
                       : emailStatus === 'checking'  ? <span className="text-yellow-400 text-[10px] ml-1">Checking…</span>
                       : null;

  const inputCls = "w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gold transition-colors";
  const labelCls = "text-[10px] font-bold text-gray-400 uppercase tracking-wider";

  const modal = createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-[#0B1628] border border-[#1E2E52] rounded-2xl shadow-2xl overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2E52] bg-[#0D1E3A]">
          <div>
            <h2 className="text-white font-bold text-base">Add New Student</h2>
            <p className="text-gray-500 text-[10px] mt-0.5">
              {isSubAdmin ? `Org: ${orgName}` : 'All fields filled here — student logs in directly'}
            </p>
          </div>
          <button onClick={successMsg ? onSuccess : onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[78vh] overflow-y-auto">
          {error      && <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-3 rounded-xl text-xs mb-4">{error}</div>}
          
          {successMsg ? (
            <div className="space-y-4">
              <div className="bg-green-950/20 border border-green-800/30 text-green-400 p-5 rounded-2xl text-xs space-y-3">
                <p className="text-sm font-bold">{successMsg}</p>
                <div className="bg-[#0B1628] border border-green-800/20 rounded-xl p-4 space-y-2 select-text">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Student Credentials</p>
                  <div className="h-px bg-green-800/20 my-1" />
                  <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Email:</span> <span className="text-white font-mono font-bold select-all">{createdCreds?.email}</span></p>
                  <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Password:</span> <span className="text-white font-mono font-bold select-all">{createdCreds?.password}</span></p>
                </div>
                <div className="bg-yellow-900/10 border border-yellow-700/20 text-yellow-400 rounded-xl p-3 text-[10px] mt-3">
                  ⚠️ Save these credentials now. Passwords are encrypted for safety and will require verification to see again.
                </div>
              </div>
              <button
                onClick={onSuccess}
                className="w-full btn-gold py-3 text-xs font-bold transition-all"
              >
                Close & Refresh
              </button>
            </div>
          ) : (

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Row 1: Name + Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  required placeholder="e.g. Arjun Kumar" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}
                  className={inputCls + " cursor-pointer"}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Row 2: Class + Roll No */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Class</label>
                <select value={studentClass} onChange={e => setStudentClass(e.target.value)}
                  className={inputCls + " cursor-pointer"}>
                  <option value="">Select Class…</option>
                  {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Roll No <span className="text-gray-600 normal-case">(optional)</span></label>
                <input type="text" value={rollNo} onChange={e => setRollNo(e.target.value)}
                  placeholder="e.g. R001" className={inputCls} />
                {rollNo.length > 0 && !/^[a-zA-Z0-9-]+$/.test(rollNo) && (
                  <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠️ Only alphanumeric characters and hyphens (-) allowed</p>
                )}
              </div>
            </div>

            {/* Contact numbers */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Contact Number(s)</label>
                {contacts.length < 2 && (
                  <button type="button" onClick={addContact}
                    className="text-[10px] text-gold hover:text-yellow-300 font-bold">+ Add</button>
                )}
              </div>
              {contacts.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <input type="tel" value={c} onChange={e => setContact(i, e.target.value)}
                      placeholder={`Phone ${i + 1}`}
                      className={inputCls + " flex-1"} />
                    {contacts.length > 1 && (
                      <button type="button" onClick={() => removeContact(i)}
                        className="text-red-500 hover:text-red-400 text-sm font-bold px-1">✕</button>
                    )}
                  </div>
                  {c.length > 0 && (c.replace(/\D/g, '').length !== 10 || /\D/.test(c)) && (
                    <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚠️ Phone number must be exactly 10 digits</p>
                  )}
                </div>
              ))}
            </div>

            {/* Email with generate button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelCls}>
                  Email {emailIndicator}
                </label>
                <button type="button" onClick={handleGenerateEmail}
                  title="Auto-generate a unique email from the student name"
                  className="text-[10px] bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg px-2 py-1 font-bold transition-colors flex items-center gap-1">
                  ⚡ Generate
                </button>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="Leave blank to auto-generate on save"
                className={`${inputCls} ${emailStatus === 'taken' ? 'border-red-500/60' : emailStatus === 'ok' ? 'border-green-500/60' : ''}`}
              />
              {email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠️ Invalid email address format</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className={labelCls}>Password <span className="text-gray-600 normal-case">(auto-generated if blank)</span></label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className={inputCls + " pr-10"}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Org picker (super_admin) or read-only org info (sub_admin) */}
            {isSuperAdmin ? (
              <div className="space-y-1">
                <label className={labelCls}>Organization *</label>
                <select value={orgId} onChange={e => handleOrgSelect(e.target.value)}
                  className={inputCls + " cursor-pointer"} required>
                  <option value="">Select an organization…</option>
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name} — {o.district}</option>
                  ))}
                  <option value="__create__">➕ Create new organization…</option>
                </select>
                {orgName && <p className="text-[10px] text-gray-500 mt-1">🏫 {orgName}</p>}
              </div>
            ) : (
              <div className="bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 flex items-center gap-3">
                <span className="text-lg">🏫</span>
                <div>
                  <p className="text-xs text-white font-medium">{orgName || 'Your Organization'}</p>
                  <p className="text-[10px] text-gray-500">Student will be created under your org</p>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={
                loading || 
                emailStatus === 'taken' ||
                (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
                (rollNo.length > 0 && !/^[a-zA-Z0-9-]+$/.test(rollNo)) ||
                contacts.some(c => c.length > 0 && (c.replace(/\D/g, '').length !== 10 || /\D/.test(c)))
              }
              className="w-full btn-gold py-3 text-xs font-bold shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Creating Student…' : '✓ Create Student'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {modal}
      {showCreateOrg && (
        <CreateOrgModal
          onClose={() => setShowCreateOrg(false)}
          onSuccess={(newOrg: any) => {
            setShowCreateOrg(false);
            if (newOrg?.orgId) {
              adminApi.getOrganizations().then((data: any) => {
                const list = Array.isArray(data) ? data : [];
                setOrgs(list);
                const created = list.find((o: any) => o.id === newOrg.orgId);
                if (created) { setOrgId(created.id); setOrgName(created.name); }
              });
            }
          }}
        />
      )}
    </>
  );
}
