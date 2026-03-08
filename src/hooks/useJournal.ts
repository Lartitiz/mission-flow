import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type JournalEntry = Tables<'journal_entries'>;

export function useJournal(missionId: string) {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journal', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('mission_id', missionId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as JournalEntry[];
    },
    enabled: !!missionId,
  });

  const createMutation = useMutation({
    mutationFn: async (entry: TablesInsert<'journal_entries'>) => {
      const { data, error } = await supabase
        .from('journal_entries')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', missionId] });
    },
  });

  const addEntry = useCallback(
    (content: string, source: 'manual' | 'auto' = 'manual') => {
      createMutation.mutate({
        mission_id: missionId,
        content,
        source,
      });
    },
    [missionId, createMutation]
  );

  return {
    entries,
    isLoading,
    addEntry,
    isSaving: createMutation.isPending,
  };
}
