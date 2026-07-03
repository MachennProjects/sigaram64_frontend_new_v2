// SIGARAM64 — OrganizationManager
// Super admin page: list all organizations, create/edit/deactivate
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../../api';
import CreateOrgModal from './CreateOrgModal';

export default function OrganizationManager() {
  const [orgs,    setOrgs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg,    setEditOrg]    = useState<any>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ org: any; newStatus: boolean } | null>(null);

  const loadOrgs = () => {
    setLoading(true);
    adminApi.getOrganizations()
      .then(data => setOrgs(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load orgs', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrgs(); }, []);

  const handleConfirmStatusChange = async () => {
    if (!confirmStatusModal) return;
    const { org, newStatus } = confirmStatusModal;
    setConfirmStatusModal(null);
    try {
      await adminApi.updateOrganization(org.id, { active: newStatus });
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, active: newStatus } : o));
    } catch { /* ignore */ }
  };

  const filtered = orgs.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.district?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = orgs.reduce((s, o) => s + (o.totalStudents || 0), 0);
  const totalActive   = orgs.filter(o => o.active).length;
  const avgElo = orgs.length
    ? Math.round(orgs.reduce((s, o) => s + (o.avgElo || 1000), 0) / orgs.length)
    : 1000;

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">🏢 Organizations</h1>
            <p className="text-gray-500 text-xs mt-1">Manage all school / campus organizations</p>
          </div>
          <button
            onClick={() => { setEditOrg(null); setShowCreate(true); }}
            className="flex items-center gap-2 bg-gold text-navy font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-yellow-400 transition-colors"
          >
            + Create Org
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Orgs',    value: orgs.length,    icon: '🏢' },
            { label: 'Active',        value: totalActive,    icon: '✅' },
            { label: 'Total Students', value: totalStudents, icon: '👥' },
            { label: 'Avg ELO',       value: avgElo,         icon: '📊' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-gold text-xl font-bold">{s.value.toLocaleString()}</div>
              <div className="text-gray-500 text-[10px] uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or district…"
            className="flex-1 bg-navy-mid border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600"
          />
        </div>

        {/* Org cards */}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-gray-400 font-bold">No organizations found</p>
            <p className="text-gray-600 text-[11px] mt-1">
              {search ? 'Try a different search term' : 'Click "+ Create Org" to add the first one'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(org => (
              <div key={org.id} className="card p-5 flex flex-col gap-3 hover:border-gold/30 transition-colors">

                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">{org.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-[#1E2E52] text-blue-300 px-2 py-0.5 rounded-full font-bold">
                        {org.district}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        org.active
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {org.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#12234A] rounded-lg py-2">
                    <div className="text-white font-bold text-sm">{org.totalStudents || 0}</div>
                    <div className="text-gray-500 text-[9px] uppercase">Students</div>
                  </div>
                  <div className="bg-[#12234A] rounded-lg py-2">
                    <div className="text-gold font-bold text-sm">{org.avgElo || 1000}</div>
                    <div className="text-gray-500 text-[9px] uppercase">Avg ELO</div>
                  </div>
                  <div className="bg-[#12234A] rounded-lg py-2">
                    <div className="text-white font-bold text-sm">{org.activeStudents || 0}</div>
                    <div className="text-gray-500 text-[9px] uppercase">Active</div>
                  </div>
                </div>

                {/* Email */}
                {org.email && (
                  <p className="text-gray-500 text-[10px] truncate">📧 {org.email}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-[#1E2E52] items-center">
                  <Link
                    to={`/organizations/${org.id}`}
                    className="flex-1 text-center text-[11px] font-bold text-white bg-navy-mid border border-[#1E2E52] hover:border-gold/40 hover:text-gold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => { setEditOrg(org); setShowCreate(true); }}
                    className="text-[11px] font-bold text-gray-400 hover:text-gold border border-[#1E2E52] px-3 py-1.5 rounded-lg transition-colors"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <div className="flex items-center justify-center px-1">
                    <button
                      onClick={() => setConfirmStatusModal({ org, newStatus: !org.active })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        org.active ? "bg-green-500" : "bg-[#32312F]"
                      }`}
                      title={org.active ? 'Click to Deactivate' : 'Click to Activate'}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          org.active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showCreate && (
        <CreateOrgModal
          onClose={() => { setShowCreate(false); setEditOrg(null); }}
          editOrg={editOrg}
          onSuccess={() => { setShowCreate(false); setEditOrg(null); loadOrgs(); }}
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
