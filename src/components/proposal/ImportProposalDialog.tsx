import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
  missionType: string;
  proposalId?: string;
  currentVersion?: number;
  onImportDone: () => void;
}

export function ImportProposalDialog({
  open,
  onOpenChange,
  missionId,
  missionType,
  proposalId,
  onImportDone,
}: ImportProposalDialogProps) {
  const [tab, setTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [fileText, setFileText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [structuring, setStructuring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sanitizeFileName = (name: string) =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext || '')) {
      toast.error('Seuls les fichiers .docx et .pdf sont acceptés.');
      return;
    }

    setUploading(true);
    try {
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${missionId}/proposition_importee_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('mission-files')
        .upload(storagePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Create file entry
      await supabase.from('files').insert({
        mission_id: missionId,
        file_name: file.name,
        file_size: file.size,
        storage_path: storagePath,
        category: 'Proposition',
        uploaded_by: 'laetitia',
      });

      setUploadedFileName(file.name);
      toast.success('Fichier uploadé !');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error("Erreur d'upload : " + (err?.message || 'Réessaie.'));
    } finally {
      setUploading(false);
    }
  };

  const handleStructure = async () => {
    const rawText = tab === 'paste' ? pasteText : fileText;
    if (!rawText || rawText.trim().length < 20) {
      toast.error('Colle au moins quelques lignes de contenu.');
      return;
    }

    setStructuring(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-proposal', {
        body: { raw_text: rawText, mission_type: missionType },
      });
      if (error) throw error;
      if (!data?.sections) throw new Error('Format de réponse invalide');

      const contentToSave = { sections: data.sections };

      if (proposalId) {
        await supabase
          .from('proposals')
          .update({ content: contentToSave as any })
          .eq('id', proposalId);
      } else {
        await supabase.from('proposals').insert({
          mission_id: missionId,
          content: contentToSave as any,
          version: 1,
        });
      }

      toast.success('Proposition importée et structurée !');
      onImportDone();
      onOpenChange(false);
      // Reset state
      setPasteText('');
      setFileText('');
      setUploadedFileName('');
    } catch (err: any) {
      console.error('Structure error:', err);
      toast.error('Erreur : ' + (err?.message || 'Structuration échouée.'));
    } finally {
      setStructuring(false);
    }
  };

  const currentText = tab === 'paste' ? pasteText : fileText;
  const canStructure = currentText.trim().length >= 20 && !structuring;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Importer une proposition existante</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="font-body text-sm gap-2">
              <FileText className="h-4 w-4" />
              Coller le texte
            </TabsTrigger>
            <TabsTrigger value="upload" className="font-body text-sm gap-2">
              <Upload className="h-4 w-4" />
              Uploader un fichier
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-4 space-y-4">
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Colle ici le contenu de ta proposition commerciale (texte brut, pas besoin de mise en forme)"
              className="font-body text-sm min-h-[300px]"
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="font-body text-sm text-muted-foreground">Upload en cours...</p>
                </div>
              ) : uploadedFileName ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="font-body text-sm text-foreground">{uploadedFileName}</p>
                  <p className="font-body text-xs text-muted-foreground">Cliquer pour changer de fichier</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-body text-sm text-foreground">Clique ou glisse un fichier .docx ou .pdf</p>
                  <p className="font-body text-xs text-muted-foreground">Le fichier sera sauvegardé dans les documents de la mission</p>
                </div>
              )}
            </div>

            {/* Text area for manual paste after upload */}
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1 block">
                Colle ici le contenu texte de ta proposition (ou un résumé structuré)
              </label>
              <Textarea
                value={fileText}
                onChange={(e) => setFileText(e.target.value)}
                placeholder="L'extraction automatique n'est pas encore disponible. Copie-colle le texte de ton document ici pour le structurer avec l'IA."
                className="font-body text-sm min-h-[200px]"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleStructure}
            disabled={!canStructure}
            className="gap-2"
          >
            {structuring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Structuration en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Structurer avec l'IA
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
