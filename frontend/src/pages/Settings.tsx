import { useState } from 'react';
import { Header } from '../components/layout';
import { useAuthStore } from '../stores/authStore';
import { User, Bell, Shield, Palette, Database, Save, Check } from 'lucide-react';

export function Settings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance' | 'system'>('profile');
  const [saved, setSaved] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    department: user?.department || '',
  });

  const [notifications, setNotifications] = useState({
    emailTicketAssigned: true,
    emailTicketUpdated: true,
    emailLeaveApproved: true,
    browserNotifications: false,
    dailyDigest: false,
  });

  const [appearance, setAppearance] = useState({
    theme: 'light',
    sidebarCollapsed: false,
    compactMode: false,
  });

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('ak-crm-settings', JSON.stringify({
      notifications,
      appearance,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'system', label: 'System', icon: Database },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your account and preferences" />

      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="card p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="card p-6">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 pb-6 border-b border-neutral-200">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                      {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{user?.name}</h3>
                      <p className="text-neutral-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Full Name</label>
                      <input
                        type="text"
                        className="input"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        className="input"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input
                        type="tel"
                        className="input"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder="+60 12-345 6789"
                      />
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <input
                        type="text"
                        className="input"
                        value={profileData.department}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                      <Shield className="w-5 h-5 text-primary-500" />
                      <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Email Notifications</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'emailTicketAssigned', label: 'When a ticket is assigned to me' },
                      { key: 'emailTicketUpdated', label: 'When my ticket is updated' },
                      { key: 'emailLeaveApproved', label: 'When my leave request is approved/rejected' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                        <span>{item.label}</span>
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                          checked={(notifications as any)[item.key]}
                          onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                        />
                      </label>
                    ))}
                  </div>

                  <h3 className="text-lg font-semibold pt-4">Other Notifications</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                      <div>
                        <span className="font-medium">Browser Notifications</span>
                        <p className="text-sm text-neutral-500">Get real-time alerts in your browser</p>
                      </div>
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                        checked={notifications.browserNotifications}
                        onChange={(e) => setNotifications({ ...notifications, browserNotifications: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                      <div>
                        <span className="font-medium">Daily Digest</span>
                        <p className="text-sm text-neutral-500">Receive a daily summary email</p>
                      </div>
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                        checked={notifications.dailyDigest}
                        onChange={(e) => setNotifications({ ...notifications, dailyDigest: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Theme</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['light', 'dark', 'system'].map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setAppearance({ ...appearance, theme })}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          appearance.theme === theme
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className={`w-full h-16 rounded-lg mb-2 ${
                          theme === 'light' ? 'bg-white border border-neutral-200' :
                          theme === 'dark' ? 'bg-neutral-800' : 'bg-gradient-to-r from-white to-neutral-800'
                        }`} />
                        <span className="font-medium capitalize">{theme}</span>
                      </button>
                    ))}
                  </div>

                  <h3 className="text-lg font-semibold pt-4">Layout</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                      <div>
                        <span className="font-medium">Collapsed Sidebar</span>
                        <p className="text-sm text-neutral-500">Show only icons in the sidebar</p>
                      </div>
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                        checked={appearance.sidebarCollapsed}
                        onChange={(e) => setAppearance({ ...appearance, sidebarCollapsed: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                      <div>
                        <span className="font-medium">Compact Mode</span>
                        <p className="text-sm text-neutral-500">Reduce spacing and padding</p>
                      </div>
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                        checked={appearance.compactMode}
                        onChange={(e) => setAppearance({ ...appearance, compactMode: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">System Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                      <span className="text-neutral-600">Version</span>
                      <span className="font-mono font-medium">1.0.0</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                      <span className="text-neutral-600">Environment</span>
                      <span className="badge-primary">Development</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                      <span className="text-neutral-600">API Server</span>
                      <span className="font-mono text-sm">{import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold pt-4">Data Management</h3>
                  <div className="space-y-3">
                    <button className="w-full p-4 bg-neutral-50 hover:bg-neutral-100 rounded-lg text-left transition-colors">
                      <span className="font-medium">Export Data</span>
                      <p className="text-sm text-neutral-500">Download your data as JSON</p>
                    </button>
                    <button className="w-full p-4 bg-danger-50 hover:bg-danger-100 rounded-lg text-left transition-colors">
                      <span className="font-medium text-danger-700">Clear Local Storage</span>
                      <p className="text-sm text-danger-600">Reset all local settings</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-6 mt-6 border-t border-neutral-200">
                <button onClick={handleSave} className="btn-primary">
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
