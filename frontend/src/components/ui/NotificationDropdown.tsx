import { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-danger-500" />;
      default: return <Info className="w-5 h-5 text-primary-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-neutral-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-primary-50/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-medium text-sm ${!notification.read ? 'text-neutral-900' : 'text-neutral-700'}`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          className="p-1 hover:bg-neutral-200 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-neutral-400" />
                        </button>
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => { setIsOpen(false); navigate('/settings'); }}
                className="text-sm text-neutral-600 hover:text-neutral-800 w-full text-center"
              >
                Notification Settings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
