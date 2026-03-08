import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find kickoff by questionnaire_token
    const { data: kickoff, error: kickoffError } = await supabase
      .from("kickoffs")
      .select("*, missions!inner(client_name, mission_type)")
      .eq("questionnaire_token", token)
      .maybeSingle();

    if (kickoffError || !kickoff) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = kickoff.questionnaire_status;

    if (status === "completed") {
      return new Response(
        JSON.stringify({
          status: "completed",
          client_name: (kickoff as any).missions.client_name,
          completed_at: kickoff.completed_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status !== "sent" && status !== "ready") {
      return new Response(JSON.stringify({ error: "Ce questionnaire n'est pas encore disponible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the question list from fixed_questions, ai_questions, declic
    const fixedQuestions = [
      { id: "histoire", text: "Quelle est ton histoire ? Comment l'aventure a débuté ?", theme: "Ton histoire" },
      { id: "anecdotes", text: "As-tu des anecdotes, des moments fondateurs ?", theme: "Ton histoire" },
      { id: "causes", text: "Pour quelles causes ou valeurs ton projet prend position ?", theme: "Ton identité" },
      { id: "mission", text: "Ta mission ? Le pourquoi profond ?", theme: "Ton identité" },
      { id: "positionnement", text: "Définis ton projet en une phrase (positionnement)", theme: "Ton identité" },
      { id: "mots", text: "Décris-toi en 3 mots", theme: "Ton identité" },
      { id: "perception", text: "Comment veux-tu être perçu·e ?", theme: "Ton image" },
      { id: "inspirations", text: "Quelles marques t'inspirent en communication ?", theme: "Ton image" },
      { id: "offres", text: "Peux-tu détailler tes offres ?", theme: "Ton activité" },
      { id: "client_ideal", text: "Qui est ton/ta client·e idéal·e ?", theme: "Ton activité" },
      { id: "style", text: "Quel style et ton souhaites-tu adopter ?", theme: "Ton image" },
      { id: "attentes", text: "Qu'attends-tu exactement de cet accompagnement ?", theme: "Tes attentes" },
    ];

    const declicQuestions = [
      { id: "declic_livre", text: "Quel est le livre que tu as le plus offert et pourquoi ?", theme: "Questions déclic" },
      { id: "declic_defaite", text: "Raconte quelque chose qui semblait être une défaite mais qui t'a permis d'arriver à une victoire.", theme: "Questions déclic" },
      { id: "declic_panneau", text: "Si tu pouvais avoir un panneau géant pour écrire un message au monde, tu écrirais quoi ?", theme: "Questions déclic" },
      { id: "declic_phrase", text: "Complète la phrase : je ne serais pas arrivé·e là si...", theme: "Questions déclic" },
      { id: "declic_habitude_chelou", text: "Raconte une habitude chelou ou un truc que tu aimes de manière absurde", theme: "Questions déclic" },
      { id: "declic_habitude_vie", text: "Dans les 5 dernières années, quelle habitude a le plus amélioré ta vie ?", theme: "Questions déclic" },
    ];

    const checked = (kickoff.fixed_questions as Record<string, boolean>) ?? {};
    const aiQs = (kickoff.ai_questions as string[]) ?? [];
    const declicEnabled = kickoff.declic_questions_enabled ?? false;

    const questions: { id: string; text: string; theme: string }[] = [];

    // Add checked fixed questions
    for (const q of fixedQuestions) {
      if (checked[q.id]) {
        questions.push(q);
      }
    }

    // Add checked AI questions
    aiQs.forEach((text, idx) => {
      if (checked[`ai_${idx}`]) {
        questions.push({ id: `ai_${idx}`, text, theme: "Questions contextuelles" });
      }
    });

    // Add checked declic questions
    if (declicEnabled) {
      for (const q of declicQuestions) {
        if (checked[q.id]) {
          questions.push(q);
        }
      }
    }

    // Get existing responses
    const responses = (kickoff.questionnaire_responses as Record<string, string>) ?? {};

    return new Response(
      JSON.stringify({
        status,
        client_name: (kickoff as any).missions.client_name,
        mission_type: (kickoff as any).missions.mission_type,
        kickoff_id: kickoff.id,
        questions,
        responses,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-questionnaire error:", e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
