import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Action = Tables<'actions'>;

export function useActions(missionId: string) {
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['actions', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actions')
        .select('*')
        .eq('mission_id', missionId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Action[];
    },
    enabled: !!missionId,
  });

  const createMutation = useMutation({
    mutationFn: async (action: TablesInsert<'actions'>) => {
      const { data, error } = await supabase
        .from('actions')
        .insert(action)
        .select()
        .single();
      if (error) throw error;
      return data as Action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'actions'> & { id: string }) => {
      const { error } = await supabase
        .from('actions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('actions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('actions').update({ sort_order: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
    },
  });

  // Realtime: auto-refresh when actions change (e.g. client updates status)
  useEffect(() => {
    if (!missionId) return;
    const channel = supabase
      .channel(`actions-${missionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'actions',
        filter: `mission_id=eq.${missionId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, queryClient]);

  const addAction = useCallback(
    (assignee: 'laetitia' | 'client') => {
      const filtered = actions.filter(a => a.assignee === assignee);
      const maxSort = filtered.length > 0
        ? Math.max(...filtered.map(a => a.sort_order)) + 1
        : 0;
      createMutation.mutate({
        mission_id: missionId,
        assignee,
        task: '',
        sort_order: maxSort,
        status: 'not_started',
      });
    },
    [actions, missionId, createMutation]
  );

  const updateAction = useCallback(
    (id: string, updates: Omit<TablesUpdate<'actions'>, 'id'>) => {
      updateMutation.mutate({ id, ...updates });
    },
    [updateMutation]
  );

  const deleteAction = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const reorderActions = useCallback(
    (orderedIds: string[]) => {
      reorderMutation.mutate(orderedIds);
    },
    [reorderMutation]
  );

  return {
    actions,
    isLoading,
    addAction,
    updateAction,
    deleteAction,
    reorderActions,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
