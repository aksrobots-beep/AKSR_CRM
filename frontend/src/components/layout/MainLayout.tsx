import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../../stores/appStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { api } from '../../services/api';

export function MainLayout() {
  const { sidebarOpen } = useAppStore();
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  useEffect(() => {
    let cancelled = false;
    const fetchNotifications = async () => {
      try {
        const list = await api.getNotifications();
        if (!cancelled) setNotifications(list);
      } catch {
        // User may not be logged in or API may not support notifications
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setNotifications]);

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
