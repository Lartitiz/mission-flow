import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { saveAs } from 'file-saver';

interface KickoffSection {
  title: string;
  content: string;
}

interface KickoffStructuredNotesProps {
  sections: KickoffSection[];
  clientName: string;
  rawNotes: string;
  createdAt?: string;
  onSectionEdit: (index: number, content: string) => void;
}

export function KickoffStructuredNotes({
  sections,
  clientName,
  rawNotes,
  createdAt,
  onSectionEdit,
}: KickoffStructuredNotesProps) {
  const handleDownloadMarkdown = () => {
    const date = createdAt
      ? new Date(createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

    let markdown = `# Kick-off — ${clientName}\n\n`;
    markdown += `**Date :** ${date}\n\n`;
    markdown += `---\n\n`;

    sections.forEach((section) => {
      markdown += `## ${section.title}\n\n${section.content}\n\n`;
    });

    markdown += `---\n\n## Notes brutes\n\n${rawNotes}`;

    const filename = `Kickoff_${clientName.replace(/\s+/g, '_')}_${date.replace(/\s+/g, '_')}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    saveAs(blob, filename);
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg text-foreground">Fiche kick-off structurée</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadMarkdown}
          className="font-body gap-2"
        >
          <Download className="h-4 w-4" />
          Télécharger (.md)
        </Button>
      </div>

      {sections.map((section, idx) => (
        <SectionCard
          key={idx}
          section={section}
          onEdit={(content) => onSectionEdit(idx, content)}
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  onEdit,
}: {
  section: KickoffSection;
  onEdit: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(section.content);

  const handleBlur = () => {
    setEditing(false);
    if (value !== section.content) {
      onEdit(value);
    }
  };

  return (
    <div className="bg-card rounded-xl border-l-4 border-l-primary shadow-[var(--card-shadow)] p-5">
      <h4 className="font-body text-sm font-semibold text-foreground mb-2">
        {section.title}
      </h4>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="w-full min-h-[80px] p-2 rounded-lg border border-input bg-background font-body text-sm text-foreground resize-y outline-none focus:ring-1 focus:ring-ring leading-relaxed"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="font-body text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap cursor-text hover:bg-secondary/30 rounded-lg p-1 -m-1 transition-colors"
        >
          {section.content}
        </p>
      )}
    </div>
  );
}
