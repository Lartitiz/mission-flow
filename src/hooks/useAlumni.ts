import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Mission } from '@/lib/missions';

export function useAlumni() {
  return useQuery({
    queryKey: ['alumni'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Mission[];
    },
  });
}

export function useUpdateLastContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (missionId: string) => {
      const { error } = await supabase
        .from('missions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', missionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alumni'] });
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}
