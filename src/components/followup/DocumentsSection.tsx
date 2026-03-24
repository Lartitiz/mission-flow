import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, Trash2, FileText, FileImage, FileSpreadsheet, File as FileIcon, Loader2, X, Link2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface FileRow {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  category: string | null;
  created_at: string;
  uploaded_by: string;
  url: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
  if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-5 w-5 text-blue-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <FileImage className="h-5 w-5 text-green-500" />;
  return <FileIcon className="h-5 w-5 text-gray-400" />;
}

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  brief: { label: 'Brief', className: 'bg-gray-100 text-gray-600' },
  livrable: { label: 'Livrable', className: 'bg-green-50 text-green-700' },
  visuel: { label: 'Visuel', className: 'bg-pink-50 text-pink-700' },
  proposition: { label: 'Proposition', className: 'bg-purple-50 text-purple-700' },
  autre: { label: 'Autre', className: 'bg-gray-100 text-gray-600' },
};

export function DocumentsSection({ missionId }: { missionId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<globalThis.File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('autre');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState('autre');
  const [savingLink, setSavingLink] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['mission-files', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('id, file_name, file_size, storage_path, category, created_at, uploaded_by, url')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: false });
      return (data ?? []) as FileRow[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mission-files', missionId] });

  const openFilePicker = (file: globalThis.File) => {
    setPendingFile(file);
    setUploadName(file.name);
    setUploadCategory('autre');
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${missionId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('mission-files').upload(storagePath, pendingFile);
    if (uploadError) {
      toast({ title: 'Erreur upload', variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { error: dbError } = await supabase.from('files').insert({
      mission_id: missionId,
      file_name: uploadName || pendingFile.name,
      storage_path: storagePath,
      uploaded_by: 'laetitia',
      category: uploadCategory,
      file_size: pendingFile.size,
    });
    if (dbError) {
      toast({ title: 'Erreur enregistrement', variant: 'destructive' });
    } else {
      toast({ title: 'Document ajouté ✓' });
      refresh();
    }
    setPendingFile(null);
    setUploading(false);
  };

  const handleDownload = async (file: FileRow) => {
    if (file.url) {
      window.open(file.url, '_blank');
      return;
    }
    const { data } = await supabase.storage.from('mission-files').createSignedUrl(file.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast({ title: 'Erreur téléchargement', variant: 'destructive' });
  };

  const handleDelete = async (file: FileRow) => {
    await supabase.storage.from('mission-files').remove([file.storage_path]);
    await supabase.from('files').delete().eq('id', file.id);
    toast({ title: 'Document supprimé' });
    refresh();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) openFilePicker(file);
  };

  const catBadge = (cat: string | null) => {
    if (!cat) return null;
    const badge = CATEGORY_BADGES[cat];
    if (!badge) return null;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg" style={{ color: '#91014b' }}>
          Documents & livrables
        </h3>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          style={{ background: '#FB3D80', color: '#fff' }}
          className="hover:opacity-90"
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Ajouter un document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.ppt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openFilePicker(f);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="rounded-xl p-6 text-center transition-all mb-4 cursor-pointer"
        style={{
          border: `2px dashed ${isDragging ? '#FB3D80' : '#e0c0d0'}`,
          background: isDragging ? '#FFF0F5' : 'transparent',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-5 w-5 mx-auto mb-1.5" style={{ color: '#FB3D80' }} />
        <p className="text-sm" style={{ color: '#91014b' }}>
          Glisse un fichier ici ou clique pour uploader
        </p>
      </div>

      {/* Files grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun document pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="group bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3"
            >
              {getFileIcon(file.file_name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A2E' }}>
                  {file.file_name.length > 40 ? file.file_name.slice(0, 37) + '...' : file.file_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    {formatFileSize(file.file_size)}
                    {file.file_size ? ' · ' : ''}
                    {format(new Date(file.created_at), 'd MMM yyyy', { locale: fr })}
                  </span>
                  {catBadge(file.category)}
                  {file.uploaded_by === 'client' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                      Client
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(file)}
                  className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                  title="Télécharger"
                >
                  <Download className="h-4 w-4" style={{ color: '#91014b' }} />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        « {file.file_name} » sera supprimé définitivement.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(file)} className="bg-red-500 hover:bg-red-600">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Dialog open={!!pendingFile} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom du fichier</label>
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Catégorie</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="livrable">Livrable</SelectItem>
                  <SelectItem value="visuel">Visuel</SelectItem>
                  <SelectItem value="proposition">Proposition</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
              style={{ background: '#FB3D80', color: '#fff' }}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Uploader
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
