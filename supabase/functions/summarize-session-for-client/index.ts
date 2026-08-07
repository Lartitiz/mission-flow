import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu écris un RÉSUMÉ ULTRA COURT d'une session, destiné à être affiché dans l'espace en ligne du ou de la client·e. C'est ce que la cliente verra en un coup d'œil — pas un compte-rendu détaillé.

RÈGLES STRICTES :
- "headline" : UNE phrase (≤ 140 caractères) qui dit ce qu'on a fait/décidé ensemble pendant la session. Orientée valeur pour la cliente.
- "bullets" : 2 à 4 puces TRÈS courtes (≤ 80 caractères chacune). Décisions actées, livrables validés, prochaines étapes côté cliente. Une idée par puce.
- INTERDIT : aucune mention de budget, tarif, heures, marge, notes internes Laetitia, hésitations.
- Ton : chaleureux, direct, "tu", écriture inclusive (point médian quand pertinent).
- ZÉRO jargon corporate (pas de ROI, KPI, lead magnet, funnel, etc.).
- Si une info n'est pas dans les notes, ne l'invente pas.

Réponds UNIQUEMENT en JSON valide : { "headline": "...", "bullets": ["...", "..."] }`;

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

    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ error: "session_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, mission_id, structured_notes, raw_notes, session_date, session_type, topic, client_summary")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceText = session.structured_notes
      ? JSON.stringify(session.structured_notes)
      : (session.raw_notes ?? "");

    if (!sourceText.trim()) {
      return new Response(JSON.stringify({ error: "Pas de contenu à résumer" }), {
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

    const userPrompt = `Notes de la session :\n\n${sourceText.slice(0, 30000)}`;

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
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 600,
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
    const textContent = result.content?.[0]?.text;
    if (!textContent) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonStr = textContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: { headline: string; bullets: string[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Invalid JSON from Claude:", textContent);
      return new Response(JSON.stringify({ error: "Réponse JSON invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!parsed.headline || !Array.isArray(parsed.bullets)) {
      return new Response(JSON.stringify({ error: "Format de résumé invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Une régénération écrase un résumé déjà publié : la cliente ne doit être
    // prévenue par e-mail qu'à la PREMIÈRE publication.
    const isFirstPublication = session.client_summary == null;

    // Save to session
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ client_summary: parsed })
      .eq("id", session_id);

    if (updateError) {
      console.error("update error:", updateError);
      return new Response(JSON.stringify({ error: "Erreur de sauvegarde" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Première publication : prévenir la cliente par e-mail (best effort, ne
    // fait jamais échouer la génération du résumé).
    let notified = false;
    let notifiedClientName = "";
    if (isFirstPublication) {
      try {
        const { data: mission, error: missionError } = await supabase
          .from("missions")
          .select("client_email, client_name, client_token, client_link_active")
          .eq("id", session.mission_id)
          .maybeSingle();

        if (missionError) {
          console.error("mission lookup for notify failed:", missionError);
        }

        const clientEmail = (mission?.client_email ?? "").trim();
        if (mission && clientEmail && mission.client_link_active !== false) {
          const sessionDate = session.session_date
            ? new Date(`${session.session_date}T00:00:00Z`).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })
            : "";

          const { data: sendData, error: sendError } = await supabase.functions.invoke(
            "send-transactional-email",
            {
              body: {
                templateName: "client-summary-published",
                recipientEmail: clientEmail,
                // Clé stable pour toujours : même si le résumé est régénéré un
                // jour où client_summary est redevenu null, l'infra e-mail
                // dédupliquera et la cliente ne recevra qu'UN seul e-mail.
                idempotencyKey: `summary-published-${session_id}`,
                templateData: {
                  clientName: mission.client_name ?? "",
                  sessionDate,
                  sessionLabel: session.topic ?? "",
                  clientSpaceUrl: `https://nowadays-mission-flow.lovable.app/client/${mission.client_token}`,
                },
              },
            }
          );

          if (sendError) {
            console.error("client summary email failed:", sendError);
          } else if (sendData?.success === true && sendData?.queued === true) {
            notified = true;
            notifiedClientName = mission.client_name ?? "";
          }
        }
      } catch (notifyErr) {
        console.error("client summary notify error:", notifyErr);
      }
    }

    return new Response(
      JSON.stringify({ client_summary: parsed, notified, client_name: notifiedClientName }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("summarize-session-for-client error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
