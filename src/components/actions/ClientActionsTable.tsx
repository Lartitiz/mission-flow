import { useState, useRef } from 'react';
import type { Action } from '@/hooks/useActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Upload, FileDown, File } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const CLIENT_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Pas commencée', bg: '#E0E0E0', text: '#333' },
  { value: 'in_progress', label: 'En cours', bg: '#4A90D9', text: '#fff' },
  { value: 'done', label: 'Fait', bg: '#4CAF50', text: '#fff' },
];

interface ClientActionsTableProps {
  actions: Action[];
  missionId: string;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

function EditableCell({ value, onSave, className }: {
  value: string | null;
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

function FileCell({ actionId, missionId }: { actionId: string; missionId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [] } = useQuery({
    queryKey: ['action-files', actionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('mission_id', missionId)
        .eq('category', `action_${actionId}`);
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const path = `${missionId}/actions/${actionId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('mission-files')
      .upload(path, file);

    if (uploadError) {
      toast({ title: 'Erreur', description: "Erreur lors de l'upload.", variant: 'destructive' });
      return;
    }

    await supabase.from('files').insert({
      mission_id: missionId,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      category: `action_${actionId}`,
    });

    queryClient.invalidateQueries({ queryKey: ['action-files', actionId] });
    toast({ title: 'Fichier ajouté' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('mission-files')
      .download(storagePath);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-1">
      {files.map((f) => (
        <button
          key={f.id}
          onClick={() => handleDownload(f.storage_path, f.file_name)}
          className="flex items-center gap-1 text-xs font-body text-primary hover:underline truncate max-w-[140px]"
          title={f.file_name}
        >
          <File className="h-3 w-3 shrink-0" />
          <span className="truncate">{f.file_name}</span>
        </button>
      ))}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1 text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
      >
        <Upload className="h-3 w-3" />
        Upload
      </button>
    </div>
  );
}

export function ClientActionsTable({ actions, missionId, onUpdate, onDelete, onReorder }: ClientActionsTableProps) {
  if (actions.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
        <p className="font-body text-sm text-muted-foreground">Aucune action client·e pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tâche</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Description</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Date cible</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
              <th className="px-3 py-2 font-body text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fichiers</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                <td className="px-1 py-1 w-[180px]">
                  <EditableCell value={action.task} onSave={(v) => onUpdate(action.id, { task: v })} />
                </td>
                <td className="px-1 py-1 w-[240px]">
                  <EditableCell value={action.description} onSave={(v) => onUpdate(action.id, { description: v })} />
                </td>
                <td className="px-1 py-1 w-[100px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="font-body text-xs text-foreground hover:bg-secondary/30 rounded px-2 py-1 transition-colors min-h-[28px] w-full text-left">
                        {action.target_date
                          ? format(new Date(action.target_date), 'dd/MM/yy', { locale: fr })
                          : <span className="text-muted-foreground italic">—</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={action.target_date ? new Date(action.target_date) : undefined}
                        onSelect={(d) => onUpdate(action.id, { target_date: d ? format(d, 'yyyy-MM-dd') : null })}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="px-2 py-1 w-[120px]">
                  <Select value={action.status} onValueChange={(s) => onUpdate(action.id, { status: s })}>
                    <SelectTrigger className="border-0 p-0 h-auto shadow-none focus:ring-0 w-auto">
                      {(() => {
                        const current = CLIENT_STATUS_OPTIONS.find((s) => s.value === action.status) ?? CLIENT_STATUS_OPTIONS[0];
                        return (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full font-body text-[10px] font-medium"
                            style={{ backgroundColor: current.bg, color: current.text }}
                          >
                            {current.label}
                          </span>
                        );
                      })()}
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUS_OPTIONS.map((s) => (
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
                </td>
                <td className="px-2 py-1 w-[160px]">
                  <FileCell actionId={action.id} missionId={missionId} />
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
