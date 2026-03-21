import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères la chaîne de prompts de travail pour un projet client.

Tu reçois : le contexte de la mission ET le prompt système déjà généré.

Génère une liste de prompts de travail adaptés à CETTE cliente. Pas des templates génériques.

Structure en 3 phases :
- Phase A (Recherche) : audits, analyse concurrentielle. Les prompts DOIVENT demander des recherches web.
- Phase B (Stratégie) : positionnement, messages clés. Les prompts DOIVENT poser des questions à Laetitia. Proposer 2 directions opposées quand pertinent.
- Phase C (Production) : livrables dans l'ordre des dépendances. Un prompt = un livrable = un fichier.

Règles par prompt :
- Rappeler le contexte (qui, où on en est)
- Spécifier le format de sortie (.docx, .xlsx, .pptx)
- Spécifier le ton et les red flags
- Identifier le matériau source (quel livrable précédent)
- Prévoir des previews avant fichiers finaux quand pertinent
- Les prompts doivent poser des questions et challenger, pas juste exécuter

Adaptation au profil :
- Cliente débutante/débordée : du prêt-à-publier
- Cliente avancée : co-création
- Structure avec équipe : livrables modulaires

Génère aussi des WARNINGS :
- Infos manquantes
- Risques de surproduction (volume vs budget)
- Dépendances bloquantes
- Incohérences proposition/kick-off

Réponds UNIQUEMENT en JSON valide :
{
  "prompt_chain": [
    { "order": 1, "phase": "A", "title": "Titre court", "prompt": "Le prompt complet", "output_format": ".docx", "depends_on": null, "is_pause": false }
  ],
  "warnings": [
    { "type": "missing_info", "message": "Description" }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { context, prompt_system } = await req.json();
    if (!context || !prompt_system) {
      return new Response(JSON.stringify({ error: "context et prompt_system requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = context + "\n\n## PROMPT SYSTÈME DÉJÀ GÉNÉRÉ\n\n" + prompt_system;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

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
      console.error("Anthropic error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erreur API Claude" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text;
    if (!text) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Robust JSON parsing
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const first = jsonStr.indexOf("{");
      const last = jsonStr.lastIndexOf("}");
      if (first !== -1 && last > first) jsonStr = jsonStr.slice(first, last + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Invalid JSON:", text.slice(0, 500));
      return new Response(JSON.stringify({ error: "JSON invalide. Réessaie." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      prompt_chain: Array.isArray(parsed.prompt_chain) ? parsed.prompt_chain : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-claude-project-chain error:", e);
    const msg = e instanceof Error && e.name === "AbortError" ? "Timeout étape 2" : "Erreur interne";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
