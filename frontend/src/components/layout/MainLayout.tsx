import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../../stores/appStore';

export function MainLayout() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
