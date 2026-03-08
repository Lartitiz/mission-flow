import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronDown, Upload, Paperclip, Download } from 'lucide-react';
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
  to_validate: { label: 'À valider', dot: '#FFE561', bg: '#FFFBEB', text: '#D97706' },
  validated: { label: 'Livrée', dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
  delivered: { label: 'Livrée', dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
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

function catBadge(cat: string | null) {
  if (!cat || cat === 'client_upload' || cat.startsWith('action_')) return null;
  const map: Record<string, { label: string; bg: string; text: string }> = {
    proposition: { label: 'Proposition', bg: 'rgba(145,1,75,0.08)', text: '#91014b' },
    livrable: { label: 'Livrable', bg: '#ECFDF5', text: '#059669' },
    visuel: { label: 'Visuel', bg: '#EFF6FF', text: '#4A90D9' },
    brief: { label: 'Brief', bg: '#F3F4F6', text: '#6B7280' },
  };
  const m = map[cat.toLowerCase()];
  if (m) return m;
  return { label: cat, bg: '#F3F4F6', text: '#6B7280' };
}

/* ─── ANIMATIONS (CSS-in-JS keyframes injected once) ─── */
const ANIM_ID = '__client-view-anim';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes cv-fade-up { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
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
  const [isDragging, setIsDragging] = useState(false);
  const [laetitiaOpen, setLaetitiaOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: result, error } = await supabase.functions.invoke('get-client-space', { body: { token } });
      if (error || result?.error) { setErrorMessage(result?.error || "Ce lien n'est pas valide"); setNotFound(true); return; }
      setData(result as ClientData);
    } catch { setNotFound(true); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleAction = async (actionId: string, done: boolean) => {
    setUpdatingAction(actionId);
    try {
      await supabase.functions.invoke('update-client-action', { body: { token, action_id: actionId, status: done ? 'done' : 'not_started' } });
      setData(p => p ? { ...p, actions: p.actions.map(a => a.id === actionId ? { ...a, status: done ? 'done' : 'not_started' } : a) } : p);
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); } finally { setUpdatingAction(null); }
  };

  const handleActionFileUpload = async (actionId: string, file: globalThis.File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${data?.mission.client_name?.replace(/\s+/g, '_') ?? 'client'}/actions/${actionId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file);
    if (uploadError) { toast({ title: 'Erreur upload', variant: 'destructive' }); return; }
    await supabase.functions.invoke('update-client-action', { body: { token, action_id: actionId, file_name: file.name, file_size: file.size, storage_path: path } });
    toast({ title: 'Fichier ajouté ✓' }); fetchData();
  };

  const handleGlobalFileUpload = async (file: globalThis.File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${data?.mission.client_name?.replace(/\s+/g, '_') ?? 'client'}/uploads/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file);
    if (uploadError) { toast({ title: 'Erreur upload', variant: 'destructive' }); return; }
    await supabase.functions.invoke('upload-client-file', { body: { token, file_name: file.name, file_size: file.size, storage_path: path } });
    toast({ title: 'Fichier envoyé ✓' }); fetchData();
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleGlobalFileUpload(f); };

  /* ─── LOADING ─── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#91014b' }} />
    </div>
  );

  /* ─── NOT FOUND ─── */
  if (notFound || !data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
      <div className="text-center space-y-4 px-6">
        <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '15px' }}>Nowadays</p>
        <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#1A1A2E', fontSize: '1.5rem' }}>{errorMessage}</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#9CA3AF', fontSize: '0.875rem' }}>Vérifie que tu as bien copié le lien envoyé par Laetitia.</p>
      </div>
    </div>
  );

  const clientActions = data.actions.filter(a => a.assignee === 'client');
  const laetitiaActions = data.actions.filter(a => a.assignee === 'laetitia');
  const doneClient = clientActions.filter(a => a.status === 'done').length;
  const totalClient = clientActions.length;

  // Progress
  const allActions = data.actions;
  const doneAll = allActions.filter(a => ['done', 'delivered', 'validated'].includes(a.status)).length;
  const inProgressAll = allActions.filter(a => a.status === 'in_progress').length;
  const progressPct = allActions.length > 0 ? Math.round((doneAll / allActions.length) * 100) : 0;

  // Laetitia summary counts
  const laetitiaWip = laetitiaActions.filter(a => a.status === 'in_progress').length;
  const laetitiaDone = laetitiaActions.filter(a => ['done', 'delivered', 'validated'].includes(a.status)).length;

  let sectionIdx = 0;
  const delay = () => `${(sectionIdx++) * 0.03}s`;

  return (
    <div className="min-h-screen" style={{ background: '#FFF4F8', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <header style={{ background: '#fff', borderBottom: '3px solid #91014b' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 15, fontWeight: 'normal' }}>Nowadays</p>
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#1A1A2E', fontSize: 28, fontWeight: 'normal', marginTop: 12 }}>{data.mission.client_name}</h1>
          <p style={{ color: '#6B7280', fontSize: 15, marginTop: 8, lineHeight: 1.6 }}>
            Bienvenue dans ton espace projet. Tu retrouves ici tes actions, l'avancement de la mission, et tous les documents partagés.
          </p>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ─── NEXT SESSION ─── */}
        {data.next_session && (
          <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 32, background: '#fff', borderRadius: 14, borderLeft: '4px solid #FFE561', padding: '18px 22px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>📅</div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#91014b' }}>Prochaine session</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginTop: 4 }}>
                {format(new Date(data.next_session.date), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              {data.next_session.agenda && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{data.next_session.agenda}</p>}
            </div>
          </div>
        )}

        {/* ─── PROGRESS BAR ─── */}
        <div className="cv-anim" style={{ animationDelay: delay(), marginTop: 32, background: '#fff', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E' }}>Avancement de la mission</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#91014b' }}>{progressPct}%</span>
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#FFD6E8' }}>
            <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #91014b, #FB3D80)', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{inProgressAll} action{inProgressAll > 1 ? 's' : ''} en cours</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{doneClient}/{totalClient} de tes actions terminées</span>
          </div>
        </div>

        {/* ─── CLIENT ACTIONS ─── */}
        {clientActions.length > 0 && (
          <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 17, fontWeight: 'normal' }}>Ce que j'attends de toi</h2>
              <span style={{ background: '#91014b', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 10px', lineHeight: '18px' }}>{doneClient}/{totalClient}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clientActions.map(action => (
                <ActionCard key={action.id} action={action} isUpdating={updatingAction === action.id} onToggle={d => handleToggleAction(action.id, d)} onFileUpload={f => handleActionFileUpload(action.id, f)} />
              ))}
            </div>
          </section>
        )}

        {/* ─── DOCUMENTS ─── */}
        <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 32 }}>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 17, fontWeight: 'normal', marginBottom: 14 }}>Documents & livrables</h2>
          {data.files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, marginBottom: 12 }}>
              {data.files.map(file => {
                const cb = catBadge(file.category);
                return (
                  <div
                    key={file.id}
                    onClick={() => file.download_url && window.open(file.download_url, '_blank')}
                    style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 1px 2px rgba(145,1,75,0.04)', cursor: file.download_url ? 'pointer' : 'default', transition: 'transform 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: fileIconBg(file.file_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{fileIconEmoji(file.file_name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                        {fmtSize(file.file_size)}{file.file_size ? ' · ' : ''}{format(new Date(file.created_at), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    {cb && <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, background: cb.bg, color: cb.text, borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>{cb.label}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {/* Upload zone */}
          <div
            ref={el => { if (el) { el.ondragover = e => { e.preventDefault(); setIsDragging(true); }; el.ondragleave = () => setIsDragging(false); el.ondrop = e => handleDrop(e as any); } }}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? '#FFA7C6' : '#FFD6E8'}`, borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
          >
            <Upload style={{ color: '#91014b', width: 20, height: 20, margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: '#91014b' }}>Dépose tes fichiers ici</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Images, PDF, Word, Excel — max 50 Mo</p>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx" onChange={e => { const f = e.target.files?.[0]; if (f) handleGlobalFileUpload(f); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
          </div>
        </section>

        {/* ─── SEPARATOR ─── */}
        <div style={{ height: 1, background: '#FFD6E8', opacity: 0.5, margin: '8px 0 28px' }} />

        {/* ─── LAETITIA ACTIONS (accordion) ─── */}
        {laetitiaActions.length > 0 && (
          <section className="cv-anim" style={{ animationDelay: delay() }}>
            <div
              onClick={() => setLaetitiaOpen(!laetitiaOpen)}
              style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(145,1,75,0.05)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 15, fontWeight: 'normal' }}>Ce que je fais de mon côté</h2>
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    <span style={{ color: '#4A90D9', fontWeight: 600 }}>{laetitiaWip}</span> en cours · <span style={{ color: '#10B981', fontWeight: 600 }}>{laetitiaDone}</span> terminée{laetitiaDone > 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronDown style={{ width: 18, height: 18, color: '#9CA3AF', transition: 'transform 0.2s', transform: laetitiaOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
              </div>

              {laetitiaOpen && (
                <div style={{ marginTop: 14 }}>
                  {laetitiaActions.map((a, i) => {
                    const s = STATUS_MAP[a.status] ?? STATUS_MAP.not_started;
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < laetitiaActions.length - 1 ? '1px solid #FAF0F4' : 'none', gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: s.dot, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: '#1A1A2E' }}>{a.task}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, background: s.bg, color: s.text, borderRadius: 99, padding: '2px 10px', flexShrink: 0 }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── SESSIONS ─── */}
        {data.sessions.length > 0 && (
          <section className="cv-anim" style={{ animationDelay: delay(), marginTop: 32 }}>
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: 17, fontWeight: 'normal', marginBottom: 14 }}>Nos sessions</h2>
            <div style={{ position: 'relative', paddingLeft: 22 }}>
              {/* timeline line */}
              <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 2, background: '#FFD6E8' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.sessions.map(session => <SessionCard key={session.id} session={session} />)}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ paddingTop: 48, paddingBottom: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
          Propulsé par{' '}
          <a href="https://nowadaysagency.com" target="_blank" rel="noopener noreferrer" style={{ color: '#91014b' }}>Nowadays Agency</a>
        </p>
      </footer>
    </div>
  );
};

/* ─── ACTION CARD ─── */
function ActionCard({ action, isUpdating, onToggle, onFileUpload }: {
  action: ClientAction; isUpdating: boolean; onToggle: (done: boolean) => void; onFileUpload: (file: globalThis.File) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDone = action.status === 'done';

  return (
    <div
      style={{
        background: '#fff', borderRadius: 10, padding: '12px 16px',
        boxShadow: '0 1px 2px rgba(145,1,75,0.04)',
        opacity: isDone ? 0.45 : 1, transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Checkbox */}
        <button
          onClick={() => !isUpdating && onToggle(!isDone)}
          disabled={isUpdating}
          style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
            border: isDone ? 'none' : '2px solid #D1D5DB',
            background: isDone ? '#91014b' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            padding: 0, minWidth: 44, minHeight: 44,
            marginLeft: -12, marginTop: -12, marginBottom: -12,
          }}
        >
          {isUpdating ? <Loader2 style={{ width: 12, height: 12, color: '#91014b' }} className="animate-spin" /> :
            isDone ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, cursor: action.description ? 'pointer' : 'default' }} onClick={() => action.description && setExpanded(!expanded)}>
          <span style={{ fontSize: 13, fontWeight: 500, color: isDone ? '#9CA3AF' : '#1A1A2E', textDecoration: isDone ? 'line-through' : 'none' }}>{action.task}</span>
          {expanded && action.description && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, lineHeight: 1.5 }}>{action.description}</p>}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {action.target_date && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{format(new Date(action.target_date), 'd MMM', { locale: fr })}</span>}
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FFF4F8')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Paperclip style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFileUpload(f); if (fileRef.current) fileRef.current.value = ''; }} />
      </div>
    </div>
  );
}

/* ─── SESSION CARD ─── */
function SessionCard({ session }: { session: ClientSession }) {
  const [open, setOpen] = useState(false);
  const typeLabel = session.session_type === 'visio' ? 'Visio' : session.session_type === 'telephone' ? 'Téléphone' : 'Autre';

  return (
    <div style={{ position: 'relative' }}>
      {/* dot */}
      <div style={{ position: 'absolute', left: -22, top: 16, width: 10, height: 10, borderRadius: 3, background: '#91014b', marginLeft: -1 }} />
      <div
        onClick={() => setOpen(!open)}
        style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 1px 2px rgba(145,1,75,0.04)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>{format(new Date(session.session_date), 'd MMMM yyyy', { locale: fr })}</span>
            <span style={{ fontSize: 10, background: '#F3F4F6', color: '#6B7280', borderRadius: 99, padding: '1px 8px' }}>{typeLabel}</span>
          </div>
          <ChevronDown style={{ width: 14, height: 14, color: '#9CA3AF', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
        </div>

        {open && session.structured_notes?.sections && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #FAF0F4' }}>
            {session.structured_notes.sections.map((s, i) => (
              <div key={i} style={{ marginBottom: i < session.structured_notes!.sections!.length - 1 ? 12 : 0 }}>
                <h5 style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{s.title}</h5>
                <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.content}</p>
              </div>
            ))}
          </div>
        )}
        {open && !session.structured_notes?.sections && (
          <p style={{ marginTop: 12, fontSize: 12, fontStyle: 'italic', color: '#9CA3AF' }}>Notes en cours de structuration.</p>
        )}
      </div>
    </div>
  );
}

export default ClientView;
