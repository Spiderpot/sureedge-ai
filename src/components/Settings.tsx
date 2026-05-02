'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Bell, CreditCard, Key, AlertTriangle, Save, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function Settings() {
  const { user } = useAppStore();
  const [renewalDate] = useState(() => new Date(Date.now() + 30 * 86400000).toLocaleDateString());
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [notifications, setNotifications] = useState({
    surebets: true,
    oddsDrop: true,
    riskAlerts: true,
    accountUpdates: true,
    marketing: false,
  });
  const [bookmakers] = useState([
    { name: 'Bet365', status: 'Connected', balance: '$1,200' },
    { name: 'Pinnacle', status: 'Connected', balance: '$850' },
    { name: '1xBet', status: 'Connected', balance: '$2,100' },
    { name: 'DraftKings', status: 'Pending', balance: '-' },
  ]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your account and preferences</p>
        </div>
        {saved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
            <Check className="w-4 h-4" /> Saved
          </motion.div>
        )}
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="w-4 h-4 text-emerald-400" /> Profile</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
            <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Role</label>
            <input type="text" value={user?.role || 'FREE'} readOnly className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Member Since</label>
            <input type="text" value={new Date().toLocaleDateString()} readOnly className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
          </div>
        </div>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-400" /> Change Password</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Current Password</label>
            <input type="password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">New Password</label>
            <input type="password" value={passwords.newPass} onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Confirm New Password</label>
            <input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-emerald-400" /> Notification Preferences</h3>
        <div className="space-y-4">
          {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div>
                <div className="text-xs text-gray-500">Receive {key} notifications</div>
              </div>
              <button onClick={() => setNotifications({ ...notifications, [key]: !value })} className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bookmaker Accounts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" /> Connected Bookmakers</h3>
        <div className="space-y-3">
          {bookmakers.map((bm) => (
            <div key={bm.name} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
              <div>
                <div className="text-sm font-medium">{bm.name}</div>
                <div className="text-xs text-gray-500">Balance: {bm.balance}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${bm.status === 'Connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {bm.status}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* API Key */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-emerald-400" /> API Key</h3>
        <div className="flex gap-3">
          <input type="text" value="sk-xxxx-xxxx-xxxx-xxxx" readOnly className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-400 font-mono" />
          <button className="px-4 py-2.5 rounded-lg bg-white/5 text-gray-400 hover:text-white text-sm transition-colors">Regenerate</button>
        </div>
        <p className="text-xs text-gray-600 mt-2">Use this key to access the SureEdge AI API. Keep it secret.</p>
      </motion.div>

      {/* Subscription */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4">Subscription Plan</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{user?.role || 'FREE'}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">Active</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Renews on {renewalDate}</p>
          </div>
          {user?.role !== 'ENTERPRISE' && (
            <button className="px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-medium transition-colors">
              Upgrade Plan
            </button>
          )}
        </div>
      </motion.div>

      {/* Save & Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-4">
        <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg transition-colors">
          <Save className="w-4 h-4" /> Save Changes
        </button>
        <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/10">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" /> Danger Zone</h3>
          <p className="text-sm text-gray-400 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors">
            Delete Account
          </button>
        </div>
      </motion.div>
    </div>
  );
}
