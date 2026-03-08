import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMissions, useDeleteMission } from '@/hooks/useMissions';
import { formatAmount, statusLabel, statusColor, formatMissionType, timeAgo, PIPELINE_COLUMNS } from '@/lib/missions';
import { PipelineStats } from '@/components/pipeline/PipelineStats';
import { NewMissionDialog } from '@/components/pipeline/NewMissionDialog';
import { DeleteMissionDialog } from '@/components/pipeline/DeleteMissionDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, MoreHorizontal, ArrowUpDown, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type SortKey = 'client_name' | 'mission_type' | 'status' | 'amount' | 'updated_at' | 'created_at';
type SortDir = 'asc' | 'desc';

const TYPE_BADGE: Record<string, string> = {
  non_determine: 'bg-muted text-muted-foreground',
  binome: 'bg-primary text-primary-foreground',
  agency: 'bg-[hsl(var(--brand-logo))] text-primary-foreground',
};

const Missions = () => {
  const { data: missions = [], isLoading } = useMissions();
  const deleteMission = useDeleteMission();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'client_name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let result = missions;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.client_name.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') {
      result = result.filter((m) => m.mission_type === typeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'client_name':
          cmp = a.client_name.localeCompare(b.client_name);
          break;
        case 'mission_type':
          cmp = a.mission_type.localeCompare(b.mission_type);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'amount':
          cmp = (a.amount ?? 0) - (b.amount ?? 0);
          break;
        case 'updated_at':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [missions, search, typeFilter, statusFilter, sortKey, sortDir]);

  const SortHeader = ({ label, field, className = '' }: { label: string; field: SortKey; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground transition-colors font-body text-xs font-semibold uppercase tracking-wide ${className}`}
      onClick={() => toggleSort(field)}
      style={{ background: 'hsl(340 100% 92%)' }}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground font-body">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="relative pb-20 md:pb-0">
      <div className="flex items-start justify-between mb-6">
        <h1 className="font-heading text-2xl text-foreground">Liste des missions</h1>
        <Button onClick={() => setDialogOpen(true)} className="font-body rounded-lg hidden md:inline-flex">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle mission
        </Button>
      </div>

      <PipelineStats missions={missions} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un·e client·e..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-body"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] font-body">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-body">Tous les types</SelectItem>
            <SelectItem value="non_determine" className="font-body">Non déterminé</SelectItem>
            <SelectItem value="binome" className="font-body">Binôme</SelectItem>
            <SelectItem value="agency" className="font-body">Agency</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] font-body">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-body">Tous les statuts</SelectItem>
            {PIPELINE_COLUMNS.map((col) => (
              <SelectItem key={col.id} value={col.id} className="font-body">{col.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(340_30%_92%)] overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b-0 hover:bg-transparent">
              <SortHeader label="Client·e" field="client_name" />
              <SortHeader label="Type" field="mission_type" />
              <SortHeader label="Statut" field="status" />
              <SortHeader label="Montant" field="amount" className="hidden md:table-cell" />
              <SortHeader label="Dernière action" field="updated_at" />
              <SortHeader label="Créée le" field="created_at" className="hidden md:table-cell" />
              <TableHead className="w-12" style={{ background: 'hsl(340 100% 92%)' }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-body">
                  Aucune mission trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m, i) => {
                const sc = statusColor(m.status);
                return (
                  <TableRow
                    key={m.id}
                    className={`border-[hsl(340_30%_92%)] hover:bg-secondary/60 cursor-pointer transition-colors ${
                      i % 2 === 1 ? 'bg-[hsl(340_100%_99%)]' : ''
                    }`}
                    onClick={() => navigate(`/dashboard/mission/${m.id}`)}
                  >
                    <TableCell className="font-body font-medium text-foreground">
                      {m.client_name}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium font-body ${TYPE_BADGE[m.mission_type] || TYPE_BADGE.non_determine}`}>
                        {formatMissionType(m.mission_type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium font-body ${sc.bg} ${sc.text}`}>
                        {statusLabel(m.status)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-body text-muted-foreground">
                      {formatAmount(m.amount) ?? '—'}
                    </TableCell>
                    <TableCell className="font-body text-muted-foreground text-sm">
                      {timeAgo(m.updated_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-body text-muted-foreground text-sm">
                      {format(new Date(m.created_at), 'd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/dashboard/mission/${m.id}`)}
                            className="font-body"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ouvrir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(m.id)}
                            className="font-body text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile FAB */}
      <Button
        onClick={() => setDialogOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Nouvelle mission"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NewMissionDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <DeleteMissionDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        clientName={missions.find((m) => m.id === deleteId)?.client_name ?? ''}
        onConfirm={() => {
          if (deleteId) {
            deleteMission.mutate(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
};

export default Missions;
