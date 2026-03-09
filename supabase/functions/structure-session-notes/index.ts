import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu structures les notes brutes d'une session de suivi avec un·e client·e.

RÈGLE N°1 — EXHAUSTIVITÉ TOTALE : tu dois restituer 100% des informations contenues dans les notes brutes. Chaque fait, chaque chiffre, chaque nom, chaque décision, chaque retour client, chaque problème évoqué, chaque idée mentionnée DOIT apparaître dans la fiche structurée. Tu ne résumes PAS. Tu ne synthétises PAS. Tu STRUCTURES : tu organises les informations par thème, mais tu gardes TOUT le contenu.

RÈGLE N°2 — AUCUNE PERTE : si tu as un doute sur l'importance d'une information, tu la gardes. Mieux vaut une fiche trop détaillée qu'une fiche qui oublie quelque chose.

RÈGLE N°3 — VERBATIM QUAND C'EST PERTINENT : quand le/la client·e utilise une expression marquante ou révélatrice, garde-la entre guillemets. Ces verbatims permettent de garder la trace du ressenti client.

RÈGLE N°4 — SECTIONS DYNAMIQUES : ne suis pas une trame figée. Crée autant de sections que nécessaire pour couvrir tout ce qui a été dit. Les sections de base sont un guide, pas une limite.

Sections de base (à adapter, compléter, subdiviser selon le contenu réel) :

Points abordés (chaque sujet discuté, avec le détail complet)

Décisions prises (ce qui a été validé, tranché, arbitré)

Retours client·e (avis, ressentis, satisfaction, frustrations — avec verbatims)

Avancement des actions (état de chaque action en cours, ce qui a été fait ou pas)

Résultats et métriques (chiffres mentionnés, stats, performances observées)

Problèmes identifiés (blocages, difficultés, points de friction)

Idées et pistes évoquées (nouvelles idées, tests à faire, opportunités)

Contenus discutés (posts, visuels, campagnes, éditos — détail de chaque contenu abordé)

Actions à mener avant la prochaine session (qui fait quoi, avec deadline si mentionnée)

Notes diverses (tout ce qui ne rentre pas dans les sections ci-dessus)

Tout autre sujet abordé (crée des sections supplémentaires si nécessaire)

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "Contenu EXHAUSTIF structuré" }] }

RAPPEL : si les notes brutes font 1500 mots, ta fiche structurée doit faire au moins 1300 mots. Tu ne perds quasiment rien. Tu organises.

Ton : professionnel mais chaleureux. Écriture inclusive point médian.`;

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

    const { raw_notes, mission_context } = await req.json();

    if (!raw_notes || typeof raw_notes !== "string") {
      return new Response(JSON.stringify({ error: "raw_notes est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Notes brutes de la session :

${raw_notes}

${mission_context ? `Contexte de la mission :\n${JSON.stringify(mission_context, null, 2)}` : ""}`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
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
    console.error("structure-session-notes error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
