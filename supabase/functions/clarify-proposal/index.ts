import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu analyses les notes structurées d'un appel découverte pour vérifier si tu as assez d'informations pour rédiger une proposition commerciale PERSONNALISÉE.

CONTEXTE : Laetitia vient de terminer un appel découverte. Les notes structurées contiennent tout ce qui a été dit. Ton rôle est d'identifier les TROUS : les informations qui manquent pour rédiger une proposition sur mesure.

IMPORTANT : tes questions doivent être CONTEXTUALISÉES. Tu as lu les notes. Tu sais de quoi le projet parle. Ne pose JAMAIS de questions génériques. Chaque question doit référencer un élément précis de la conversation.

MAUVAIS (générique) : "Quel est ton budget ?"
BON (contextualisé) : "Tu m'as parlé de refaire tout ton branding + lancer une newsletter, mais on n'a pas parlé budget. Tu as une enveloppe en tête pour tout ça ?"

MAUVAIS : "Quel type d'accompagnement tu cherches ?"
BON : "Vu que tu gères déjà tes réseaux toute seule depuis 2 ans, tu préfères qu'on construise ensemble la stratégie et que tu appliques, ou que je prenne en main certains canaux ?"

VÉRIFIE si les notes contiennent ces informations (en te basant sur ce qui a RÉELLEMENT été dit) :

Le périmètre concret : quels canaux, quelles actions spécifiques sont attendues (pas juste "de la com'" mais quoi exactement)

Le budget ou une indication de fourchette

Le calendrier : y a-t-il une urgence, un lancement, un événement qui impose un timing ?

Le format d'accompagnement souhaité : faire ensemble (binôme) ou déléguer (agency) ou pas clair ?

Le processus de décision : qui valide ? Seul·e ou CA/bureau/associé·e ?

Si TOUT est suffisamment clair pour rédiger une proposition personnalisée, réponds : { "needs_clarification": false, "questions": [] }

Si des informations manquent, pose MAXIMUM 3 questions. Chaque question doit :

Citer un élément précis de la conversation ("Tu m'as dit que...", "Quand tu parlais de...")

Être formulée comme Laetitia parlerait (directe, chaleureuse, tu ou vous selon le type de mission)

Aider concrètement à calibrer la proposition (pas de question "pour faire joli")

Réponds UNIQUEMENT en JSON valide : { "needs_clarification": true/false, "questions": ["question 1", "question 2"] }`;

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

    const { structured_notes, mission_type } = await req.json();
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

    const userPrompt = `Type de mission : ${mission_type || "non_determine"}\n\nNotes structurées :\n${JSON.stringify(structured_notes, null, 2)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
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
    console.error("clarify-proposal error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout : l'analyse a pris trop de temps"
      : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
