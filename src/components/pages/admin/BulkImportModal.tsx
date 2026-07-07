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
  const [allRows,     setAllRows]     = useState<Record<string,string>[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [summary,     setSummary]     = useState<{created:number;failed:number;total:number}|null>(null);
  const [failedRows,  setFailedRows]  = useState<{ row: number; error: string }[]>([]);
  const [existingRolls, setExistingRolls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'validating' | 'hashing' | 'creating'>('validating');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isSuperAdmin && !orgId) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isSuperAdmin && !orgId) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      handleFileChange(droppedFile);
    } else if (droppedFile) {
      setError('Only Excel files (.xlsx) are supported.');
    }
  };

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

  useEffect(() => {
    if (orgId) {
      studentApi.listStudents({ orgId, limit: 1000 })
        .then((d: any) => {
          const rolls = d.map((s: any) => s.rollNo).filter(Boolean);
          setExistingRolls(rolls);
        })
        .catch(() => {});
    } else {
      setExistingRolls([]);
    }
  }, [orgId]);

  // Helper to get detailed validation error for phone numbers (max 2, each 10 digits separated by "/")
  const getPhoneValidationError = (phone: string | undefined): string | null => {
    if (!phone || !phone.trim()) return null;
    const parts = phone.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length > 2) {
      return 'Max 2 phone numbers allowed';
    }
    for (const part of parts) {
      let digits = part.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.substring(2);
      } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.substring(1);
      }
      if (digits.length !== 10) {
        return `Phone number "${part}" must be exactly 10 digits (found ${digits.length})`;
      }
    }
    return null;
  };

  const isPhoneInvalid = (phone: string | undefined): boolean => {
    return getPhoneValidationError(phone) !== null;
  };

  const normalizeRollNo = (roll: string): string => {
    const val = String(roll).trim().toLowerCase();
    return val.replace(/(?:^|[^0-9])0+(\d+)/g, (match) => {
      return match.replace(/0+(\d+)/, '$1');
    }).replace(/^0+$/, '0');
  };

  const getRollNoValidationError = (rollVal: string | undefined, rowIndex: number): string | null => {
    if (!rollVal || !rollVal.trim()) return null;
    const trimmed = rollVal.trim();
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      return 'Roll number can only contain letters, numbers, and hyphens (-)';
    }
    const norm = normalizeRollNo(trimmed);
    
    // Check duplicate in DB
    const existingNorms = new Set(existingRolls.map(r => normalizeRollNo(r)));
    if (existingNorms.has(norm)) {
      return `Roll No "${trimmed}" matches an existing student (normalized: "${norm}")`;
    }

    // Check duplicate anywhere in list (excluding self)
    const rollSearch = ['studentid(rollno)', 'studentid', 'rollno', 'roll no', 'roll_no'];
    for (let i = 0; i < allRows.length; i++) {
      if (i === rowIndex) continue;
      const otherRow = allRows[i];
      const otherRollKey = getHeaderKey(otherRow, rollSearch);
      const otherRollVal = otherRow[otherRollKey];
      if (otherRollVal && normalizeRollNo(otherRollVal) === norm) {
        return `Duplicate of Row ${i + 2} inside this spreadsheet`;
      }
    }
    return null;
  };

  const isRollNoInvalid = (rollVal: string | undefined, rowIndex: number): boolean => {
    return getRollNoValidationError(rollVal, rowIndex) !== null;
  };

  // Helper to map keys case-insensitively
  const getHeaderKey = (row: Record<string, string>, searchKeys: string[]): string => {
    if (!row) return searchKeys[0];
    const found = Object.keys(row).find(rk => 
      searchKeys.some(sk => rk.toLowerCase().replace(/\s+/g,'') === sk.toLowerCase().replace(/\s+/g,''))
    );
    return found || searchKeys[0];
  };

  const handleCellChange = (rowIndex: number, key: string, val: string) => {
    setAllRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: val };
      return next;
    });
  };

  // Real-time validation warning aggregates
  const rollSearch = ['studentid(rollno)', 'studentid', 'rollno', 'roll no', 'roll_no'];
  const contactSearch = ['contactno', 'contact', 'phone'];
  
  let duplicateRollsCount = 0;
  let invalidPhonesCount = 0;

  allRows.forEach((row, idx) => {
    const rollKey = getHeaderKey(row, rollSearch);
    if (isRollNoInvalid(row[rollKey], idx)) {
      duplicateRollsCount++;
    }
    const contactKey = getHeaderKey(row, contactSearch);
    if (isPhoneInvalid(row[contactKey])) {
      invalidPhonesCount++;
    }
  });

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
        
        if (rows.length === 0) {
          setError('The uploaded Excel file is empty.');
          return;
        }

        const firstKeys = Object.keys(rows[0]);
        const nameKeyFound = firstKeys.some(k => k.trim().toLowerCase().replace(/\s+/g,'') === 'name');
        if (!nameKeyFound) {
          setError('❌ Invalid spreadsheet columns. The spreadsheet must contain a "Name" column. Please download the template to verify.');
          return;
        }

        // Clean keys and spaces
        const cleaned = rows.map(row => {
          const clean: Record<string, string> = {};
          for (const key of Object.keys(row)) {
            clean[key.trim()] = String(row[key]).trim();
          }
          return clean;
        });

        setAllRows(cleaned);
        setStep('upload');
      } catch (err: any) {
        setError(err.message || 'Could not parse Excel file. Make sure it is a valid .xlsx file.');
      }
    };
    reader.readAsBinaryString(f);
  };

  // ── Upload & create ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (allRows.length === 0) { setError('No rows to upload'); return; }
    if (isSuperAdmin && !orgId) { setError('Please select an organization first'); return; }
    
    // Check if any numbers are currently invalid
    const contactSearch = ['contactno', 'contact', 'phone'];
    for (let rIdx = 0; rIdx < allRows.length; rIdx++) {
      const row = allRows[rIdx];
      const contactKey = getHeaderKey(row, contactSearch);
      const val = row[contactKey];
      const validationError = getPhoneValidationError(val);
      if (validationError) {
        setError(`⚠️ Row ${rIdx + 2}: ${validationError}. Please correct it before saving.`);
        return;
      }
    }

    // Check if any roll numbers are duplicates of DB or spreadsheet entries
    const rollSearch = ['studentid(rollno)', 'studentid', 'rollno', 'roll no', 'roll_no'];
    const existingNorms = new Set(existingRolls.map(r => normalizeRollNo(r)));
    const currentNorms = new Set<string>();

    for (let rIdx = 0; rIdx < allRows.length; rIdx++) {
      const row = allRows[rIdx];
      const rollKey = getHeaderKey(row, rollSearch);
      const rollVal = row[rollKey];

      if (rollVal && rollVal.trim()) {
        const norm = normalizeRollNo(rollVal);
        if (existingNorms.has(norm)) {
          setError(`⚠️ Row ${rIdx + 2}: Roll No "${rollVal}" already exists in this organization (normalized: "${norm}"). Please edit it to be unique.`);
          return;
        }
        if (currentNorms.has(norm)) {
          setError(`⚠️ Row ${rIdx + 2}: Duplicate Roll No "${rollVal}" found inside this spreadsheet. Please change it before creating.`);
          return;
        }
        currentNorms.add(norm);
      }
    }

    setLoading(true);
    setLoadingStage('validating');
    setError('');

    // Simulate perceived progress of stages
    const timer1 = setTimeout(() => {
      setLoadingStage('hashing');
    }, 450);

    const timer2 = setTimeout(() => {
      setLoadingStage('creating');
    }, 1500);

    try {
      const res = await studentApi.bulkImport(allRows, orgId) as any;
      setCredentials(res.credentials || []);
      setFailedRows(res.failedRows || res.failed || []);
      setSummary({ created: res.created, failed: res.failed, total: res.summary?.total || 0 });
      setStep('credentials');
      if (res.created > 0) {
        onSuccess();
      } else {
        setError('No students were imported. All rows in the spreadsheet contained validation errors.');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed. Check the file format and try again.');
    } finally {
      setLoading(false);
      clearTimeout(timer1);
      clearTimeout(timer2);
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
      <div className="w-full max-w-3xl bg-[#0B1628] border border-[#1E2E52] rounded-2xl shadow-2xl overflow-hidden relative animate-slideUp">

        {/* Real-time High Performance Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-50 bg-[#0B1628]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6 animate-fadeIn">
            {/* Circular spinner with gold Accent */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-gold/15 border-t-gold animate-spin"></div>
              <span className="text-2xl animate-pulse">👑</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-white font-bold text-sm tracking-wide">Creating Student Profiles...</h3>
              <p className="text-[10px] text-gray-400">Hashing credentials securely & initializing rating history. Please wait.</p>
            </div>
            
            {/* Step Status Tracker */}
            <div className="w-64 bg-[#0D1E3A] border border-[#1E2E52] rounded-xl p-4 space-y-2 text-left shadow-lg">
              {/* Step 1 */}
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wide">
                <span className="text-gray-300">📊 1. Validation</span>
                {loadingStage === 'validating' ? (
                  <span className="text-gold animate-pulse">Processing…</span>
                ) : (
                  <span className="text-green-400">✓ Checked</span>
                )}
              </div>
              {/* Step 2 */}
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wide">
                <span className={loadingStage === 'validating' ? 'text-gray-600' : 'text-gray-300'}>🔒 2. Hash & Encrypt</span>
                {loadingStage === 'validating' ? (
                  <span className="text-gray-600">Waiting…</span>
                ) : loadingStage === 'hashing' ? (
                  <span className="text-gold animate-pulse">Processing…</span>
                ) : (
                  <span className="text-green-400">✓ Done</span>
                )}
              </div>
              {/* Step 3 */}
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wide">
                <span className={loadingStage !== 'creating' ? 'text-gray-600' : 'text-gray-300'}>🏫 3. Create Profiles</span>
                {loadingStage !== 'creating' ? (
                  <span className="text-gray-600">Waiting…</span>
                ) : (
                  <span className="text-gold animate-pulse">Creating…</span>
                )}
              </div>
            </div>
          </div>
        )}

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

              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-5 transition-all duration-200 ${
                  isSuperAdmin && !orgId 
                    ? 'opacity-40 cursor-not-allowed border-[#1E2E52]' 
                    : isDragging
                      ? 'border-gold bg-[#12234A]/30 scale-[1.01]'
                      : 'border-[#1E2E52] hover:border-gold/50 cursor-pointer'
                }`}
              >
                <span className="text-2xl">{isDragging ? '📥' : '📂'}</span>
                <span className="text-xs text-gray-400">
                  {isSuperAdmin && !orgId 
                    ? 'Please select an organization first' 
                    : isDragging
                      ? 'Drop the Excel file here!'
                      : 'Click or drag & drop your filled .xlsx file here'}
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
              <div className="flex items-center justify-between bg-[#0D1E3A] border border-[#1E2E52] rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{file?.name}</p>
                    <p className="text-[10px] text-gray-500">{allRows.length} total rows parsed · editable preview below</p>
                  </div>
                </div>
                <button onClick={() => { setFile(null); setAllRows([]); setStep('template'); }}
                  className="text-[10px] text-gray-500 hover:text-red-400 font-bold ml-4">Remove</button>
              </div>

              {/* Dynamic Real-time Warning Alerts */}
              {duplicateRollsCount > 0 && (
                <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <span>⚠️</span>
                  <span>{duplicateRollsCount} roll number(s) already exist or are duplicates. Please change them before submitting.</span>
                </div>
              )}
              {invalidPhonesCount > 0 && (
                <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <span>⚠️</span>
                  <span>{invalidPhonesCount} student phone number(s) do not have exactly 10 digits. Please check them before submitting.</span>
                </div>
              )}

              {/* Preview table with inline editing */}
              {allRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">✏️ Preview List (Click cell value to edit):</p>
                  <div className="bg-[#0D1E3A] rounded-xl border border-[#1E2E52] overflow-x-auto max-h-60 select-text">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead className="sticky top-0 bg-[#0D1E3A] z-10 shadow-[0_1px_0_0_#1E2E52]">
                        <tr className="border-b border-[#1E2E52]">
                          {['Student ID (Roll No)', 'Name', 'Gender', 'Class', 'ContactNo', 'Email'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-gold font-bold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2E52]">
                        {allRows.map((row, i) => {
                          const rollKey = getHeaderKey(row, ['studentid(rollno)', 'studentid', 'rollno', 'roll no', 'roll_no']);
                          const nameKey = getHeaderKey(row, ['name']);
                          const genderKey = getHeaderKey(row, ['gender']);
                          const classKey = getHeaderKey(row, ['class']);
                          const contactKey = getHeaderKey(row, ['contactno', 'contact', 'phone']);
                          const emailKey = getHeaderKey(row, ['email']);

                          return (
                            <tr key={i} className="hover:bg-[#12234A]/25 transition-colors">
                              {/* Roll No */}
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={row[rollKey] || ''}
                                  title={getRollNoValidationError(row[rollKey], i) || 'Student ID (Roll No)'}
                                  onChange={(e) => handleCellChange(i, rollKey, e.target.value)}
                                  className={`bg-transparent border-b focus:outline-none w-full text-xs px-1 ${
                                    isRollNoInvalid(row[rollKey], i)
                                      ? 'text-red-400 border-red-500/50 bg-red-950/10'
                                      : 'text-gray-300 border-transparent hover:border-gold/30 focus:border-gold'
                                  }`}
                                />
                              </td>
                              {/* Name */}
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={row[nameKey] || ''}
                                  onChange={(e) => handleCellChange(i, nameKey, e.target.value)}
                                  className="bg-transparent border-b border-transparent hover:border-gold/30 focus:border-gold focus:outline-none w-full text-xs px-1 text-white font-medium"
                                  required
                                />
                              </td>
                              {/* Gender */}
                              <td className="px-2.5 py-1.5">
                                <select
                                  value={row[genderKey] || ''}
                                  onChange={(e) => handleCellChange(i, genderKey, e.target.value)}
                                  className="bg-transparent focus:outline-none focus:border-gold text-xs text-gray-300 cursor-pointer w-full px-1 border-b border-transparent"
                                >
                                  <option value="" className="bg-[#0D1B33]">Select…</option>
                                  <option value="male" className="bg-[#0D1B33]">male</option>
                                  <option value="female" className="bg-[#0D1B33]">female</option>
                                  <option value="other" className="bg-[#0D1B33]">other</option>
                                </select>
                              </td>
                              {/* Class */}
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={row[classKey] || ''}
                                  onChange={(e) => handleCellChange(i, classKey, e.target.value)}
                                  className="bg-transparent border-b border-transparent hover:border-gold/30 focus:border-gold focus:outline-none w-14 text-xs px-1 text-gray-300"
                                />
                              </td>
                              {/* ContactNo */}
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={row[contactKey] || ''}
                                  title={getPhoneValidationError(row[contactKey]) || 'E.g. 9876543210'}
                                  onChange={(e) => handleCellChange(i, contactKey, e.target.value)}
                                  className={`bg-transparent border-b focus:outline-none w-full text-xs px-1 ${
                                    isPhoneInvalid(row[contactKey])
                                      ? 'text-red-400 border-red-500/50 bg-red-950/10'
                                      : 'text-gray-300 border-transparent hover:border-gold/30 focus:border-gold'
                                  }`}
                                  placeholder="E.g. 9876543210"
                                />
                              </td>
                              {/* Email */}
                              <td className="px-2.5 py-1.5">
                                <input
                                  type="text"
                                  value={row[emailKey] || ''}
                                  onChange={(e) => handleCellChange(i, emailKey, e.target.value)}
                                  className="bg-transparent border-b border-transparent hover:border-gold/30 focus:border-gold focus:outline-none w-full text-xs px-1 text-gray-300"
                                  placeholder="Auto-generated"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setFile(null); setAllRows([]); setStep('template'); }}
                  className="flex-1 py-2.5 text-xs font-bold border border-[#1E2E52] text-gray-400 hover:text-white rounded-xl transition-colors">
                  ← Back
                </button>
                <button onClick={handleUpload} disabled={loading || (isSuperAdmin && !orgId)}
                  className="flex-1 btn-gold py-2.5 text-xs font-bold disabled:opacity-50">
                  {loading ? 'Creating students…' : `✓ Create ${allRows.length > 0 ? 'All' : ''} Students`}
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

              {credentials.length === 0 && (
                <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-4 rounded-xl text-xs font-bold text-center">
                  ❌ All rows failed to import. Check the error list below.
                </div>
              )}

              {/* Failed Rows Warnings */}
              {failedRows.length > 0 && (
                <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-3 rounded-xl text-xs max-h-40 overflow-y-auto space-y-1">
                  <p className="font-bold text-red-300">⚠️ Row errors encountered ({failedRows.length}):</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {failedRows.map((f, idx) => (
                      <li key={idx}><strong>Row {f.row}:</strong> {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Credentials table */}
              {credentials.length > 0 && (
                <div className="bg-[#0D1E3A] rounded-xl border border-[#1E2E52] overflow-x-auto max-h-52">
                  <table className="w-full text-xs min-w-max">
                    <thead className="sticky top-0 bg-[#0D1E3A] z-10 shadow-[0_1px_0_0_#1E2E52]">
                      <tr className="border-b border-[#1E2E52]">
                        {['Roll No','Name','Class','Email','Password'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-gold font-bold whitespace-nowrap">{h}</th>
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
              )}

              <button 
                onClick={handleDownloadCredentials}
                disabled={credentials.length === 0}
                className="w-full btn-gold py-3 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
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
