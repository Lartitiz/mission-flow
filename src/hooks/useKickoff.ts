import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    onError: (err: any) => {
      console.error('[useKickoff] save failed', err);
      toast.error('Sauvegarde échouée — réessaie ou recharge la page.');
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
      pendingFieldsRef.current = { ...(pendingFieldsRef.current ?? {}), ...updates };
      if (debounceFields.current) clearTimeout(debounceFields.current);
      debounceFields.current = setTimeout(() => {
        if (kickoff && pendingFieldsRef.current) {
          const toSave = pendingFieldsRef.current;
          pendingFieldsRef.current = null;
          updateMutation.mutate({ id: kickoff.id, ...toSave } as any);
        }
      }, 250);
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

  const flushNotesNow = useCallback(
    (notes: string) => {
      if (debounceNotes.current) {
        clearTimeout(debounceNotes.current);
        debounceNotes.current = null;
      }
      pendingNotesRef.current = null;
      if (kickoff) {
        supabase
          .from('kickoffs')
          .update({ raw_notes: notes })
          .eq('id', kickoff.id)
          .then(() => {});
      }
    },
    [kickoff]
  );

  // Flush pending saves on unmount + on page unload (F5, tab close)
  useEffect(() => {
    const currentKickoff = kickoff;

    const flushPending = () => {
      if (!currentKickoff) return;
      const updates: Record<string, unknown> = {};
      if (pendingNotesRef.current !== null) updates.raw_notes = pendingNotesRef.current;
      if (pendingFieldsRef.current !== null) Object.assign(updates, pendingFieldsRef.current);
      if (Object.keys(updates).length === 0) return;

      // Try sendBeacon first (survives page unload), fall back to fetch
      try {
        const url = `${(supabase as any).supabaseUrl}/rest/v1/kickoffs?id=eq.${currentKickoff.id}`;
        const apikey = (supabase as any).supabaseKey;
        const headers = {
          'Content-Type': 'application/json',
          apikey,
          Authorization: `Bearer ${apikey}`,
          Prefer: 'return=minimal',
        };
        // sendBeacon doesn't support PATCH → use fetch with keepalive
        fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates),
          keepalive: true,
        }).catch(() => {});
      } catch {
        supabase.from('kickoffs').update(updates as any).eq('id', currentKickoff.id).then(() => {});
      }
      pendingNotesRef.current = null;
      pendingFieldsRef.current = null;
    };

    const handleBeforeUnload = () => flushPending();
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPending();
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceNotes.current) clearTimeout(debounceNotes.current);
      if (debounceFields.current) clearTimeout(debounceFields.current);
      flushPending();
    };
  }, [kickoff]);

  return {
    kickoff,
    isLoading,
    saveNotes,
    flushNotesNow,
    saveField,
    saveImmediate,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
