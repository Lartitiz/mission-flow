import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    const { token, action_id, status, file_name, file_size, file_base64, content_type } = await req.json();

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

    // Verify token
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id")
      .eq("client_token", token)
      .single();

    if (missionError || !mission) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify action belongs to this mission and is a client action
    const { data: action, error: actionError } = await supabase
      .from("actions")
      .select("id, assignee, mission_id")
      .eq("id", action_id)
      .eq("mission_id", mission.id)
      .eq("assignee", "client")
      .single();

    if (actionError || !action) {
      return new Response(JSON.stringify({ error: "Action non trouvée" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    if (status) {
      const { error } = await supabase
        .from("actions")
        .update({ status })
        .eq("id", action_id);
      if (error) throw error;
    }

    // Upload file if base64 provided
    if (file_name && file_base64) {
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${mission.id}/actions/${action_id}/${Date.now()}_${safeName}`;

      const fileBytes = decode(file_base64);
      const { error: uploadError } = await supabase.storage
        .from("mission-files")
        .upload(storagePath, fileBytes, {
          contentType: content_type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error: fileError } = await supabase.from("files").insert({
        mission_id: mission.id,
        file_name,
        file_size: file_size ?? null,
        storage_path: storagePath,
        category: `action_${action_id}`,
        uploaded_by: "client",
      });
      if (fileError) throw fileError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-client-action error:", e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
