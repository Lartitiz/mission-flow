import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu structures les notes brutes d'une session de suivi avec un·e client·e en une fiche SYNTHÉTIQUE et lisible d'un coup d'œil.

RÈGLE N°1 — SYNTHÈSE, PAS EXHAUSTIVITÉ : tu produis un résumé clair et resserré. Cible : environ 30-40% de la longueur des notes brutes. Pas de paraphrase systématique, pas de mur de texte. Tu vas à l'essentiel.

RÈGLE N°2 — PRIORITÉS À RESTITUER : décisions prises, chiffres/tarifs/dates, livrables validés, blocages, retours client marquants, prochaines étapes. Le reste (détails de discussion, allers-retours, hésitations) peut être omis ou condensé en une ligne.

RÈGLE N°3 — VERBATIMS COURTS UNIQUEMENT : garde entre guillemets uniquement les expressions vraiment révélatrices du ressenti client (1-2 max par section). Pas de citation longue.

RÈGLE N°4 — FORMAT LISIBLE : privilégie les listes à puces courtes plutôt que les paragraphes denses. Phrases brèves. Une idée par puce.

Sections fixes (utilise exactement ces titres, dans cet ordre, et n'inclus que celles qui ont du contenu) :

1. "Résultats clés" — 2-4 phrases qui résument l'essentiel de la session.
2. "Décisions prises" — liste à puces des arbitrages validés (avec chiffres/dates si évoqués).
3. "Retours client·e" — 2-4 puces, verbatims courts si utile.
4. "Points de vigilance" — blocages, frustrations, risques identifiés.
5. "Actions à mener" — qui fait quoi (Laetitia / décisionnaires côté client), avec deadline si mentionnée.

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "..." }] }

Ton : professionnel, chaleureux, direct. Écriture inclusive point médian. Utilise "tu". Pas de jargon corporate (ROI, lead magnet, KPI, etc.).`;

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
        max_tokens: 2500,
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
