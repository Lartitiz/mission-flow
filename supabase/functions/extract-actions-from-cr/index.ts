import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu analyses un compte-rendu de réunion pour en extraire les actions à faire.

Tu reçois aussi la liste des actions existantes pour éviter les doublons et pour proposer des mises à jour de statut.

Extrais :
- NOUVELLES ACTIONS : tâches mentionnées qui n'existent pas encore
- MISES À JOUR : changements de statut, de date, ou de description pour des actions existantes

RÈGLE CRITIQUE — ÉQUILIBRE LAETITIA / CLIENT·E :
Pour CHAQUE sujet abordé dans le CR, tu te poses systématiquement DEUX questions :
1. "Qu'est-ce que Laetitia doit faire ?" → action avec assignee="laetitia"
2. "Qu'est-ce que le/la décisionnaire côté client doit faire ?" → action avec assignee="client"

Les actions client typiques à NE PAS oublier :
- Validations à donner (sur un visuel, un texte, une offre, un tarif)
- Contenus à fournir (photos, textes, témoignages, chiffres internes)
- Décisions à prendre (arbitrages stratégiques, choix d'options)
- Infos à transmettre (accès comptes, documents, contacts)
- Retours à faire (feedback sur livrable, relecture)
- Tests/expérimentations à mener côté terrain
- RDV/échanges à organiser de leur côté (équipe interne, prestataire)

Si le CR mentionne un livrable de Laetitia, il y a presque toujours une action client associée (valider, relire, partager). Ne te limite JAMAIS aux seules tâches de Laetitia.

Pour chaque nouvelle action, détermine :
- assignee : "laetitia" ou "client"
- category : la catégorie la plus adaptée parmi : Cadrage, Messages, Site web, Social media, Emailing, Branding, Cross-posting, Influence/Presse, Formation, Commercial, Support, Préparation session, Finalisation, Autre
- task : intitulé court (verbe d'action)
- description : détail (1-2 phrases)
- channel : si applicable, parmi : Instagram, LinkedIn, Pinterest, Site web, Brevo, Facebook, Telegram/WhatsApp, Identité, Orga, Autre
- target_date : si mentionnée (format YYYY-MM-DD)
- phase : la phase temporelle de l'action. Pour un accompagnement Binôme 6 mois : "mois_1_2", "mois_3", "mois_4_5", "mois_6". Pour Agency 3 mois : "mois_1", "mois_2", "mois_3". Mission courte : "phase_1", "phase_2". Récurrent : "continu".

Réponds UNIQUEMENT en JSON valide : { "new_actions": [{ "assignee": "...", "category": "...", "task": "...", "description": "...", "channel": "...", "target_date": "...", "phase": "..." }], "updates": [{ "action_id": "...", "field": "status|target_date|description", "old_value": "...", "new_value": "...", "reason": "..." }] }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meeting_notes, existing_actions, mission_type } = await req.json();

    if (!meeting_notes || typeof meeting_notes !== "string") {
      return new Response(JSON.stringify({ error: "meeting_notes est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Compte-rendu de réunion :

${meeting_notes}

Actions existantes :
${JSON.stringify(existing_actions ?? [], null, 2)}

Type de mission : ${mission_type || "non_determine"}`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 170000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erreur API Claude" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;
    if (!textContent) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonStr = textContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Invalid JSON from Claude:", textContent);
      return new Response(JSON.stringify({ error: "Réponse JSON invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-actions-from-cr error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
