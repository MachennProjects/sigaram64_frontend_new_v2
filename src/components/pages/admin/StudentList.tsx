import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { studentApi } from "../../../api";
import AddStudentModal from "./AddStudentModal";
import BulkImportModal from "./BulkImportModal";

export interface Student {
  id: string;
  name: string;
  email: string;
  gender?: string;
  studentClass?: string;
  rollNo?: string;
  contact?: string[];
  school?: { id: string; name: string; district: string };
  active: boolean;
  elo?: number;
  gamesPlayed?: number;
}

interface StudentListProps {
  students: Student[];
  loadingData: boolean;
  onRefresh: () => void;
  showStats?: boolean;
  showAddImportButtons?: boolean;
  preselectedOrgId?: string;
  preselectedOrgName?: string;
  preselectedDistrict?: string;
}

export default function StudentList({
  students,
  loadingData,
  onRefresh,
  showStats = false,
  showAddImportButtons = false,
  preselectedOrgId,
  preselectedOrgName,
  preselectedDistrict,
}: StudentListProps) {
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editModal, setEditModal] = useState<Student | null>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ student: Student; newStatus: boolean } | null>(null);
  
  // Edit states
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editRollNo, setEditRollNo] = useState("");
  const [editContacts, setEditContacts] = useState<string[]>(['']);
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Sync props to localStudents state
  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  // Filter students based on search query and status tab
  const filtered = localStudents.filter(s => {
    // 1. Search Filter
    const q = search.toLowerCase();
    const matchSearch =
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.rollNo ?? "").toLowerCase().includes(q) ||
      (s.studentClass ?? "").toLowerCase().includes(q) ||
      (s.school?.name ?? "").toLowerCase().includes(q) ||
      (s.school?.district ?? "").toLowerCase().includes(q);
      
    // 2. Status Filter
    const matchFilter =
      filterActive === "all" ||
      (filterActive === "active" ? s.active === true : s.active !== true);
      
    return matchSearch && matchFilter;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterActive]);

  // Sliced data for current page
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedStudents = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Selection helpers
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Edit save
  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const updates = {
        name: editName.trim(),
        gender: editGender || undefined,
        studentClass: editClass || undefined,
        rollNo: editRollNo.trim() || undefined,
        contact: editContacts.filter(Boolean),
      };
      await studentApi.updateStudent(editModal.id, updates);
      setLocalStudents(prev =>
        prev.map(s =>
          s.id === editModal.id ? { ...s, ...updates } : s
        )
      );
      setEditModal(null);
      showToast("✅ Student updated successfully");
      onRefresh(); // Notify parent of update
    } catch (err: any) {
      showToast(err.message || "❌ Failed to update student");
    } finally {
      setSaving(false);
    }
  }

  // Handle confirmed status change
  async function handleConfirmStatusChange() {
    if (!confirmStatusModal) return;
    const { student, newStatus } = confirmStatusModal;
    setConfirmStatusModal(null);
    try {
      await studentApi.updateStudent(student.id, { active: newStatus });
      setLocalStudents(prev =>
        prev.map(s => s.id === student.id ? { ...s, active: newStatus } : s)
      );
      showToast(`${newStatus ? "✅ Activated" : "⏸ Deactivated"}: ${student.name}`);
      onRefresh(); // Notify parent of update
    } catch {
      showToast("❌ Failed to update status");
    }
  }

  // Stats helpers
  const totalActive = filtered.filter(s => s.active === true).length;
  const totalInactive = filtered.filter(s => s.active !== true).length;
  const avgElo = filtered.length > 0
    ? Math.round(filtered.reduce((a, s) => a + (s.elo ?? 1000), 0) / filtered.length)
    : 0;

  return (
    <div className="w-full">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#12234A] border border-gold/40 rounded-xl px-4 py-3 text-sm text-white shadow-xl animate-fadeIn">
          {toast}
        </div>
      )}

      {/* Header Buttons if showAddImportButtons is true */}
      {showAddImportButtons && (
        <div className="flex justify-end gap-2 mb-6 flex-wrap">
          <button 
            onClick={() => setShowBulkModal(true)} 
            className="px-4 py-2 border border-gold/30 text-gold hover:bg-gold/10 text-xs rounded-xl font-semibold transition-colors"
          >
            📥 Bulk Import
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-gold text-xs px-4 py-2 font-semibold"
          >
            + Add Student
          </button>
        </div>
      )}

      {/* Stats row */}
      {showStats && (
        loadingData ? (
          <div className="flex gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card px-5 py-3 w-32 h-14 animate-pulse">
                <div className="h-3 bg-navy-mid rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 mb-6 flex-wrap">
            {[
              { label: "Total Students", v: filtered.length, color: "text-gold" },
              { label: "Active", v: totalActive, color: "text-green-400" },
              { label: "Inactive", v: totalInactive, color: "text-red-400" },
              { label: "Avg Elo", v: avgElo, color: "text-white" },
            ].map((s, i) => (
              <div key={i} className="card px-5 py-3 flex items-center gap-3">
                <span className={`text-xl font-bold ${s.color}`}>{s.v}</span>
                <span className="text-gray-400 text-xs font-semibold">{s.label}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Search + filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, roll no, class, email, school…"
          className="input-field flex-1 min-w-[200px]"
        />
        <div className="flex bg-navy-mid rounded-xl p-1 gap-1">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors
                ${filterActive === f ? "bg-gold text-navy" : "text-gray-400 hover:text-white"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="bg-navy-mid border border-[#1E2E52] rounded-xl px-4 py-3 mb-4 flex items-center gap-4 flex-wrap animate-fadeIn">
          <span className="text-gold text-xs font-bold">{selected.size} selected</span>
          <button
            onClick={async () => {
              try {
                for (const id of selected) {
                  await studentApi.deactivateStudent(id);
                }
                setLocalStudents(prev =>
                  prev.map(s => selected.has(s.id) ? { ...s, active: false } : s)
                );
                setSelected(new Set());
                showToast(`⏸ ${selected.size} students deactivated`);
                onRefresh(); // Notify parent of updates
              } catch {
                showToast("❌ Failed to deactivate selected");
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 ml-auto font-bold"
          >
            Deactivate Selected
          </button>
        </div>
      )}

      {/* Students Table */}
      <div className="card overflow-hidden overflow-x-auto border-divider">
        <table className="w-full min-w-[800px] text-xs">
          <thead>
            <tr className="border-b border-[#1E2E52] bg-[#12234A] text-gray-400">
              <th className="px-4 py-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="accent-gold"
                />
              </th>
              <th className="text-left font-bold px-4 py-3.5">Student</th>
              <th className="text-left font-bold px-4 py-3.5">Roll No</th>
              <th className="text-left font-bold px-4 py-3.5">Class</th>
              <th className="text-left font-bold px-4 py-3.5">Gender</th>
              <th className="text-left font-bold px-4 py-3.5">Contact</th>
              <th className="text-center font-bold px-4 py-3.5">Games</th>
              <th className="text-right font-bold px-4 py-3.5">Elo</th>
              <th className="text-center font-bold px-4 py-3.5">Status</th>
              <th className="text-right font-bold px-4 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E2E52]/20">
            {loadingData ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-divider animate-pulse">
                  <td className="px-4 py-3.5"><div className="w-4 h-4 bg-navy-mid rounded mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-32" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-12" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-24" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-8 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-12 ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-14 mx-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 text-xs italic">
                  No students found matching your filters.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((s) => (
                <tr key={s.id} className="hover:bg-[#12234A]/20 transition-colors">
                  <td className="px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="accent-gold"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 select-none">
                        <span className="text-[#E7CB75] text-xs font-bold">
                          {(s.name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-white text-xs font-bold block">{s.name || "—"}</span>
                        <span className="text-gray-500 text-[10px] block">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-300 font-medium">
                    {s.rollNo || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-gray-300">
                    {s.studentClass ? `Class ${s.studentClass}` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 capitalize">
                    {s.gender || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 truncate max-w-[130px]">
                    {s.contact && s.contact.length > 0 ? s.contact.join(' / ') : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-white font-semibold text-center">
                    {s.gamesPlayed || 0}
                  </td>
                  <td className="px-4 py-3.5 text-gold font-bold text-right">
                    {s.elo ?? 1000}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => setConfirmStatusModal({ student: s, newStatus: !s.active })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        s.active ? "bg-green-500" : "bg-[#32312F]"
                      }`}
                      title={s.active ? "Click to Deactivate" : "Click to Activate"}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          s.active ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setEditModal(s);
                          setEditName(s.name);
                          setEditGender(s.gender || "");
                          setEditClass(s.studentClass || "");
                          setEditRollNo(s.rollNo || "");
                          setEditContacts(s.contact && s.contact.length > 0 ? [...s.contact] : ['']);
                        }}
                        className="text-gold font-bold hover:underline text-[10px]"
                      >
                        Edit
                      </button>
                      <Link
                        to={`/students/${s.id}`}
                        className="text-[10px] text-white bg-navy-mid border border-gold/30 px-2.5 py-1 rounded hover:bg-gold hover:text-navy transition-colors font-bold"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-gray-400 select-none">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-navy-mid border border-[#1E2E52] rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-navy-mid border border-[#1E2E52] rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-md bg-[#0B1628] border border-[#1E2E52] rounded-2xl p-6 shadow-2xl space-y-4 animate-slideUp">
            <h3 className="text-white font-bold text-base">Edit Student Profile</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Student Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gender</label>
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value)}
                    className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold"
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</label>
                  <select
                    value={editClass}
                    onChange={e => setEditClass(e.target.value)}
                    className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold"
                  >
                    <option value="">Select…</option>
                    {['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Roll No</label>
                <input
                  type="text"
                  value={editRollNo}
                  onChange={e => setEditRollNo(e.target.value)}
                  className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contacts (1 or 2, slash-separated or list)</label>
                {editContacts.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={c}
                      onChange={e => setEditContacts(prev => prev.map((val, i) => i === idx ? e.target.value : val))}
                      className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold flex-1"
                    />
                    {editContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditContacts(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-400 text-xs px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {editContacts.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setEditContacts(prev => [...prev, ''])}
                    className="text-[10px] text-gold hover:underline font-bold mt-1 block"
                  >
                    + Add Phone Number
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-2.5 btn-gold font-bold rounded-xl text-xs"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal Portal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onRefresh();
            showToast("✅ Student generated successfully!");
          }}
          preselectedOrgId={preselectedOrgId}
          preselectedOrgName={preselectedOrgName}
          preselectedDistrict={preselectedDistrict}
        />
      )}

      {/* Bulk Import Modal Portal */}
      {showBulkModal && (
        <BulkImportModal
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            onRefresh();
            showToast("✅ Students imported successfully!");
          }}
          preselectedOrgId={preselectedOrgId}
          preselectedOrgName={preselectedOrgName}
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
                Are you sure you want to {confirmStatusModal.newStatus ? "activate" : "deactivate"} student{" "}
                <span className="text-white font-semibold">{confirmStatusModal.student.name}</span>?
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
