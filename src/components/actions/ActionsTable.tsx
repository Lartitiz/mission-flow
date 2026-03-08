import { useState } from 'react';
import type { Action } from '@/hooks/useActions';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CATEGORIES = ['Cadrage', 'Messages', 'Site web', 'Social media', 'Emailing', 'Branding', 'Cross-posting', 'Influence/Presse', 'Formation', 'Autre'];
const CHANNELS = ['Instagram', 'LinkedIn', 'Pinterest', 'Site web', 'Brevo', 'Facebook', 'Telegram/WhatsApp', 'Identité', 'Orga', 'Autre'];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Pas commencée', bg: '#E0E0E0', text: '#333' },
  { value: 'in_progress', label: 'En cours', bg: '#4A90D9', text: '#fff' },
  { value: 'to_validate', label: 'À valider', bg: '#FFE561', text: '#333' },
  { value: 'validated', label: 'Validée', bg: '#4CAF50', text: '#fff' },
  { value: 'delivered', label: 'Livrée', bg: '#2E7D32', text: '#fff' },
];

interface ActionsTableProps {
  actions: Action[];
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

function EditableCell({ value, onSave, className, type = 'text' }: {
  value: string | number | null;
  onSave: (val: string) => void;
  className?: string;
  type?: 'text' | 'number';
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
        type={type}
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

export function ActionsTable({ actions, onUpdate, onDelete, onReorder }: ActionsTableProps) {
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
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Catégorie</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tâche</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Canal</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Date cible</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
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
                <td className="px-2 py-1 w-[120px]">
                  <Select
                    value={action.channel ?? ''}
                    onValueChange={(v) => onUpdate(action.id, { channel: v })}
                  >
                    <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 font-body text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c} className="font-body text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
