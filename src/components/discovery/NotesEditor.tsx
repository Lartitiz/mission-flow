import { useRef } from 'react';
import { Mic, MicOff, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface NotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  isSaving: boolean;
}

export function NotesEditor({ notes, onChange, isSaving }: NotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, toggle } = useSpeechRecognition({
    onResult: (transcript) => {
      const newNotes = notes ? `${notes} ${transcript}` : transcript;
      onChange(newNotes);
    },
  });

  const handlePaste = () => {
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSupported ? (
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="sm"
              onClick={toggle}
              className={`font-body text-xs gap-1.5 ${isListening ? 'animate-pulse' : ''}`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Dictée en cours...
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Dicter
                </>
              )}
            </Button>
          ) : (
            <p className="font-body text-xs text-muted-foreground">
              Dictée non disponible sur ce navigateur. Utilise Chrome ou Safari.
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            className="font-body text-xs text-muted-foreground gap-1.5"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Coller depuis ChatGPT
          </Button>
        </div>

        {isSaving && (
          <span className="font-body text-xs text-muted-foreground">
            Sauvegarde...
          </span>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Prends tes notes ici pendant l'appel..."
        className="w-full min-h-[400px] p-4 rounded-xl border border-input bg-card font-body text-sm text-foreground placeholder:text-muted-foreground resize-y outline-none focus:ring-1 focus:ring-ring leading-relaxed"
      />
    </div>
  );
}
