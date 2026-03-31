import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlumni } from '@/hooks/useAlumni';
import { formatMissionType } from '@/lib/missions';
import { getWarmthLevel, getWarmthConfig, daysSinceContact } from '@/lib/alumni';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, ExternalLink, Users, AlertTriangle, SmilePlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlumniFollowUpDialog } from '@/components/alumni/AlumniFollowUpDialog';
import type { Mission } from '@/lib/missions';

const TYPE_BADGE: Record<string, string> = {
  non_determine: 'bg-muted text-muted-foreground',
  binome: 'bg-primary text-primary-foreground',
  agency: 'bg-badge-bordeaux/20 text-badge-bordeaux',
};

const Alumni = () => {
  const { data: alumni = [], isLoading } = useAlumni();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'warmth' | 'name' | 'date'>('warmth');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let result = alumni;
    if (typeFilter !== 'all') {
      result = result.filter((m) => m.mission_type === typeFilter);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'warmth': {
          const daysA = Date.now() - new Date((a as any).last_contact_at || a.updated_at).getTime();
          const daysB = Date.now() - new Date((b as any).last_contact_at || b.updated_at).getTime();
          return daysB - daysA;
        }
        case 'name':
          return a.client_name.localeCompare(b.client_name);
        case 'date':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });
    return result;
  }, [alumni, typeFilter, sortBy]);

  const totalAlumni = alumni.length;
  const coldCount = alumni.filter(
    (m) => getWarmthLevel((m as any).last_contact_at, m.updated_at) === 'cold'
  ).length;
  const recentCount = alumni.filter(
    (m) => getWarmthLevel((m as any).last_contact_at, m.updated_at) === 'recent'
  ).length;

  const openDialog = (mission: Mission) => {
    setSelectedMission(mission);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="font-body text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl text-foreground">Ancien·nes client·es</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-body text-sm text-muted-foreground">Total ancien·nes</p>
              <p className="font-heading text-xl">{totalAlumni}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-badge-rose/10 p-2">
              <AlertTriangle className="h-5 w-5 text-badge-rose" />
            </div>
            <div>
              <p className="font-body text-sm text-muted-foreground">Sans nouvelles &gt; 90j</p>
              <p className="font-heading text-xl text-badge-rose">{coldCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2">
              <SmilePlus className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-body text-sm text-muted-foreground">Contact récent</p>
              <p className="font-heading text-xl text-emerald-700">{recentCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Sort */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] font-body">
            <SelectValue placeholder="Type de mission" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="binome">Binôme</SelectItem>
            <SelectItem value="agency">Agency</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'warmth' | 'name' | 'date')}>
          <SelectTrigger className="w-[200px] font-body">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warmth">À relancer en priorité</SelectItem>
            <SelectItem value="name">Nom A→Z</SelectItem>
            <SelectItem value="date">Date de fin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="font-body text-muted-foreground text-center py-12">
          Aucun·e ancien·ne client·e pour le moment.
        </p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((mission) => {
            const warmth = getWarmthLevel(null, mission.updated_at);
            const warmthConfig = getWarmthConfig(warmth);

            return (
              <Card
                key={mission.id}
                className="border-[hsl(340_30%_92%)] hover:border-primary/40 transition-colors rounded-xl"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-body font-medium text-[15px] text-foreground">
                      {mission.client_name}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        TYPE_BADGE[mission.mission_type] || TYPE_BADGE.non_determine
                      }`}
                    >
                      {formatMissionType(mission.mission_type)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="font-body text-xs text-muted-foreground">
                      Fin de mission : {format(new Date(mission.updated_at), 'd MMM yyyy', { locale: fr })}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      Dernier contact : {daysSinceContact(null, mission.updated_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${warmthConfig.color}`} />
                    <span className={`font-body text-xs ${warmthConfig.textColor}`}>
                      {warmthConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-body text-sm flex-1"
                      onClick={() => openDialog(mission)}
                    >
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      Prendre des nouvelles
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => navigate(`/dashboard/mission/${mission.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedMission && (
        <AlumniFollowUpDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          missionId={selectedMission.id}
          clientName={selectedMission.client_name}
          clientEmail={selectedMission.client_email}
          missionType={selectedMission.mission_type}
        />
      )}
    </div>
  );
};

export default Alumni;
