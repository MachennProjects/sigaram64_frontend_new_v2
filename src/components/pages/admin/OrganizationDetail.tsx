// SIGARAM64 — OrganizationDetail
// Super admin deep-dive view of one organization: stats, students table, edit
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { adminApi, studentApi } from '../../../api';
import CreateOrgModal from './CreateOrgModal';
import AddStudentModal from './AddStudentModal';
import StudentList from './StudentList';

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
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ org: any; newStatus: boolean } | null>(null);

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
    // Reload org stats too so the top row updates when a student changes active status
    loadOrg();
    studentApi.listStudents({ orgId: id, limit: 1000 })
      .then(data => {
        // Map API response to Student interface fields
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
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center animate-fadeIn">
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs font-bold text-gray-300 hover:text-gold border border-[#1E2E52] hover:border-gold/30 px-4 py-2 rounded-xl transition-colors"
            >
              ✏️ Edit
            </button>
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

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowAddStudent(true)}
            className="flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold font-bold text-xs px-4 py-2 rounded-xl hover:bg-gold/20 transition-colors"
          >
            + Add Student to this Org
          </button>
          <Link
            to={`/bootcamp?orgId=${org.id}`}
            className="flex items-center gap-2 bg-navy-mid border border-[#1E2E52] text-gray-300 font-bold text-xs px-4 py-2 rounded-xl hover:border-gold/30 hover:text-gold transition-colors"
          >
            📍 Bootcamp Activity
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
    </div>
  );
}
