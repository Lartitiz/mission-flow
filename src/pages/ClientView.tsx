import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
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
  phase: string | null;
}
interface ClientSession {
  id: string;
  session_date: string;
  session_type: string;
  client_summary: { headline: string; bullets: string[] } | null;
}
interface ClientFile {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  category: string | null;
  created_at: string;
  download_url: string | null;
  url: string | null;
  uploaded_by?: string | null;
}
interface ClientData {
  mission: { id: string; client_name: string; mission_type: string; status: string; client_note?: string | null };
  actions: ClientAction[];
  sessions: ClientSession[];
  next_session: { date: string; agenda: string | null } | null;
  files: ClientFile[];
}

/* ─── CONFETTIS (charte : célébration à l'interaction, jamais en décor) ───
   Petite salve (6) quand une action est cochée ; grande salve (36) réservée
   aux jalons (pin's gagné, palier franchi). Coupés en prefers-reduced-motion. */
const CONFETTI_COLORS = ['#FB3D80', '#FFE561', '#FF7A33', '#91014B', '#FFA7C6', '#E8402E'];
function fireConfetti(x: number, y: number, count: number) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    bit.className = 'cv-confetti-bit';
    const big = count > 10;
    bit.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${big ? 9 : 7}px;height:${big ? 13 : 11}px;border-radius:2px;pointer-events:none;z-index:9999;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};`;
    bit.style.setProperty('--dx', `${(Math.random() * 2 - 1) * (big ? 220 : 70)}px`);
    bit.style.setProperty('--dy', `${-(big ? 60 : 40) - Math.random() * (big ? 200 : 70)}px`);
    bit.style.setProperty('--rot', `${Math.random() * 520 - 260}deg`);
    bit.style.animation = `cv-confetti ${(big ? 1 : 0.7) + Math.random() * 0.5}s ease-out forwards`;
    document.body.appendChild(bit);
    setTimeout(() => bit.remove(), 1800);
  }
}

/* ─── PIN'S : des jalons RÉELS de la mission, jamais des points ─── */
interface Pin {
  emoji: string;
  label: string;
  won: boolean;
  bg: string;
}
function computePins(data: ClientData): Pin[] {
  const clientActions = data.actions.filter((a) => a.assignee === 'client');
  const doneClient = clientActions.filter((a) => a.status === 'done').length;
  const doneAll = data.actions.filter((a) => ['done', 'delivered', 'validated'].includes(a.status)).length;
  const pct = data.actions.length > 0 ? (doneAll / data.actions.length) * 100 : 0;
  const hasClientFile = data.files.some((f) => f.uploaded_by === 'client');
  return [
    { emoji: '🚀', label: "C'est parti", won: true, bg: '#FFE561' },
    { emoji: '📎', label: '1er fichier envoyé', won: hasClientFile, bg: '#FFD6E8' },
    { emoji: '✅', label: '1re action bouclée', won: doneClient >= 1, bg: '#FFE561' },
    { emoji: '🔥', label: 'Mi-parcours', won: pct >= 50, bg: '#FB3D80' },
    { emoji: '💪', label: 'Toutes tes actions', won: clientActions.length > 0 && doneClient === clientActions.length, bg: '#FFD6E8' },
    { emoji: '🎉', label: 'Mission bouclée', won: data.mission.status === 'completed', bg: '#FFE561' },
  ];
}

/* Palier nommé de la jauge : le chiffre raconte au lieu de compter */
function palierFor(pct: number): string {
  if (pct >= 100) return 'Mission accomplie 🎉';
  if (pct >= 75) return 'Dernière ligne droite';
  if (pct >= 50) return 'À mi-chemin : ça avance fort';
  if (pct >= 25) return 'Ça prend forme';
  return "En route !";
}

/* ─── CHARTE NOWADAYS ───
   Couleurs par rôle : blanc (base), rose pâle #FFF4F8 (fonds), framboise #FB3D80
   (actions, coches, jauge), bordeaux #91014B (titres, texte fort), jaune #FFE561
   (badges, chiffres-clés — texte toujours bordeaux), encre #1A1A1A (texte),
   gris chaud #6B5A62 (légendes). */
const SERIF = "'Instrument Serif', serif";
const SANS = "'Hanken Grotesk', sans-serif";
/* Seul usage autorisé de linear-gradient : le fin bandeau vichy en haut de page. */
const VICHY: React.CSSProperties = {
  height: 8,
  background:
    'repeating-linear-gradient(90deg, rgba(251,61,128,.28) 0 10px, transparent 10px 24px), repeating-linear-gradient(0deg, rgba(251,61,128,.18) 0 4px, transparent 4px 10px)',
};

/* ─── HELPERS ─── */
function fmtSize(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${Math.round(b / 1024)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  not_started: { label: 'À venir', dot: '#E8DEE3', bg: '#F4EFF1', text: '#6B5A62' },
  in_progress: { label: 'En cours', dot: '#FB3D80', bg: '#FFE561', text: '#91014B' },
  to_validate: { label: 'À valider', dot: '#FB3D80', bg: '#FFE561', text: '#91014B' },
  validated: { label: 'Livré', dot: '#FB3D80', bg: '#FFF4F8', text: '#91014B' },
  delivered: { label: 'Livré', dot: '#FB3D80', bg: '#FFF4F8', text: '#91014B' },
  done: { label: 'Fait', dot: '#FB3D80', bg: '#FFF4F8', text: '#91014B' },
};

function fileIconBg(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '#FFE0EC';
  if (['doc', 'docx'].includes(ext || '')) return '#FFF4F8';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '#FFF7CC';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return '#FFD6E8';
  return '#F4EFF1';
}

function fileIconEmoji(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return '🖼️';
  return '📁';
}

/* MIME par extension : quand le navigateur ne fournit pas de type (fréquent
   sous Windows ou depuis WhatsApp), on le déduit du nom du fichier : sinon le
   bucket refuse 'application/octet-stream' et la cliente voit une erreur brute. */
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
};

function contentTypeFor(fileName: string, browserType: string): string {
  if (browserType) return browserType;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXT_MIME[ext] || 'application/octet-stream';
}

const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
const ACCEPTED_FORMATS_MSG = "Ce type de fichier n'est pas accepté. Formats ok : photos (y compris iPhone), PDF, Word, Excel, CSV, zip.";
const TOO_BIG_MSG = 'coupe-le en deux ou envoie un lien.';

/* Vérifications AVANT l'upload : on bloque tout de suite avec un message clair
   plutôt que de laisser le serveur répondre une erreur anglaise. */
function preUploadError(file: globalThis.File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_EXTS.includes(ext) || file.type.startsWith('video/')) {
    return "Les vidéos ne sont pas acceptées ici : envoie un lien (WeTransfer, Drive…) dans un commentaire.";
  }
  if (file.size > 50 * 1024 * 1024) {
    return `Fichier trop lourd (${Math.round(file.size / 1048576)} Mo, max 50) : ${TOO_BIG_MSG}`;
  }
  if (contentTypeFor(file.name, file.type) === 'application/octet-stream') {
    return ACCEPTED_FORMATS_MSG;
  }
  return null;
}

/* Traduit les erreurs storage de Supabase (anglaises) en français. */
function storageErrorMessage(rawMessage: string | undefined): string {
  const m = (rawMessage || '').toLowerCase();
  if (m.includes('mime type')) return ACCEPTED_FORMATS_MSG;
  if (m.includes('payload too large') || m.includes('exceeded')) return `Fichier trop lourd (max 50 Mo) : ${TOO_BIG_MSG}`;
  if (m.includes('row-level security') || m.includes('security policy')) return "Ce lien n'est plus actif : contacte Laetitia.";
  return "L'envoi a échoué. Réessaie, ou contacte Laetitia si ça continue.";
}

function catBadge(cat: string | null): { label: string; bg: string; text: string } | null {
  if (!cat || cat === 'client_upload' || cat.startsWith('action_')) return null;
  const map: Record<string, { label: string; bg: string; text: string }> = {
    proposition: { label: 'Proposition', bg: 'rgba(145,1,75,0.08)', text: '#91014b' },
    livrable: { label: 'Livrable', bg: '#FFE561', text: '#91014B' },
    visuel: { label: 'Visuel', bg: '#FFD6E8', text: '#91014B' },
    brief: { label: 'Brief', bg: '#FFF7CC', text: '#91014B' },
  };
  const m = map[cat.toLowerCase()];
  if (m) return m;
  return { label: cat, bg: '#F4EFF1', text: '#6B5A62' };
}

/* ─── CSS KEYFRAMES ─── */
const ANIM_ID = '__client-view-anim-v2';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes cv-fade-up { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    .cv-anim { animation: cv-fade-up 0.4s ease both }
    @keyframes cv-confetti { 0% { opacity:1; transform:translate(0,0) rotate(0) } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) rotate(var(--rot)) } }
    @media (prefers-reduced-motion: reduce) { .cv-confetti-bit { display:none } }
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
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [showDoneActions, setShowDoneActions] = useState(false);


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
      document.title = `${data.mission.client_name} · Espace projet Nowadays`;
      const updateMeta = (attr: string, key: string, content: string) => {
        const meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
        if (meta) meta.content = content;
      };
      const typeLabel = data.mission.mission_type === 'agency' ? 'Agency' : 'Binôme';
      updateMeta('property', 'og:title', `${data.mission.client_name} · Espace projet Nowadays`);
      updateMeta('property', 'og:description', `Mission ${typeLabel} : suivez l'avancement avec Nowadays Agency.`);
      updateMeta('name', 'twitter:title', `${data.mission.client_name} · Espace projet Nowadays`);
      updateMeta('name', 'twitter:description', `Mission ${typeLabel} : suivez l'avancement avec Nowadays Agency.`);
    }
    return () => { document.title = 'Nowadays Missions'; };
  }, [data]);

  const handleToggleAction = async (actionId: string, done: boolean, clickRect?: DOMRect) => {
    setUpdatingAction(actionId);
    try {
      const { data: result, error } = await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, status: done ? 'done' : 'not_started' }
      });
      if (error || result?.error) throw new Error(result?.error || 'Erreur');
      setData(p => {
        if (!p) return p;
        const next = {
          ...p,
          actions: p.actions.map(a => a.id === actionId ? { ...a, status: done ? 'done' : 'not_started' } : a)
        };
        if (done) {
          // Petite salve sur la coche ; GRANDE salve seulement si un jalon tombe
          const wonBefore = computePins(p).filter(pin => pin.won).length;
          const wonAfter = computePins(next).filter(pin => pin.won).length;
          if (wonAfter > wonBefore) {
            fireConfetti(window.innerWidth / 2, window.innerHeight / 3, 36);
          } else if (clickRect) {
            fireConfetti(clickRect.left + clickRect.width / 2, clickRect.top, 6);
          }
        }
        return next;
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder. Réessaie.', variant: 'destructive' });
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleSaveComment = async (actionId: string) => {
    const comment = commentDrafts[actionId] ?? '';
    setSavingComment(actionId);
    try {
      const { data: result, error } = await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, client_comment: comment }
      });
      if (error || result?.error) throw new Error(result?.error || 'Erreur');
      setData(p => p ? {
        ...p,
        actions: p.actions.map(a => a.id === actionId ? { ...a, client_comment: comment || null } : a)
      } : p);
      toast({ title: 'Commentaire enregistré ✓' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder. Réessaie.', variant: 'destructive' });
    } finally {
      setSavingComment(null);
    }
  };

  const handleActionFileUpload = async (actionId: string, file: globalThis.File) => {
    const blocked = preUploadError(file);
    if (blocked) {
      toast({ title: 'Fichier refusé', description: blocked, variant: 'destructive' });
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${data!.mission.id}/actions/${actionId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file, {
        contentType: contentTypeFor(file.name, file.type),
      });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast({ title: "Erreur d'envoi", description: storageErrorMessage(uploadError.message), variant: 'destructive' });
        return;
      }

      // Enregistrement côté serveur : la fonction vérifie le lien, enregistre
      // le fichier ET prévient Laetitia par e-mail (l'insert direct ne notifiait pas).
      const { data: result, error: fnError } = await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, file_name: file.name, file_size: file.size, storage_path: path },
      });

      if (fnError || result?.error) {
        console.error('File record error:', fnError || result?.error);
        toast({ title: 'Erreur', description: 'Le fichier est envoyé mais pas enregistré : contacte Laetitia.', variant: 'destructive' });
        return;
      }

      toast({ title: 'Fichier ajouté ✓' });
      fetchData();
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: "Erreur d'envoi", description: "L'envoi a échoué. Réessaie, ou contacte Laetitia si ça continue.", variant: 'destructive' });
    }
  };

  const handleGlobalFileUpload = async (file: globalThis.File) => {
    const blocked = preUploadError(file);
    if (blocked) {
      toast({ title: 'Fichier refusé', description: blocked, variant: 'destructive' });
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${data!.mission.id}/uploads/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file, {
        contentType: contentTypeFor(file.name, file.type),
      });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast({ title: "Erreur d'envoi", description: storageErrorMessage(uploadError.message), variant: 'destructive' });
        return;
      }

      // Enregistrement côté serveur : la fonction vérifie le lien, enregistre
      // le fichier ET prévient Laetitia par e-mail (l'insert direct ne notifiait pas).
      const { data: result, error: fnError } = await supabase.functions.invoke('upload-client-file', {
        body: { token, file_name: file.name, file_size: file.size, storage_path: path },
      });

      if (fnError || result?.error) {
        console.error('File record error:', fnError || result?.error);
        toast({ title: 'Erreur', description: 'Le fichier est envoyé mais pas enregistré : contacte Laetitia.', variant: 'destructive' });
        return;
      }

      toast({ title: 'Fichier envoyé ✓' });
      fetchData();
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: "Erreur d'envoi", description: "L'envoi a échoué. Réessaie, ou contacte Laetitia si ça continue.", variant: 'destructive' });
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
      <div className="min-h-screen flex flex-col" style={{ background: '#FFF4F8' }}>
        <div style={VICHY} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 px-6">
            <p style={{ fontFamily: SANS, fontWeight: 700, color: '#91014b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>NOWADAYS</p>
            <h1 style={{ fontFamily: SERIF, fontWeight: 'normal', color: '#91014b', fontSize: 26 }}>{errorMessage}</h1>
            <p style={{ fontFamily: SANS, color: '#6B5A62', fontSize: '0.875rem' }}>Vérifie que tu as bien copié le lien envoyé par Laetitia.</p>
          </div>
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

  // Phase timeline config
  const PHASE_CONFIG: Record<string, { label: string; description: string }> = {
    'mois_1_2': { label: 'Mois 1-2 : Stratégie', description: 'Je construis toute ta stratégie de com\' : positionnement, branding, plan d\'actions.' },
    'mois_1': { label: 'Mois 1', description: '' },
    'mois_2': { label: 'Mois 2', description: '' },
    'mois_3': { label: 'Mois 3 : Application', description: 'On met en place les premiers outils et contenus ensemble.' },
    'mois_4_5': { label: 'Mois 4-5 : Déploiement', description: 'On déploie la stratégie sur tes canaux et on ajuste en continu.' },
    'mois_4': { label: 'Mois 4', description: '' },
    'mois_5': { label: 'Mois 5', description: '' },
    'mois_6': { label: 'Mois 6 : Bilan & autonomie', description: 'On fait le point sur les résultats et je te donne ta feuille de route pour la suite.' },
    'phase_1': { label: 'Phase 1', description: '' },
    'phase_2': { label: 'Phase 2', description: '' },
    'continu': { label: 'Tout au long de la mission', description: '' },
  };
  const PHASE_ORDER = ['mois_1_2', 'mois_1', 'mois_2', 'mois_3', 'mois_4_5', 'mois_4', 'mois_5', 'mois_6', 'phase_1', 'phase_2', 'continu', '__other__'];
  const DONE_STATUSES = ['validated', 'delivered', 'done'];
  const ACTIVE_STATUSES = ['in_progress', 'to_validate'];

  const laetitiaByPhase = (() => {
    const map = new Map<string, ClientAction[]>();
    laetitiaActions.forEach(a => {
      const key = a.phase?.trim() || '__other__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return PHASE_ORDER
      .filter(k => map.has(k))
      .map(k => ({
        key: k,
        label: k === '__other__' ? 'Autre' : (PHASE_CONFIG[k]?.label || k),
        description: k === '__other__' ? '' : (PHASE_CONFIG[k]?.description || ''),
        actions: [...map.get(k)!].sort((a, b) => a.sort_order - b.sort_order),
      }));
  })();

  const phaseGroupStatus = (actions: ClientAction[]) => {
    if (actions.every(a => DONE_STATUSES.includes(a.status))) return 'done';
    if (actions.some(a => ACTIVE_STATUSES.includes(a.status))) return 'active';
    return 'upcoming';
  };

  const isCollabKeyword = (task: string) => /visio|atelier|bilan|session|ensemble/i.test(task);

  const togglePhaseCollapse = (key: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  // (phase grouping moved above)

  const actionStatusColor = (status: string) => {
    if (['validated', 'delivered', 'done'].includes(status)) return { color: '#6B5A62', weight: 400, strike: true };
    if (['in_progress', 'to_validate'].includes(status)) return { color: '#91014B', weight: 600, strike: false };
    return { color: '#6B5A62', weight: 400, strike: false };
  };

  const actionBarColor = (status: string) => {
    if (['validated', 'delivered', 'done'].includes(status)) return '#FB3D80';
    if (['in_progress', 'to_validate'].includes(status)) return '#FFE561';
    return '#F4EFF1';
  };

  let sectionIdx = 0;
  const delay = () => `${(sectionIdx++) * 0.03}s`;

  /* ─── RENDERABLE BLOCKS ─── */

  const pins = computePins(data);
  const wonPins = pins.filter((p) => p.won).length;

  const pinsBlock = (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 20 }}>
      <p style={{ fontSize: 12, color: '#6B5A62', marginBottom: 8 }}>
        Ta collection de pin's · {wonPins} sur {pins.length}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {pins.map((pin) => (
          <div key={pin.label} style={{ width: 72, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, margin: '0 auto',
              borderRadius: '16px 9px 14px 9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              background: pin.won ? pin.bg : '#F1EAEE',
              border: `2.5px solid ${pin.won ? '#91014b' : '#D9CCD3'}`,
              boxShadow: pin.won ? 'inset 0 -3px 0 rgba(145,1,75,0.18), 0 2px 6px rgba(145,1,75,0.12)' : 'none',
              filter: pin.won ? 'none' : 'grayscale(1)',
              opacity: pin.won ? 1 : 0.55,
            }}>
              {pin.emoji}
            </div>
            <p style={{
              fontSize: 10, fontWeight: pin.won ? 700 : 600, lineHeight: 1.25, marginTop: 5,
              color: pin.won ? '#91014b' : '#B9A8B1',
            }}>
              {pin.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  // Le mot de Laetitia : un sticker penché, UNIQUEMENT si elle a écrit un mot
  const stickerBlock = data.mission.client_note?.trim() ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 24, display: 'flex' }}>
      <div style={{
        background: '#FFE561', color: '#91014b', transform: 'rotate(-2deg)',
        borderRadius: '6px 14px 6px 12px', padding: '13px 16px', maxWidth: 480,
        boxShadow: '2px 3px 0 rgba(145,1,75,0.15)', fontSize: 13, fontWeight: 600, lineHeight: 1.45,
      }}>
        <p style={{ fontFamily: SERIF, fontWeight: 'normal', fontSize: 15, marginBottom: 2 }}>Le mot de Laetitia</p>
        {data.mission.client_note}
      </div>
    </div>
  ) : null;

  const nextSessionBlock = data.next_session?.date ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 28, background: '#fff', borderRadius: '14px 22px 12px 18px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      {/* Badge de date : fond jaune, chiffre du jour en serif bordeaux */}
      <div style={{ width: 48, minHeight: 52, borderRadius: 10, background: '#FFE561', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '4px 0' }}>
        <span style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1, color: '#91014b' }}>{format(new Date(data.next_session.date), 'd')}</span>
        <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#91014b', marginTop: 2 }}>{format(new Date(data.next_session.date), 'MMM', { locale: fr })}</span>
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#91014b' }}>
          PROCHAINE SESSION
          {(() => {
            // J-moins : l'attente fait partie du plaisir
            const days = Math.ceil((new Date(data.next_session.date).getTime() - Date.now()) / 86400000);
            return days > 0 ? ` · J-${days}` : days === 0 ? " · C'EST AUJOURD'HUI ✨" : '';
          })()}
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginTop: 4 }}>
          {/* session_date est une DATE sans heure : afficher « à 00h00 » (ou 02h00
              après fuseau) serait un mensonge d'affichage */}
          {format(new Date(data.next_session.date), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
        {data.next_session.agenda && <p style={{ fontSize: 12, color: '#6B5A62', marginTop: 2 }}>{data.next_session.agenda}</p>}
      </div>
    </div>
  ) : null;

  const progressBlock = showProgress && allActions.length > 0 ? (
    <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 24, background: '#fff', borderRadius: '18px 12px 22px 14px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        {/* Le palier nommé : la jauge raconte au lieu de compter */}
        <span style={{ fontFamily: SERIF, fontSize: 19, color: '#91014b' }}>{palierFor(progressPct)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#91014b', whiteSpace: 'nowrap' }}>{progressPct}%</span>
      </div>
      <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: '#FFD6E8', position: 'relative' }}>
        <div style={{ height: '100%', borderRadius: 4, background: '#FB3D80', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
        {/* Jalons sur la jauge : ils s'allument quand on les dépasse */}
        {[
          { at: 25, emoji: '✨' },
          { at: 50, emoji: '🔥' },
          { at: 75, emoji: '💪' },
          { at: 100, emoji: '🎉' },
        ].map((m) => (
          <span key={m.at} style={{
            position: 'absolute', top: -7, left: `${m.at}%`, transform: 'translateX(-100%)',
            width: 22, height: 22, borderRadius: '50%', fontSize: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: progressPct >= m.at ? '#FFE561' : '#fff',
            border: `2px solid ${progressPct >= m.at ? '#91014b' : '#FFA7C6'}`,
            filter: progressPct >= m.at ? 'none' : 'grayscale(1)',
            opacity: progressPct >= m.at ? 1 : 0.6,
          }}>
            {m.emoji}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#6B5A62' }}>{inProgressAll} en cours</span>
        <span style={{ fontSize: 11, color: '#6B5A62' }}>
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
      <h2 style={{ fontFamily: SERIF, color: '#91014b', fontSize: 24, fontWeight: 'normal', marginBottom: 14 }}>Ce que je fais pour toi</h2>

      {/* Stats bar */}
      <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', background: '#FFD6E8', gap: 1, marginBottom: 16 }}>
        {[
          { count: laetitiaDelivered.length, label: 'Livrées', color: '#FB3D80' },
          { count: laetitiaInProgress.length, label: 'En cours', color: '#91014b' },
          { count: laetitiaUpcoming.length, label: 'Prévues', color: '#6B5A62' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: '#fff', padding: '12px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</p>
            <p style={{ fontSize: 11, color: '#6B5A62', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Phase timeline */}
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 8, top: 9, bottom: 9, width: 2, background: '#FFD6E8' }} />

        {laetitiaByPhase.map((group, gIdx) => {
          const gStatus = phaseGroupStatus(group.actions);
          const isOther = group.key === '__other__';
          const collapsed = collapsedPhases.has(group.key);

          // Pastille config
          const pastilleColor = gStatus === 'done' ? '#FB3D80' : gStatus === 'active' ? '#FFE561' : '#FFD6E8';
          const pastilleContent = gStatus === 'done' ? '✓' : '';
          const pastilleShadow = gStatus === 'active' ? '0 0 0 4px rgba(251,61,128,0.15)' : 'none';

          // Badge config
          const badgeCfg = gStatus === 'done'
            ? { label: 'Terminé', bg: '#fff', color: '#91014b' }
            : gStatus === 'active'
            ? { label: 'En cours', bg: '#FFE561', color: '#91014b' }
            : { label: 'À venir', bg: '#F4EFF1', color: '#6B5A62' };

          // Condensation: done groups with >3 actions
          const shouldCondense = gStatus === 'done' && group.actions.length > 3;
          const visibleActions = shouldCondense && !collapsed
            ? group.actions.slice(0, 2)
            : group.actions;
          const hiddenCount = shouldCondense ? group.actions.length - 2 : 0;

          return (
            <div key={group.key} style={{ position: 'relative', marginBottom: gIdx < laetitiaByPhase.length - 1 ? 20 : 0 }}>
              {/* Pastille */}
              <div style={{
                position: 'absolute', left: -28 + (isOther ? 3 : 0), top: 0,
                width: isOther ? 12 : 18, height: isOther ? 12 : 18,
                borderRadius: isOther ? 99 : 6,
                background: isOther ? '#FFD6E8' : pastilleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isOther ? 'none' : pastilleShadow,
                marginTop: isOther ? 3 : 0,
              }}>
                {!isOther && (
                  <span style={{ color: gStatus === 'active' ? '#91014b' : '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{pastilleContent}</span>
                )}
              </div>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 600,
                  color: gStatus === 'done' ? '#6B5A62' : '#1A1A1A',
                }}>
                  {group.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, borderRadius: 99,
                  padding: '2px 8px',
                  background: badgeCfg.bg, color: badgeCfg.color,
                }}>
                  {badgeCfg.label}
                </span>
              </div>

              {/* Description */}
              {group.description && gStatus !== 'done' && (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: '#6B5A62', marginBottom: 8 }}>{group.description}</p>
              )}

              {/* Actions */}
              <div>
                {visibleActions.map(a => {
                  const isDone = DONE_STATUSES.includes(a.status);
                  const isWip = ACTIVE_STATUSES.includes(a.status);
                  const dotColor = isDone ? '#FB3D80' : isWip ? '#91014b' : '#FFD6E8';
                  const textColor = isDone ? '#6B5A62' : isWip ? '#91014b' : '#6B5A62';
                  const isCollab = isCollabKeyword(a.task);

                  return (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 12px', background: '#fff', borderRadius: 8,
                      marginBottom: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: dotColor, flexShrink: 0 }} />
                      <span style={{
                        flex: 1, fontSize: 12,
                        color: textColor,
                        fontWeight: isWip ? 600 : 400,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>
                        {a.task}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {isCollab && (
                          <span style={{ fontSize: 10, borderRadius: 99, padding: '1px 6px', background: '#FFF4F8', color: '#91014b' }}>🤝 ensemble</span>
                        )}
                        {isDone && (
                          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 99, padding: '1px 6px', background: '#FFF4F8', color: '#91014b' }}>Livré</span>
                        )}
                        {isWip && (
                          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 99, padding: '1px 6px', background: '#FFE561', color: '#91014b' }}>En cours</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Condensed expand link */}
                {shouldCondense && !collapsed && hiddenCount > 0 && (
                  <button
                    onClick={() => togglePhaseCollapse(group.key)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: '#91014b', fontWeight: 500,
                      padding: '4px 12px', marginTop: 2,
                    }}
                  >
                    + {hiddenCount} autres actions terminées
                  </button>
                )}
                {shouldCondense && collapsed && (
                  <button
                    onClick={() => togglePhaseCollapse(group.key)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: '#91014b', fontWeight: 500,
                      padding: '4px 12px', marginTop: 2,
                    }}
                  >
                    Réduire
                  </button>
                )}
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
        <p style={{ fontSize: 13, color: '#6B5A62', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500, color: '#91014b' }}>Pas encore d'actions pour toi.</span>{' '}
          Je prépare la stratégie, tes premières actions arriveront bientôt ici.
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#6B5A62', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 500, color: '#91014b' }}>Je travaille sur ta stratégie.</span>{' '}
          Tu retrouveras ici tes actions et l'avancement au fur et à mesure.
        </p>
      )}
    </div>
  ) : null;

  const clientActionsBlock = hasClientActions ? (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontFamily: SERIF, color: '#91014b', fontSize: 24, fontWeight: 'normal' }}>Ce que j'attends de toi</h2>
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
                  onClick={(e) => handleToggleAction(action.id, !isDone, e.currentTarget.getBoundingClientRect())}
                  disabled={isUpdating}
                  style={{
                    width: 20, height: 20, minWidth: 20, borderRadius: 6,
                    border: '2px solid #FB3D80',
                    background: isDone ? '#FB3D80' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0
                  }}
                  onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = '#FFF4F8'; }}
                  onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = 'transparent'; }}
                >
                  {isDone && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isUpdating && <Loader2 className="h-3 w-3 animate-spin" style={{ color: isDone ? '#fff' : '#FB3D80' }} />}
                </button>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: isDone ? '#6B5A62' : '#1A1A1A', textDecoration: isDone ? 'line-through' : 'none' }}>{action.task}</p>
                  {isExpanded && action.description && <p style={{ fontSize: 12, color: '#6B5A62', marginTop: 4, lineHeight: 1.5 }}>{action.description}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#6B5A62' }}>
                    {/* Pas de date de complétion en base : afficher new Date() mentait (toujours « aujourd'hui ») */}
                    {isDone ? '✓ Fait' : action.target_date ? format(new Date(action.target_date), 'd MMM', { locale: fr }) : ''}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingActionId(action.id); actionFileInputRef.current?.click(); }}
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FFF4F8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Paperclip style={{ width: 14, height: 14, color: '#FB3D80' }} />
                  </button>
                </div>
              </div>
              {/* Expanded: comment zone */}
              {isExpanded && (
                <div style={{ marginTop: 10, paddingLeft: 32 }}>
                  {action.client_comment && !(commentDrafts[action.id] !== undefined) && (
                    <p style={{ fontSize: 12, color: '#6B5A62', background: '#FFF4F8', borderRadius: 6, padding: '6px 10px', marginBottom: 6, lineHeight: 1.5 }}>
                      💬 {action.client_comment}
                    </p>
                  )}
                  <textarea
                    placeholder="Ajoute un commentaire…"
                    value={commentDrafts[action.id] ?? action.client_comment ?? ''}
                    onChange={e => setCommentDrafts(p => ({ ...p, [action.id]: e.target.value }))}
                    style={{
                      width: '100%', fontSize: 12, border: '1px solid #FFD6E8', borderRadius: 6,
                      padding: '6px 10px', minHeight: 50, resize: 'vertical', fontFamily: SANS,
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FB3D80'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#FFD6E8'; }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      onClick={() => handleSaveComment(action.id)}
                      disabled={savingComment === action.id}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#fff', background: '#FB3D80',
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
        accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt,.zip"
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
      <h2 style={{ fontFamily: SERIF, color: '#91014b', fontSize: 24, fontWeight: 'normal', marginBottom: 14 }}>Documents & livrables</h2>
      {data.files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, marginBottom: 12 }}>
          {data.files.map(file => {
            const cb = catBadge(file.category);
            return (
              <div key={file.id} onClick={() => { const target = file.url || file.download_url; if (target) window.open(target, '_blank'); }}
                style={{ background: '#fff', borderRadius: 10, padding: 13, boxShadow: '0 1px 2px rgba(145,1,75,0.04)', cursor: (file.url || file.download_url) ? 'pointer' : 'default', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(145,1,75,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(145,1,75,0.04)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: file.url ? '#FFF7CC' : fileIconBg(file.file_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{file.url ? '🔗' : fileIconEmoji(file.file_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</p>
                  <p style={{ fontSize: 10, color: '#6B5A62', marginTop: 2 }}>{fmtSize(file.file_size)}{file.file_size ? ' · ' : ''}{format(new Date(file.created_at), 'd MMM yyyy', { locale: fr })}</p>
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
        style={{ border: `2px dashed ${isDragging ? '#FB3D80' : '#FFA7C6'}`, borderRadius: '14px 22px 12px 18px', padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', background: isDragging ? '#FFE9F1' : '#FFF4F8' }}
      >
        <span style={{ fontSize: 18 }}>⬆️</span>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#91014b', marginTop: 8 }}>{data.files.length === 0 ? 'Tu as des fichiers à me transmettre ?' : 'Dépose tes fichiers ici'}</p>
        <p style={{ fontSize: 11, color: '#6B5A62', marginTop: 4 }}>{data.files.length === 0 ? 'Logo, photos (y compris iPhone), PDF, Word, Excel, zip : jusqu\'à 50 Mo par fichier' : 'Photos (y compris iPhone), PDF, Word, Excel, zip : jusqu\'à 50 Mo par fichier'}</p>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt,.zip" onChange={e => { const f = e.target.files?.[0]; if (f) handleGlobalFileUpload(f); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
      </div>
    </section>
  );

  const sessionsBlock = data.sessions.length > 0 ? (
    <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 28 }}>
      <h2 style={{ fontFamily: SERIF, color: '#91014b', fontSize: 24, fontWeight: 'normal', marginBottom: 14 }}>Nos sessions</h2>
      <div style={{ borderLeft: '2px solid #FFD6E8', paddingLeft: 22, marginLeft: 5 }}>
        {data.sessions.map((session, idx) => {
          const isLatest = idx === 0;
          const isExpanded = isLatest || expandedSessions.has(session.id);
          const summary = session.client_summary;
          const toggle = () => {
            if (isLatest) return;
            setExpandedSessions((prev) => {
              const next = new Set(prev);
              if (next.has(session.id)) next.delete(session.id);
              else next.add(session.id);
              return next;
            });
          };
          const typeLabel = session.session_type === 'visio' ? 'Visio' : session.session_type === 'phone' ? 'Téléphone' : session.session_type;

          return (
            <div key={session.id} style={{ position: 'relative', paddingBottom: idx < data.sessions.length - 1 ? 14 : 0 }}>
              <span style={{ position: 'absolute', left: -27, top: 6, width: 10, height: 10, borderRadius: 3, background: '#91014b', border: '2px solid #fff', boxShadow: '0 0 0 2px #FFD6E8' }} />

              {/* Header : always shown, clickable for non-latest */}
              <button
                type="button"
                onClick={toggle}
                disabled={isLatest}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
                  border: 'none', padding: '4px 0', cursor: isLatest ? 'default' : 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>
                  {format(new Date(session.session_date), 'd MMMM yyyy', { locale: fr })}
                </span>
                <span style={{ fontSize: 10, color: '#6B5A62', background: '#F4EFF1', borderRadius: 99, padding: '2px 8px' }}>{typeLabel}</span>
                {!isExpanded && summary?.headline && (
                  <span style={{ fontSize: 12, color: '#6B5A62', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    · {summary.headline}
                  </span>
                )}
                {!isLatest && (
                  isExpanded
                    ? <ChevronUp size={14} style={{ color: '#6B5A62', marginLeft: 'auto' }} />
                    : <ChevronDown size={14} style={{ color: '#6B5A62', marginLeft: 'auto' }} />
                )}
              </button>

              {isExpanded && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 13, boxShadow: '0 1px 2px rgba(145,1,75,0.03)', marginTop: 6 }}>
                  {summary ? (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.5, marginBottom: summary.bullets?.length ? 8 : 0 }}>
                        {summary.headline}
                      </p>
                      {summary.bullets?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {summary.bullets.map((b, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.6, marginBottom: 2 }}>{b}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: '#6B5A62', fontStyle: 'italic' }}>Synthèse en préparation.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  ) : null;

  const footerBlock = (
    <footer style={{ paddingTop: 48, textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#6B5A62' }}>
        Propulsé par{' '}
        <a href="https://nowadaysagency.com" target="_blank" rel="noopener noreferrer" style={{ color: '#91014b', textDecoration: 'none' }}>Nowadays Agency</a>
      </p>
    </footer>
  );

  return (
    <div className="min-h-screen" style={{ background: '#FFF4F8', fontFamily: SANS, color: '#1A1A1A' }}>

      {/* ═══ BANDEAU VICHY ═══ */}
      <div style={VICHY} />

      {/* ═══ HEADER ═══ */}
      <header>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 24, borderBottom: '2px solid #91014b' }}>
            <div>
              <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: 12, color: '#91014b', textTransform: 'uppercase', letterSpacing: 2 }}>NOWADAYS</p>
              <h1 style={{ fontFamily: SERIF, fontSize: 27, color: '#91014b', fontWeight: 'normal', marginTop: 8 }}>
                Bonjour <em>{data.mission.client_name.split(' ')[0]}</em>
              </h1>
              {missionType !== 'non_determine' && (
                <span style={{ display: 'inline-block', marginTop: 10, fontSize: 11, fontWeight: 700, color: '#fff', background: isBinome ? '#FB3D80' : '#91014b', borderRadius: 99, padding: '3px 12px' }}>{typeLabel}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: '#FB3D80' }} />
              <span style={{ fontSize: 11, color: '#6B5A62' }}>Mission en cours</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ CONTENT : Dynamic order ═══ */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 80px' }} className="sm:px-6">
        {isPhase1 && (
          <>
            {stickerBlock}
            {nextSessionBlock}
            {laetitiaBlock}
            {documentsBlock}
            {softMessageBlock}
            {footerBlock}
          </>
        )}
        {isPhase2 && (
          <>
            {stickerBlock}
            {nextSessionBlock}
            {progressBlock}
            {pinsBlock}
            {laetitiaBlock}
            {documentsBlock}
            {softMessageBlock}
            {footerBlock}
          </>
        )}
        {isPhase3 && (
          <>
            {stickerBlock}
            {nextSessionBlock}
            {progressBlock}
            {pinsBlock}
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
