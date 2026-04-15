import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INPUT_CHARS = 40000;

const systemPrompt = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu reçois le contenu texte d'une proposition commerciale existante et tu dois le structurer au format standard de l'outil.

RÈGLE ABSOLUE : NE RIEN PERDRE. Tout le contenu de la proposition doit être conservé. Tu réorganises dans les sections standard mais tu ne supprimes rien.

Identifie et structure le contenu dans ces sections (adapte les titres selon ce qui est réellement dans le texte) :

"Ce que j'ai compris" — la partie où Laetitia reformule le contexte et les besoins du client

"Analyse stratégique" ou "Le vrai sujet stratégique" — les recommandations et le diagnostic

"L'offre proposée" ou "Ma proposition" — le détail des phases et livrables

"Investissement" — les prix, montants, modalités de paiement

"Planning prévisionnel" — le calendrier des étapes

"Pourquoi travailler avec moi" — les références et différenciateurs

Si certaines sections n'existent pas dans le texte original, ne les invente pas. Crée uniquement les sections pour lesquelles il y a du contenu.

Si le texte contient des sections supplémentaires (objectifs, ce qui est inclus/exclus, conditions, etc.), crée des sections additionnelles pour les conserver.

IMPORTANT : Ta réponse doit être du JSON valide et COMPLET. Ne coupe jamais ta réponse.

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "..." }] }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { raw_text, mission_type } = await req.json();

    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Texte trop court ou manquant." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configurée");

    // Truncate input if too long
    const truncatedText = raw_text.length > MAX_INPUT_CHARS
      ? raw_text.substring(0, MAX_INPUT_CHARS) + "\n\n[... texte tronqué pour respecter les limites]"
      : raw_text;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Voici le texte de la proposition commerciale à structurer :\n\nType de mission : ${mission_type || "non déterminé"}\n\n---\n\n${truncatedText}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error("Erreur API IA");
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    if (!text) throw new Error("Réponse IA vide");

    // Check if response was truncated (stop_reason !== "end_turn")
    const stopReason = result.stop_reason;
    if (stopReason === "max_tokens") {
      console.error("Response truncated by max_tokens");
      // Try to repair truncated JSON
      const repaired = repairTruncatedJson(text);
      if (repaired) {
        return new Response(JSON.stringify(repaired), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("La proposition est trop longue pour être structurée en une seule fois. Essaie de coller un texte plus court.");
    }

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Réponse IA non parseable");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error("Format de sections invalide");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-proposal error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout — la proposition est trop longue. Essaie de coller un texte plus court."
      : e instanceof Error ? e.message : "Erreur interne";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function repairTruncatedJson(text: string): { sections: Array<{ title: string; content: string }> } | null {
  try {
    // Find the start of the JSON
    const startIdx = text.indexOf('{"sections"');
    if (startIdx === -1) return null;

    let jsonStr = text.substring(startIdx);

    // Try parsing as-is first
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.sections) return parsed;
    } catch { /* continue with repair */ }

    // Find all complete section objects
    const sections: Array<{ title: string; content: string }> = [];
    const sectionRegex = /\{\s*"title"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\s*,\s*"content"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\s*\}/g;
    let match;
    while ((match = sectionRegex.exec(jsonStr)) !== null) {
      sections.push({
        title: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
        content: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      });
    }

    if (sections.length > 0) {
      console.log(`Repaired truncated JSON: recovered ${sections.length} sections`);
      return { sections };
    }

    return null;
  } catch {
    return null;
  }
}
