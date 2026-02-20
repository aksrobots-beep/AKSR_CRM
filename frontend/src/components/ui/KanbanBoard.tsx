import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export interface KanbanItem {
  id: string;
  title: string;
  subtitle?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignee?: { name: string; avatar?: string };
  dueDate?: Date;
  tags?: string[];
  metadata?: Record<string, string | number>;
}

export interface KanbanColumnDef {
  id: string;
  title: string;
  color: string;
  items: KanbanItem[];
}

interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  onDragEnd: (itemId: string, sourceColumnId: string, targetColumnId: string) => void;
  onItemClick?: (item: KanbanItem) => void;
}

export function KanbanBoard({ columns, onDragEnd, onItemClick }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const itemId = active.id as string;

    for (const column of columns) {
      const item = column.items.find((i) => i.id === itemId);
      if (item) {
        setActiveItem(item);
        setActiveColumnId(column.id);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !activeColumnId) {
      setActiveItem(null);
      setActiveColumnId(null);
      return;
    }

    const itemId = active.id as string;
    const overId = over.id as string;

    // Find target column
    let targetColumnId = overId;
    const targetColumn = columns.find((col) => col.id === overId);
    
    if (!targetColumn) {
      // Over is an item, find its column
      for (const column of columns) {
        if (column.items.some((item) => item.id === overId)) {
          targetColumnId = column.id;
          break;
        }
      }
    }

    if (activeColumnId !== targetColumnId) {
      onDragEnd(itemId, activeColumnId, targetColumnId);
    }

    setActiveItem(null);
    setActiveColumnId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 px-1">
        {columns.map((column) => (
          <SortableContext
            key={column.id}
            items={column.items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id={column.id}
              title={column.title}
              color={column.color}
              count={column.items.length}
            >
              {column.items.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick?.(item)}
                />
              ))}
            </KanbanColumn>
          </SortableContext>
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-3 opacity-90">
            <KanbanCard item={activeItem} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
