// SIGARAM64 — OrganizationDetail
// Super admin deep-dive view of one organization: stats, students table, settings, actions
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { adminApi, studentApi } from '../../../api';
import CreateOrgModal from './CreateOrgModal';
import AddStudentModal from './AddStudentModal';
import BulkImportModal from './BulkImportModal';
import StudentList from './StudentList';
import * as XLSX from 'xlsx';

export default function OrganizationDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [org,     setOrg]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Students list
  const [students,     setStudents]     = useState<any[]>([]);
  const [studLoading,  setStudLoading]  = useState(false);

  const [showEdit,       setShowEdit]       = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ org: any; newStatus: boolean } | null>(null);

  // Secure Password Decryption and Settings states
  const [showSettingsMenu, setShowSettingsMenu]     = useState(false);
  const [showVerifyModal, setShowVerifyModal]       = useState(false);
  const [verifyAction, setVerifyAction]             = useState<'view_subadmin' | 'download_all' | null>(null);
  const [verifyLoading, setVerifyLoading]           = useState(false);
  const [decryptedPassword, setDecryptedPassword]   = useState<string | null>(null);
  const [toast, setToast]                           = useState("");
  const [verifyError, setVerifyError]               = useState("");
  const [verifyAttempts, setVerifyAttempts]         = useState(0);

  const loadOrg = () => {
    if (!id) return;
    adminApi.getOrganizationDetail(id)
      .then(data => setOrg(data))
      .catch(err => console.error('Failed to load org', err))
      .finally(() => setLoading(false));
  };

  const loadStudents = () => {
    if (!id) return;
    setStudLoading(true);
    loadOrg();
    studentApi.listStudents({ orgId: id, limit: 1000 })
      .then(data => {
        const mapped = data.map((s: any) => ({
          id: s.id || s._id,
          name: s.name,
          email: s.email,
          gender: s.gender,
          studentClass: s.studentClass,
          rollNo: s.rollNo,
          contact: s.contact,
          school: s.school,
          active: s.active,
          elo: s.elo ?? 1000,
          gamesPlayed: s.gamesPlayed ?? 0
        }));
        setStudents(mapped);
      })
      .catch(err => console.error('Failed to load students', err))
      .finally(() => setStudLoading(false));
  };

  const handleConfirmStatusChange = async () => {
    if (!confirmStatusModal) return;
    const { org, newStatus } = confirmStatusModal;
    setConfirmStatusModal(null);
    try {
      await adminApi.updateOrganization(org.id, { active: newStatus });
      loadOrg();
    } catch { /* ignore */ }
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleVerifySubmit(adminPassword: string) {
    if (!org?.id) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      if (verifyAction === 'view_subadmin') {
        const res = await adminApi.decryptSubAdminCredentials(org.id, adminPassword);
        setShowVerifyModal(false);
        if (res?.password) {
          setDecryptedPassword(res.password);
        } else {
          showToast("❌ Password not found or not encrypted yet");
        }
      } else if (verifyAction === 'download_all') {
        const targetIds = students.map(s => s.id);
        const res = await studentApi.decryptCredentials(adminPassword, targetIds);
        setShowVerifyModal(false);
        if (!res || res.length === 0) {
          showToast("❌ No credentials to download");
          return;
        }
        const rows = res.map(c => ({
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
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `sigaram64_credentials_${new Date().toISOString().split('T')[0]}.xlsx`; 
        a.click();
        URL.revokeObjectURL(url);
        showToast("📥 Credentials downloaded successfully!");
      }
      setVerifyAttempts(0);
    } catch (err: any) {
      const nextCount = verifyAttempts + 1;
      setVerifyAttempts(nextCount);
      if (nextCount >= 3) {
        localStorage.removeItem('sigaram64_token');
        window.location.href = '/login';
      } else {
        setVerifyError(`❌ Incorrect password. ${3 - nextCount} attempt(s) remaining before secure logout.`);
      }
    } finally {
      setVerifyLoading(false);
    }
  }

  useEffect(() => {
    loadOrg();
    loadStudents();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 font-bold">Organization not found</p>
        <Link to="/organizations" className="text-gold text-sm hover:underline">← Back to Organizations</Link>
      </div>
    );
  }

  const stats = org.stats || {};

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#12234A] border border-gold/40 rounded-xl px-4 py-3 text-sm text-white shadow-xl animate-fadeIn">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link to="/organizations" className="w-9 h-9 rounded-full bg-navy-mid flex items-center justify-center text-gray-400 hover:text-white hover:bg-navy transition-colors font-bold text-sm flex-shrink-0 mt-0.5">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{org.name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                org.active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
              }`}>
                {org.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-gray-500 text-[11px]">
              <span>📍 {org.district}</span>
              {org.email  && <span>📧 {org.email}</span>}
              {org.phone  && <span>📞 {org.phone}</span>}
              {org.address && <span>🏠 {org.address}</span>}
            </div>

            {/* Sub-Admin Manager Details Display */}
            {org.subAdmin && (
              <div className="mt-3 p-3 bg-navy-mid/20 border border-[#1E2E52]/40 rounded-xl max-w-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sub-Admin Manager</p>
                  <p className="text-white text-xs font-semibold mt-0.5">{org.subAdmin.name}</p>
                  <p className="text-gray-400 text-[10px]">{org.subAdmin.email}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center animate-fadeIn">
            {/* Settings dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(prev => !prev)}
                className="px-4 py-2 bg-navy-mid border border-[#1E2E52] hover:border-gold/30 hover:text-gold text-gray-300 rounded-xl font-semibold transition-all flex items-center gap-1.5"
                title="Manage Organization"
              >
                ⚙️ Settings
              </button>
              {showSettingsMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettingsMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-[#0D1B33] border border-[#1E2E52] rounded-xl shadow-2xl p-1.5 z-20 flex flex-col gap-0.5 animate-slideUp">
                    <button
                      onClick={() => {
                        setShowEdit(true);
                        setShowSettingsMenu(false);
                      }}
                      className="px-3.5 py-2 text-left text-xs font-bold text-gold hover:bg-gold/10 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      ✏️ Edit Organization
                    </button>
                    {org.subAdmin && (
                      <button
                        onClick={() => {
                          setVerifyAction('view_subadmin');
                          setShowVerifyModal(true);
                          setShowSettingsMenu(false);
                        }}
                        className="px-3.5 py-2 text-left text-xs font-bold text-cyan-400 hover:bg-cyan-500/10 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        🔑 View Sub-Admin Password
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 border border-[#1E2E52] px-3.5 py-2 rounded-xl bg-navy-mid/30">
              <span className="text-xs text-gray-400 font-bold select-none">
                {org.active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => setConfirmStatusModal({ org, newStatus: !org.active })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  org.active ? "bg-green-500" : "bg-[#32312F]"
                }`}
                title={org.active ? "Click to Deactivate" : "Click to Activate"}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    org.active ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Students',  value: stats.totalStudents  ?? 0,    icon: '👥' },
            { label: 'Active Students', value: stats.activeStudents ?? 0,    icon: '✅' },
            { label: 'Avg ELO',         value: stats.avgElo         ?? 1000, icon: '📊' },
            { label: 'Total Games',     value: stats.totalGames     ?? 0,    icon: '♟' },
            { label: 'Games This Week', value: stats.weekGames      ?? 0,    icon: '📅' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-gold text-lg font-bold">{(s.value as number).toLocaleString()}</div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions (moved and consolidated action buttons here) */}
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={() => setShowAddStudent(true)}
            className="flex items-center gap-2 bg-gold/10 border border-gold/30 hover:bg-gold/20 text-gold font-bold text-xs px-4 py-2 rounded-xl transition-all"
          >
            + Add Student
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 bg-navy-mid border border-[#1E2E52] hover:border-gold/30 text-gray-300 font-bold text-xs px-4 py-2 rounded-xl transition-all"
          >
            📥 Bulk Import
          </button>
          <button
            onClick={() => {
              setVerifyAction('download_all');
              setShowVerifyModal(true);
            }}
            className="flex items-center gap-2 bg-navy-mid border border-cyan-500/20 hover:border-cyan-500/50 text-cyan-400 font-bold text-xs px-4 py-2 rounded-xl transition-all"
          >
            🔑 Download All Credentials
          </button>
          <Link
            to={`/bootcamp?orgId=${org.id}`}
            className="flex items-center gap-2 bg-navy-mid border border-[#1E2E52] text-gray-300 font-bold text-xs px-4 py-2 rounded-xl hover:border-gold/30 hover:text-gold transition-colors"
          >
            📍 Org Activity
          </Link>
        </div>

        {/* Students table */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Students</h3>
              <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                {students.length} total
              </span>
              {studLoading && (
                <span className="inline-block w-3 h-3 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
              )}
            </div>
          </div>

          <StudentList
            students={students}
            loadingData={studLoading}
            onRefresh={loadStudents}
            showStats={false}
            showAddImportButtons={false}
            preselectedOrgId={org.id}
            preselectedOrgName={org.name}
            preselectedDistrict={org.district}
          />
        </div>
      </div>

      {showEdit && (
        <CreateOrgModal
          onClose={() => setShowEdit(false)}
          editOrg={org}
          onSuccess={() => { setShowEdit(false); loadOrg(); }}
        />
      )}

      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onSuccess={() => { setShowAddStudent(false); loadStudents(); }}
          preselectedOrgId={org.id}
          preselectedOrgName={org.name}
          preselectedDistrict={org.district}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            loadStudents();
          }}
          preselectedOrgId={org.id}
          preselectedOrgName={org.name}
        />
      )}

      {/* Status Confirmation Modal */}
      {confirmStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-sm bg-[#0B1628] border border-[#1E2E52] rounded-2xl p-6 shadow-2xl space-y-4 animate-slideUp animate-duration-200">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-gold text-xl font-bold">⚠️</span>
              </div>
              <h3 className="text-white font-bold text-base">Confirm Status Change</h3>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                Are you sure you want to {confirmStatusModal.newStatus ? "activate" : "deactivate"} organization{" "}
                <span className="text-white font-semibold">{confirmStatusModal.org.name}</span>?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmStatusModal(null)}
                className="flex-1 py-2 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="flex-1 py-2 btn-gold font-bold rounded-xl text-xs transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Verification Overlay Modal */}
      {showVerifyModal && createPortal(
        <AdminPasswordVerifyModal
          loading={verifyLoading}
          error={verifyError}
          onClose={() => {
            setShowVerifyModal(false);
            setVerifyAction(null);
            setVerifyError("");
            setVerifyAttempts(0);
          }}
          onSubmit={handleVerifySubmit}
        />,
        document.body
      )}

      {/* Decrypted Sub-Admin Credentials Display Modal */}
      {decryptedPassword && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs px-4" onClick={() => setDecryptedPassword(null)}>
          <div 
            className="w-full max-w-sm bg-[#0D1B33] border border-cyan-800/40 rounded-2xl p-6 shadow-2xl animate-slideUp space-y-4 select-text text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <span className="text-2xl">🔑</span>
              <h4 className="text-white font-bold text-sm">Sub-Admin credentials</h4>
              <p className="text-gray-500 text-[10px]">{org.name} — Sub-Admin Manager</p>
            </div>
            <div className="bg-[#0B1628] border border-cyan-800/20 rounded-xl p-4 space-y-2 select-text leading-relaxed">
              <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Login Email:</span> <span className="text-blue-300 font-mono font-bold select-all">{org.subAdmin?.email}</span></p>
              <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Password:</span> <span className="text-green-300 font-mono font-bold select-all">{decryptedPassword}</span></p>
            </div>
            <button
              onClick={() => setDecryptedPassword(null)}
              className="w-full btn-gold py-2.5 font-bold rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Inner Secure Verification Modal ───
interface VerifyModalProps {
  onClose: () => void;
  onSubmit: (password: string) => void;
  loading: boolean;
  error?: string;
}
function AdminPasswordVerifyModal({ onClose, onSubmit, loading, error }: VerifyModalProps) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs px-4" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-[#0D1B33] border border-[#1E2E52] rounded-2xl p-6 shadow-2xl animate-slideUp space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <span className="text-2xl">🔐</span>
          <h4 className="text-white font-bold text-sm">Security Verification</h4>
          <p className="text-gray-500 text-[10px]">Please enter your super-admin login password to authorize this action.</p>
        </div>
        {error && (
          <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-2.5 rounded-xl text-[10px] font-semibold text-center animate-fadeIn">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gold pr-10"
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="flex-1 py-2 btn-gold font-bold rounded-xl text-xs disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
