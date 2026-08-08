import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function palierFor(pct: number): string {
  if (pct >= 100) return "Mission accomplie 🎉";
  if (pct >= 75) return "Dernière ligne droite";
  if (pct >= 50) return "À mi-chemin : ça avance fort";
  if (pct >= 25) return "Ça prend forme";
  return "En route !";
}

// Assemble les 3 blocs du récap depuis les données de la mission.
// « Depuis le dernier récap » : chaque envoi ne raconte que le neuf.
// deno-lint-ignore no-explicit-any
async function assembleBlocks(supabase: any, mission: any) {
  const since: string = mission.last_recap_sent_at ?? mission.created_at;
  const sinceDate = since.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [sessionsRes, actionsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("session_date, topic, client_summary, next_session_agenda")
      .eq("mission_id", mission.id)
      .order("session_date", { ascending: true }),
    supabase
      .from("actions")
      .select("task, status, assignee, target_date, updated_at")
      .eq("mission_id", mission.id),
  ]);
  // deno-lint-ignore no-explicit-any
  const sessions: any[] = sessionsRes.data ?? [];
  // deno-lint-ignore no-explicit-any
  const actions: any[] = actionsRes.data ?? [];

  const doneStatuses = ["done", "delivered", "validated"];

  // ── Ce qu'on a fait ensemble ──
  const doneItems: string[] = [];
  for (const s of sessions.filter((s) => s.session_date <= today && s.session_date >= sinceDate)) {
    const dateStr = DAY_FMT.format(new Date(s.session_date));
    const headline = s.client_summary?.headline ? ` : ${s.client_summary.headline}` : "";
    doneItems.push(`${s.topic || "Atelier"} (${dateStr})${headline}`);
  }
  // Approximation assumée : updated_at bouge à chaque modification, pas
  // seulement au passage en « livré ». Laetitia relit avant d'envoyer.
  for (const a of actions.filter(
    (a) => a.assignee === "laetitia" && doneStatuses.includes(a.status) && a.updated_at >= since
  )) {
    doneItems.push(`${a.task} : livré`);
  }

  // ── Où on en est ──
  const doneAll = actions.filter((a) => doneStatuses.includes(a.status)).length;
  const pct = actions.length > 0 ? Math.round((doneAll / actions.length) * 100) : 0;
  const progress = {
    percent: pct,
    label: palierFor(pct),
    count: actions.length > 0 ? `${doneAll}/${actions.length} actions` : "",
  };

  // ── Ce qui arrive ──
  const upcomingItems: string[] = [];
  const nextSession = sessions.find((s) => s.session_date > today);
  if (nextSession) {
    const d = new Date(nextSession.session_date);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    upcomingItems.push(
      `${nextSession.topic || "Prochain atelier"} : ${DAY_FMT.format(d)}${days > 0 && days <= 14 ? ` (J-${days} !)` : ""}`
    );
  }
  const pendingClient = actions
    .filter((a) => a.assignee === "client" && !doneStatuses.includes(a.status))
    .slice(0, 3)
    .map((a) => a.task);
  if (pendingClient.length > 0) {
    // Ton doux : le récap donne envie, il ne réclame pas
    upcomingItems.push(`De ton côté : ${pendingClient.join(" · ")}, quand tu peux 😉`);
  }

  return { doneItems, progress, upcomingItems, since };
}

// deno-lint-ignore no-explicit-any
async function draftIntro(mission: any, blocks: { doneItems: string[]; progress: { label: string; count: string }; upcomingItems: string[] }): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "";
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu écris le mot d'ouverture d'un e-mail de récap de mission, au nom de Laetitia Mattioli (Nowadays Agency), pour sa cliente. 2 phrases MAXIMUM, ton chaleureux et direct, tutoiement, écriture inclusive au point médian si besoin. INTERDIT : tiret cadratin (utilise « : » ou « ; »), jargon corporate, flatterie creuse. Le mot doit s'appuyer sur les FAITS fournis (ce qui a été fait, où on en est), donner de l'élan, jamais culpabiliser.`,
          },
          {
            role: "user",
            content: `Cliente : ${mission.client_name}\nFait récemment : ${blocks.doneItems.join(" ; ") || "rien de notable"}\nAvancement : ${blocks.progress.label} (${blocks.progress.count})\nÀ venir : ${blocks.upcomingItems.join(" ; ") || "rien de planifié"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "write_intro",
              description: "Le mot d'ouverture du récap",
              parameters: {
                type: "object",
                properties: {
                  intro: { type: "string", description: "2 phrases maximum, sans tiret cadratin" },
                },
                required: ["intro"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "write_intro" } },
      }),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return "";
    const intro = String(JSON.parse(toolCall.function.arguments).intro ?? "");
    // Garde déterministe : jamais de cadratin, quoi qu'ait produit le modèle
    return intro.replace(/\s*—\s*/g, " : ");
  } catch (e) {
    console.error("draftIntro failed (non bloquant):", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mission_id, mode, intro_text, include } = await req.json();
    if (!mission_id || !["prepare", "send"].includes(mode)) {
      return new Response(JSON.stringify({ error: "mission_id et mode (prepare|send) requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, client_name, client_email, client_token, client_link_active, mission_type, created_at, last_recap_sent_at")
      .eq("id", mission_id)
      .single();
    if (missionError || !mission) {
      return new Response(JSON.stringify({ error: "Mission introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocks = await assembleBlocks(supabase, mission);

    if (mode === "prepare") {
      const intro = await draftIntro(mission, blocks);
      return new Response(
        JSON.stringify({
          blocks,
          intro,
          client_email: mission.client_email ?? null,
          last_recap_sent_at: mission.last_recap_sent_at ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // mode === "send"
    if (!mission.client_email) {
      return new Response(JSON.stringify({ error: "Pas d'e-mail cliente sur cette mission" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (mission.client_link_active === false) {
      return new Response(JSON.stringify({ error: "Le lien client est désactivé" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inc = { done: true, progress: true, upcoming: true, ...(include ?? {}) };
    const missionLabel =
      mission.mission_type === "binome" ? "Binôme" : mission.mission_type === "agency" ? "Agency" : "";

    const { data: sendResult, error: sendError } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "mission-recap",
          recipientEmail: mission.client_email,
          // Clé par minute : un double-clic ne part qu'une fois, un récap
          // ultérieur passe (l'infra déduplique par clé depuis peu).
          idempotencyKey: `mission-recap-${mission.id}-${new Date().toISOString().slice(0, 16)}`,
          templateData: {
            clientName: mission.client_name.split(" ")[0],
            missionLabel,
            recapDate: MONTH_FMT.format(new Date()),
            introText: typeof intro_text === "string" ? intro_text.trim() : "",
            doneItems: inc.done ? blocks.doneItems : [],
            progressPercent: inc.progress ? blocks.progress.percent : 0,
            progressLabel: inc.progress ? blocks.progress.label : "",
            progressCount: inc.progress ? blocks.progress.count : "",
            upcomingItems: inc.upcoming ? blocks.upcomingItems : [],
            clientSpaceUrl: `https://nowadays-mission-flow.lovable.app/client/${mission.client_token}`,
          },
        },
      }
    );
    if (sendError || sendResult?.error) {
      console.error("send-mission-recap: envoi échoué", sendError, sendResult);
      return new Response(JSON.stringify({ error: "L'envoi a échoué : réessaie." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: stampError } = await supabase
      .from("missions")
      .update({ last_recap_sent_at: new Date().toISOString() })
      .eq("id", mission.id);
    if (stampError) console.error("send-mission-recap: last_recap_sent_at non enregistré", stampError);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-mission-recap error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
