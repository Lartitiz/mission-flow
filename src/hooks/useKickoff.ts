import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { Json } from '@/integrations/supabase/types';

export type Kickoff = Tables<'kickoffs'>;

export function useKickoff(missionId: string) {
  const queryClient = useQueryClient();
  const debounceNotes = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceFields = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);
  const pendingNotesRef = useRef<string | null>(null);
  const pendingFieldsRef = useRef<Record<string, unknown> | null>(null);

  const { data: kickoff, isLoading } = useQuery({
    queryKey: ['kickoff', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kickoffs')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as Kickoff | null;
    },
    enabled: !!missionId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('kickoffs')
        .insert({ mission_id: missionId })
        .select()
        .single();
      if (error) throw error;
      return data as Kickoff;
    },
    onSuccess: () => {
      creatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['kickoff', missionId] });
    },
    onError: () => {
      creatingRef.current = false;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      mode?: string;
      raw_notes?: string;
      fixed_questions?: Json;
      ai_questions?: Json;
      declic_questions_enabled?: boolean;
      structured_notes?: Json;
      questionnaire_status?: string;
    }) => {
      const { error } = await supabase
        .from('kickoffs')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kickoff', missionId] });
    },
  });

  // Auto-create kickoff if it doesn't exist
  useEffect(() => {
    if (!isLoading && kickoff === null && !creatingRef.current && !createMutation.isPending) {
      creatingRef.current = true;
      createMutation.mutate();
    }
  }, [isLoading, kickoff, createMutation]);

  const saveNotes = useCallback(
    (notes: string) => {
      pendingNotesRef.current = notes;
      if (debounceNotes.current) clearTimeout(debounceNotes.current);
      debounceNotes.current = setTimeout(() => {
        if (kickoff) {
          updateMutation.mutate({ id: kickoff.id, raw_notes: notes });
          pendingNotesRef.current = null;
        }
      }, 2000);
    },
    [kickoff, updateMutation]
  );

  const saveField = useCallback(
    (updates: Record<string, unknown>) => {
      pendingFieldsRef.current = updates;
      if (debounceFields.current) clearTimeout(debounceFields.current);
      debounceFields.current = setTimeout(() => {
        if (kickoff) {
          updateMutation.mutate({ id: kickoff.id, ...updates } as any);
          pendingFieldsRef.current = null;
        }
      }, 500);
    },
    [kickoff, updateMutation]
  );

  const saveImmediate = useCallback(
    (updates: Record<string, unknown>) => {
      if (kickoff) {
        updateMutation.mutate({ id: kickoff.id, ...updates } as any);
      }
    },
    [kickoff, updateMutation]
  );

  // Flush pending saves on unmount
  useEffect(() => {
    const currentKickoff = kickoff;
    return () => {
      if (debounceNotes.current) clearTimeout(debounceNotes.current);
      if (debounceFields.current) clearTimeout(debounceFields.current);

      if (currentKickoff && pendingNotesRef.current !== null) {
        supabase
          .from('kickoffs')
          .update({ raw_notes: pendingNotesRef.current })
          .eq('id', currentKickoff.id)
          .then(() => {});
      }
      if (currentKickoff && pendingFieldsRef.current !== null) {
        supabase
          .from('kickoffs')
          .update(pendingFieldsRef.current as any)
          .eq('id', currentKickoff.id)
          .then(() => {});
      }
    };
  }, [kickoff]);

  return {
    kickoff,
    isLoading,
    saveNotes,
    saveField,
    saveImmediate,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
