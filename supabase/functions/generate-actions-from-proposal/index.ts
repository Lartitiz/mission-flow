import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { proposal_content, mission_type, client_name } = await req.json();

    if (!proposal_content) {
      return new Response(JSON.stringify({ error: "proposal_content requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sections = proposal_content.sections || proposal_content;
    const proposalText = Array.isArray(sections)
      ? sections.map((s: any) => `## ${s.title}\n${s.content}`).join("\n\n")
      : JSON.stringify(proposal_content);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu génères un plan d'actions concret à partir d'une proposition commerciale validée.

Analyse la proposition et crée TOUTES les actions nécessaires pour la réaliser. Chaque livrable mentionné dans la proposition doit devenir une ou plusieurs actions.

Pour chaque action, détermine :
- assignee : "laetitia" (ce que Laetitia fait) ou "client" (ce que le/la client·e doit fournir)
- category : Cadrage, Messages, Site web, Social media, Emailing, Branding, Influence/Presse, Formation, Cross-posting, Commercial, Support, Préparation session, Finalisation, Autre
- task : intitulé court et clair (max 60 caractères)
- description : détail de ce qui est à faire
- channel : le canal concerné si applicable (Instagram, LinkedIn, Site web, Brevo, etc.) ou null

RÈGLES :
- Sépare bien les actions Laetitia (livrables, analyses, créations) et les actions client (fournir des accès, envoyer des documents, valider des livrables, etc.)
- Pour chaque livrable de Laetitia, crée aussi l'action client correspondante ("Valider le positionnement", "Envoyer le logo HD", "Donner accès admin au site", etc.)
- Organise les actions dans l'ordre chronologique (ce qui vient en premier en haut)
- Sois concret : pas de "travailler sur la stratégie" mais "Rédiger le document stratégique (10-15 pages)"

Réponds UNIQUEMENT en JSON valide : { "actions": [ { "assignee": "laetitia", "category": "Cadrage", "task": "Audit communication existante", "description": "Analyser le site web, les réseaux sociaux, le référencement et la concurrence", "channel": null } ] }`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Voici la proposition commerciale pour ${client_name || "le/la client·e"} (type de mission : ${mission_type || "non déterminé"}) :\n\n${proposalText}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Pas de JSON dans la réponse IA");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-actions-from-proposal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
