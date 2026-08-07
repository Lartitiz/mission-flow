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
    const { token, action_id, status, client_comment, file_name, file_size, file_base64, content_type, storage_path } = await req.json();

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

    // Seul le client_token (UUID aléatoire) donne accès : le slug est devinable
    // (dérivé du nom de la cliente), il ne doit jamais servir de clé d'accès.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    if (!isUuid) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, client_name, client_link_active")
      .eq("client_token", token)
      .single();

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

    // Update status and/or client_comment
    // Le client ne peut que cocher/décocher : pas question de passer une
    // action en "validated"/"delivered" (statuts réservés au suivi interne).
    const CLIENT_STATUSES = ["not_started", "done"];
    if (status && !CLIENT_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: "Statut non autorisé" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (typeof client_comment === "string") updates.client_comment = client_comment;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("actions")
        .update(updates)
        .eq("id", action_id);
      if (error) throw error;
    }

    // Upload file if base64 provided (legacy)
    let fileRecorded = false;
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
      fileRecorded = true;
    }
    // Or record file if already uploaded directly (new: direct upload from client)
    else if (file_name && storage_path) {
      // Le chemin vient du client : il doit rester dans le dossier de SA mission,
      // sinon la ligne files permettrait de faire signer n'importe quel fichier.
      if (typeof storage_path !== "string" || !storage_path.startsWith(`${mission.id}/`)) {
        return new Response(JSON.stringify({ error: "Chemin de fichier invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: fileError } = await supabase.from("files").insert({
        mission_id: mission.id,
        file_name,
        file_size: file_size ?? null,
        storage_path,
        category: `action_${action_id}`,
        uploaded_by: "client",
      });
      if (fileError) throw fileError;
      fileRecorded = true;
    }

    // Notify Laetitia via email (non-blocking) — même modèle que upload-client-file :
    // jusqu'ici, un fichier déposé sur une action ne notifiait PAS.
    // Anti-rafale : un seul e-mail par salve. La clé d'idempotence est par
    // tranche d'heure, et comme l'infra e-mail ne prouve pas de déduplication
    // par idempotency_key (le dispatcher ne dédoublonne que par message_id),
    // on garde aussi une garde locale : si un autre fichier client de cette
    // mission a déjà été enregistré dans la même tranche d'heure, il a déjà
    // déclenché l'e-mail → on saute l'envoi.
    if (fileRecorded) {
      try {
        const hourSlice = new Date().toISOString().slice(0, 13); // ex: 2026-08-07T14
        const { count: uploadsThisHour, error: countError } = await supabase
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("mission_id", mission.id)
          .eq("uploaded_by", "client")
          .gte("created_at", `${hourSlice}:00:00.000Z`);

        // Le fichier qu'on vient d'insérer compte pour 1 : au-delà, un e-mail
        // est déjà parti cette heure-ci. En cas d'erreur de comptage, on envoie
        // quand même (mieux vaut un e-mail en trop qu'aucun).
        if (countError || uploadsThisHour === null || uploadsThisHour <= 1) {
          const fileSizeKb = file_size ? (file_size < 1048576 ? `${Math.round(file_size / 1024)} Ko` : `${(file_size / 1048576).toFixed(1)} Mo`) : '';
          const uploadedAt = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
          const missionUrl = `https://nowadays-mission-flow.lovable.app/missions/${mission.id}`;
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'client-file-uploaded',
              recipientEmail: 'laetitia@nowadaysagency.com',
              idempotencyKey: `client-upload-${mission.id}-${hourSlice}`,
              templateData: {
                clientName: mission.client_name || 'Une cliente',
                fileName: file_name,
                fileSize: fileSizeKb,
                uploadedAt,
                missionUrl,
              },
            },
          });
        } else {
          console.log('Notification déjà envoyée cette heure-ci, e-mail sauté', { mission_id: mission.id, hourSlice });
        }
      } catch (notifyErr) {
        console.error('Email notification failed (non-blocking):', notifyErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("update-client-action error:", e);
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
