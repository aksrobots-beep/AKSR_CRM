import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
}

const colorClasses = {
  primary: {
    bg: 'bg-primary-50',
    icon: 'bg-primary-100 text-primary-600',
    trend: 'text-primary-600',
  },
  success: {
    bg: 'bg-success-50',
    icon: 'bg-success-100 text-success-600',
    trend: 'text-success-600',
  },
  warning: {
    bg: 'bg-warning-50',
    icon: 'bg-warning-100 text-warning-600',
    trend: 'text-warning-600',
  },
  danger: {
    bg: 'bg-danger-50',
    icon: 'bg-danger-100 text-danger-600',
    trend: 'text-danger-600',
  },
  accent: {
    bg: 'bg-accent-50',
    icon: 'bg-accent-100 text-accent-600',
    trend: 'text-accent-600',
  },
};

export function StatsCard({ title, value, icon, trend, color = 'primary' }: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="card p-5 hover:shadow-soft transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${colors.icon}`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend.direction === 'up'
                ? 'text-success-600'
                : trend.direction === 'down'
                ? 'text-danger-600'
                : 'text-neutral-500'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : trend.direction === 'down' ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-display font-bold text-neutral-900">{value}</p>
        <p className="text-sm text-neutral-500 mt-1">{title}</p>
      </div>
    </div>
  );
}
