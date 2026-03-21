import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu structures les notes brutes d'un atelier de lancement (kick-off) avec un·e client·e.

RÈGLE N°1 — EXHAUSTIVITÉ TOTALE : tu dois restituer 100% des informations contenues dans les notes brutes. Chaque fait, chaque chiffre, chaque nom, chaque anecdote, chaque frustration exprimée, chaque objectif mentionné, chaque outil cité, chaque date évoquée, chaque détail personnel ou professionnel DOIT apparaître dans la fiche structurée. Tu ne résumes PAS. Tu ne synthétises PAS. Tu STRUCTURES : tu organises les informations par thème, mais tu gardes TOUT le contenu.

RÈGLE N°2 — AUCUNE PERTE : si tu as un doute sur l'importance d'une information, tu la gardes. Mieux vaut une fiche trop détaillée qu'une fiche qui oublie quelque chose. Les petits détails mentionnés en passant sont souvent les plus importants pour construire la stratégie.

RÈGLE N°3 — VERBATIM QUAND C'EST PERTINENT : quand le/la client·e utilise une expression marquante, une formulation qui révèle son état d'esprit, ses valeurs ou sa vision, garde-la entre guillemets. Ces verbatims sont précieux pour le positionnement et la stratégie.

RÈGLE N°4 — SECTIONS DYNAMIQUES : ne suis pas une trame figée. Crée autant de sections que nécessaire pour couvrir tout ce qui a été dit. Les sections de base sont un guide, pas une limite.

Sections de base (à adapter, compléter, subdiviser selon le contenu réel) :

Histoire et identité de marque (parcours, création, évolution, anecdotes fondatrices)

Valeurs et engagements (ce qui compte pour le/la client·e, ce qui le/la différencie)

Positionnement et mission (comment il/elle se définit, sa vision, sa promesse)

Identité visuelle et ton (charte existante, préférences, exemples aimés/détestés)

Offres et proposition de valeur (détail de chaque offre, prix, cible, positionnement)

Client·e idéal·e / Persona (profil détaillé, besoins, frustrations, comportement d'achat)

Communication actuelle — forces (ce qui marche, contenus performants, retours positifs)

Communication actuelle — faiblesses (ce qui coince, avec les mots du/de la client·e)

Objectifs validés (court terme, long terme, indicateurs de succès)

Canaux prioritaires (réseaux sociaux, site, newsletter, blog, etc. avec état actuel de chacun)

Assets à récupérer et accès à obtenir (photos, logos, accès réseaux, outils)

Compétences et ressources internes (qui fait quoi, temps disponible, outils maîtrisés)

Inspirations et références (marques, comptes, contenus qui inspirent le/la client·e)

Prochaines actions (actions Laetitia + actions client·e)

Tout autre sujet abordé (crée des sections supplémentaires pour chaque sujet non couvert ci-dessus)

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "Contenu EXHAUSTIF structuré" }] }

RAPPEL : si les notes brutes font 2000 mots, ta fiche structurée doit faire au moins 1800 mots. Tu ne perds quasiment rien. Tu organises.

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

    const { raw_notes, mission_type, proposal_content } = await req.json();

    if (!raw_notes || typeof raw_notes !== "string") {
      return new Response(JSON.stringify({ error: "raw_notes est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate very long notes to avoid timeout (max ~30000 chars ≈ 8000 tokens)
    const truncatedNotes = raw_notes.length > 30000 ? raw_notes.slice(0, 30000) + "\n\n[... notes tronquées pour des raisons de longueur]" : raw_notes;

    // Truncate proposal context too
    const proposalCtx = proposal_content ? JSON.stringify(proposal_content, null, 2) : "";
    const truncatedProposal = proposalCtx.length > 5000 ? proposalCtx.slice(0, 5000) + "..." : proposalCtx;

    const userPrompt = `Notes brutes du kick-off :

${truncatedNotes}

Type de mission : ${mission_type || "non_determine"}

${truncatedProposal ? `Contexte (proposition commerciale) :\n${truncatedProposal}` : ""}`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 140000);

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
    console.error("structure-kickoff-notes error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
