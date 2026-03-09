import { useState, useMemo } from 'react';
import type { Action } from '@/hooks/useActions';
import { Trash2, GripVertical, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CATEGORIES = ['Cadrage', 'Messages', 'Site web', 'Social media', 'Emailing', 'Branding', 'Cross-posting', 'Influence/Presse', 'Formation', 'Commercial', 'Support', 'Préparation session', 'Finalisation', 'Autre'];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Pas commencée', bg: '#E0E0E0', text: '#333', order: 0 },
  { value: 'in_progress', label: 'En cours', bg: '#4A90D9', text: '#fff', order: 1 },
  { value: 'to_validate', label: 'À valider', bg: '#FFE561', text: '#333', order: 2 },
  { value: 'validated', label: 'Validée', bg: '#4CAF50', text: '#fff', order: 3 },
  { value: 'delivered', label: 'Livrée', bg: '#2E7D32', text: '#fff', order: 4 },
];

type SortKey = 'category' | 'task' | 'description' | 'target_date' | 'status';
type SortDir = 'asc' | 'desc';

interface ActionsTableProps {
  actions: Action[];
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

// ── Editable Cell ──
function EditableCell({ value, onSave, className }: {
  value: string | number | null;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));

  const handleBlur = () => {
    setEditing(false);
    if (val !== String(value ?? '')) onSave(val);
  };

  if (editing) {
    return (
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
        autoFocus
        className={cn(
          'w-full bg-background border border-input rounded px-2 py-1 font-body text-xs text-foreground outline-none focus:ring-1 focus:ring-ring',
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={() => { setVal(String(value ?? '')); setEditing(true); }}
      className={cn(
        'block w-full px-2 py-1 font-body text-xs text-foreground cursor-text hover:bg-secondary/30 rounded transition-colors min-h-[28px]',
        !value && 'text-muted-foreground italic',
        className
      )}
    >
      {value || '—'}
    </span>
  );
}

// ── Status Badge ──
function StatusBadge({ status, onStatusChange }: { status: string; onStatusChange: (s: string) => void }) {
  const current = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
  return (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 w-auto">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full font-body text-[10px] font-medium"
          style={{ backgroundColor: current.bg, color: current.text }}
        >
          {current.label}
        </span>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s.value} value={s.value} className="font-body text-xs">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-body text-[10px] font-medium mr-2"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {s.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Date Cell ──
function DateCell({ date, onDateChange }: { date: string | null; onDateChange: (d: string | null) => void }) {
  const selected = date ? new Date(date) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="font-body text-xs text-foreground hover:bg-secondary/30 rounded px-2 py-1 transition-colors min-h-[28px] w-full text-left">
          {date ? format(new Date(date), 'dd/MM/yy', { locale: fr }) : <span className="text-muted-foreground italic">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onDateChange(d ? format(d, 'yyyy-MM-dd') : null)}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Sortable Row ──
function SortableRow({ action, onUpdate, onDelete }: {
  action: Action;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
    >
      <td className="px-1 py-1 w-8">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-2 py-1 w-[120px]">
        <Select
          value={action.category ?? ''}
          onValueChange={(v) => onUpdate(action.id, { category: v })}
        >
          <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 font-body text-xs">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="font-body text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-1 py-1 w-[160px]">
        <EditableCell value={action.task} onSave={(v) => onUpdate(action.id, { task: v })} />
      </td>
      <td className="px-1 py-1 w-[200px]">
        <EditableCell value={action.description} onSave={(v) => onUpdate(action.id, { description: v })} />
      </td>
      <td className="px-1 py-1 w-[100px]">
        <DateCell
          date={action.target_date}
          onDateChange={(d) => onUpdate(action.id, { target_date: d })}
        />
      </td>
      <td className="px-2 py-1 w-[120px]">
        <StatusBadge
          status={action.status}
          onStatusChange={(s) => onUpdate(action.id, { status: s })}
        />
      </td>
      <td className="px-2 py-1">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-muted-foreground hover:text-destructive transition-colors p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading">Supprimer l'action ?</AlertDialogTitle>
              <AlertDialogDescription className="font-body">
                Cette action sera supprimée définitivement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-body">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(action.id)}
                className="bg-destructive text-destructive-foreground font-body"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  );
}

// ── Sort Header ──
function SortHeader({ label, sortKey, currentSort, onSort }: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort?.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

// ── Main Table ──
export function ActionsTable({ actions, onUpdate, onDelete, onReorder }: ActionsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) {
        if (prev.dir === 'asc') return { key, dir: 'desc' };
        return null; // reset
      }
      return { key, dir: 'asc' };
    });
  };

  const sortedActions = useMemo(() => {
    if (!sort) return actions;
    const { key, dir } = sort;
    return [...actions].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (key === 'status') {
        aVal = STATUS_OPTIONS.find((s) => s.value === a.status)?.order ?? 99;
        bVal = STATUS_OPTIONS.find((s) => s.value === b.status)?.order ?? 99;
      } else {
        aVal = a[key] ?? '';
        bVal = b[key] ?? '';
      }

      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [actions, sort]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedActions.findIndex((a) => a.id === active.id);
    const newIndex = sortedActions.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(sortedActions, oldIndex, newIndex);
    onReorder(reordered.map((a) => a.id));
    setSort(null); // reset sort after manual reorder
  };

  if (actions.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
        <p className="font-body text-sm text-muted-foreground">Aucune action pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] overflow-hidden">
      <div className="overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-1 py-2 w-8"></th>
                <SortHeader label="Catégorie" sortKey="category" currentSort={sort} onSort={handleSort} />
                <SortHeader label="Tâche" sortKey="task" currentSort={sort} onSort={handleSort} />
                <SortHeader label="Description" sortKey="description" currentSort={sort} onSort={handleSort} />
                <SortHeader label="Date cible" sortKey="target_date" currentSort={sort} onSort={handleSort} />
                <SortHeader label="Statut" sortKey="status" currentSort={sort} onSort={handleSort} />
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <SortableContext items={sortedActions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sortedActions.map((action) => (
                  <SortableRow
                    key={action.id}
                    action={action}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
