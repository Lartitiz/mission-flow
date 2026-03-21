import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu génères le prompt système (instructions permanentes) pour un nouveau projet Claude client.

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

function buildContext(mission: any, discovery: any, proposal: any, kickoff: any, actions: any[], sessions: any[]): string {
  let ctx = "## MISSION\n";
  ctx += "- Client : " + mission.client_name + "\n";
  ctx += "- Type : " + mission.mission_type + "\n";
  ctx += "- Montant : " + (mission.amount ? mission.amount + "€ HT" : "Non défini") + "\n";
  ctx += "- Statut : " + mission.status + "\n";
  ctx += "- Email : " + (mission.client_email || "Non renseigné") + "\n\n";

  if (discovery) {
    ctx += "## APPEL DÉCOUVERTE\n";
    const notes = discovery.structured_notes as { sections?: { title: string; content: string }[] } | null;
    if (notes?.sections) {
      notes.sections.forEach((s: any) => { ctx += "### " + s.title + "\n" + s.content + "\n\n"; });
    }
    if (discovery.raw_notes) ctx += "### Notes brutes\n" + discovery.raw_notes + "\n\n";
  }

  if (proposal) {
    ctx += "## PROPOSITION COMMERCIALE (v" + proposal.version + ")\n";
    const content = proposal.content as { sections?: { title: string; content: string }[] } | null;
    if (content?.sections) {
      content.sections.forEach((s: any) => { ctx += "### " + s.title + "\n" + s.content + "\n\n"; });
    }
  }

  if (kickoff) {
    ctx += "## KICK-OFF\n";
    const notes = kickoff.structured_notes as { sections?: { title: string; content: string }[] } | null;
    if (notes?.sections) {
      notes.sections.forEach((s: any) => { ctx += "### " + s.title + "\n" + s.content + "\n\n"; });
    }
    if (kickoff.raw_notes) ctx += "### Notes brutes\n" + kickoff.raw_notes + "\n\n";
  }

  if (actions.length > 0) {
    ctx += "## PLAN D'ACTIONS (" + actions.length + " actions)\n\n";
    actions.forEach((a: any) => {
      ctx += "- [" + a.assignee + "] [" + a.status + "] " + a.task;
      if (a.description) ctx += " — " + a.description;
      if (a.category) ctx += " (" + a.category + ")";
      if (a.channel) ctx += " [" + a.channel + "]";
      if (a.hours_estimated) ctx += " ~" + a.hours_estimated + "h";
      ctx += "\n";
    });
    ctx += "\n";
  }

  if (sessions.length > 0) {
    ctx += "## SESSIONS (" + sessions.length + " dernières)\n\n";
    sessions.forEach((s: any) => {
      ctx += "### " + s.session_date + " (" + s.session_type + ")\n";
      const notes = s.structured_notes as { sections?: { title: string; content: string }[] } | null;
      if (notes?.sections) {
        notes.sections.forEach((sec: any) => { ctx += sec.title + " : " + sec.content + "\n\n"; });
      } else if (s.raw_notes) {
        ctx += s.raw_notes + "\n\n";
      }
    });
  }

  return ctx;
}

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

    const { mission_id } = await req.json();
    if (!mission_id) {
      return new Response(JSON.stringify({ error: "mission_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = buildContext(
      missionRes.data, discoveryRes.data, proposalRes.data,
      kickoffRes.data, actionsRes.data ?? [], sessionsRes.data ?? []
    );

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
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
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
    const promptSystem = result.content?.[0]?.text;
    if (!promptSystem) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build condensed summary for step 2 phases
    const mission = missionRes.data;
    let contextSummary = "## MISSION\n";
    contextSummary += "- Client : " + mission.client_name + "\n";
    contextSummary += "- Type : " + mission.mission_type + "\n";
    contextSummary += "- Montant : " + (mission.amount ? mission.amount + "€ HT" : "Non défini") + "\n\n";

    const proposal = proposalRes.data;
    if (proposal?.content) {
      const pc = proposal.content as { sections?: { title: string; content: string }[] };
      if (pc?.sections) {
        contextSummary += "## PROPOSITION (résumé)\n";
        pc.sections.forEach((s: any) => {
          contextSummary += "- " + s.title + " : " + s.content.slice(0, 200) + (s.content.length > 200 ? "..." : "") + "\n";
        });
        contextSummary += "\n";
      }
    }

    const actions = actionsRes.data ?? [];
    if (actions.length > 0) {
      contextSummary += "## ACTIONS (" + actions.length + ")\n";
      actions.forEach((a: any) => {
        contextSummary += "- [" + a.assignee + "] " + a.task + (a.channel ? " [" + a.channel + "]" : "") + "\n";
      });
      contextSummary += "\n";
    }

    return new Response(JSON.stringify({ prompt_system: promptSystem, context_summary: contextSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-claude-project error:", e);
    const msg = e instanceof Error && e.name === "AbortError" ? "Timeout étape 1" : "Erreur interne";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});