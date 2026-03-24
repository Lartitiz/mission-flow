import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get mission by slug or token
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    const query = supabase
      .from("missions")
      .select("id, client_name, mission_type, status, amount, client_link_active")
    
    const { data: mission, error: missionError } = isUuid
      ? await query.eq("client_token", token).single()
      : await query.eq("client_slug", token).single();

    if (missionError || !mission) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mission.client_link_active === false) {
      return new Response(JSON.stringify({ error: "Ce lien a été désactivé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const missionId = mission.id;

    // Fetch all data in parallel
    const [actionsRes, sessionsRes, filesRes, nextSessionRes] = await Promise.all([
      supabase
        .from("actions")
        .select("id, task, description, category, channel, target_date, status, assignee, sort_order, client_comment, phase")
        .eq("mission_id", missionId)
        .order("sort_order"),
      supabase
        .from("sessions")
        .select("id, session_date, session_type, structured_notes, next_session_date, next_session_agenda")
        .eq("mission_id", missionId)
        .order("session_date", { ascending: false }),
      supabase
        .from("files")
        .select("id, file_name, file_size, storage_path, category, created_at, url")
        .eq("mission_id", missionId)
        .order("created_at", { ascending: false }),
      // nothing extra needed
    ]);

    const actions = (actionsRes.data ?? []).map((a: any) => {
      // Strip hours_estimated and budget_ht for laetitia actions
      if (a.assignee === "laetitia") {
        return { ...a };
      }
      return a;
    });

    const sessions = sessionsRes.data ?? [];
    const files = filesRes.data ?? [];

    // Find next session
    const lastSession = sessions[0] ?? null;
    const nextSession = lastSession?.next_session_date
      ? { date: lastSession.next_session_date, agenda: lastSession.next_session_agenda }
      : null;

    // Generate signed URLs for files
    const filesWithUrls = await Promise.all(
      files.map(async (f: any) => {
        if (f.url) {
          return { ...f, download_url: null };
        }
        const { data } = await supabase.storage
          .from("mission-files")
          .createSignedUrl(f.storage_path, 3600);
        return { ...f, download_url: data?.signedUrl ?? null };
      })
    );

    return new Response(
      JSON.stringify({
        mission: {
          id: missionId,
          client_name: mission.client_name,
          mission_type: mission.mission_type,
          status: mission.status,
        },
        actions,
        sessions: sessions.map((s: any) => ({
          id: s.id,
          session_date: s.session_date,
          session_type: s.session_type,
          structured_notes: s.structured_notes,
        })),
        next_session: nextSession,
        files: filesWithUrls,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-client-space error:", e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
