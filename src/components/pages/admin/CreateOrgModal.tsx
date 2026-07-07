// SIGARAM64 — CreateOrgModal
// Modal for creating or editing an organization (super_admin only)
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authApi, adminApi } from '../../../api';

interface Props {
  onClose: () => void;
  onSuccess: (org: any) => void;
  editOrg?: any;  // if provided, switches to edit mode
}

const DISTRICTS = [
  'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore',
  'Dharmapuri','Dindigul','Erode','Kallakurichi','Kancheepuram',
  'Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam',
  'Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram',
  'Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur',
  'Theni','Thoothukudi','Tiruchirappalli','Tirunelveli',
  'Tiruppur','Tirupattur','Tiruvallur','Tiruvarur','Tiruvannamalai',
  'Vellore','Virudhunagar','Viluppuram','Kanniyakumari',
];

export default function CreateOrgModal({ onClose, onSuccess, editOrg }: Props) {
  const isEdit = Boolean(editOrg);

  const [name,     setName]     = useState(editOrg?.name     || '');
  const [email,    setEmail]    = useState(editOrg?.email    || '');
  const [phone,    setPhone]    = useState(editOrg?.phone    || '');
  const [district, setDistrict] = useState(editOrg?.district || '');
  const [address,  setAddress]  = useState(editOrg?.address  || '');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !district) { setError('Name and District are required.'); return; }
    if (!isEdit && (!email || !password)) { setError('Email and Password are required.'); return; }
    if (!isEdit && password !== confirm)  { setError('Passwords do not match.'); return; }
    if (!isEdit && password.length < 6)   { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (isEdit) {
        const updated = await adminApi.updateOrganization(editOrg.id, { name, phone, district, address });
        onSuccess(updated);
      } else {
        const res = await (authApi as any).createSubAdmin({ name, email, password, schoolName: name, district, phone, address });
        onSuccess(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0D1B33] border border-[#1E2E52] rounded-2xl w-full max-w-lg shadow-2xl animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2E52]">
          <div>
            <h2 className="text-white font-bold text-base">
              {isEdit ? '✏️ Edit Organization' : '🏢 Create New Organization'}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {isEdit ? 'Update organization details' : 'Creates a new org + sub-admin login account'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Org / School Name */}
          <div>
            <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">
              School / Org Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chennai Chess Academy"
              className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600"
            />
          </div>

          {/* Email — only shown when creating */}
          {!isEdit && (
            <div>
              <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">
                Contact Email (Login Email) *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@school.com"
                className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600"
              />
              {email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠️ Invalid email address format</p>
              )}
            </div>
          )}

          {/* Phone + District row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 99999 00000"
                className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600"
              />
              {phone.length > 0 && (phone.replace(/\D/g, '').length !== 10 || /\D/.test(phone)) && (
                <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠️ Must be exactly 10 digits</p>
              )}
            </div>
            <div>
              <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">District *</label>
              <select
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none"
              >
                <option value="">Select…</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">Address / City</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123, Main Street, Chennai"
              className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600"
            />
          </div>

          {/* Password fields — only shown when creating */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600 pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-gray-400 text-[11px] font-bold mb-1.5 uppercase tracking-wider">Confirm *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-4 py-2.5 text-white text-sm focus:border-gold/50 focus:outline-none placeholder-gray-600 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                    {showConfirm ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#1E2E52] text-gray-400 hover:text-white text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                (phone.length > 0 && (phone.replace(/\D/g, '').length !== 10 || /\D/.test(phone))) ||
                (!isEdit && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
              }
              className="flex-1 py-2.5 rounded-xl bg-gold text-navy font-bold text-sm hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : '🏢 Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
