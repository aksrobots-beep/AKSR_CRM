import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Ticket,
  Bot,
  Package,
  FileText,
  Settings,
  Building2,
  Wrench,
  TrendingUp,
  UserCog,
  Truck,
  BarChart3,
  MapPinned,
  MapPin,
  Mail,
} from 'lucide-react';

export type WorkspaceNavItem = {
  id: string;
  name: string;
  icon: LucideIcon;
  path: string;
  color: string;
  roles?: string[];
};

export const workspaces: WorkspaceNavItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/', color: 'bg-primary-500' },
  {
    id: 'ceo',
    name: 'Executive View',
    icon: TrendingUp,
    path: '/ceo',
    color: 'bg-gradient-to-br from-amber-500 to-orange-500',
    roles: ['ceo', 'admin'],
  },
  { id: 'clients', name: 'Clients', icon: Building2, path: '/clients', color: 'bg-accent-500' },
  { id: 'service', name: 'Service Tickets', icon: Ticket, path: '/service', color: 'bg-success-500' },
  {
    id: 'site-visits',
    name: 'Site visits',
    icon: MapPinned,
    path: '/site-visits',
    color: 'bg-sky-500',
    roles: ['technician', 'service_manager', 'finance', 'hr_manager'],
  },
  { id: 'field-check-in', name: 'Field check-in', icon: MapPin, path: '/field-check-in', color: 'bg-emerald-600' },
  { id: 'equipment', name: 'Contract', icon: Wrench, path: '/equipment', color: 'bg-warning-500' },
  { id: 'robots', name: 'Robots', icon: Bot, path: '/robots', color: 'bg-purple-500' },
  { id: 'inventory', name: 'Inventory', icon: Package, path: '/inventory', color: 'bg-cyan-500' },
  {
    id: 'reports',
    name: 'Reports',
    icon: BarChart3,
    path: '/reports',
    color: 'bg-teal-500',
    roles: ['ceo', 'admin', 'finance', 'service_manager'],
  },
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
    id: 'message-logs',
    name: 'Message Logs',
    icon: Mail,
    path: '/message-logs',
    color: 'bg-slate-600',
    roles: ['ceo', 'admin'],
  },
  { id: 'settings', name: 'Settings', icon: Settings, path: '/settings', color: 'bg-neutral-500' },
];
