import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { section_title, section_content, structured_notes, mission_type, tutoiement, instruction } = await req.json();

    if (!section_title || !structured_notes) {
      return new Response(JSON.stringify({ error: 'section_title et structured_notes sont requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tonDirective = tutoiement
      ? "Tutoiement, chaleureux et complice"
      : "Vouvoiement, professionnel mais chaleureux";

    const systemPrompt = `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency. Tu dois réécrire UNE SEULE section d'une proposition commerciale.

TON : ${tonDirective}

RÈGLES : pas de jargon (ROI, funnel, growth hacking), pas de promesses exagérées, écriture inclusive point médian, pas de tiret cadratin.

Réponds UNIQUEMENT en JSON valide : { "title": "titre de la section", "content": "nouveau contenu" }`;

    const contextSummary = Array.isArray(structured_notes)
      ? structured_notes.map((s: { title: string; content: string }) => `${s.title}: ${s.content}`).join('\n')
      : JSON.stringify(structured_notes);

    let userPrompt = `Section à réécrire : ${section_title}

Contenu actuel : ${section_content || '(vide)'}

Contexte (notes appel) : ${contextSummary}

Type de mission : ${mission_type || 'non_determine'}`;

    if (instruction) {
      userPrompt += `\n\nInstruction spécifique : ${instruction}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'Erreur API Claude' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;
    if (!textContent) {
      return new Response(JSON.stringify({ error: 'Réponse Claude vide' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let jsonStr = textContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Also try to extract raw JSON object
    if (!jsonStr.startsWith('{')) {
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Invalid JSON from Claude:', textContent);
      return new Response(JSON.stringify({ error: 'Réponse JSON invalide' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('regenerate-proposal-section error:', e);
    const message = e instanceof Error && e.name === 'AbortError'
      ? 'Timeout'
      : 'Erreur interne';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
