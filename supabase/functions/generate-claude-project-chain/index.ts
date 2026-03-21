import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHASE_PROMPTS: Record<string, string> = {
  A: `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères les prompts de la PHASE A (Recherche) pour un projet client.

La phase A couvre : audits de l'existant, analyse concurrentielle, vérification des comptes/site, recherche de marché.

RÈGLE FONDAMENTALE : les prompts que tu génères sont des INSTRUCTIONS DE TRAVAIL pour un autre Claude dans un projet dédié. Ils doivent demander à Claude de FAIRE le travail de recherche, pas de deviner les résultats. Chaque prompt doit demander des recherches web réelles et produire des observations factuelles.

Génère entre 2 et 5 prompts de recherche adaptés à CETTE cliente et à SES canaux/missions spécifiques.

Règles pour chaque prompt :
- Rappeler qui est la cliente et ce qu'on cherche
- Demander des recherches WEB RÉELLES (pas de la réorganisation de contexte)
- Le format de sortie est "chat" ou "preview" (c'est de l'investigation, pas des livrables)
- Le prompt doit PRODUIRE des observations, pas poser des questions à Laetitia à ce stade
- Ne PAS inventer de données, de chiffres, de noms de concurrents — le prompt demande à Claude de les CHERCHER

CONCISION : chaque prompt fait 100-200 mots max. Le prompt système du projet contient déjà le contexte client, le ton, les red flags — ne les répète pas.

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

La phase B couvre : positionnement, messages clés, ligne éditoriale, choix structurants. C'est la phase où Laetitia TRANCHE.

RÈGLE FONDAMENTALE : les prompts phase B DÉPENDENT des résultats de la phase A. Ils ne doivent JAMAIS inventer des options stratégiques à partir de rien. Ils doivent :
1. S'appuyer explicitement sur les résultats des audits phase A ("À partir de l'audit Instagram réalisé à l'étape X...")
2. Poser des QUESTIONS OUVERTES à Laetitia, pas des QCM avec options pré-remplies
3. Demander à Claude de présenter ses observations PUIS de poser les questions qui permettent de trancher

MAUVAIS EXEMPLE (ne fais JAMAIS ça) :
"Je vois 3 axes de positionnement possibles : Option A : l'innovation. Option B : l'expérience. Option C : le bridge culturel. Quel axe préfères-tu ?"
→ C'est mauvais parce que les options sont inventées sans recherche réelle.

BON EXEMPLE :
"À partir de l'analyse concurrentielle (étape 2) et de l'audit de la communication existante (étape 1), synthétise les forces et faiblesses identifiées, puis identifie les espaces de positionnement où la concurrence est faible. Présente tes observations à Laetitia avec les questions suivantes : qu'est-ce qui résonne le plus avec la vision de la cliente ? Y a-t-il des territoires qu'on doit exclure ? Quels sont les critères de décision prioritaires (budget, délai, cible) ?"

Au moins un prompt doit être une PAUSE STRATÉGIQUE (is_pause: true) : un moment où Laetitia doit valider avant de passer à la production. Le prompt de pause ne produit rien — il résume où on en est et liste les décisions à prendre.

Génère entre 2 et 4 prompts stratégiques.

CONCISION : chaque prompt fait 100-200 mots max. Pas de répétition du contexte client ni des red flags (déjà dans le prompt système).

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

La phase C couvre : tous les livrables concrets. Un prompt = un livrable (ou un batch de livrables similaires) = un fichier.

RÈGLE FONDAMENTALE : chaque prompt de production s'appuie sur les décisions validées aux phases A et B. Il dit explicitement : "En suivant le positionnement validé à l'étape X et la ligne éditoriale définie à l'étape Y, produis..."

Les prompts ne réinventent PAS la stratégie. Ils EXÉCUTENT ce qui a été décidé.

Adaptation au profil cliente :
- Cliente débutante/débordée → prompts qui produisent du prêt-à-publier ("rédige le post complet, prêt à copier-coller")
- Cliente avancée → prompts en co-création ("affine et enrichis le brouillon fourni par la cliente")
- Structure avec équipe → livrables modulaires ("produis un document avec des briques que l'équipe peut piocher")

Regrouper les livrables similaires : 4 posts Instagram = 1 prompt "batch contenus Instagram", pas 4 prompts séparés.

CONCISION : chaque prompt fait 100-200 mots max. Le prompt système contient le ton, les red flags, les règles de style — ne les répète pas dans chaque prompt. Concentre-toi sur ce qui est SPÉCIFIQUE à ce livrable : le format de sortie, la structure attendue, le matériau source (quel livrable précédent utiliser).

Signale en WARNING si le volume de livrables estimé semble dépasser le budget horaire de la mission.

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
        model: "claude-opus-4-20250514",
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
