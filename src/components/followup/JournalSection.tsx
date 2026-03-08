import { useState } from 'react';
import type { JournalEntry } from '@/hooks/useJournal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface JournalSectionProps {
  entries: JournalEntry[];
  addEntry: (content: string, source?: 'manual' | 'auto') => void;
  isSaving: boolean;
}

export function JournalSection({ entries, addEntry, isSaving }: JournalSectionProps) {
  const [newContent, setNewContent] = useState('');

  const handleAdd = () => {
    if (!newContent.trim()) return;
    addEntry(newContent.trim(), 'manual');
    setNewContent('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-base font-medium text-foreground">Journal de bord</h3>

      <div className="flex gap-2">
        <Input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Noter quelque chose..."
          className="font-body text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newContent.trim() || isSaving}
          className="font-body gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">Aucune entrée dans le journal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-card rounded-xl shadow-[var(--card-shadow)] px-4 py-3 flex items-start gap-3">
              <div className="shrink-0 pt-0.5">
                <span className="font-body text-[10px] text-muted-foreground">
                  {format(new Date(entry.entry_date), 'dd/MM', { locale: fr })}
                </span>
              </div>
              <Badge
                variant={entry.source === 'auto' ? 'secondary' : 'outline'}
                className="font-body text-[9px] px-1.5 py-0 shrink-0"
              >
                {entry.source === 'auto' ? 'Auto' : 'Manuel'}
              </Badge>
              <p className="font-body text-sm text-foreground leading-relaxed">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
