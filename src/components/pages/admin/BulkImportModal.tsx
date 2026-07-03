import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { studentApi, adminApi } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import * as XLSX from 'xlsx';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  preselectedOrgId?: string;
  preselectedOrgName?: string;
}

type Step = 'template' | 'upload' | 'credentials';

interface Credential {
  rollNo: string;
  name: string;
  email: string;
  password: string;
  studentClass: string;
}

export default function BulkImportModal({ onClose, onSuccess, preselectedOrgId, preselectedOrgName }: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [step,        setStep]        = useState<Step>('template');
  const [file,        setFile]        = useState<File | null>(null);
  const [preview,     setPreview]     = useState<Record<string,string>[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [summary,     setSummary]     = useState<{created:number;failed:number;total:number}|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Org selections for super admin
  const [orgId,   setOrgId]   = useState(preselectedOrgId || '');
  const [orgName, setOrgName] = useState(preselectedOrgName || '');
  const [orgs,    setOrgs]    = useState<any[]>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      adminApi.getOrganizations()
        .then((d: any) => setOrgs(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // ── Download template ────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      const blob = await studentApi.downloadBulkTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'sigaram64_student_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download template. Try again.');
    }
  };

  // ── File selection & preview ─────────────────────────────────────────────────
  const handleFileChange = (f: File | null) => {
    if (!f) return;
    setFile(f); setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string,string>>(ws, { defval: '' });
        setPreview(rows.slice(0, 5));
        setStep('upload');
      } catch {
        setError('Could not parse Excel file. Make sure it is a valid .xlsx file.');
      }
    };
    reader.readAsBinaryString(f);
  };

  // ── Upload & create ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError('No file selected'); return; }
    if (isSuperAdmin && !orgId) { setError('Please select an organization first'); return; }
    setLoading(true); setError('');
    try {
      const res = await studentApi.bulkImport(file, orgId) as any;
      setCredentials(res.credentials || []);
      setSummary({ created: res.created, failed: res.failed, total: res.summary?.total || 0 });
      setStep('credentials');
      if (res.created > 0) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Upload failed. Check the file format and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Download credentials Excel ────────────────────────────────────────────────
  const handleDownloadCredentials = () => {
    const rows = credentials.map(c => ({
      'Roll No': c.rollNo,
      'Name': c.name,
      'Class': c.studentClass,
      'Email': c.email,
      'Password': c.password,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 32 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sigaram64_credentials.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const modal = createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-[#0B1628] border border-[#1E2E52] rounded-2xl shadow-2xl overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2E52] bg-[#0D1E3A]">
          <div>
            <h2 className="text-white font-bold text-base">Bulk Student Import</h2>
            <p className="text-gray-500 text-[10px] mt-0.5">
              {step === 'template' ? 'Step 1 — Download template' : step === 'upload' ? 'Step 2 — Upload & preview' : 'Step 3 — Download credentials'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 gap-2 border-b border-[#1E2E52]">
          {(['template','upload','credentials'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${step === s ? 'bg-gold text-navy' : credentials.length > 0 || (i < ['template','upload','credentials'].indexOf(step)) ? 'bg-green-700 text-white' : 'bg-[#1E2E52] text-gray-500'}`}>
                {i + 1}
              </div>
              <span className={`text-[10px] ${step === s ? 'text-white' : 'text-gray-500'}`}>
                {s === 'template' ? 'Template' : s === 'upload' ? 'Upload' : 'Credentials'}
              </span>
              {i < 2 && <span className="text-gray-700 text-xs mx-1">›</span>}
            </div>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
          {error && <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-3 rounded-xl text-xs">{error}</div>}

          {/* Organization Selector for Super Admin (Steps 1 & 2 only) */}
          {isSuperAdmin && step !== 'credentials' && (
            <div className="space-y-1 text-left bg-[#0D1E3A] border border-[#1E2E52] rounded-xl p-4">
              <label className="text-[10px] font-bold text-gold uppercase tracking-wider block">Organization Assignment *</label>
              <select
                value={orgId}
                onChange={e => {
                  setOrgId(e.target.value);
                  const found = orgs.find(o => o.id === e.target.value);
                  setOrgName(found ? found.name : '');
                }}
                className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold cursor-pointer mt-1"
                required
              >
                <option value="">Select an organization…</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name} — {o.district}</option>
                ))}
              </select>
              {orgName ? (
                <p className="text-[10px] text-green-400 mt-1">🏫 Students will be imported to: <strong className="font-bold">{orgName}</strong></p>
              ) : (
                <p className="text-[10px] text-red-400 mt-1">⚠️ You must select an organization before uploading.</p>
              )}
            </div>
          )}

          {/* ── Step 1: Template ──────────────────────────────────────────── */}
          {step === 'template' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">Download the Excel template, fill in your student data, then upload it here.</p>

              {/* Column guide */}
              <div className="bg-[#0D1E3A] rounded-xl border border-[#1E2E52] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1E2E52]">
                      <th className="text-left px-3 py-2 text-gold font-bold">Column</th>
                      <th className="text-left px-3 py-2 text-gold font-bold">Required</th>
                      <th className="text-left px-3 py-2 text-gold font-bold">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E52]">
                    {[
                      ['Student ID (Roll No)', 'No', 'R001'],
                      ['Name', 'Yes', 'Arjun Kumar'],
                      ['Gender', 'No', 'male / female / other'],
                      ['Class', 'No', 'I – XII'],
                      ['ContactNo', 'No', '9876543210 or 98765/98766'],
                      ['Email', 'No', 'Auto-generated if blank'],
                    ].map(([col, req, ex]) => (
                      <tr key={col}>
                        <td className="px-3 py-2 text-white font-medium">{col}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${req === 'Yes' ? 'bg-red-900/40 text-red-400' : 'bg-[#1E2E52] text-gray-400'}`}>{req}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-400">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-gray-500">
                ℹ️ Password is always auto-generated. Email is auto-generated if left blank.
              </p>

              <button onClick={handleDownloadTemplate}
                className="w-full btn-gold py-3 text-xs font-bold flex items-center justify-center gap-2">
                ⬇ Download Template
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#1E2E52]" /></div>
                <div className="relative flex justify-center"><span className="px-3 bg-[#0B1628] text-xs text-gray-500">or upload if you already have it</span></div>
              </div>

              <label className={`w-full flex flex-col items-center gap-2 border-2 border-dashed border-[#1E2E52] rounded-xl p-5 transition-colors ${isSuperAdmin && !orgId ? 'opacity-40 cursor-not-allowed' : 'hover:border-gold/50 cursor-pointer'}`}>
                <span className="text-2xl">📂</span>
                <span className="text-xs text-gray-400">
                  {isSuperAdmin && !orgId ? 'Please select an organization first' : 'Click to select your filled .xlsx file'}
                </span>
                <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden"
                  disabled={isSuperAdmin && !orgId}
                  onChange={e => handleFileChange(e.target.files?.[0] || null)} />
              </label>
            </div>
          )}

          {/* ── Step 2: Upload & Preview ──────────────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-[#0D1E3A] border border-[#1E2E52] rounded-xl px-4 py-3">
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{file?.name}</p>
                  <p className="text-[10px] text-gray-500">{preview.length} preview rows (showing up to 5)</p>
                </div>
                <button onClick={() => { setFile(null); setPreview([]); setStep('template'); }}
                  className="text-[10px] text-gray-500 hover:text-red-400 font-bold">Remove</button>
              </div>

              {/* Preview table */}
              {preview.length > 0 && (
                <div className="bg-[#0D1E3A] rounded-xl border border-[#1E2E52] overflow-x-auto">
                  <table className="w-full text-xs min-w-max">
                    <thead>
                      <tr className="border-b border-[#1E2E52]">
                        {Object.keys(preview[0]).map(k => (
                          <th key={k} className="text-left px-3 py-2 text-gold font-bold whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2E52]">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-gray-300 whitespace-nowrap">{String(v) || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setFile(null); setPreview([]); setStep('template'); }}
                  className="flex-1 py-2.5 text-xs font-bold border border-[#1E2E52] text-gray-400 hover:text-white rounded-xl transition-colors">
                  ← Back
                </button>
                <button onClick={handleUpload} disabled={loading || (isSuperAdmin && !orgId)}
                  className="flex-1 btn-gold py-2.5 text-xs font-bold disabled:opacity-50">
                  {loading ? 'Creating students…' : `✓ Create ${preview.length > 0 ? 'All' : ''} Students`}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Credentials ──────────────────────────────────────── */}
          {step === 'credentials' && (
            <div className="space-y-4">
              {summary && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Rows', value: summary.total, color: 'text-white' },
                    { label: 'Created',    value: summary.created, color: 'text-green-400' },
                    { label: 'Failed',     value: summary.failed,  color: summary.failed > 0 ? 'text-red-400' : 'text-gray-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0D1E3A] border border-[#1E2E52] rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-xl p-3">
                <p className="text-yellow-400 text-xs font-bold">⚠️ Save these credentials now</p>
                <p className="text-yellow-600 text-[10px] mt-1">Passwords will not be shown again. Download the Excel file to share with students.</p>
              </div>

              {/* Credentials table */}
              <div className="bg-[#0D1E3A] rounded-xl border border-[#1E2E52] overflow-x-auto max-h-52">
                <table className="w-full text-xs min-w-max">
                  <thead className="sticky top-0 bg-[#0D1E3A]">
                    <tr className="border-b border-[#1E2E52]">
                      {['Roll No','Name','Class','Email','Password'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-gold font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E52]">
                    {credentials.map((c, i) => (
                      <tr key={i} className="hover:bg-[#1E2E52]/30">
                        <td className="px-3 py-2 text-gray-400">{c.rollNo}</td>
                        <td className="px-3 py-2 text-white font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-gray-300">{c.studentClass}</td>
                        <td className="px-3 py-2 text-blue-300 font-mono">{c.email}</td>
                        <td className="px-3 py-2 text-green-300 font-mono font-bold">{c.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={handleDownloadCredentials}
                className="w-full btn-gold py-3 text-xs font-bold flex items-center justify-center gap-2">
                ⬇ Download Credentials Excel
              </button>

              <button onClick={onClose}
                className="w-full py-2.5 text-xs font-bold border border-[#1E2E52] text-gray-400 hover:text-white rounded-xl transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return <>{modal}</>;
}
