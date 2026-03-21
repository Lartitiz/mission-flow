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

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL dans une conversation du projet Claude. Il n'a PAS accès aux résultats des autres prompts. Il a accès au prompt système du projet (contexte client, règles, red flags) et aux documents uploadés. Donc :
- Ne JAMAIS écrire "à l'étape X" ou "résultats de l'étape précédente"
- Écrire plutôt "à partir des informations du projet" ou "en te basant sur le contexte client"
- Chaque prompt doit être compréhensible et exécutable de façon indépendante

Génère entre 2 et 5 prompts de recherche adaptés à CETTE cliente et à SES canaux/missions.

Règles pour chaque prompt :
- Rappeler brièvement qui est la cliente et ce qu'on cherche
- Demander des recherches WEB RÉELLES (pas de la réorganisation de contexte)
- Format de sortie : "chat" (c'est de l'investigation, pas des livrables)
- Le prompt doit PRODUIRE des observations, pas poser des questions à Laetitia à ce stade
- Ne PAS inventer de données — le prompt demande à Claude de les CHERCHER

CONCISION : chaque prompt fait 100-200 mots max.

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

RÈGLE FONDAMENTALE : les prompts phase B s'appuient sur le travail de recherche fait en phase A. Ils ne doivent JAMAIS inventer des options stratégiques à partir de rien. Ils doivent :
1. Demander à Claude de synthétiser les observations issues des audits (disponibles dans le projet)
2. Poser des QUESTIONS OUVERTES à Laetitia, pas des QCM avec options pré-remplies
3. Laisser Claude présenter ses observations PUIS poser les questions qui permettent de trancher

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL dans une conversation du projet Claude. Il n'a PAS accès aux conversations précédentes. Il a accès au prompt système et aux documents uploadés (dont les audits réalisés en phase A que Laetitia aura uploadés). Donc :
- Ne JAMAIS écrire "à l'étape 2" ou "en suivant l'étape X"
- Écrire "à partir de l'audit Instagram disponible dans le projet" ou "en te basant sur l'analyse concurrentielle uploadée"
- Nommer les LIVRABLES par leur nom, pas par leur numéro

MAUVAIS EXEMPLE (ne fais JAMAIS ça) :
"Je vois 3 axes possibles : Option A, Option B, Option C. Lequel préfères-tu ?"

BON EXEMPLE :
"À partir de l'analyse concurrentielle et de l'audit de communication (documents disponibles dans le projet), synthétise les forces, faiblesses et espaces libres identifiés. Puis pose à Laetitia les questions qui permettent de trancher le positionnement : qu'est-ce qui résonne avec la vision de la cliente ? Quels territoires exclure ? Quels critères prioriser (budget, délai, cible) ?"

Au moins un prompt doit être une PAUSE STRATÉGIQUE (is_pause: true) : un moment où on résume les décisions prises et celles qui restent à prendre.

Génère entre 2 et 4 prompts. CONCISION : 100-200 mots chacun.

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

RÈGLE FONDAMENTALE : chaque prompt de production s'appuie sur les décisions stratégiques validées. Il ne réinvente PAS la stratégie, il EXÉCUTE ce qui a été décidé.

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL dans une conversation du projet Claude. Il n'a PAS accès aux conversations précédentes. Il a accès au prompt système (contexte, ton, red flags) et aux documents uploadés (audits, positionnement validé, ligne éditoriale, etc.). Donc :
- Ne JAMAIS écrire "en suivant le positionnement validé à l'étape 5"
- Écrire "en suivant le positionnement et les messages clés validés (documents disponibles dans le projet)"
- Nommer les documents sources explicitement par leur NOM, pas par un numéro d'étape
- Chaque prompt doit être exécutable de façon indépendante

RÈGLE DU DESTINATAIRE : chaque prompt précise QUI va utiliser le livrable et COMMENT. Un calendrier éditorial pour une solopreneuse débutante (qui va l'appliquer seule) n'est pas structuré pareil qu'un document stratégique pour une coopérative (qui sera présenté en CA). Le profil de la cliente est dans le kick-off — l'utiliser.

RÈGLE POST-LIVRABLE : chaque prompt de production demande EN PLUS du fichier :
- Un résumé en 3-5 lignes de ce qui a été produit (pour que Laetitia puisse l'envoyer à la cliente sans relire tout le document)
- La liste des prochaines actions (ce que Laetitia doit faire, ce que la cliente doit faire)

Adaptation au profil :
- Cliente débutante/débordée → prêt-à-publier, actionnable immédiatement
- Cliente avancée → co-création, affinage de ses brouillons
- Structure avec équipe → briques modulables que l'équipe pioche

Regrouper les livrables similaires (4 posts Instagram = 1 prompt batch, pas 4 prompts).

CONCISION : chaque prompt fait 100-200 mots max. Ne pas répéter le ton, les red flags, les règles de style (déjà dans le prompt système). Se concentrer sur : le format de sortie, la structure du livrable, les documents sources nécessaires, le destinataire final.

Signale en WARNING si le volume estimé semble dépasser le budget horaire.

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
