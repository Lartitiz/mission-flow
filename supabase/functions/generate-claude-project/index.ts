import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_STEP1 = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères le prompt système (instructions permanentes) pour un nouveau projet Claude client.

Tu reçois le contexte complet d'une mission. Tu dois produire un prompt système prêt à copier-coller dans les "Project Instructions" d'un projet Claude.

Le prompt système doit contenir ces sections (remplies avec les données réelles, pas des placeholders) :

1. IDENTITÉ : "Tu travailles pour Laetitia Mattioli, fondatrice de Nowadays Agency, consultante en communication stratégique et éditoriale. Laetitia pilote la stratégie ; Claude produit les livrables."

2. CONTEXTE CLIENT : nom, activité (dans les mots de la cliente), type de mission (done_for_you | done_with_you | co_creation — déduis-le), budget, durée, canaux prioritaires, ton (tu/vous + registre), contact principal.

3. RED FLAGS : extraits des notes (sujets sensibles, termes interdits, données non confirmées). Si aucun : "Aucun red flag identifié — à confirmer avec Laetitia."

4. CHARTE VISUELLE : si mentionnée. Sinon : "[NON ABORDÉ — à confirmer]".

5. RÈGLES DE TRAVAIL (toujours les mêmes, copie-les telles quelles) :

Cadrage :
1. Ne JAMAIS produire sans cadrage. S'il manque du contexte, poser les questions AVANT.
2. Vérifier l'existant avant de créer.
3. Le périmètre est fixé par Laetitia. Ne pas élargir sans demander.

Production :
4. Un thème = une session complète.
5. Format de sortie : TOUJOURS des fichiers (.docx, .xlsx, .pptx). Le chat sert à piloter, pas à livrer.
6. Briques modulables : chaque document doit pouvoir être découpé.
7. Architecture d'abord, rédaction ensuite.

Ton et style :
8. Jamais de jargon corporate (ROI, tunnel, lead magnet, growth hacking, synergies, disruption, scalabilité).
9. Jamais de promesses exagérées, de ton « mindset », d'injonctions.
10. Écriture inclusive avec point médian.
11. Ne JAMAIS réduire un sujet complexe à une question simple.
12. Phrases complètes, pas des rafales de 3 mots.

Vérification :
13. Vérifier TOUTE donnée factuelle. Si incertitude, mettre entre [crochets].
14. Signaler les incohérences entre documents.
15. Ne jamais présenter une info incertaine comme définitive.

Relation client :
16. Communications client TOUJOURS en 2 variantes (structurée/pro + conversationnelle/chaleureuse).
17. Chaque livrable doit fonctionner pour un lecteur froid.
18. Séquence post-échange : synthèse → actions → message client → livrable.

Validation :
19. "Oui" = validé + suivant.
20. Absence de correction = c'est bon.
21. Quand Laetitia corrige par reformulation, suivre la reformulation.

6. LIVRABLES ATTENDUS : liste issue de la proposition et du plan d'actions, avec format pour chacun.

Réponds avec LE PROMPT SYSTÈME COMPLET uniquement. Pas de JSON, pas de backticks, pas de commentaire. Juste le texte du prompt, prêt à copier.`;

const SYSTEM_PROMPT_STEP2 = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères la chaîne de prompts de travail pour un projet client.

Tu reçois : le contexte de la mission ET le prompt système déjà généré (étape précédente).

Génère une liste de prompts de travail adaptés à CETTE cliente. Pas des templates génériques.

Structure en 3 phases :
- Phase A (Recherche) : audits, analyse concurrentielle. Les prompts DOIVENT demander des recherches web.
- Phase B (Stratégie) : positionnement, messages clés. Les prompts DOIVENT poser des questions à Laetitia pour trancher. Proposer 2 directions opposées quand pertinent.
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
    {
      "order": 1,
      "phase": "A",
      "title": "Titre court",
      "prompt": "Le prompt complet",
      "output_format": ".docx",
      "depends_on": null,
      "is_pause": false
    }
  ],
  "warnings": [
    {
      "type": "missing_info",
      "message": "Description"
    }
  ]
}`;

async function callClaude(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", response.status, errText);
    if (response.status === 429) {
      throw new Error("Trop de requêtes, réessaie dans quelques minutes.");
    }
    throw new Error(`API Claude erreur ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text;
  if (!text) throw new Error("Réponse Claude vide");
  return text;
}

function extractJson(text: string): any {
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(jsonStr);
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [missionRes, discoveryRes, proposalRes, kickoffRes, actionsRes, sessionsRes] = await Promise.all([
      supabase.from("missions").select("*").eq("id", mission_id).single(),
      supabase.from("discovery_calls").select("*").eq("mission_id", mission_id).maybeSingle(),
      supabase.from("proposals").select("*").eq("mission_id", mission_id).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("kickoffs").select("*").eq("mission_id", mission_id).maybeSingle(),
      supabase.from("actions").select("*").eq("mission_id", mission_id).order("sort_order"),
      supabase.from("sessions").select("*").eq("mission_id", mission_id).order("session_date", { ascending: false }).limit(5),
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
    const sessions = sessionsRes.data ?? [];

    // Build context shared between both calls
    let context = `## MISSION\n`;
    context += `- Client : ${mission.client_name}\n`;
    context += `- Type : ${mission.mission_type}\n`;
    context += `- Montant : ${mission.amount ? mission.amount + '€ HT' : 'Non défini'}\n`;
    context += `- Statut : ${mission.status}\n`;
    context += `- Email : ${mission.client_email || 'Non renseigné'}\n\n`;

    if (discovery) {
      context += `## APPEL DÉCOUVERTE\n`;
      if (discovery.structured_notes) {
        const notes = discovery.structured_notes as { sections?: { title: string; content: string }[] };
        if (notes.sections) {
          notes.sections.forEach((s: any) => { context += `### ${s.title}\n${s.content}\n\n`; });
        }
      }
      if (discovery.raw_notes) {
        context += `### Notes brutes\n${discovery.raw_notes}\n\n`;
      }
    }

    if (proposal) {
      context += `## PROPOSITION COMMERCIALE (v${proposal.version})\n`;
      const content = proposal.content as { sections?: { title: string; content: string }[] } | null;
      if (content?.sections) {
        content.sections.forEach((s: any) => { context += `### ${s.title}\n${s.content}\n\n`; });
      }
    }

    if (kickoff) {
      context += `## KICK-OFF\n`;
      if (kickoff.structured_notes) {
        const notes = kickoff.structured_notes as { sections?: { title: string; content: string }[] };
        if (notes.sections) {
          notes.sections.forEach((s: any) => { context += `### ${s.title}\n${s.content}\n\n`; });
        }
      }
      if (kickoff.raw_notes) {
        context += `### Notes brutes\n${kickoff.raw_notes}\n\n`;
      }
    }

    if (actions.length > 0) {
      context += `## PLAN D'ACTIONS (${actions.length} actions)\n\n`;
      actions.forEach((a: any) => {
        context += `- [${a.assignee}] [${a.status}] ${a.task}${a.description ? ' — ' + a.description : ''}${a.category ? ' (' + a.category + ')' : ''}${a.channel ? ' [' + a.channel + ']' : ''}${a.hours_estimated ? ' ~' + a.hours_estimated + 'h' : ''}\n`;
      });
      context += '\n';
    }

    if (sessions.length > 0) {
      context += `## SESSIONS (${sessions.length} dernières)\n\n`;
      sessions.forEach((s: any) => {
        context += `### ${s.session_date} (${s.session_type})\n`;
        if (s.structured_notes) {
          const notes = s.structured_notes as { sections?: { title: string; content: string }[] };
          if (notes.sections) {
            notes.sections.forEach((sec: any) => { context += `${sec.title} : ${sec.content}\n\n`; });
          }
        } else if (s.raw_notes) {
          context += `${s.raw_notes}\n\n`;
        }
      });
    }

    // STEP 1: Generate prompt system (plain text, no JSON)
    console.log("Step 1/2: Generating prompt system...");
    const promptSystem = await callClaude(
      ANTHROPIC_API_KEY,
      SYSTEM_PROMPT_STEP1,
      context,
      6000
    );

    // STEP 2: Generate prompt chain + warnings (JSON)
    console.log("Step 2/2: Generating prompt chain...");
    const step2Input = `${context}\n\n## PROMPT SYSTÈME DÉJÀ GÉNÉRÉ (pour référence)\n\n${promptSystem}`;
    const chainRaw = await callClaude(
      ANTHROPIC_API_KEY,
      SYSTEM_PROMPT_STEP2,
      step2Input,
      8000
    );

    let chainParsed;
    try {
      chainParsed = extractJson(chainRaw);
    } catch {
      console.error("Failed to parse chain JSON. First 500 chars:", chainRaw.slice(0, 500));
      return new Response(JSON.stringify({ error: "Erreur de parsing de la chaîne. Réessaie." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      prompt_system: promptSystem,
      prompt_chain: Array.isArray(chainParsed.prompt_chain) ? chainParsed.prompt_chain : [],
      warnings: Array.isArray(chainParsed.warnings) ? chainParsed.warnings : [],
    };

    console.log(`Done. System: ${promptSystem.length} chars, Chain: ${result.prompt_chain.length} steps, Warnings: ${result.warnings.length}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-claude-project error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout : un des appels a pris trop de temps. Réessaie."
      : e instanceof Error ? e.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
