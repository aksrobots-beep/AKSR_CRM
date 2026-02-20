import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Bot,
  Package,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Wrench,
  TrendingUp,
  UserCog,
  Truck,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';

const workspaces = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    color: 'bg-primary-500',
  },
  {
    id: 'ceo',
    name: 'Executive View',
    icon: TrendingUp,
    path: '/ceo',
    color: 'bg-gradient-to-br from-amber-500 to-orange-500',
    roles: ['ceo', 'admin'],
  },
  {
    id: 'clients',
    name: 'Clients',
    icon: Building2,
    path: '/clients',
    color: 'bg-accent-500',
  },
  {
    id: 'service',
    name: 'Service Tickets',
    icon: Ticket,
    path: '/service',
    color: 'bg-success-500',
  },
  {
    id: 'equipment',
    name: 'Equipment',
    icon: Wrench,
    path: '/equipment',
    color: 'bg-warning-500',
  },
  {
    id: 'robots',
    name: 'Robots',
    icon: Bot,
    path: '/robots',
    color: 'bg-purple-500',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Package,
    path: '/inventory',
    color: 'bg-cyan-500',
  },
  // HR-related functionalities hidden
  // {
  //   id: 'hr',
  //   name: 'HR & Leave',
  //   icon: Calendar,
  //   path: '/hr',
  //   color: 'bg-pink-500',
  //   roles: ['ceo', 'admin', 'hr_manager'],
  // },
  // {
  //   id: 'employees',
  //   name: 'Employees',
  //   icon: UserCircle,
  //   path: '/employees',
  //   color: 'bg-rose-500',
  //   roles: ['ceo', 'admin', 'hr_manager'],
  // },
  {
    id: 'accounts',
    name: 'Accounts',
    icon: FileText,
    path: '/accounts',
    color: 'bg-emerald-500',
    roles: ['ceo', 'admin', 'finance'],
  },
  {
    id: 'suppliers',
    name: 'Suppliers',
    icon: Truck,
    path: '/suppliers',
    color: 'bg-indigo-500',
    roles: ['ceo', 'admin', 'service_manager'],
  },
  {
    id: 'users',
    name: 'User Management',
    icon: UserCog,
    path: '/users',
    color: 'bg-indigo-500',
    roles: ['ceo', 'admin'],
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    path: '/settings',
    color: 'bg-neutral-500',
  },
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeWorkspace, setActiveWorkspace } = useAppStore();
  const { user, hasPermission } = useAuthStore();

  const filteredWorkspaces = workspaces.filter((ws) => {
    if (!ws.roles) return true;
    return hasPermission(ws.roles as any);
  });

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-neutral-900 text-white transition-all duration-300 z-50 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center font-display font-bold text-lg">
            AK
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <h1 className="font-display font-semibold text-lg leading-tight">AK Success</h1>
              <p className="text-xs text-neutral-400">CRM System</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {filteredWorkspaces.map((workspace) => {
            const Icon = workspace.icon;
            const isActive = activeWorkspace === workspace.id;

            return (
              <NavLink
                key={workspace.id}
                to={workspace.path}
                onClick={() => setActiveWorkspace(workspace.id)}
                className={({ isActive: routeActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                    routeActive || isActive
                      ? 'bg-white/10 text-white'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <div
                  className={`w-8 h-8 rounded-lg ${workspace.color} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                {sidebarOpen && (
                  <span className="font-medium text-sm animate-fade-in truncate">
                    {workspace.name}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center font-semibold text-sm">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.name}</p>
                <p className="text-xs text-neutral-400 capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-20 w-6 h-6 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center hover:bg-neutral-700 transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
