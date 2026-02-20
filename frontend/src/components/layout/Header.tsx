import { Search, Plus, LogOut, Grid3X3, List, CalendarDays } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { NotificationDropdown } from '../ui/NotificationDropdown';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showViewToggle?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  addButtonText?: string;
}

export function Header({
  title,
  subtitle,
  showViewToggle = false,
  showAddButton = false,
  onAddClick,
  addButtonText = 'Add New',
}: HeaderProps) {
  const { activeView, setActiveView } = useAppStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-neutral-200 px-6 flex items-center justify-between sticky top-0 z-40">
      <div>
        <h1 className="text-xl font-display font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-2 text-sm bg-neutral-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('kanban')}
              className={`p-2 rounded-md transition-all ${
                activeView === 'kanban'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
              title="Kanban View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`p-2 rounded-md transition-all ${
                activeView === 'table'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`p-2 rounded-md transition-all ${
                activeView === 'calendar'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
              title="Calendar View"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add Button */}
        {showAddButton && (
          <button onClick={onAddClick} className="btn-primary">
            <Plus className="w-4 h-4" />
            {addButtonText}
          </button>
        )}

        {/* Notifications */}
        <NotificationDropdown />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
