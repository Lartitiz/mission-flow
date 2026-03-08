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
      .select("id, questionnaire_status, questionnaire_responses")
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

    if (kickoff.questionnaire_status !== "sent" && kickoff.questionnaire_status !== "ready") {
      return new Response(JSON.stringify({ error: "Ce questionnaire n'est pas disponible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge responses
    const existingResponses = (kickoff.questionnaire_responses as Record<string, string>) ?? {};
    const mergedResponses = { ...existingResponses, ...responses };

    const updates: Record<string, unknown> = {
      questionnaire_responses: mergedResponses,
    };

    if (submit) {
      updates.questionnaire_status = "completed";
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("kickoffs")
      .update(updates)
      .eq("id", kickoff.id);

    if (updateError) throw updateError;

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
