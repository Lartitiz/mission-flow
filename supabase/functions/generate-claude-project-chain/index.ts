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

RÈGLE FONDAMENTALE : les prompts sont des INSTRUCTIONS DE TRAVAIL pour un autre Claude dans un projet dédié. Ils demandent à Claude de FAIRE la recherche, pas de deviner les résultats.

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL dans une conversation du projet Claude. Il a accès au prompt système (contexte client) et aux documents uploadés par Laetitia.
- Ne JAMAIS écrire "à l'étape X"
- Nommer les documents sources par leur nom
- Chaque prompt est exécutable indépendamment

RÈGLE DE CASCADING : les prompts de recherche forment une séquence logique. Chaque prompt APRÈS le premier s'appuie sur les livrables des prompts précédents (que Laetitia aura uploadés dans le projet après validation).

- Le PREMIER prompt de la chaîne part des hypothèses du kick-off comme point de départ à vérifier. C'est le SEUL qui a le droit de citer les hypothèses brutes de la cliente.
- Les prompts SUIVANTS s'appuient sur les documents produits par les prompts précédents. Ils disent : "En te basant sur l'audit concurrentiel / l'analyse de marché / le benchmark disponible dans le projet..."
- Si un prompt de recherche dépend d'un livrable précédent, le dire explicitement : "Ce prompt nécessite que l'audit concurrentiel ait été réalisé et uploadé dans le projet."

RÈGLE NE PAS PRÉSUPPOSER : les informations du kick-off sont des HYPOTHÈSES. Les prompts doivent :
- Présenter les infos comme "La cliente pense que...", "L'hypothèse actuelle est que..."
- Demander à Claude de vérifier, pas de confirmer
- Ne PAS nommer de concurrents, médias, influenceurs spécifiques (Claude doit les TROUVER)
- Ne PAS pré-découper le terrain en catégories
- Signaler ce qui contredit les hypothèses initiales

Génère entre 2 et 5 prompts adaptés à CETTE cliente.

Règles :
- Format : "chat" pour l'exploratoire rapide, ".docx" pour les audits structurés
- Le premier prompt est le plus ouvert (exploration large). Les suivants affinent à partir des découvertes.
- Indiquer pour chaque prompt s'il dépend d'un livrable précédent (champ depends_on avec le titre du livrable, pas un numéro)

CONCISION : 100-200 mots par prompt.

Réponds UNIQUEMENT en JSON valide :
{
  "prompts": [
    { "order": 1, "title": "Titre court", "prompt": "Le prompt complet", "output_format": "chat ou .docx", "depends_on": null, "is_pause": false }
  ],
  "warnings": [
    { "type": "missing_info", "message": "Description" }
  ]
}`,

  B: `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères les prompts de la PHASE B (Stratégie) pour un projet client.

La phase B couvre : positionnement, messages clés, ligne éditoriale, choix structurants. C'est la phase où Laetitia TRANCHE.

RÈGLE FONDAMENTALE : les prompts phase B s'appuient sur les LIVRABLES produits en phase A (audits, analyses), PAS sur les hypothèses brutes du kick-off. Si la recherche a révélé que la cible ou le marché est différent de ce que la cliente pensait, c'est la recherche qui prime.

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL. Il a accès au prompt système et aux documents uploadés.
- Ne JAMAIS écrire "à l'étape X"
- Nommer les livrables par leur nom ("l'audit concurrentiel", "l'analyse Instagram")

RÈGLE NE PAS PRÉSUPPOSER : les prompts phase B ne reprennent JAMAIS les données brutes du kick-off (cible, concurrents, médias cités par la cliente). Ils s'appuient sur les audits.
- MAUVAIS : "Définis le positionnement pour les 40-60 ans face à Zafu et Lotuscrafts."
- BON : "À partir de l'audit concurrentiel et de l'analyse de marché (documents dans le projet), synthétise les segments identifiés et les espaces libres. La cible et les concurrents mentionnés au kick-off sont-ils confirmés par la recherche ? Pose les questions à Laetitia pour trancher."

Les prompts doivent :
1. Demander à Claude de synthétiser les observations des audits uploadés
2. Poser des QUESTIONS OUVERTES à Laetitia (pas des QCM)
3. Signaler les écarts entre hypothèses kick-off et réalité du marché

Au moins un prompt doit être une PAUSE STRATÉGIQUE (is_pause: true).

Génère entre 2 et 4 prompts. CONCISION : 100-200 mots.

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

RÈGLE FONDAMENTALE : chaque prompt de production s'appuie sur les DÉCISIONS VALIDÉES (documents uploadés : positionnement, ligne éditoriale, messages clés). Il ne réinvente PAS la stratégie, il EXÉCUTE ce qui a été décidé.

RÈGLE D'AUTONOMIE : chaque prompt sera copié-collé SEUL. Il a accès au prompt système et aux documents uploadés.
- Ne JAMAIS écrire "en suivant l'étape 5"
- Écrire "en suivant le positionnement validé (document dans le projet)"
- Nommer les documents sources par leur NOM

RÈGLE NE PAS PRÉSUPPOSER : les prompts phase C ne reprennent JAMAIS les données brutes du kick-off pour les éléments stratégiques (cible, positionnement, canaux, médias). Ils utilisent les décisions validées en phase B.
- MAUVAIS : "Recherche les médias wellness senior : Psychologies, Santé Magazine, Yanko Design."
- BON : "À partir du positionnement validé et des segments confirmés par la recherche (documents dans le projet), identifie les médias et influenceurs pertinents pour ce positionnement. Ne te limite pas aux médias mentionnés au kick-off : la recherche a pu révéler des opportunités plus pertinentes."

RÈGLE DU DESTINATAIRE : chaque prompt précise QUI va utiliser le livrable et COMMENT.

RÈGLE POST-LIVRABLE : chaque prompt demande EN PLUS du fichier :
- Un résumé en 3-5 lignes
- La liste des prochaines actions (Laetitia + cliente)

Adaptation au profil :
- Débutante/débordée → prêt-à-publier
- Avancée → co-création
- Structure avec équipe → briques modulables

Regrouper les livrables similaires.

CONCISION : 100-200 mots par prompt. Ne pas répéter le ton, red flags, règles de style (déjà dans le prompt système).

Signale en WARNING si le volume estimé dépasse le budget horaire.

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
