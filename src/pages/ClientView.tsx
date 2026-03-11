import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

/* ─── TYPES ─── */
interface ClientAction {
  id: string;
  task: string;
  description: string | null;
  category: string | null;
  channel: string | null;
  target_date: string | null;
  status: string;
  assignee: string;
  sort_order: number;
  client_comment: string | null;
}
interface ClientSession {
  id: string;
  session_date: string;
  session_type: string;
  structured_notes: { sections?: { title: string; content: string }[] } | null;
}
interface ClientFile {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  category: string | null;
  created_at: string;
  download_url: string | null;
}
interface ClientData {
  mission: { client_name: string; mission_type: string; status: string };
  actions: ClientAction[];
  sessions: ClientSession[];
  next_session: { date: string; agenda: string | null } | null;
  files: ClientFile[];
}

/* ─── HELPERS ─── */
function fmtSize(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${Math.round(b / 1024)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  not_started: { label: 'À venir', dot: '#D1D5DB', bg: '#F3F4F6', text: '#6B7280' },
  in_progress: { label: 'En cours', dot: '#4A90D9', bg: '#EFF6FF', text: '#2563EB' },
  to_validate: { label: 'À valider', dot: '#D97706', bg: '#FFFBEB', text: '#D97706' },
  validated: { label: 'Livré', dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
  delivered: { label: 'Livré', dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
  done: { label: 'Fait', dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
};

function fileIconBg(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '#FEE2E2';
  if (['doc', 'docx'].includes(ext || '')) return '#DBEAFE';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '#D1FAE5';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return '#E0E7FF';
  return '#F3F4F6';
}

function fileIconEmoji(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return '🖼️';
  return '📁';
}

function catBadge(cat: string | null): { label: string; bg: string; text: string } | null {
  if (!cat || cat === 'client_upload' || cat.startsWith('action_')) return null;
  const map: Record<string, { label: string; bg: string; text: string }> = {
    proposition: { label: 'Proposition', bg: 'rgba(145,1,75,0.08)', text: '#91014b' },
    livrable: { label: 'Livrable', bg: '#ECFDF5', text: '#059669' },
    visuel: { label: 'Visuel', bg: '#EFF6FF', text: '#4A90D9' },
    brief: { label: 'Brief', bg: '#FFFBEB', text: '#D97706' },
  };
  const m = map[cat.toLowerCase()];
  if (m) return m;
  return { label: cat, bg: '#F3F4F6', text: '#6B7280' };
}

/* ─── CSS KEYFRAMES ─── */
const ANIM_ID = '__client-view-anim-v2';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes cv-fade-up { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    .cv-anim { animation: cv-fade-up 0.4s ease both }
  `;
  document.head.appendChild(style);
}

/* ─── MAIN COMPONENT ─── */
const ClientView = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Ce lien n'est pas valide");
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: result, error } = await supabase.functions.invoke('get-client-space', { body: { token } });
      if (error || result?.error) {
        setErrorMessage(result?.error || "Ce lien n'est pas valide");
        setNotFound(true);
        return;
      }
      setData(result as ClientData);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Dynamic meta tags
  useEffect(() => {
    if (data) {
      document.title = `${data.mission.client_name} — Espace projet Nowadays`;
      const updateMeta = (attr: string, key: string, content: string) => {
        const meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
        if (meta) meta.content = content;
      };
      const typeLabel = data.mission.mission_type === 'agency' ? 'Agency' : 'Binôme';
      updateMeta('property', 'og:title', `${data.mission.client_name} — Espace projet Nowadays`);
      updateMeta('property', 'og:description', `Mission ${typeLabel} — Suivez l'avancement avec Nowadays Agency.`);
      updateMeta('name', 'twitter:title', `${data.mission.client_name} — Espace projet Nowadays`);
      updateMeta('name', 'twitter:description', `Mission ${typeLabel} — Suivez l'avancement avec Nowadays Agency.`);
    }
    return () => { document.title = 'Nowadays Missions'; };
  }, [data]);

  const handleToggleAction = async (actionId: string, done: boolean) => {
    setUpdatingAction(actionId);
    try {
      await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, status: done ? 'done' : 'not_started' }
      });
      setData(p => p ? {
        ...p,
        actions: p.actions.map(a => a.id === actionId ? { ...a, status: done ? 'done' : 'not_started' } : a)
      } : p);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleSaveComment = async (actionId: string) => {
    const comment = commentDrafts[actionId] ?? '';
    setSavingComment(actionId);
    try {
      await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, client_comment: comment }
      });
      setData(p => p ? {
        ...p,
        actions: p.actions.map(a => a.id === actionId ? { ...a, client_comment: comment || null } : a)
      } : p);
      toast({ title: 'Commentaire enregistré ✓' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setSavingComment(null);
    }
  };

  const handleActionFileUpload = async (actionId: string, file: globalThis.File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 50 Mo.', variant: 'destructive' });
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const clientFolder = (data?.mission.client_name || 'client').replace(/\s+/g, '_');
      const path = `${clientFolder}/actions/${actionId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast({ title: 'Erreur upload', description: uploadError.message || "Impossible d'envoyer le fichier.", variant: 'destructive' });
        return;
      }

      const { data: res, error } = await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, file_name: file.name, file_size: file.size, storage_path: path },
      });

      if (error) {
        console.error('Edge Function invoke error:', error);
        toast({ title: 'Fichier envoyé', description: 'Le fichier a été uploadé. Laetitia le verra dans le Storage.' });
        fetchData();
        return;
      }

      if (res?.error) {
        console.error('Edge Function response error:', res.error);
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Fichier ajouté ✓' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erreur upload', description: err?.message || "Impossible d'envoyer le fichier.", variant: 'destructive' });
    }
  };

  const handleGlobalFileUpload = async (file: globalThis.File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 50 Mo.', variant: 'destructive' });
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const clientFolder = (data?.mission.client_name || 'client').replace(/\s+/g, '_');
      const path = `${clientFolder}/uploads/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast({ title: 'Erreur upload', description: uploadError.message || "Impossible d'envoyer le fichier.", variant: 'destructive' });
        return;
      }

      const { data: res, error } = await supabase.functions.invoke('upload-client-file', {
        body: { token, file_name: file.name, file_size: file.size, storage_path: path },
      });

      if (error) {
        console.error('Edge Function invoke error:', error);
        toast({ title: 'Fichier envoyé', description: 'Le fichier a été uploadé. Laetitia le verra dans le Storage.' });
        fetchData();
        return;
      }

      if (res?.error) {
        console.error('Edge Function response error:', res.error);
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Fichier envoyé ✓' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erreur upload', description: err?.message || "Impossible d'envoyer le fichier.", variant: 'destructive' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleGlobalFileUpload(f);
  };

  /* ─── LOADING ─── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#91014b' }} />
      </div>
    );
  }

  /* ─── NOT FOUND ─── */
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
        <div className="text-center space-y-4 px-6">
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.7 }}>NOWADAYS</p>
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#1A1A2E', fontSize: '1.5rem' }}>{errorMessage}</h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#9CA3AF', fontSize: '0.875rem' }}>Vérifie que tu as bien copié le lien envoyé par Laetitia.</p>
        </div>
      </div>
    );
  }

  /* ─── DATA CALCULATIONS ─── */
  const clientActions = data.actions.filter(a => a.assignee === 'client');
  const laetitiaActions = data.actions.filter(a => a.assignee === 'laetitia');
  const allActions = data.actions;

  // Progress calculations
  const doneAll = allActions.filter(a => ['done', 'delivered', 'validated'].includes(a.status)).length;
  const inProgressAll = allActions.filter(a => a.status === 'in_progress').length;
  const progressPct = allActions.length > 0 ? Math.round((doneAll / allActions.length) * 100) : 0;

  // Client actions stats
  const doneClient = clientActions.filter(a => a.status === 'done').length;
  const totalClient = clientActions.length;

  // Laetitia actions stats
  const laetitiaWip = laetitiaActions.filter(a => a.status === 'in_progress').length;
  const laetitiaDone = laetitiaActions.filter(a => ['done', 'delivered', 'validated'].includes(a.status)).length;
  const laetitiaTodo = laetitiaActions.filter(a => a.status === 'not_started').length;

  // Sort client actions: done first, then by sort_order
  const sortedClientActions = [...clientActions].sort((a, b) => {
    const aDone = a.status === 'done' ? 0 : 1;
    const bDone = b.status === 'done' ? 0 : 1;
    if (aDone !== bDone) return aDone - bDone;
    return a.sort_order - b.sort_order;
  });

  // Sort laetitia actions: done first, then in_progress, then not_started
  const sortedLaetitiaActions = [...laetitiaActions].sort((a, b) => {
    const order = (s: string) => {
      if (['done', 'delivered', 'validated'].includes(s)) return 0;
      if (s === 'in_progress') return 1;
      if (s === 'to_validate') return 2;
      return 3;
    };
    return order(a.status) - order(b.status);
  });

  // Conditions
  const hasClientActions = clientActions.length > 0;
  const hasLaetitiaWip = laetitiaWip > 0;
  const hasLaetitiaDone = laetitiaDone > 0;
  const hasLaetitiaActive = hasLaetitiaWip || hasLaetitiaDone;

  // Mission type badge
  const missionType = data.mission.mission_type;
  const isBinome = missionType === 'binome';
  const typeLabel = missionType === 'agency' ? 'Agency' : missionType === 'binome' ? 'Binôme' : missionType.replace(/_/g, ' ');

  // Determine phase
  const isPhase1 = !hasClientActions && !hasLaetitiaActive; // tout début
  const isPhase2 = !hasClientActions && hasLaetitiaActive;  // laetitia active, pas encore d'actions client
  const isPhase3 = hasClientActions;                         // actions client existent

  // Show progress bar only in phase 2 and 3
  const showProgress = isPhase2 || isPhase3;

  // Laetitia section helpers
  const laetitiaInProgress = laetitiaActions.filter(a => ['in_progress', 'to_validate'].includes(a.status));
  const laetitiaDelivered = laetitiaActions.filter(a => ['validated', 'delivered', 'done'].includes(a.status));
  const laetitiaUpcoming = laetitiaActions.filter(a => a.status === 'not_started');
  const sortByOrder = (arr: ClientAction[]) => [...arr].sort((a, b) => a.sort_order - b.sort_order);

  // Build category map for laetitia actions
  const laetitiaByCategory = (() => {
    const map = new Map<string, ClientAction[]>();
    laetitiaActions.forEach(a => {
      const cat = a.category?.trim() || 'Autre';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    });
    const sortedCats = [...map.keys()].sort((a, b) => {
      if (a === 'Cadrage') return -1;
      if (b === 'Cadrage') return 1;
      return a.localeCompare(b, 'fr');
    });
    return sortedCats.map(cat => ({ cat, actions: sortByOrder(map.get(cat)!) }));
  })();

  const actionStatusColor = (status: string) => {
    if (['validated', 'delivered', 'done'].includes(status)) return { color: '#D1D5DB', weight: 400, strike: true };
    if (['in_progress', 'to_validate'].includes(status)) return { color: '#4A90D9', weight: 500, strike: false };
    return { color: '#9CA3AF', weight: 400, strike: false };
  };

  const actionBarColor = (status: string) => {
    if (['validated', 'delivered', 'done'].includes(status)) return '#10B981';
    if (['in_progress', 'to_validate'].includes(status)) return '#4A90D9';
    return '#E5E7EB';
  };

  let sectionIdx = 0;
  const delay = () => `${(sectionIdx++) * 0.03}s`;

  /* ─── RENDERABLE BLOCKS ─── */

  const nextSessionBlock = data.next_session?.date ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 28, background: '#fff', borderRadius: 14, borderLeft: '4px solid #FFE561', padding: '16px 20px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>📅</div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#91014b' }}>PROCHAINE SESSION</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginTop: 4 }}>
          {format(new Date(data.next_session.date), "EEEE d MMMM yyyy — HH'h'mm", { locale: fr })}
        </p>
        {data.next_session.agenda && <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{data.next_session.agenda}</p>}
      </div>
    </div>
  ) : null;

  const progressBlock = showProgress && allActions.length > 0 ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 24, background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E' }}>Avancement de la mission</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#91014b' }}>{progressPct}%</span>
      </div>
      <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#FFD6E8' }}>
        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #91014b, #FB3D80)', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{inProgressAll} en cours</span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {hasClientActions
            ? `${doneClient}/${totalClient} de tes actions terminées`
            : `${doneAll} livrées sur ${allActions.length}`
          }
        </span>
      </div>
    </div>
  ) : null;

  const laetitiaBlock = laetitiaActions.length > 0 ? (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 16, fontWeight: 'normal', marginBottom: 14 }}>Ce que je fais pour toi</h2>

      {/* Stats bar */}
      <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', background: '#F3F4F6', gap: 1, marginBottom: 16 }}>
        {[
          { count: laetitiaDelivered.length, label: 'Livrées', color: '#10B981' },
          { count: laetitiaInProgress.length, label: 'En cours', color: '#4A90D9' },
          { count: laetitiaUpcoming.length, label: 'Prévues', color: '#9CA3AF' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: '#fff', padding: '12px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8 }}>
        {laetitiaByCategory.map(({ cat, actions: catActions }) => {
          const doneCount = catActions.filter(a => ['validated', 'delivered', 'done'].includes(a.status)).length;
          const allDone = doneCount === catActions.length;
          return (
            <div key={cat} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(145,1,75,0.03)' }}>
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#91014b', textTransform: 'uppercase', letterSpacing: 0.3 }}>{cat}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{doneCount}/{catActions.length}{allDone ? ' ✓' : ''}</span>
              </div>
              {/* Action list */}
              <div style={{ marginBottom: 10 }}>
                {catActions.map(a => {
                  const s = actionStatusColor(a.status);
                  return (
                    <p key={a.id} style={{ fontSize: 12, lineHeight: 1.6, color: s.color, fontWeight: s.weight, textDecoration: s.strike ? 'line-through' : 'none' }}>{a.task}</p>
                  );
                })}
              </div>
              {/* Mini progress bar */}
              <div style={{ display: 'flex', gap: 3 }}>
                {catActions.map(a => (
                  <span key={a.id} style={{ width: 8, height: 4, borderRadius: 2, background: actionBarColor(a.status) }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  ) : null;

  const softMessageBlock = !hasClientActions ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 24, background: '#fff', borderRadius: 12, padding: '20px 24px', textAlign: 'center', boxShadow: '0 1px 2px rgba(145,1,75,0.03)' }}>
      {hasLaetitiaDone ? (
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500, color: '#91014b' }}>Pas encore d'actions pour toi.</span>{' '}
          Je prépare la stratégie, tes premières actions arriveront bientôt ici.
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500, color: '#91014b' }}>Je travaille sur ta stratégie.</span>{' '}
          Tu retrouveras ici tes actions et l'avancement au fur et à mesure.
        </p>
      )}
    </div>
  ) : null;

  const clientActionsBlock = hasClientActions ? (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 16, fontWeight: 'normal' }}>Ce que j'attends de toi</h2>
        <span style={{ background: '#91014b', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 10px', lineHeight: '18px' }}>{doneClient}/{totalClient}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sortedClientActions.map(action => {
          const isDone = action.status === 'done';
          const isExpanded = expandedAction === action.id;
          const isUpdating = updatingAction === action.id;

          return (
            <div
              key={action.id}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '11px 16px',
                boxShadow: '0 1px 2px rgba(145,1,75,0.03)',
                transition: 'all 0.15s',
                opacity: isDone ? 0.4 : 1
              }}
              onMouseEnter={e => { if (!isDone) e.currentTarget.style.boxShadow = '0 2px 6px rgba(145,1,75,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(145,1,75,0.03)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => handleToggleAction(action.id, !isDone)}
                  disabled={isUpdating}
                  style={{
                    width: 20, height: 20, minWidth: 20, borderRadius: 5,
                    border: `2px solid ${isDone ? '#91014b' : '#D1D5DB'}`,
                    background: isDone ? '#91014b' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0
                  }}
                  onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = '#91014b'; }}
                  onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                >
                  {isDone && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isUpdating && <Loader2 className="h-3 w-3 animate-spin" style={{ color: isDone ? '#fff' : '#91014b' }} />}
                </button>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: isDone ? '#9CA3AF' : '#1A1A2E', textDecoration: isDone ? 'line-through' : 'none' }}>{action.task}</p>
                  {isExpanded && action.description && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, lineHeight: 1.5 }}>{action.description}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {isDone ? `✓ ${format(new Date(), 'd MMM', { locale: fr })}` : action.target_date ? format(new Date(action.target_date), 'd MMM', { locale: fr }) : ''}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingActionId(action.id); actionFileInputRef.current?.click(); }}
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FFF4F8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Paperclip style={{ width: 14, height: 14, color: '#91014b' }} />
                  </button>
                </div>
              </div>
              {/* Expanded: comment zone */}
              {isExpanded && (
                <div style={{ marginTop: 10, paddingLeft: 32 }}>
                  {action.client_comment && !(commentDrafts[action.id] !== undefined) && (
                    <p style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 6, padding: '6px 10px', marginBottom: 6, lineHeight: 1.5 }}>
                      💬 {action.client_comment}
                    </p>
                  )}
                  <textarea
                    placeholder="Ajoute un commentaire…"
                    value={commentDrafts[action.id] ?? action.client_comment ?? ''}
                    onChange={e => setCommentDrafts(p => ({ ...p, [action.id]: e.target.value }))}
                    style={{
                      width: '100%', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6,
                      padding: '6px 10px', minHeight: 50, resize: 'vertical', fontFamily: "'IBM Plex Sans', sans-serif",
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#91014b'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      onClick={() => handleSaveComment(action.id)}
                      disabled={savingComment === action.id}
                      style={{
                        fontSize: 12, fontWeight: 500, color: '#fff', background: '#91014b',
                        border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
                        opacity: savingComment === action.id ? 0.6 : 1, transition: 'opacity 0.15s',
                      }}
                    >
                      {savingComment === action.id ? 'Envoi…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={actionFileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt,.zip"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && pendingActionId) handleActionFileUpload(pendingActionId, f);
          if (actionFileInputRef.current) actionFileInputRef.current.value = '';
          setPendingActionId(null);
        }}
      />
    </section>
  ) : null;

  const documentsBlock = (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 16, fontWeight: 'normal', marginBottom: 14 }}>Documents & livrables</h2>
      {data.files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, marginBottom: 12 }}>
          {data.files.map(file => {
            const cb = catBadge(file.category);
            return (
              <div key={file.id} onClick={() => file.download_url && window.open(file.download_url, '_blank')}
                style={{ background: '#fff', borderRadius: 10, padding: 13, boxShadow: '0 1px 2px rgba(145,1,75,0.04)', cursor: file.download_url ? 'pointer' : 'default', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(145,1,75,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(145,1,75,0.04)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: fileIconBg(file.file_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{fileIconEmoji(file.file_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{fmtSize(file.file_size)}{file.file_size ? ' · ' : ''}{format(new Date(file.created_at), 'd MMM yyyy', { locale: fr })}</p>
                </div>
                {cb && <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4, background: cb.bg, color: cb.text, borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>{cb.label}</span>}
              </div>
            );
          })}
        </div>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ border: `2px dashed ${isDragging ? '#FFA7C6' : '#FFD6E8'}`, borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', background: isDragging ? 'rgba(255,244,248,0.4)' : 'transparent' }}
      >
        <span style={{ fontSize: 18, color: '#FFA7C6' }}>⬆️</span>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#91014b', marginTop: 8 }}>{data.files.length === 0 ? 'Tu as des fichiers à me transmettre ?' : 'Dépose tes fichiers ici'}</p>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{data.files.length === 0 ? 'Logo, photos, charte graphique... Dépose-les ici' : 'Images, PDF, Word, Excel — max 4.5 Mo'}</p>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt,.zip" onChange={e => { const f = e.target.files?.[0]; if (f) handleGlobalFileUpload(f); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
      </div>
    </section>
  );

  const sessionsBlock = data.sessions.length > 0 ? (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 16, fontWeight: 'normal', marginBottom: 14 }}>Nos sessions</h2>
      <div style={{ borderLeft: '2px solid #FFD6E8', paddingLeft: 22, marginLeft: 5 }}>
        {data.sessions.map((session, idx) => (
          <div key={session.id} style={{ position: 'relative', paddingBottom: idx < data.sessions.length - 1 ? 20 : 0 }}>
            <span style={{ position: 'absolute', left: -27, top: 4, width: 10, height: 10, borderRadius: 3, background: '#91014b', border: '2px solid #fff', boxShadow: '0 0 0 2px #FFD6E8' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>{format(new Date(session.session_date), 'd MMMM yyyy', { locale: fr })}</span>
              <span style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', borderRadius: 99, padding: '2px 8px' }}>{session.session_type === 'visio' ? 'Visio' : session.session_type === 'phone' ? 'Téléphone' : session.session_type}</span>
            </div>
            {session.structured_notes?.sections && session.structured_notes.sections.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 10, padding: 13, boxShadow: '0 1px 2px rgba(145,1,75,0.03)' }}>
                {session.structured_notes.sections.map((sec, i) => (
                  <div key={i} style={{ marginBottom: i < session.structured_notes!.sections!.length - 1 ? 12 : 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{sec.title}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{sec.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const footerBlock = (
    <footer style={{ paddingTop: 48, textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
        Propulsé par{' '}
        <a href="https://nowadaysagency.com" target="_blank" rel="noopener noreferrer" style={{ color: '#91014b', textDecoration: 'none' }}>Nowadays Agency</a>
      </p>
    </footer>
  );

  return (
    <div className="min-h-screen" style={{ background: '#FFF4F8', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      
      {/* ═══ HEADER ═══ */}
      <header style={{ background: 'linear-gradient(180deg, white 0%, #FFF4F8 100%)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 24, borderBottom: '2px solid #91014b' }}>
            <div>
              <p style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 13, color: '#91014b', textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.7 }}>NOWADAYS</p>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, color: '#1A1A2E', fontWeight: 'normal', marginTop: 8 }}>{data.mission.client_name}</h1>
              {missionType !== 'non_determine' && (
                <span style={{ display: 'inline-block', marginTop: 10, fontSize: 11, fontWeight: 700, color: '#fff', background: isBinome ? '#FB3D80' : '#91014b', borderRadius: 99, padding: '3px 12px' }}>{typeLabel}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: '#10B981' }} />
              <span style={{ fontSize: 11, color: '#6B7280' }}>Mission en cours</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ CONTENT — Dynamic order ═══ */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 80px' }} className="sm:px-6">
        {isPhase1 && (
          <>
            {nextSessionBlock}
            {laetitiaBlock}
            {documentsBlock}
            {softMessageBlock}
            {footerBlock}
          </>
        )}
        {isPhase2 && (
          <>
            {nextSessionBlock}
            {progressBlock}
            {laetitiaBlock}
            {documentsBlock}
            {softMessageBlock}
            {footerBlock}
          </>
        )}
        {isPhase3 && (
          <>
            {nextSessionBlock}
            {progressBlock}
            {laetitiaBlock}
            {clientActionsBlock}
            {documentsBlock}
            {sessionsBlock}
            {footerBlock}
          </>
        )}
      </main>
    </div>
  );
};

export default ClientView;
