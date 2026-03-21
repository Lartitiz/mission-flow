import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHASE_PROMPTS: Record<string, string> = {
  A: `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères les prompts de la PHASE A (Recherche) pour un projet client.

La phase A couvre : audits de l'existant, analyse concurrentielle, vérification des comptes/site, recherche de marché. C'est le travail d'investigation AVANT de produire quoi que ce soit.

Tu reçois : un résumé de la mission et le prompt système du projet.

Génère entre 2 et 5 prompts de recherche adaptés à CETTE cliente. Chaque prompt DOIT demander des recherches web réelles (pas juste de la réorganisation de contenu).

Règles :
- Chaque prompt rappelle qui est la cliente et ce qu'on cherche
- Chaque prompt spécifie le format de sortie (souvent "chat" ou "preview" pour cette phase, car c'est de l'investigation)
- Les prompts doivent être intelligents : poser des questions, signaler les incohérences
- Adapter au contexte : si Instagram est un canal, auditer Instagram. Si site web, auditer le site. Si pas de canal digital, analyser le marché local.

Génère aussi des WARNINGS si tu détectes des infos manquantes ou des incohérences.

Réponds UNIQUEMENT en JSON valide :
{
  "prompts": [
    { "order": 1, "title": "Titre court", "prompt": "Le prompt complet", "output_format": "chat", "depends_on": null, "is_pause": false }
  ],
  "warnings": [
    { "type": "missing_info", "message": "Description" }
  ]
}`,

  B: `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères les prompts de la PHASE B (Stratégie) pour un projet client.

La phase B couvre : positionnement, messages clés, ligne éditoriale, choix des canaux, ton et style, décisions structurantes. C'est la phase où Laetitia TRANCHE.

Tu reçois : un résumé de la mission, le prompt système du projet, et les prompts de la phase A déjà générés (pour connaître les dépendances).

Génère entre 2 et 4 prompts stratégiques. Les prompts DOIVENT poser des questions à Laetitia pour qu'elle tranche. Proposer 2 directions opposées quand pertinent ("Option A : on mise sur Instagram + newsletter. Option B : on mise sur LinkedIn + blog. Qu'est-ce qui te parle le plus pour cette cliente ?").

Au moins un prompt doit être une PAUSE STRATÉGIQUE (is_pause: true) : un moment où Laetitia doit valider les grandes orientations avant de passer à la production.

Règles :
- Chaque prompt spécifie ce qu'il faut décider
- Chaque prompt s'appuie sur les résultats attendus de la phase A
- Les prompts ne produisent pas de fichiers finaux, ils préparent les décisions
- Format de sortie : "chat" ou "preview" (pas de .docx à ce stade)

Réponds UNIQUEMENT en JSON valide :
{
  "prompts": [
    { "order": 1, "title": "Titre court", "prompt": "Le prompt complet", "output_format": "chat", "depends_on": null, "is_pause": false }
  ],
  "warnings": [
    { "type": "missing_info", "message": "Description" }
  ]
}`,

  C: `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères les prompts de la PHASE C (Production) pour un projet client.

La phase C couvre : tous les livrables concrets, dans l'ordre des dépendances. Un prompt = un livrable = un fichier.

Tu reçois : un résumé de la mission, le prompt système du projet, et les prompts des phases A et B déjà générés.

Génère les prompts de production adaptés aux livrables identifiés dans la proposition commerciale et le plan d'actions. Chaque livrable mentionné doit avoir son prompt.

Adaptation au profil :
- Cliente débutante/débordée : prompts qui produisent du prêt-à-publier
- Cliente avancée : prompts en mode co-création
- Structure avec équipe : livrables modulaires que l'équipe peut piocher

Règles :
- Un prompt = un livrable = un fichier (.docx, .xlsx, .pptx)
- Chaque prompt rappelle le contexte, le ton, les red flags
- Chaque prompt identifie le matériau source (quel livrable précédent est nécessaire)
- Prévoir des étapes de preview (format "preview") avant les fichiers finaux complexes
- Respecter l'ordre des dépendances (le positionnement avant les contenus, le branding avant les templates)

Signale en WARNING si le volume de livrables semble dépasser le budget horaire de la mission.

IMPORTANT : sois concis dans les prompts. Chaque prompt fait 150-250 mots maximum. Ne développe pas les instructions évidentes (le prompt système du projet contient déjà les règles de ton, les red flags, etc. — ne les répète pas dans chaque prompt). Concentre-toi sur ce qui est SPÉCIFIQUE à ce livrable.

Si la mission a plus de 6 livrables de production, regroupe les livrables similaires (par exemple : 4 posts Instagram = 1 seul prompt "batch contenus Instagram", pas 4 prompts séparés).

Réponds UNIQUEMENT en JSON valide :
{
  "prompts": [
    { "order": 1, "title": "Titre court", "prompt": "Le prompt complet", "output_format": ".docx", "depends_on": null, "is_pause": false }
  ],
  "warnings": [
    { "type": "missing_info", "message": "Description" }
  ]
}`
};

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

    const { context_summary, prompt_system, phase, previous_prompts } = await req.json();

    if (!context_summary || !prompt_system || !phase) {
      return new Response(JSON.stringify({ error: "context_summary, prompt_system et phase requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PHASE_PROMPTS[phase]) {
      return new Response(JSON.stringify({ error: "Phase invalide. Utiliser A, B ou C." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userPrompt = context_summary + "\n\n## PROMPT SYSTÈME DU PROJET\n\n" + prompt_system;

    if (previous_prompts && Array.isArray(previous_prompts) && previous_prompts.length > 0) {
      userPrompt += "\n\n## PROMPTS DÉJÀ GÉNÉRÉS (phases précédentes)\n\n";
      previous_prompts.forEach((p: any) => {
        userPrompt += "- Étape " + p.order + " [Phase " + p.phase + "] : " + p.title + " (" + p.output_format + ")\n";
      });
    }

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
        max_tokens: 4096,
        system: PHASE_PROMPTS[phase],
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erreur API Claude phase " + phase }), {
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
      console.error("Invalid JSON phase " + phase + ":", text.slice(0, 500));
      return new Response(JSON.stringify({ error: "JSON invalide phase " + phase + ". Réessaie." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-claude-project-chain error:", e);
    const msg = e instanceof Error && e.name === "AbortError"
      ? "La génération a pris trop de temps (phase " + phase + "). Réessaie — ça fonctionne souvent au 2e essai."
      : "Erreur interne";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
