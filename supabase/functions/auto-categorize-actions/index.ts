import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  "Cadrage",
  "Messages",
  "Site web",
  "Social media",
  "Emailing",
  "Branding",
  "Cross-posting",
  "Influence/Presse",
  "Formation",
  "Commercial",
  "Support",
  "Préparation session",
  "Autre",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actions } = await req.json();
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return new Response(JSON.stringify({ error: "Aucune action à catégoriser" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const actionsText = actions
      .map((a: { id: string; task: string; description?: string; channel?: string }) =>
        `- ID: ${a.id} | Tâche: "${a.task}"${a.description ? ` | Description: "${a.description}"` : ""}${a.channel ? ` | Canal: ${a.channel}` : ""}`
      )
      .join("\n");

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
            content: `Tu es un assistant de gestion de projet pour une agence de communication. Tu dois catégoriser des actions.

Les catégories disponibles sont exactement : ${CATEGORIES.join(", ")}

Règles :
- "Cadrage" = stratégie, positionnement, audit, planning, brief
- "Messages" = rédaction, copywriting, storytelling, taglines
- "Site web" = pages web, SEO, blog, développement web
- "Social media" = posts, stories, reels, calendrier éditorial, communauté
- "Emailing" = newsletters, séquences email, automation
- "Branding" = logo, identité visuelle, charte graphique, templates
- "Cross-posting" = republication multi-plateformes
- "Influence/Presse" = relations presse, influenceurs, partenariats
- "Formation" = coaching, atelier, formation client
- "Commercial" = devis, facturation, contrats, prospection, relances clients, CRM
- "Autre" = si vraiment rien ne correspond`,
          },
          {
            role: "user",
            content: `Catégorise chacune de ces actions :\n\n${actionsText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_actions",
              description: "Assign a category to each action",
              parameters: {
                type: "object",
                properties: {
                  categorizations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "The action ID" },
                        category: {
                          type: "string",
                          enum: CATEGORIES,
                          description: "The assigned category",
                        },
                      },
                      required: ["id", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["categorizations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "categorize_actions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-categorize error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
