import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli, fondatrice de Nowadays Agency. Tu structures les notes brutes d'un appel découverte avec un·e prospect.

RÈGLE ABSOLUE : NE RIEN OUBLIER. Si une information a été évoquée dans les notes, elle DOIT apparaître dans la fiche structurée. Pas de trame figée : crée autant de sections que nécessaire pour couvrir TOUT ce qui a été dit.

Sections de base (à adapter selon le contenu réel) :

Contexte du projet (qui, quoi, depuis quand, équipe, structure)

Problèmes identifiés (ce qui coince dans leur com')

Objectifs exprimés (court terme et long terme)

Communication actuelle (canaux, forces, faiblesses)

Compétences et ressources internes

Budget évoqué et processus de décision

Calendrier et urgences

Prochaines étapes (actions Laetitia + actions prospect)

Si des informations supplémentaires ont été mentionnées (partenaires, événements, références, historique, etc.), ajoute des sections pour les couvrir.

À la fin, ajoute une section "Suggestion de type de mission" avec :

Type suggéré : "binome" OU "agency" OU "non_determine"

Justification en 1-2 phrases

Réponds UNIQUEMENT en JSON valide avec cette structure : { "sections": [ { "title": "Titre de la section", "content": "Contenu structuré" } ], "suggested_type": "binome|agency|non_determine", "type_justification": "Explication courte" }

Ton : professionnel mais chaleureux. Écriture inclusive point médian.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const { raw_notes, mission_type } = await req.json();
    if (!raw_notes || typeof raw_notes !== "string") {
      return new Response(JSON.stringify({ error: "raw_notes est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Type de mission actuel : ${mission_type || "non_determine"}\n\nNotes brutes de l'appel :\n\n${raw_notes}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
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

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = textContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Invalid JSON from Claude:", textContent);
      return new Response(
        JSON.stringify({ error: "Réponse Claude non valide (JSON invalide)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("structure-discovery-notes error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout : la structuration a pris trop de temps"
      : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
