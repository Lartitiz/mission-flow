import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Mission } from '@/lib/missions';

export function useMissions() {
  return useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Mission[];
    },
  });
}

export function useMission(id: string) {
  return useQuery({
    queryKey: ['missions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Mission;
    },
    enabled: !!id,
  });
}

export function useUpdateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Mission>) => {
      const { error } = await supabase
        .from('missions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['missions', variables.id] });
    },
  });
}

export function useMissionDiscoveryCalls(missionId: string) {
  return useQuery({
    queryKey: ['discovery_calls', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_calls')
        .select('structured_notes')
        .eq('mission_id', missionId);
      if (error) throw error;
      return data;
    },
    enabled: !!missionId,
  });
}

export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('missions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      client_name,
      client_email,
      mission_type,
      status,
      amount,
    }: {
      client_name: string;
      client_email?: string;
      mission_type?: string;
      status?: string;
      amount?: number;
    }) => {
      const { data, error } = await supabase
        .from('missions')
        .insert({
          client_name,
          client_email: client_email || null,
          mission_type: mission_type || 'non_determine',
          status: status || 'discovery_call',
          amount: amount ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('missions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast({ title: 'Mission supprimée' });
    },
  });
}
