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
  const pendingStructuredRef = useRef<StructuredNotes | null>(null);
  const creatingRef = useRef(false);

  const { data: discoveryCall, isLoading } = useQuery({
    queryKey: ['discovery_call', missionId],
    queryFn: async () => {
      // Pas de .maybeSingle() : s'il existe des doublons (bug historique de
      // double création), il renverrait une erreur à chaque chargement et
      // l'onglet resterait cassé. On prend la plus ancienne, comme useKickoff.
      const { data, error } = await supabase
        .from('discovery_calls')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as DiscoveryCall | null;
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
    onSuccess: (created) => {
      creatingRef.current = false;
      // Frappes arrivées pendant l'insert : les écrire tout de suite,
      // sinon elles attendraient le prochain événement de sauvegarde.
      const updates: Record<string, unknown> = {};
      if (pendingNotesRef.current !== null) updates.raw_notes = pendingNotesRef.current;
      if (pendingQuestionsRef.current !== null) updates.questions_asked = pendingQuestionsRef.current;
      if (pendingStructuredRef.current !== null) {
        updates.structured_notes = pendingStructuredRef.current;
        updates.ai_suggested_type = pendingStructuredRef.current.suggested_type;
      }
      pendingNotesRef.current = null;
      pendingQuestionsRef.current = null;
      pendingStructuredRef.current = null;
      if (Object.keys(updates).length > 0) {
        supabase
          .from('discovery_calls')
          .update(updates as never)
          .eq('id', created.id)
          .then(({ error }) => {
            if (error) console.error('[useDiscoveryCall] post-create flush failed', error);
          });
      }
      queryClient.invalidateQueries({ queryKey: ['discovery_call', missionId] });
      queryClient.invalidateQueries({ queryKey: ['discovery_calls', missionId] });
    },
    onError: (err) => {
      creatingRef.current = false;
      console.error('[useDiscoveryCall] create failed', err);
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
    onError: (err) => {
      console.error('[useDiscoveryCall] save failed', err);
    },
  });

  // Une seule création possible à la fois : saveNotes (2 s) et saveQuestions
  // (0,5 s) peuvent tomber dans la même fenêtre sur une mission neuve, et un
  // double INSERT casserait la fiche (deux lignes pour la même mission).
  const createOnce = useCallback(() => {
    if (creatingRef.current || createMutation.isPending) return;
    creatingRef.current = true;
    createMutation.mutate({
      raw_notes: pendingNotesRef.current ?? undefined,
      questions_asked: pendingQuestionsRef.current ?? undefined,
    });
  }, [createMutation]);

  const saveNotes = useCallback(
    (notes: string) => {
      pendingNotesRef.current = notes;
      if (debounceTimerNotes.current) clearTimeout(debounceTimerNotes.current);
      debounceTimerNotes.current = setTimeout(() => {
        if (discoveryCall) {
          updateMutation.mutate({ id: discoveryCall.id, raw_notes: notes });
          pendingNotesRef.current = null;
        } else {
          // Si une création est déjà en vol, le pending sera flushé à son onSuccess
          createOnce();
        }
      }, 2000);
    },
    [discoveryCall, updateMutation, createOnce]
  );

  const flushNotesNow = useCallback(
    (notes: string) => {
      if (debounceTimerNotes.current) {
        clearTimeout(debounceTimerNotes.current);
        debounceTimerNotes.current = null;
      }
      if (discoveryCall) {
        pendingNotesRef.current = null;
        supabase
          .from('discovery_calls')
          .update({ raw_notes: notes })
          .eq('id', discoveryCall.id)
          .then(({ error }) => {
            if (error) console.error('[useDiscoveryCall] flush failed', error);
          });
      } else {
        pendingNotesRef.current = notes;
        createOnce();
      }
    },
    [discoveryCall, createOnce]
  );

  const saveQuestions = useCallback(
    (questions: Record<string, boolean>) => {
      pendingQuestionsRef.current = questions;
      if (debounceTimerQuestions.current) clearTimeout(debounceTimerQuestions.current);
      debounceTimerQuestions.current = setTimeout(() => {
        if (discoveryCall) {
          updateMutation.mutate({ id: discoveryCall.id, questions_asked: questions });
          pendingQuestionsRef.current = null;
        } else {
          createOnce();
        }
      }, 500);
    },
    [discoveryCall, updateMutation, createOnce]
  );

  const saveStructuredNotes = useCallback(
    (structured: StructuredNotes) => {
      if (discoveryCall) {
        updateMutation.mutate({
          id: discoveryCall.id,
          structured_notes: structured,
          ai_suggested_type: structured.suggested_type,
        });
      } else {
        // Fiche pas encore créée (notes collées + « Structurer » avant le
        // debounce de 2 s) : sans ça, la fiche affichée n'était jamais sauvée.
        pendingStructuredRef.current = structured;
        createOnce();
      }
    },
    [discoveryCall, updateMutation, createOnce]
  );

  // Flush pending saves on unmount
  useEffect(() => {
    const currentCall = discoveryCall;
    return () => {
      if (debounceTimerNotes.current) clearTimeout(debounceTimerNotes.current);
      if (debounceTimerQuestions.current) clearTimeout(debounceTimerQuestions.current);

      if (currentCall && pendingNotesRef.current !== null) {
        const notes = pendingNotesRef.current;
        pendingNotesRef.current = null;
        supabase
          .from('discovery_calls')
          .update({ raw_notes: notes })
          .eq('id', currentCall.id)
          .then(({ error }) => {
            if (error) console.error('[useDiscoveryCall] unmount flush failed', error);
          });
      }
      if (currentCall && pendingQuestionsRef.current !== null) {
        const questions = pendingQuestionsRef.current;
        pendingQuestionsRef.current = null;
        supabase
          .from('discovery_calls')
          .update({ questions_asked: questions })
          .eq('id', currentCall.id)
          .then(({ error }) => {
            if (error) console.error('[useDiscoveryCall] unmount flush failed', error);
          });
      }
    };
  }, [discoveryCall]);

  return {
    discoveryCall,
    isLoading,
    saveNotes,
    flushNotesNow,
    saveQuestions,
    saveStructuredNotes,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
