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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { client_name, structured_notes, mission_type, tutoiement, amount } = await req.json();

    if (!client_name || !structured_notes) {
      return new Response(JSON.stringify({ error: 'client_name and structured_notes are required' }), { status: 400, headers: corsHeaders });
    }

    const tonDirective = tutoiement
      ? "Tutoiement, chaleureux et complice"
      : "Vouvoiement, professionnel mais chaleureux";

    const contextSummary = Array.isArray(structured_notes)
      ? structured_notes.map((s: { title: string; content: string }) => `${s.title}: ${s.content}`).join('\n')
      : JSON.stringify(structured_notes);

    const systemPrompt = `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency. Rédige un email court et chaleureux pour accompagner l'envoi d'une proposition commerciale.

TON : ${tonDirective}

L'email doit :

Rappeler brièvement le contexte de l'appel (1-2 phrases)

Annoncer la proposition en pièce jointe

Inviter à poser des questions

Proposer un prochain RDV pour en discuter

Être court (150-250 mots max)

Signer "Laetitia" avec le lien Calendly : https://calendly.com/laetitia-mattioli/rendez-vous-avec-laetitia

Pas de jargon. Écriture inclusive point médian. Pas de tiret cadratin.

Réponds en JSON : { "subject": "Objet de l'email", "body": "Corps de l'email" }`;

    const userPrompt = `Client·e : ${client_name}
Type de mission : ${mission_type || 'non_determine'}
${amount ? `Montant : ${amount}€ HT` : ''}

Notes structurées de l'appel découverte :
${contextSummary}`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic error:', errBody);
      return new Response(JSON.stringify({ error: 'AI generation failed' }), { status: 500, headers: corsHeaders });
    }

    const aiResponse = await response.json();
    const textContent = aiResponse.content?.[0]?.text;

    if (!textContent) {
      return new Response(JSON.stringify({ error: 'Empty AI response' }), { status: 500, headers: corsHeaders });
    }

    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in AI response' }), { status: 500, headers: corsHeaders });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
