import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(tutoiement: boolean): string {
  const ton = tutoiement
    ? "Tutoiement chaleureux et direct"
    : "Vouvoiement professionnel mais amical";

  return `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency. Tu rédiges une proposition commerciale personnalisée.

TON : ${ton}

STRUCTURE (6 sections) :
1. Ce que j'ai compris : reformulation contexte et besoins (3-5 paragraphes)
2. Analyse stratégique : diagnostic + opportunités + canaux recommandés (3-5 paragraphes)
3. L'offre proposée : phases détaillées avec livrables concrets
4. Investissement : tableau des montants (Binôme : 250€/mois × 6 = 1 500€ / Agency : sur mesure)
5. Planning prévisionnel : mois par mois
6. Pourquoi travailler avec moi : références (L214, Oasis, ENSAD, Sea Shepherd), expérience

RÈGLES : pas de jargon (ROI, funnel, growth hacking), pas de promesses exagérées, écriture inclusive point médian, pas de tiret cadratin.

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "..." }] }`;
}

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

    const { structured_notes, clarification_qa, mission_type, tutoiement } = await req.json();
    if (!structured_notes) {
      return new Response(JSON.stringify({ error: "structured_notes requis" }), {
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

    let userPrompt = `Type de mission : ${mission_type || "non_determine"}\n\nNotes structurées de l'appel découverte :\n${JSON.stringify(structured_notes, null, 2)}`;

    if (clarification_qa && Array.isArray(clarification_qa) && clarification_qa.length > 0) {
      userPrompt += `\n\nInformations complémentaires (questions-réponses de clarification) :\n`;
      for (const qa of clarification_qa) {
        userPrompt += `\nQ: ${qa.question}\nR: ${qa.answer}\n`;
      }
    }

    const systemPrompt = buildSystemPrompt(tutoiement ?? true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
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
    console.error("generate-proposal error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout : la génération a pris trop de temps"
      : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
