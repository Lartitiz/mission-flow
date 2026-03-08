import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Session = Tables<'sessions'>;

export function useSessions(missionId: string) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('mission_id', missionId)
        .order('session_date', { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!missionId,
  });

  const createMutation = useMutation({
    mutationFn: async (session: TablesInsert<'sessions'>) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert(session)
        .select()
        .single();
      if (error) throw error;
      return data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'sessions'> & { id: string }) => {
      const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
    },
  });

  return {
    sessions,
    isLoading,
    createSession: createMutation.mutateAsync,
    updateSession: useCallback(
      (id: string, updates: Omit<TablesUpdate<'sessions'>, 'id'>) => {
        updateMutation.mutate({ id, ...updates });
      },
      [updateMutation]
    ),
    deleteSession: deleteMutation.mutate,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
