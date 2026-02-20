import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertCircle, User } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import type { KanbanItem } from './KanbanBoard';

interface KanbanCardProps {
  item: KanbanItem;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  low: 'bg-neutral-100 text-neutral-600',
  medium: 'bg-primary-100 text-primary-700',
  high: 'bg-warning-100 text-warning-700',
  critical: 'bg-danger-100 text-danger-700',
};

const priorityIcons = {
  low: null,
  medium: null,
  high: <AlertCircle className="w-3 h-3" />,
  critical: <AlertCircle className="w-3 h-3" />,
};

export function KanbanCard({ item, isDragging, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = item.dueDate && isPast(item.dueDate) && !isToday(item.dueDate);
  const isDueToday = item.dueDate && isToday(item.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`card p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-soft group ${
        isDragging || isSortableDragging ? 'opacity-50 shadow-elevated' : ''
      }`}
    >
      {/* Title & Priority */}
      <div className="flex items-start gap-2 mb-2">
        <h4 className="font-medium text-sm text-neutral-800 flex-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {item.title}
        </h4>
        {item.priority && (
          <span
            className={`badge flex items-center gap-1 ${priorityColors[item.priority]}`}
          >
            {priorityIcons[item.priority]}
            {item.priority}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {item.subtitle && (
        <p className="text-xs text-neutral-500 mb-2 line-clamp-1">{item.subtitle}</p>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-neutral-500 text-xs">
              +{item.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
        {/* Due Date */}
        {item.dueDate && (
          <div
            className={`flex items-center gap-1 text-xs ${
              isOverdue
                ? 'text-danger-600'
                : isDueToday
                ? 'text-warning-600'
                : 'text-neutral-500'
            }`}
          >
            <Clock className="w-3 h-3" />
            {format(item.dueDate, 'MMM d')}
          </div>
        )}

        {/* Assignee */}
        {item.assignee && (
          <div className="flex items-center gap-1 ml-auto">
            {item.assignee.avatar ? (
              <img
                src={item.assignee.avatar}
                alt={item.assignee.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                <User className="w-3 h-3" />
              </div>
            )}
            <span className="text-xs text-neutral-500">{item.assignee.name.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
