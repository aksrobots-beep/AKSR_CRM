import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface CalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export function Calendar({ events, onEventClick, onDateClick }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows: Date[][] = [];
    let days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        days.push(day);
        day = addDays(day, 1);
      }
      rows.push(days);
      days = [];
    }

    return rows;
  }, [currentMonth]);

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => isSameDay(new Date(event.date), date));
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-danger-500';
      case 'high': return 'bg-warning-500';
      case 'medium': return 'bg-primary-500';
      case 'low': return 'bg-neutral-400';
      default: return 'bg-primary-500';
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-neutral-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          {days.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-neutral-200 last:border-b-0">
              {week.map((day, dayIdx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={dayIdx}
                    onClick={() => onDateClick?.(day)}
                    className={`min-h-[100px] p-2 border-r border-neutral-200 last:border-r-0 cursor-pointer hover:bg-neutral-50 transition-colors ${
                      !isCurrentMonth ? 'bg-neutral-50' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                        isCurrentDay
                          ? 'bg-primary-500 text-white'
                          : !isCurrentMonth
                          ? 'text-neutral-400'
                          : 'text-neutral-900'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                          className={`text-xs px-2 py-1 rounded text-white truncate cursor-pointer hover:opacity-80 ${getPriorityColor(event.priority)}`}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-neutral-500 px-2">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
