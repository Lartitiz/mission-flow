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
    const { token, file_name, file_size, file_base64, content_type, storage_path } = await req.json();

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

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, client_name")
      .eq("client_token", token)
      .single();

    if (missionError || !mission) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file_name) {
      return new Response(JSON.stringify({ error: "file_name requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy mode: base64 upload
    if (file_base64) {
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const clientFolder = (mission.client_name || 'client').replace(/\s+/g, '_');
      const storagePath = `${clientFolder}/uploads/${Date.now()}_${safeName}`;

      const fileBytes = decode(file_base64);
      const { error: uploadError } = await supabase.storage
        .from("mission-files")
        .upload(storagePath, fileBytes, {
          contentType: content_type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("files").insert({
        mission_id: mission.id,
        file_name,
        file_size: file_size ?? null,
        storage_path: storagePath,
        category: "client_upload",
        uploaded_by: "client",
      });
      if (insertError) throw insertError;
    }
    // New mode: file already uploaded directly, just record it
    else if (storage_path) {
      const { error: insertError } = await supabase.from("files").insert({
        mission_id: mission.id,
        file_name,
        file_size: file_size ?? null,
        storage_path,
        category: "client_upload",
        uploaded_by: "client",
      });
      if (insertError) throw insertError;
    } else {
      return new Response(JSON.stringify({ error: "file_base64 ou storage_path requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, storage_path: storagePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("upload-client-file error:", e);
    const message = e?.message?.includes('Payload too large')
      ? 'Fichier trop volumineux (max 4.5 Mo)'
      : e?.message?.includes('mime') || e?.message?.includes('type')
      ? 'Type de fichier non supporté'
      : 'Erreur lors de l\'upload. Réessaie ou contacte Laetitia.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
