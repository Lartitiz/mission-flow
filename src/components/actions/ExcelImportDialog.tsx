import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface ExcelImportDialogProps {
  missionId: string;
  existingActionsCount: number;
  maxSortOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ActionField =
  | 'category'
  | 'task'
  | 'description'
  | 'channel'
  | 'target_date'
  | 'hours_estimated'
  | 'budget_ht'
  | 'assignee'
  | 'status'
  | '__ignore__';

const FIELD_OPTIONS: { value: ActionField; label: string }[] = [
  { value: '__ignore__', label: 'Ignorer cette colonne' },
  { value: 'category', label: 'Catégorie' },
  { value: 'task', label: 'Tâche' },
  { value: 'description', label: 'Description / Détail' },
  { value: 'channel', label: 'Canal' },
  { value: 'target_date', label: 'Date cible' },
  { value: 'hours_estimated', label: 'Heures' },
  { value: 'budget_ht', label: 'Budget HT' },
  { value: 'assignee', label: 'Responsable' },
  { value: 'status', label: 'Statut' },
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function guessField(header: string): ActionField {
  const n = normalize(header);
  if (['categorie', 'catégorie'].some((k) => n.includes(normalize(k)))) return 'category';
  if (['tache', 'tâche', 'action'].some((k) => n === normalize(k) || n.includes(normalize(k)))) return 'task';
  if (['description', 'detail', 'détail'].some((k) => n.includes(normalize(k)))) return 'description';
  if (['canal', 'channel'].some((k) => n.includes(normalize(k)))) return 'channel';
  if (['date cible', 'echeance', 'échéance'].some((k) => n.includes(normalize(k)))) return 'target_date';
  if (n === 'date') return 'target_date';
  if (['heures', 'temps'].some((k) => n.includes(normalize(k))) || n === 'h') return 'hours_estimated';
  if (['budget', 'cout', 'coût'].some((k) => n.includes(normalize(k)))) return 'budget_ht';
  if (['responsable', 'assigne', 'assigné', 'qui'].some((k) => n.includes(normalize(k)))) return 'assignee';
  if (['statut', 'status', 'etat', 'état'].some((k) => n.includes(normalize(k)))) return 'status';
  return '__ignore__';
}

function mapAssignee(val: string): string {
  const n = normalize(val);
  if (n === 'laetitia') return 'laetitia';
  return 'client';
}

function mapStatus(val: string): string {
  const n = normalize(val);
  if (['pas commencee', 'pas commencée', 'not_started', 'a faire', 'à faire'].some((k) => n.includes(normalize(k)))) return 'not_started';
  if (['en cours', 'in_progress'].some((k) => n.includes(normalize(k)))) return 'in_progress';
  if (['terminee', 'terminée', 'livree', 'livrée', 'delivered', 'done', 'fait'].some((k) => n.includes(normalize(k)))) return 'delivered';
  return 'not_started';
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  // Try DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

type Step = 'upload' | 'mapping' | 'importing';

export function ExcelImportDialog({
  missionId,
  existingActionsCount,
  maxSortOrder,
  open,
  onOpenChange,
}: ExcelImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ActionField>>({});
  const [overrideAssignee, setOverrideAssignee] = useState(false);
  const [assigneeOverride, setAssigneeOverride] = useState<'laetitia' | 'client'>('laetitia');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setOverrideAssignee(false);
    setError(null);
    setIsImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (!json.length) {
          setError("Ce fichier ne semble pas contenir de données structurées");
          return;
        }

        const hdrs = Object.keys(json[0]);
        if (!hdrs.length) {
          setError("Ce fichier ne semble pas contenir de données structurées");
          return;
        }

        setHeaders(hdrs);
        setRows(json);

        // Auto-map
        const autoMap: Record<string, ActionField> = {};
        hdrs.forEach((h) => {
          autoMap[h] = guessField(h);
        });
        setMapping(autoMap);
        setStep('mapping');
      } catch {
        setError("Impossible de lire ce fichier. Vérifie que c'est bien un fichier Excel ou CSV.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const hasTaskMapping = Object.values(mapping).includes('task');

  const previewRows = rows.slice(0, 5);

  const mappedFields = Object.entries(mapping).filter(([, v]) => v !== '__ignore__');

  const validRows = rows.filter((row) => {
    const taskCol = Object.entries(mapping).find(([, v]) => v === 'task')?.[0];
    if (!taskCol) return false;
    const val = row[taskCol];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });

  const handleImport = async () => {
    if (!hasTaskMapping) {
      setError('La colonne Tâche est obligatoire');
      return;
    }

    setIsImporting(true);
    setStep('importing');

    try {
      const actionsToInsert = validRows.map((row, idx) => {
        const action: Record<string, unknown> = {
          mission_id: missionId,
          sort_order: maxSortOrder + idx + 1,
          status: 'not_started',
          assignee: 'laetitia',
          task: '',
        };

        for (const [col, field] of Object.entries(mapping)) {
          if (field === '__ignore__') continue;
          const val = row[col];
          if (val === undefined || val === null || String(val).trim() === '') continue;

          switch (field) {
            case 'task':
            case 'category':
            case 'description':
            case 'channel':
              action[field] = String(val).trim();
              break;
            case 'target_date':
              action[field] = parseDate(val);
              break;
            case 'hours_estimated':
            case 'budget_ht':
              action[field] = parseFloat(String(val).replace(',', '.')) || null;
              break;
            case 'assignee':
              action[field] = mapAssignee(String(val));
              break;
            case 'status':
              action[field] = mapStatus(String(val));
              break;
          }
        }

        if (overrideAssignee) {
          action.assignee = assigneeOverride;
        }

        return action;
      });

      const { error: insertError } = await supabase.from('actions').insert(actionsToInsert as any);
      if (insertError) throw insertError;

      toast({
        title: `${actionsToInsert.length} action(s) importée(s)`,
        description: 'Les actions ont été ajoutées au plan.',
      });

      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error('Import error:', e);
      setError("Erreur lors de l'import. Vérifie les données et réessaie.");
      setStep('mapping');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer des actions depuis un fichier Excel
          </DialogTitle>
          <DialogDescription>
            Importe un fichier .xlsx ou .csv pour créer des actions en masse.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-body text-sm text-muted-foreground text-center">
              Sélectionne un fichier Excel (.xlsx) ou CSV (.csv)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="font-body gap-2">
              <Upload className="h-4 w-4" />
              Choisir un fichier
            </Button>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-5">
            {/* Column mapping */}
            <div className="space-y-3">
              <h4 className="font-heading text-sm font-medium">Mapping des colonnes</h4>
              <div className="grid gap-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="font-body text-sm min-w-[140px] truncate text-muted-foreground" title={h}>
                      {h}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[h] || '__ignore__'}
                      onValueChange={(val) => setMapping((prev) => ({ ...prev, [h]: val as ActionField }))}
                    >
                      <SelectTrigger className="w-[200px] font-body text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="font-body text-sm">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Override assignee */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Switch checked={overrideAssignee} onCheckedChange={setOverrideAssignee} />
              <Label className="font-body text-sm">Assigner toutes les actions à</Label>
              {overrideAssignee && (
                <Select
                  value={assigneeOverride}
                  onValueChange={(v) => setAssigneeOverride(v as 'laetitia' | 'client')}
                >
                  <SelectTrigger className="w-[140px] font-body text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laetitia" className="font-body text-sm">Laetitia</SelectItem>
                    <SelectItem value="client" className="font-body text-sm">Client·e</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview table */}
            {mappedFields.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-heading text-sm font-medium">
                  Prévisualisation ({Math.min(5, rows.length)} sur {rows.length} lignes)
                </h4>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {mappedFields.map(([col, field]) => (
                          <TableHead
                            key={col}
                            className="text-xs font-medium text-white whitespace-nowrap"
                            style={{ backgroundColor: '#FB3D80' }}
                          >
                            {FIELD_OPTIONS.find((o) => o.value === field)?.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          {mappedFields.map(([col]) => (
                            <TableCell key={col} className="font-body text-xs py-2 whitespace-nowrap max-w-[200px] truncate">
                              {row[col] != null ? String(row[col]) : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-body text-sm text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {step === 'mapping' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); }} className="font-body">
              Annuler
            </Button>
            <Button
              onClick={handleImport}
              disabled={!hasTaskMapping || validRows.length === 0 || isImporting}
              className="font-body gap-2"
            >
              Importer {validRows.length} action(s)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
