import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante de Laetitia Mattioli (Nowadays Agency). Tu prépares l'ordre du jour de la prochaine session de suivi avec un·e client·e.

Tu reçois : le contexte de la mission, les actions en cours, les notes de la dernière session, et le périmètre de la proposition commerciale.

Génère un ordre du jour structuré, concret et actionnable. Format : texte brut avec des numéros, directement utilisable dans un agenda de visio.

RÈGLES :
- Maximum 5-6 points. Une visio de 2h ne peut pas couvrir 12 sujets.
- Commencer par un point "Bilan" (comment ça s'est passé depuis la dernière fois, retour de la cliente)
- Ensuite les actions en attente ou bloquées (les plus urgentes d'abord)
- Puis les livrables à valider ensemble
- Puis la préparation du mois suivant (si pertinent)
- Terminer par "Questions ouvertes / sujets libres"
- Pour chaque point, être concret : pas "On parle du contenu" mais "Valider les 4 posts Instagram du mois + ajuster le calendrier avril"
- Si des actions sont bloquées côté cliente (status: not_started alors qu'elles auraient dû être faites), le signaler avec diplomatie : "Faire le point sur [action] — voir si tu as besoin d'aide"
- Si la dernière session avait des actions "à mener avant la prochaine session", vérifier si elles apparaissent dans les actions en cours

Réponds UNIQUEMENT avec le texte de l'agenda, sans JSON, sans markdown, sans commentaire. Juste le texte numéroté prêt à coller.`;

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

    // Validate user
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

    // Fetch data with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [missionRes, actionsRes, sessionRes, proposalRes, kickoffRes] = await Promise.all([
      supabase.from("missions").select("client_name, mission_type, amount").eq("id", mission_id).single(),
      supabase.from("actions").select("task, description, category, channel, status, assignee, phase, sort_order")
        .eq("mission_id", mission_id)
        .not("status", "in", '("delivered","validated","done")')
        .order("sort_order"),
      supabase.from("sessions").select("structured_notes, next_session_agenda, session_date")
        .eq("mission_id", mission_id)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("proposals").select("content")
        .eq("mission_id", mission_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("kickoffs").select("structured_notes")
        .eq("mission_id", mission_id)
        .maybeSingle(),
    ]);

    const mission = missionRes.data;
    if (!mission) {
      return new Response(JSON.stringify({ error: "Mission introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actions = actionsRes.data ?? [];
    const lastSession = sessionRes.data;
    const proposal = proposalRes.data;
    const kickoff = kickoffRes.data;

    // Build user prompt
    let userPrompt = `## MISSION\nClient·e : ${mission.client_name}\nType : ${mission.mission_type}\n`;
    if (mission.amount) userPrompt += `Budget : ${mission.amount} €\n`;

    userPrompt += `\n## ACTIONS EN COURS (${actions.length})\n`;
    if (actions.length === 0) {
      userPrompt += "Aucune action en cours.\n";
    } else {
      actions.forEach((a: any) => {
        userPrompt += `- [${a.status}] [${a.assignee}] ${a.task}${a.description ? ' — ' + a.description : ''}${a.phase ? ' (phase: ' + a.phase + ')' : ''}\n`;
      });
    }

    if (lastSession) {
      userPrompt += `\n## DERNIÈRE SESSION (${lastSession.session_date})\n`;
      if (lastSession.structured_notes) {
        const notes = lastSession.structured_notes as { sections?: { title: string; content: string }[] };
        if (notes.sections) {
          notes.sections.forEach((s: any) => { userPrompt += `### ${s.title}\n${s.content}\n\n`; });
        }
      }
      if (lastSession.next_session_agenda) {
        userPrompt += `\nAgenda prévu pour cette session :\n${lastSession.next_session_agenda}\n`;
      }
    }

    if (proposal?.content) {
      const content = proposal.content as { sections?: { title: string; content: string }[] };
      if (content.sections) {
        userPrompt += `\n## PÉRIMÈTRE (proposition commerciale)\n`;
        content.sections.forEach((s: any) => { userPrompt += `- ${s.title}\n`; });
      }
    }

    if (kickoff?.structured_notes) {
      const notes = kickoff.structured_notes as { sections?: { title: string; content: string }[] };
      if (notes.sections) {
        userPrompt += `\n## CONTEXTE KICK-OFF (résumé)\n`;
        notes.sections.slice(0, 5).forEach((s: any) => {
          userPrompt += `### ${s.title}\n${s.content.slice(0, 300)}\n\n`;
        });
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
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
    const agenda = result.content?.[0]?.text?.trim();
    if (!agenda) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ agenda }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-session-agenda error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
