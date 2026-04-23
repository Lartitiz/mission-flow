import { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, ClipboardPaste, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface NotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  isSaving: boolean;
  /** Optional storage key for local draft persistence (per mission/session) */
  draftKey?: string;
  /** Optional immediate flush callback used on tab hide / unload */
  onFlush?: (notes: string) => void;
}

export function NotesEditor({ notes, onChange, isSaving, draftKey, onFlush }: NotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef(notes);
  const onFlushRef = useRef(onFlush);
  const [restoredNotice, setRestoredNotice] = useState(false);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    onFlushRef.current = onFlush;
  }, [onFlush]);

  // Restore local draft if it's longer/newer than what came from backend
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { content: string; updatedAt: number };
      if (parsed?.content && parsed.content !== notesRef.current && parsed.content.length > notesRef.current.length) {
        notesRef.current = parsed.content;
        onChange(parsed.content);
        setRestoredNotice(true);
        setTimeout(() => setRestoredNotice(false), 4000);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const persistDraft = (value: string) => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ content: value, updatedAt: Date.now() }));
    } catch {
      /* quota / private mode — ignore */
    }
  };

  const updateNotes = (value: string) => {
    notesRef.current = value;
    persistDraft(value);
    onChange(value);
  };

  const { isListening, isSupported, pausedByVisibility, restartBlocked, toggle } = useSpeechRecognition({
    onResult: (transcript) => {
      const current = notesRef.current;
      const newNotes = current ? `${current} ${transcript}` : transcript;
      updateNotes(newNotes);
    },
  });

  // Flush immediately on tab hide / unload to bypass debounce timers
  useEffect(() => {
    const flush = () => {
      const current = notesRef.current;
      persistDraft(current);
      try {
        onFlushRef.current?.(current);
      } catch {
        /* noop */
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const handlePaste = () => {
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isSupported ? (
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="sm"
              onClick={toggle}
              className={`font-body text-xs gap-1.5 ${isListening && !pausedByVisibility ? 'animate-pulse' : ''}`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  {pausedByVisibility ? 'Dictée en pause...' : 'Dictée en cours...'}
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

          {pausedByVisibility && (
            <span className="font-body text-xs text-muted-foreground inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              En pause (onglet inactif). Reprend automatiquement au retour.
            </span>
          )}
          {restartBlocked && !pausedByVisibility && (
            <span className="font-body text-xs text-destructive inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Reprise bloquée. Clique sur « Dicter » pour relancer.
            </span>
          )}
          {restoredNotice && (
            <span className="font-body text-xs text-primary">
              Brouillon local restauré.
            </span>
          )}
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
        onChange={(e) => updateNotes(e.target.value)}
        placeholder="Prends tes notes ici pendant l'appel..."
        className="w-full min-h-[400px] p-4 rounded-xl border border-input bg-card font-body text-sm text-foreground placeholder:text-muted-foreground resize-y outline-none focus:ring-1 focus:ring-ring leading-relaxed"
      />
    </div>
  );
}
