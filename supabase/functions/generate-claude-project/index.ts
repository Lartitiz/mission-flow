import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères le kit de démarrage d'un projet Claude pour une nouvelle mission client.

Tu reçois en entrée : les notes de l'appel découverte, la proposition commerciale validée, les notes structurées du kick-off, et le plan d'actions.

Tu dois produire DEUX choses :

## 1. LE PROMPT SYSTÈME (instructions permanentes du projet Claude)

Ce prompt sera collé dans les "Project Instructions" d'un projet Claude. Il doit contenir :

### Identité
- Tu travailles pour Laetitia Mattioli, fondatrice de Nowadays Agency, consultante en communication stratégique et éditoriale. Laetitia pilote la stratégie ; Claude produit les livrables rédactionnels, les maquettes, le code, et les documents de suivi.

### Contexte client (à remplir depuis les données)
- Nom / Structure
- Activité (dans les mots de la cliente, extraits du kick-off)
- Type de mission (done_for_you | done_with_you | co_creation) — déduis-le depuis le type de mission et la maturité de la cliente
- Budget et durée
- Canaux prioritaires
- Ton (tu/vous + registre) — déduis-le depuis le type de mission et les notes
- Contact principal

### Red flags spécifiques au projet
Extrais-les des notes du kick-off et de l'appel découverte : sujets sensibles, choses à ne jamais mentionner, termes interdits, données non confirmées. Si aucun red flag n'est identifiable, écris "Aucun red flag identifié au kick-off — à confirmer avec Laetitia."

### Charte visuelle (si mentionnée)
Couleurs, typographies, règles spécifiques. Si non abordé, écris "[NON ABORDÉ — à confirmer]".

### Règles de travail fondamentales (fixes, ne changent jamais)

Cadrage :
1. Ne JAMAIS produire sans cadrage. S'il manque du contexte, poser les questions AVANT de produire.
2. Vérifier l'existant avant de créer (comptes, visuels, contenus).
3. Le périmètre est fixé par Laetitia. Ne pas élargir sans demander.

Production :
4. Un thème = une session complète. Ne pas mélanger les sujets.
5. Format de sortie : TOUJOURS des fichiers (.docx, .xlsx, .pptx). Le chat sert à piloter, pas à livrer.
6. Penser en briques modulables : chaque document doit pouvoir être découpé et réutilisé.
7. Architecture d'abord, rédaction ensuite. Valider la structure avant de rédiger.

Ton et style :
8. Jamais de jargon corporate (ROI, tunnel, lead magnet, growth hacking, synergies, disruption, scalabilité).
9. Jamais de promesses exagérées, de ton « mindset », d'injonctions.
10. Écriture inclusive avec point médian (créateur·ices).
11. Si un sujet est complexe, ne JAMAIS le réduire à une question simple. Embrasser la complexité.
12. Privilégier des phrases complètes. L'oral c'est fluide, pas des rafales de 3 mots.

Vérification :
13. Vérifier TOUTE donnée factuelle (dates, chiffres, noms). Si incertitude, mettre entre [crochets].
14. Signaler immédiatement toute incohérence entre documents.
15. Ne jamais présenter une info incertaine comme définitive.

Relation client :
16. Les communications client sont TOUJOURS en 2 variantes de ton (structurée/pro + conversationnelle/chaleureuse).
17. Chaque livrable doit fonctionner pour un lecteur froid, sans contexte préalable.
18. Séquence post-échange : synthèse → actions (séparées Laetitia/client·e) → message client → livrable formel.

Validation :
19. "Oui" = validé + passer au suivant.
20. Absence de correction = c'est bon. Ne pas sur-interpréter.
21. Quand Laetitia corrige, elle reformule. Suivre la reformulation, pas revenir à la version précédente.

### Livrables attendus
Liste issue de la proposition commerciale et du plan d'actions, avec format (.docx, .xlsx, .pptx) pour chacun.

## 2. LE PROMPT CHAIN (liste ordonnée de prompts de travail)

Génère une liste de prompts de travail adaptés à CETTE cliente et à SES missions spécifiques. Pas des templates génériques.

Structure en 3 phases :
- Phase A (Recherche) : audits, analyse concurrentielle, vérification de l'existant.
- Phase B (Stratégie) : positionnement, messages clés, ligne éditoriale.
- Phase C (Production) : livrables dans l'ordre des dépendances. Un prompt = un livrable = un fichier.

Chaque prompt doit rappeler le contexte, spécifier le format de sortie, le ton, et les red flags.

## 3. WARNINGS (alertes pour Laetitia)

Signale : infos manquantes, risques de surproduction, dépendances bloquantes, incohérences.

## FORMAT DE SORTIE

Réponds UNIQUEMENT en JSON valide :
{
  "prompt_system": "Le prompt système complet, prêt à copier",
  "prompt_chain": [
    {
      "order": 1,
      "phase": "A",
      "title": "Titre court du prompt",
      "prompt": "Le prompt complet, prêt à copier",
      "output_format": ".docx",
      "depends_on": null,
      "is_pause": false
    }
  ],
  "warnings": [
    {
      "type": "missing_info",
      "message": "Description de l'alerte"
    }
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user with anon key
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mission_id } = await req.json();
    if (!mission_id) {
      return new Response(JSON.stringify({ error: "mission_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for data fetching
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all mission data in parallel
    const [missionRes, discoveryRes, proposalRes, kickoffRes, actionsRes] = await Promise.all([
      supabase.from("missions").select("*").eq("id", mission_id).single(),
      supabase.from("discovery_calls").select("*").eq("mission_id", mission_id).maybeSingle(),
      supabase.from("proposals").select("*").eq("mission_id", mission_id).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("kickoffs").select("*").eq("mission_id", mission_id).maybeSingle(),
      supabase.from("actions").select("task, description, category, channel, status, assignee, phase, hours_estimated").eq("mission_id", mission_id).order("sort_order"),
    ]);

    if (missionRes.error || !missionRes.data) {
      return new Response(JSON.stringify({ error: "Mission introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mission = missionRes.data;
    const discovery = discoveryRes.data;
    const proposal = proposalRes.data;
    const kickoff = kickoffRes.data;
    const actions = actionsRes.data ?? [];

    // Build compact user prompt
    let userPrompt = `## MISSION\nClient : ${mission.client_name} | Type : ${mission.mission_type} | Montant : ${mission.amount ? mission.amount + '€' : 'N/A'} | Statut : ${mission.status}\n\n`;

    if (discovery?.structured_notes) {
      userPrompt += `## APPEL DÉCOUVERTE\n`;
      const notes = discovery.structured_notes as { sections?: { title: string; content: string }[] };
      if (notes.sections) {
        notes.sections.forEach((s: any) => { userPrompt += `### ${s.title}\n${s.content}\n\n`; });
      }
    }

    if (proposal?.content) {
      userPrompt += `## PROPOSITION COMMERCIALE\n`;
      const content = proposal.content as { sections?: { title: string; content: string }[] } | null;
      if (content?.sections) {
        content.sections.forEach((s: any) => { userPrompt += `### ${s.title}\n${s.content}\n\n`; });
      }
    }

    if (kickoff?.structured_notes) {
      userPrompt += `## KICK-OFF\n`;
      const notes = kickoff.structured_notes as { sections?: { title: string; content: string }[] };
      if (notes.sections) {
        notes.sections.forEach((s: any) => { userPrompt += `### ${s.title}\n${s.content}\n\n`; });
      }
    }

    if (actions.length > 0) {
      userPrompt += `## ACTIONS (${actions.length})\n`;
      actions.forEach((a: any) => {
        userPrompt += `- [${a.assignee}/${a.status}] ${a.task}${a.category ? ' (' + a.category + ')' : ''}${a.phase ? ' {' + a.phase + '}' : ''}\n`;
      });
      userPrompt += '\n';
    }

    console.log("Calling Gemini 2.5 Pro for project kit generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques minutes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erreur API IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const textContent = result.choices?.[0]?.message?.content;
    if (!textContent) {
      return new Response(JSON.stringify({ error: "Réponse IA vide" }), {
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
      console.error("Invalid JSON from AI:", textContent.slice(0, 500));
      return new Response(JSON.stringify({ error: "Réponse JSON invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-claude-project error:", e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
