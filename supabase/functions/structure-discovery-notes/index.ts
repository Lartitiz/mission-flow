import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli, fondatrice de Nowadays Agency. Tu structures les notes brutes d'un appel découverte avec un·e prospect.

RÈGLE N°1 — EXHAUSTIVITÉ TOTALE : tu dois restituer 100% des informations contenues dans les notes brutes. Chaque fait, chaque chiffre, chaque nom, chaque anecdote, chaque frustration exprimée, chaque objectif mentionné, chaque outil cité, chaque date évoquée, chaque détail personnel ou professionnel DOIT apparaître dans la fiche structurée. Tu ne résumes PAS. Tu ne synthétises PAS. Tu STRUCTURES : tu organises les informations par thème, mais tu gardes TOUT le contenu.

RÈGLE N°2 — AUCUNE PERTE : si tu as un doute sur l'importance d'une information, tu la gardes. Mieux vaut une fiche trop détaillée qu'une fiche qui oublie quelque chose. Les petits détails mentionnés en passant sont souvent les plus importants pour construire la stratégie.

RÈGLE N°3 — VERBATIM QUAND C'EST PERTINENT : quand le/la prospect utilise une expression marquante, une formulation qui révèle son état d'esprit ou ses frustrations, garde-la entre guillemets. Exemples : "j'ai l'impression de parler dans le vide", "je sais pas quoi poster", "mon site ne sert à rien". Ces verbatims sont de l'or pour la proposition commerciale.

RÈGLE N°4 — SECTIONS DYNAMIQUES : ne suis pas une trame figée. Crée autant de sections que nécessaire pour couvrir tout ce qui a été dit. Si le prospect a parlé de 12 sujets différents, tu crées 12 sections (ou plus). Les sections de base sont un guide, pas une limite.

Sections de base (à adapter, compléter, subdiviser selon le contenu réel) :

Identité et contexte du projet (qui, quoi, depuis quand, équipe, structure juridique, CA, parcours)

Offres et produits/services (détail, prix, positionnement, cible par offre)

Client·e idéal·e (profil, besoins, frustrations, comportement d'achat)

Problèmes identifiés (tout ce qui coince, avec les mots du/de la prospect)

Objectifs exprimés (court terme, long terme, rêves, vision)

Communication actuelle (chaque canal mentionné avec son état : site, Instagram, LinkedIn, Pinterest, newsletter, blog, etc.)

Compétences et ressources internes (qui fait quoi, outils utilisés, temps disponible)

Expériences passées (prestataires précédents, formations suivies, ce qui a marché ou pas)

Budget et processus de décision (montant évoqué, qui décide, délai)

Calendrier et urgences (dates importantes, lancements, événements, saisonnalité)

Réseau et partenaires (contacts mentionnés, collaborations, prescripteurs)

Prochaines étapes (actions Laetitia + actions prospect)

Tout autre sujet abordé (crée des sections supplémentaires pour chaque sujet non couvert ci-dessus)

À la fin, ajoute une section "Suggestion de type de mission" avec :

Type suggéré : "binome" OU "agency" OU "non_determine"

Justification en 1-2 phrases

FORMAT DE SORTIE — Réponds UNIQUEMENT en JSON valide : { "sections": [ { "title": "Titre de la section", "content": "Contenu EXHAUSTIF structuré" } ], "suggested_type": "binome|agency|non_determine", "type_justification": "Explication courte" }

RAPPEL : si les notes brutes font 2000 mots, ta fiche structurée doit faire au moins 1800 mots. Tu ne perds quasiment rien. Tu organises.

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
        max_tokens: 8000,
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
