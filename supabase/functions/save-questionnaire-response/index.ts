import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

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
    const { token, responses, submit } = await req.json();
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

    // Verify token
    const { data: kickoff, error: kickoffError } = await supabase
      .from("kickoffs")
      .select("*, missions!inner(id, client_name, mission_type)")
      .eq("questionnaire_token", token)
      .maybeSingle();

    if (kickoffError || !kickoff) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kickoff.questionnaire_status === "completed") {
      return new Response(JSON.stringify({ error: "Ce questionnaire a déjà été soumis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge responses
    const existingResponses = (kickoff.questionnaire_responses as Record<string, string>) ?? {};
    const mergedResponses = { ...existingResponses, ...responses };

    const updates: Record<string, unknown> = {
      questionnaire_responses: mergedResponses,
    };

    // Auto-promote draft → sent on first save so the dashboard stays accurate.
    if (kickoff.questionnaire_status === "draft") {
      updates.questionnaire_status = "sent";
      updates.sent_at = new Date().toISOString();
    }

    if (submit) {
      updates.questionnaire_status = "completed";
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("kickoffs")
      .update(updates)
      .eq("id", kickoff.id);

    if (updateError) throw updateError;

    // On final submission, notify Laetitia by email (non-blocking).
    if (submit) {
      try {
        const mission = (kickoff as any).missions;
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

        const checked = ((kickoff as any).fixed_questions as Record<string, boolean>) ?? {};
        const aiQs = ((kickoff as any).ai_questions as string[]) ?? [];
        const declicEnabled = (kickoff as any).declic_questions_enabled ?? false;

        const ordered: { id: string; text: string; theme: string }[] = [];
        for (const q of fixedQuestions) if (checked[q.id]) ordered.push(q);
        aiQs.forEach((text, idx) => {
          if (checked[`ai_${idx}`]) ordered.push({ id: `ai_${idx}`, text, theme: "Questions contextuelles" });
        });
        if (declicEnabled) for (const q of declicQuestions) if (checked[q.id]) ordered.push(q);

        const qa = ordered.map((q) => ({
          theme: q.theme,
          question: q.text,
          answer: (mergedResponses as Record<string, string>)[q.id] ?? "",
        }));

        const submittedAt = new Date().toLocaleDateString("fr-FR", {
          day: "numeric", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
        const missionUrl = `https://nowadays-mission-flow.lovable.app/missions/${mission.id}`;

        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "questionnaire-submitted",
            recipientEmail: "laetitia@nowadaysagency.com",
            idempotencyKey: `questionnaire-submitted-${kickoff.id}`,
            templateData: {
              clientName: mission.client_name,
              missionType: mission.mission_type ?? "",
              submittedAt,
              missionUrl,
              responses: qa,
            },
          },
        }).catch((err) => console.error("notify email failed:", err));
      } catch (notifyErr) {
        console.error("questionnaire notify build error:", notifyErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, status: submit ? "completed" : "in_progress" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("save-questionnaire-response error:", e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
