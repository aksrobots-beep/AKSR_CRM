import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  children: ReactNode;
}

export function KanbanColumn({ id, title, color, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-neutral-100 rounded-xl transition-all duration-200 ${
        isOver ? 'ring-2 ring-primary-400 ring-offset-2' : ''
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h3 className="font-semibold text-neutral-700 text-sm">{title}</h3>
          <span className="ml-auto px-2 py-0.5 bg-neutral-200 text-neutral-600 text-xs font-medium rounded-full">
            {count}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-240px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
