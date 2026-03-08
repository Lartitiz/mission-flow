import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { StructuredNotes } from '@/lib/discovery-types';

export type DiscoveryCall = Tables<'discovery_calls'>;

export function useDiscoveryCall(missionId: string) {
  const queryClient = useQueryClient();
  const debounceTimerNotes = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerQuestions = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesRef = useRef<string | null>(null);
  const pendingQuestionsRef = useRef<Record<string, boolean> | null>(null);

  const { data: discoveryCall, isLoading } = useQuery({
    queryKey: ['discovery_call', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_calls')
        .select('*')
        .eq('mission_id', missionId)
        .maybeSingle();
      if (error) throw error;
      return data as DiscoveryCall | null;
    },
    enabled: !!missionId,
  });

  const createMutation = useMutation({
    mutationFn: async (initial: { raw_notes?: string; questions_asked?: Record<string, boolean> }) => {
      const { data, error } = await supabase
        .from('discovery_calls')
        .insert({
          mission_id: missionId,
          raw_notes: initial.raw_notes ?? null,
          questions_asked: initial.questions_asked ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DiscoveryCall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery_call', missionId] });
      queryClient.invalidateQueries({ queryKey: ['discovery_calls', missionId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      raw_notes?: string;
      questions_asked?: Record<string, boolean> | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structured_notes?: any;
      ai_suggested_type?: string | null;
    }) => {
      const { error } = await supabase
        .from('discovery_calls')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery_call', missionId] });
      queryClient.invalidateQueries({ queryKey: ['discovery_calls', missionId] });
    },
  });

  const saveNotes = useCallback(
    (notes: string) => {
      pendingNotesRef.current = notes;
      if (debounceTimerNotes.current) clearTimeout(debounceTimerNotes.current);
      debounceTimerNotes.current = setTimeout(() => {
        if (discoveryCall) {
          updateMutation.mutate({ id: discoveryCall.id, raw_notes: notes });
        } else {
          createMutation.mutate({ raw_notes: notes });
        }
        pendingNotesRef.current = null;
      }, 2000);
    },
    [discoveryCall, updateMutation, createMutation]
  );

  const saveQuestions = useCallback(
    (questions: Record<string, boolean>) => {
      pendingQuestionsRef.current = questions;
      if (debounceTimerQuestions.current) clearTimeout(debounceTimerQuestions.current);
      debounceTimerQuestions.current = setTimeout(() => {
        if (discoveryCall) {
          updateMutation.mutate({ id: discoveryCall.id, questions_asked: questions });
        } else {
          createMutation.mutate({ questions_asked: questions });
        }
        pendingQuestionsRef.current = null;
      }, 500);
    },
    [discoveryCall, updateMutation, createMutation]
  );

  const saveStructuredNotes = useCallback(
    (structured: StructuredNotes) => {
      if (discoveryCall) {
        updateMutation.mutate({
          id: discoveryCall.id,
          structured_notes: structured,
          ai_suggested_type: structured.suggested_type,
        });
      }
    },
    [discoveryCall, updateMutation]
  );

  // Flush pending saves on unmount
  useEffect(() => {
    const currentCall = discoveryCall;
    return () => {
      if (debounceTimerNotes.current) clearTimeout(debounceTimerNotes.current);
      if (debounceTimerQuestions.current) clearTimeout(debounceTimerQuestions.current);

      if (currentCall && pendingNotesRef.current !== null) {
        supabase
          .from('discovery_calls')
          .update({ raw_notes: pendingNotesRef.current })
          .eq('id', currentCall.id)
          .then(() => {});
      }
      if (currentCall && pendingQuestionsRef.current !== null) {
        supabase
          .from('discovery_calls')
          .update({ questions_asked: pendingQuestionsRef.current })
          .eq('id', currentCall.id)
          .then(() => {});
      }
    };
  }, [discoveryCall]);

  return {
    discoveryCall,
    isLoading,
    saveNotes,
    saveQuestions,
    saveStructuredNotes,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
