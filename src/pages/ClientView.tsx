import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarIcon, Upload, Download, File, ChevronDown, Loader2, Check } from 'lucide-react';
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
  not_started: { bg: '#E0E0E0', text: '#333' },
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
        body: {
          token,
          action_id: actionId,
          status: done ? 'done' : 'not_started',
        },
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
    toast({ title: 'Fichier ajouté' });
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
    toast({ title: 'Fichier envoyé' });
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
        <div className="text-center space-y-4">
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.5rem' }}>
            Ce lien n'est pas valide
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: '#666', fontSize: '0.875rem' }}>
            Vérifie que tu as bien copié le lien envoyé par Laetitia.
          </p>
        </div>
      </div>
    );
  }

  const clientActions = data.actions.filter((a) => a.assignee === 'client');
  const laetitiaActions = data.actions.filter((a) => a.assignee === 'laetitia');
  const doneClient = clientActions.filter((a) => a.status === 'done').length;

  return (
    <div className="min-h-screen" style={{ background: '#FFF4F8', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <header className="px-4 py-6 md:px-8 max-w-3xl mx-auto">
        <p style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.25rem' }}>
          Nowadays
        </p>
        <h1
          className="mt-2"
          style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1.5rem', fontWeight: 'normal' }}
        >
          {data.mission.client_name}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          {data.mission.mission_type === 'binome' ? 'Accompagnement Binôme' : data.mission.mission_type === 'agency' ? 'Mission Agency' : 'Accompagnement'}
        </p>
      </header>

      <main className="px-4 md:px-8 max-w-3xl mx-auto pb-16 space-y-6">
        {/* Next session */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#FFF4F8', border: '2px solid #FB3D80' }}
        >
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1rem', marginBottom: '0.5rem' }}>
            Prochaine session
          </h2>
          {data.next_session ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" style={{ color: '#FB3D80' }} />
                <span className="text-sm font-medium" style={{ color: '#333' }}>
                  {format(new Date(data.next_session.date), 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
              </div>
              {data.next_session.agenda && (
                <p className="text-sm" style={{ color: '#555' }}>{data.next_session.agenda}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#999' }}>Pas de session planifiée pour le moment</p>
          )}
        </div>

        {/* Client actions */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1rem' }}>
              Tes actions
            </h2>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: '#FB3D80', color: '#fff' }}
            >
              {doneClient}/{clientActions.length} terminée{doneClient !== 1 ? 's' : ''}
            </span>
          </div>
          {clientActions.length === 0 ? (
            <Card><p className="text-sm" style={{ color: '#999' }}>Aucune action pour le moment.</p></Card>
          ) : (
            <div className="space-y-2">
              {clientActions.map((action) => (
                <ClientActionCard
                  key={action.id}
                  action={action}
                  isUpdating={updatingAction === action.id}
                  onToggle={(done) => handleToggleAction(action.id, done)}
                  onFileUpload={(file) => handleActionFileUpload(action.id, file)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Laetitia actions */}
        <section>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1rem', marginBottom: '0.75rem' }}>
            Ce que je fais de mon côté
          </h2>
          {laetitiaActions.length === 0 ? (
            <Card><p className="text-sm" style={{ color: '#999' }}>Aucune action pour le moment.</p></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      {['Catégorie', 'Tâche', 'Description', 'Canal', 'Date', 'Statut'].map((h) => (
                        <th key={h} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#999' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {laetitiaActions.map((a) => {
                      const sc = STATUS_COLORS[a.status] ?? STATUS_COLORS.not_started;
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td className="px-3 py-2 text-xs" style={{ color: '#555' }}>{a.category ?? '—'}</td>
                          <td className="px-3 py-2 text-xs font-medium" style={{ color: '#333' }}>{a.task}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#555' }}>{a.description ?? '—'}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#555' }}>{a.channel ?? '—'}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#555' }}>
                            {a.target_date ? format(new Date(a.target_date), 'dd/MM', { locale: fr }) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: sc.bg, color: sc.text }}
                            >
                              {STATUS_LABELS[a.status] ?? a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* Sessions */}
        {data.sessions.length > 0 && (
          <section>
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1rem', marginBottom: '0.75rem' }}>
              Nos sessions
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {data.sessions.map((session) => (
                <AccordionItem key={session.id} value={session.id} className="border-0">
                  <Card className="overflow-hidden">
                    <AccordionTrigger className="px-5 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: '#333' }}>
                          {format(new Date(session.session_date), 'dd MMMM yyyy', { locale: fr })}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: '#f0f0f0', color: '#666' }}
                        >
                          {session.session_type === 'visio' ? 'Visio' : session.session_type === 'telephone' ? 'Téléphone' : 'Autre'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4">
                      {session.structured_notes?.sections ? (
                        <div className="space-y-3">
                          {session.structured_notes.sections.map((s, i) => (
                            <div key={i}>
                              <h5 className="text-xs font-semibold mb-1" style={{ color: '#91014b' }}>{s.title}</h5>
                              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#555' }}>{s.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#999' }}>Notes en cours de structuration.</p>
                      )}
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Documents */}
        <section>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", color: '#91014b', fontSize: '1rem', marginBottom: '0.75rem' }}>
            Documents
          </h2>

          {data.files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {data.files.map((file) => (
                <Card key={file.id} className="flex items-center gap-3 p-4">
                  <File className="h-5 w-5 shrink-0" style={{ color: '#91014b' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#333' }}>{file.file_name}</p>
                    <p className="text-[10px]" style={{ color: '#999' }}>
                      {formatFileSize(file.file_size)} · {format(new Date(file.created_at), 'dd/MM/yy')}
                    </p>
                  </div>
                  {file.download_url && (
                    <a href={file.download_url} download={file.file_name} className="shrink-0">
                      <Download className="h-4 w-4" style={{ color: '#91014b' }} />
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className="rounded-xl p-8 text-center transition-colors cursor-pointer"
            style={{
              border: `2px dashed ${isDragging ? '#FB3D80' : '#ddd'}`,
              background: isDragging ? '#FFF0F5' : '#fff',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto mb-2" style={{ color: '#999' }} />
            <p className="text-sm" style={{ color: '#666' }}>
              Glisse un fichier ici ou clique pour envoyer
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleGlobalFileUpload(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: '#999' }}>
          Powered by{' '}
          <a href="https://nowadaysagency.com" target="_blank" rel="noopener noreferrer" style={{ color: '#91014b' }}>
            Nowadays Agency
          </a>
          {' '}— nowadaysagency.com
        </p>
      </footer>
    </div>
  );
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {!className.includes('p-') && !className.includes('overflow') ? (
        <div className="p-5">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

function ClientActionCard({
  action,
  isUpdating,
  onToggle,
  onFileUpload,
}: {
  action: ClientAction;
  isUpdating: boolean;
  onToggle: (done: boolean) => void;
  onFileUpload: (file: globalThis.File) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDone = action.status === 'done';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#FB3D80' }} />
          ) : (
            <Checkbox
              checked={isDone}
              onCheckedChange={(checked) => onToggle(!!checked)}
              className="data-[state=checked]:bg-[#4CAF50] data-[state=checked]:border-[#4CAF50]"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? '#999' : '#333' }}
            >
              {action.task}
            </span>
            {action.target_date && (
              <span className="text-[10px]" style={{ color: '#999' }}>
                {format(new Date(action.target_date), 'dd/MM', { locale: fr })}
              </span>
            )}
          </div>
          {action.description && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] mt-0.5 flex items-center gap-1"
              style={{ color: '#91014b' }}
            >
              {expanded ? 'Masquer' : 'Détails'}
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {expanded && action.description && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#555' }}>{action.description}</p>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-gray-100"
          title="Joindre un fichier"
        >
          <Upload className="h-3.5 w-3.5" style={{ color: '#999' }} />
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
    </Card>
  );
}

export default ClientView;
