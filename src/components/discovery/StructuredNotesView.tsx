import { StructuredNotes, StructuredSection } from '@/lib/discovery-types';
import { useUpdateMission } from '@/hooks/useMissions';
import { formatMissionType } from '@/lib/missions';
import { Button } from '@/components/ui/button';
import { Check, Download } from 'lucide-react';
import { useState } from 'react';
import { saveAs } from 'file-saver';

interface StructuredNotesViewProps {
  structuredNotes: StructuredNotes;
  missionId: string;
  clientName: string;
  currentMissionType: string;
  rawNotes: string;
  createdAt?: string;
  onSectionEdit: (index: number, content: string) => void;
}

export function StructuredNotesView({
  structuredNotes,
  missionId,
  clientName,
  currentMissionType,
  rawNotes,
  createdAt,
  onSectionEdit,
}: StructuredNotesViewProps) {
  const updateMission = useUpdateMission();
  const [appliedType, setAppliedType] = useState(false);

  const handleApplyType = () => {
    updateMission.mutate(
      { id: missionId, mission_type: structuredNotes.suggested_type },
      { onSuccess: () => setAppliedType(true) }
    );
  };

  const handleDownloadMarkdown = () => {
    const date = createdAt ? new Date(createdAt).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let markdown = `# Appel découverte — ${clientName}\n\n`;
    markdown += `**Date :** ${date}\n`;
    markdown += `**Type de mission suggéré :** ${formatMissionType(structuredNotes.suggested_type)}\n\n`;
    markdown += `---\n\n`;

    structuredNotes.sections.forEach((section) => {
      markdown += `## ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
    });

    markdown += `---\n\n## Notes brutes\n\n`;
    markdown += rawNotes;

    const filename = `Appel_decouverte_${clientName.replace(/\s+/g, '_')}_${date.replace(/\s+/g, '_')}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    saveAs(blob, filename);
  };

  return (
    <div className="space-y-4 mt-6">
      <h3 className="font-heading text-lg text-foreground">Fiche structurée</h3>

      {structuredNotes.sections.map((section, idx) => (
        <SectionCard
          key={idx}
          section={section}
          onEdit={(content) => onSectionEdit(idx, content)}
        />
      ))}

      {/* Suggestion de type */}
      <div className="bg-card rounded-xl border-l-4 border-l-primary shadow-[var(--card-shadow)] p-5">
        <h4 className="font-body text-sm font-semibold text-foreground mb-2">
          Suggestion de type de mission
        </h4>
        <p className="font-body text-sm text-foreground/80 mb-1">
          <span className="font-medium">Type suggéré :</span>{' '}
          {formatMissionType(structuredNotes.suggested_type)}
        </p>
        <p className="font-body text-sm text-muted-foreground mb-3">
          {structuredNotes.type_justification}
        </p>
        {structuredNotes.suggested_type !== currentMissionType && !appliedType ? (
          <Button
            size="sm"
            onClick={handleApplyType}
            disabled={updateMission.isPending}
            className="font-body text-xs gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Appliquer
          </Button>
        ) : appliedType ? (
          <span className="font-body text-xs text-primary font-medium">
            ✓ Type mis à jour
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  onEdit,
}: {
  section: StructuredSection;
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
