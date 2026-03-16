import { useState, useRef, useEffect } from 'react';
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
  isToday,
  isSameDay,
} from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function DatePickerField({
  value,
  onChange,
  min,
  max,
  id,
  placeholder = 'dd/mm/yyyy',
  className = '',
  inputClassName = '',
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() =>
    value ? new Date(value + 'T12:00:00') : new Date()
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentMonth(value ? new Date(value + 'T12:00:00') : new Date());
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const minDate = min ? new Date(min + 'T00:00:00') : null;
  const maxDate = max ? new Date(max + 'T23:59:59') : null;

  const isDisabled = (d: Date) => {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  };

  const selectDate = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const setToday = () => {
    const today = new Date();
    if (!isDisabled(today)) {
      onChange(format(today, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  const displayValue = value
    ? (() => {
        const d = new Date(value + 'T12:00:00');
        return format(d, 'dd/MM/yyyy');
      })()
    : null;

  return (
    <div className={`relative flex items-center gap-2 ${className}`} ref={popoverRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={`shrink-0 p-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors ${inputClassName}`}
        title="Open calendar"
        aria-label="Select date"
      >
        <CalendarIcon className="w-5 h-5 text-primary-600" />
      </button>
      {displayValue && (
        <span className="text-sm text-neutral-700">{displayValue}</span>
      )}
      {!displayValue && (
        <span className="text-sm text-neutral-400">{placeholder}</span>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
              aria-label="Previous month"
            >
              <span className="text-neutral-600">‹</span>
            </button>
            <span className="text-sm font-semibold text-neutral-800">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
              aria-label="Next month"
            >
              <span className="text-neutral-600">›</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
              <div
                key={wd}
                className="text-center text-xs font-medium text-neutral-500 py-1"
              >
                {wd}
              </div>
            ))}
            {weeks.map((week) =>
              week.map((d) => {
                const sameMonth = isSameMonth(d, currentMonth);
                const today = isToday(d);
                const selected = value && isSameDay(d, new Date(value + 'T12:00:00'));
                const disabled = isDisabled(d);
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    onClick={() => selectDate(d)}
                    disabled={disabled}
                    className={`
                      w-8 h-8 text-sm rounded-full transition-colors
                      ${!sameMonth ? 'text-neutral-300' : 'text-neutral-800'}
                      ${today ? 'ring-1 ring-primary-500' : ''}
                      ${selected ? 'bg-primary-500 text-white hover:bg-primary-600' : ''}
                      ${!selected && sameMonth && !disabled ? 'hover:bg-primary-50' : ''}
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {format(d, 'd')}
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={setToday}
            className="w-full py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
