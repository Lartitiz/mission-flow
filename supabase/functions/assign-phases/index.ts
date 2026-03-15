import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mission_id } = await req.json();
    if (!mission_id) {
      return new Response(JSON.stringify({ error: "mission_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get mission type
    const { data: mission, error: missionErr } = await supabase
      .from("missions")
      .select("mission_type")
      .eq("id", mission_id)
      .single();

    if (missionErr || !mission) {
      return new Response(JSON.stringify({ error: "Mission introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all actions
    const { data: actions, error: actionsErr } = await supabase
      .from("actions")
      .select("id, task, description, category, assignee, phase")
      .eq("mission_id", mission_id);

    if (actionsErr) {
      return new Response(JSON.stringify({ error: "Erreur récupération actions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any actions need phases
    const needsPhase = actions?.filter((a: any) => !a.phase) || [];
    if (needsPhase.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API manquante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu reçois la liste des actions d'une mission de communication et tu dois assigner une phase temporelle à chaque action qui n'en a pas encore.

Les actions qui ont déjà une phase ne doivent PAS être modifiées. Tu assignes UNIQUEMENT les phases manquantes (phase = null).

Règles d'assignation :
- Les audits, analyses, positionnement, branding, documents stratégiques → début de mission
- Les calendriers éditoriaux, templates, contenus → milieu de mission
- Les optimisations, ajustements, emailing, publicité → deuxième moitié
- Les bilans, recommandations, feuilles de route → fin de mission
- Les visios mensuelles, support WhatsApp → "continu"
- Les actions client (accès, logo, photos, réflexions) → début de mission
- Utilise les phases déjà assignées comme repère pour la cohérence

Format des phases selon le type de mission :
- Binôme 6 mois : mois_1_2, mois_3, mois_4_5, mois_6, continu
- Agency (adapter selon la durée perçue) : mois_1, mois_2, mois_3, etc.
- Mission courte : phase_1, phase_2
- Si tu ne peux pas déterminer la durée, utilise : debut, milieu, fin, continu

Réponds UNIQUEMENT en JSON : { "updates": [{ "action_id": "uuid", "phase": "mois_1_2" }] }
Ne renvoie QUE les actions dont tu modifies la phase (celles qui étaient null).`;

    const userMessage = `Type de mission : ${mission.mission_type}

Actions (celles avec phase = null sont à compléter) :
${JSON.stringify(actions?.map((a: any) => ({ id: a.id, task: a.task, description: a.description, category: a.category, assignee: a.assignee, phase: a.phase })))}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await anthropicRes.json();
    const rawText = aiData.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in response:", rawText);
      return new Response(JSON.stringify({ error: "Réponse IA invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const updates = parsed.updates || [];

    // Apply updates
    let updatedCount = 0;
    for (const update of updates) {
      if (!update.action_id || !update.phase) continue;
      const { error } = await supabase
        .from("actions")
        .update({ phase: update.phase })
        .eq("id", update.action_id);
      if (!error) updatedCount++;
      else console.error("Update error:", error);
    }

    return new Response(JSON.stringify({ updated: updatedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assign-phases error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
