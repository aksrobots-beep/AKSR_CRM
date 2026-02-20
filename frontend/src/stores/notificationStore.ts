import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  link?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [
        {
          id: '1',
          type: 'warning',
          title: 'Critical Ticket',
          message: 'Industrial oven temperature sensor replacement is overdue',
          read: false,
          createdAt: new Date(),
          link: '/service',
        },
        {
          id: '2',
          type: 'info',
          title: 'Leave Request',
          message: 'New leave request pending approval',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
          link: '/hr',
        },
        {
          id: '3',
          type: 'success',
          title: 'Invoice Paid',
          message: 'INV-2024-0002 has been fully paid',
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          link: '/accounts',
        },
      ],
      unreadCount: 2,

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: Math.random().toString(36).substr(2, 9),
          read: false,
          createdAt: new Date(),
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        }));
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: 'ak-crm-notifications',
    }
  )
);
