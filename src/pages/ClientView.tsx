import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, Upload, Download, Paperclip, ChevronDown, Loader2, FileText, FileImage, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  not_started: { bg: '#E8E8E8', text: '#666' },
  in_progress: { bg: '#4A90D9', text: '#fff' },
  to_validate: { bg: '#FFE561', text: '#333' },
  validated: { bg: '#4CAF50', text: '#fff' },
  delivered: { bg: '#2E7D32', text: '#fff' },
  done: { bg: '#4CAF50', text: '#fff' },
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Pas commencée',
  in_progress: 'En cours',
  to_validate: 'À valider',
  validated: 'Validée',
  delivered: 'Livrée',
  done: 'Fait',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return <FileText className="h-5 w-5" style={{ color: '#E53935' }} />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-5 w-5" style={{ color: '#1976D2' }} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <FileImage className="h-5 w-5" style={{ color: '#43A047' }} />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet className="h-5 w-5" style={{ color: '#2E7D32' }} />;
  return <FileIcon className="h-5 w-5" style={{ color: '#757575' }} />;
}

function getCategoryLabel(cat: string | null): string | null {
  if (!cat) return null;
  if (cat === 'client_upload') return null;
  if (cat.startsWith('action_')) return null;
  const map: Record<string, string> = { brief: 'Brief', livrable: 'Livrable', visuel: 'Visuel' };
  return map[cat] || cat;
}

const ClientView = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Ce lien n'est pas valide");
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: result, error } = await supabase.functions.invoke('get-client-space', {
        body: { token },
      });
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleAction = async (actionId: string, done: boolean) => {
    setUpdatingAction(actionId);
    try {
      await supabase.functions.invoke('update-client-action', {
        body: { token, action_id: actionId, status: done ? 'done' : 'not_started' },
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === actionId ? { ...a, status: done ? 'done' : 'not_started' } : a
          ),
        };
      });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleActionFileUpload = async (actionId: string, file: globalThis.File) => {
    const path = `${data?.mission.client_name?.replace(/\s+/g, '_') ?? 'client'}/actions/${actionId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file);
    if (uploadError) {
      toast({ title: 'Erreur upload', variant: 'destructive' });
      return;
    }
    await supabase.functions.invoke('update-client-action', {
      body: { token, action_id: actionId, file_name: file.name, file_size: file.size, storage_path: path },
    });
    toast({ title: 'Fichier ajouté ✓' });
    fetchData();
  };

  const handleGlobalFileUpload = async (file: globalThis.File) => {
    const path = `${data?.mission.client_name?.replace(/\s+/g, '_') ?? 'client'}/uploads/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('mission-files').upload(path, file);
    if (uploadError) {
      toast({ title: 'Erreur upload', variant: 'destructive' });
      return;
    }
    await supabase.functions.invoke('upload-client-file', {
      body: { token, file_name: file.name, file_size: file.size, storage_path: path },
    });
    toast({ title: 'Fichier envoyé ✓' });
    fetchData();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleGlobalFileUpload(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#91014b' }} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF4F8' }}>
        <div className="text-center space-y-4 px-6">
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '20px' }}>
            Nowadays
          </p>
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#1A1A2E', fontSize: '1.5rem' }}>
            {errorMessage}
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#888', fontSize: '0.875rem' }}>
            Vérifie que tu as bien copié le lien envoyé par Laetitia.
          </p>
        </div>
      </div>
    );
  }

  const clientActions = data.actions.filter((a) => a.assignee === 'client');
  const laetitiaActions = data.actions.filter((a) => a.assignee === 'laetitia');
  const doneClient = clientActions.filter((a) => a.status === 'done').length;
  const missionBadge = data.mission.mission_type === 'binome'
    ? { label: 'Binôme', bg: '#FB3D80' }
    : data.mission.mission_type === 'agency'
    ? { label: 'Agency', bg: '#91014b' }
    : { label: 'Accompagnement', bg: '#91014b' };

  return (
    <div className="min-h-screen" style={{ background: '#FFF4F8', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* HEADER */}
      <header style={{ background: '#fff' }}>
        <div className="max-w-[800px] mx-auto px-6 md:px-12 py-8">
          <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '20px', fontWeight: 'normal' }}>
            Nowadays
          </p>
          <h1 className="mt-3" style={{ fontFamily: "'Libre Baskerville', serif", color: '#1A1A2E', fontSize: '28px', fontWeight: 'normal' }}>
            {data.mission.client_name}
          </h1>
          <div className="mt-3">
            <span
              className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ background: missionBadge.bg, color: '#fff' }}
            >
              {missionBadge.label}
            </span>
          </div>
        </div>
        <div style={{ height: '2px', background: '#FB3D80' }} />
      </header>

      {/* MAIN */}
      <main className="max-w-[800px] mx-auto px-6 md:px-12 py-8 space-y-8">

        {/* NEXT SESSION */}
        {data.next_session && (
          <div
            className="client-card animate-fade-in"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}
          >
            <div
              className="shrink-0 flex items-center justify-center"
              style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#FFF0F5' }}
            >
              <CalendarIcon className="h-5 w-5" style={{ color: '#FB3D80' }} />
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: '#1A1A2E' }}>
                {format(new Date(data.next_session.date), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              {data.next_session.agenda && (
                <p className="mt-1 text-sm" style={{ color: '#666' }}>{data.next_session.agenda}</p>
              )}
            </div>
          </div>
        )}

        {/* CLIENT ACTIONS */}
        {clientActions.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3 mb-4">
              <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.125rem' }}>
                Tes actions
              </h2>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: '#FB3D80', color: '#fff' }}
              >
                {doneClient}/{clientActions.length}
              </span>
            </div>
            <div className="space-y-3">
              {clientActions.map((action, i) => (
                <ClientActionCard
                  key={action.id}
                  action={action}
                  isUpdating={updatingAction === action.id}
                  onToggle={(done) => handleToggleAction(action.id, done)}
                  onFileUpload={(file) => handleActionFileUpload(action.id, file)}
                  style={{ animationDelay: `${0.05 * i}s` }}
                />
              ))}
            </div>
          </section>
        )}

        {/* LAETITIA ACTIONS */}
        {laetitiaActions.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="mb-4" style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.125rem' }}>
              Ce que Laetitia fait
            </h2>
            <div className="space-y-2">
              {laetitiaActions.map((a) => {
                const sc = STATUS_COLORS[a.status] ?? STATUS_COLORS.not_started;
                return (
                  <div key={a.id} className="client-card" style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-3">
                      {a.category && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                          style={{ background: '#FFD6E8', color: '#91014b' }}
                        >
                          {a.category}
                        </span>
                      )}
                      <span className="flex-1 text-sm font-medium" style={{ color: '#1A1A2E' }}>
                        {a.task}
                      </span>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* DOCUMENTS */}
        <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h2 className="mb-4" style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.125rem' }}>
            Documents & livrables
          </h2>

          {data.files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {data.files.map((file) => {
                const catLabel = getCategoryLabel(file.category);
                return (
                  <div key={file.id} className="client-card group" style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.file_name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A2E' }}>{file.file_name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#999' }}>
                          {formatFileSize(file.file_size)}
                          {file.file_size ? ' · ' : ''}
                          {format(new Date(file.created_at), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      {catLabel && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                          style={{ background: '#FFD6E8', color: '#91014b' }}
                        >
                          {catLabel}
                        </span>
                      )}
                      {file.download_url && (
                        <a
                          href={file.download_url}
                          download={file.file_name}
                          className="shrink-0 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          style={{ color: '#91014b' }}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className="rounded-2xl p-8 text-center transition-all cursor-pointer"
            style={{
              border: `2px dashed ${isDragging ? '#FB3D80' : '#FFAED0'}`,
              background: isDragging ? '#FFF0F5' : 'transparent',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto mb-2" style={{ color: '#FB3D80' }} />
            <p className="text-sm font-medium" style={{ color: '#91014b' }}>
              Dépose tes fichiers ici ou clique pour uploader
            </p>
            <p className="text-xs mt-1" style={{ color: '#999' }}>
              Images, PDF, Word, Excel — max 50 Mo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleGlobalFileUpload(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </div>
        </section>

        {/* SESSIONS */}
        {data.sessions.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h2 className="mb-4" style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.125rem' }}>
              Nos sessions
            </h2>
            <div className="relative pl-6">
              {/* Timeline line */}
              <div
                className="absolute left-[7px] top-2 bottom-2"
                style={{ width: '2px', background: '#FB3D80', opacity: 0.3 }}
              />
              <div className="space-y-4">
                {data.sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ paddingTop: '48px', paddingBottom: '32px', textAlign: 'center' }}>
        <p className="text-xs" style={{ color: '#999' }}>
          Propulsé par{' '}
          <a
            href="https://nowadaysagency.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: '#91014b' }}
          >
            Nowadays Agency
          </a>
        </p>
      </footer>
    </div>
  );
};

/* ─── SUB-COMPONENTS ─── */

function ClientActionCard({
  action,
  isUpdating,
  onToggle,
  onFileUpload,
  style,
}: {
  action: ClientAction;
  isUpdating: boolean;
  onToggle: (done: boolean) => void;
  onFileUpload: (file: globalThis.File) => void;
  style?: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDone = action.status === 'done';

  return (
    <div
      className={`client-card group animate-fade-in ${isDone ? 'opacity-60' : ''}`}
      style={{ padding: '16px', transition: 'opacity 0.3s', ...style }}
    >
      <div className="flex items-start gap-3">
        {/* Custom checkbox */}
        <button
          onClick={() => !isUpdating && onToggle(!isDone)}
          className="shrink-0 mt-0.5 flex items-center justify-center transition-all"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: isDone ? 'none' : '2px solid #ccc',
            background: isDone ? '#FB3D80' : 'transparent',
            minWidth: '44px',
            minHeight: '44px',
            padding: '11px',
          }}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#FB3D80' }} />
          ) : isDone ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[15px] font-semibold ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? '#999' : '#1A1A2E', fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
              {action.task}
            </span>
            {action.target_date && (
              <span className="text-xs shrink-0" style={{ color: '#999' }}>
                {format(new Date(action.target_date), 'd MMM', { locale: fr })}
              </span>
            )}
          </div>
          {action.description && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs mt-1 flex items-center gap-1 transition-colors"
                style={{ color: '#91014b' }}
              >
                {expanded ? 'Masquer' : 'Voir détails'}
                <ChevronDown
                  className="h-3 w-3 transition-transform"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {expanded && (
                <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#666' }}>
                  {action.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          className="shrink-0 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          style={{ color: '#999' }}
          title="Joindre un fichier"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ClientSession }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Dot on timeline */}
      <div
        className="absolute -left-6 top-4"
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: '#FB3D80',
          border: '3px solid #FFF4F8',
          marginLeft: '-6px',
        }}
      />
      <div className="client-card" style={{ padding: '16px' }}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>
              {format(new Date(session.session_date), 'd MMMM yyyy', { locale: fr })}
            </span>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: '#F0F0F0', color: '#666' }}
            >
              {session.session_type === 'visio' ? 'Visio' : session.session_type === 'telephone' ? 'Téléphone' : 'Autre'}
            </span>
          </div>
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{ color: '#999', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {open && session.structured_notes?.sections && (
          <div className="mt-4 pt-4 space-y-4" style={{ borderTop: '1px solid #f0f0f0' }}>
            {session.structured_notes.sections.map((s, i) => (
              <div key={i}>
                <h5 className="text-xs font-semibold mb-1.5" style={{ color: '#91014b' }}>{s.title}</h5>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#666' }}>{s.content}</p>
              </div>
            ))}
          </div>
        )}
        {open && !session.structured_notes?.sections && (
          <p className="mt-4 text-xs italic" style={{ color: '#999' }}>Notes en cours de structuration.</p>
        )}
      </div>
    </div>
  );
}

export default ClientView;
