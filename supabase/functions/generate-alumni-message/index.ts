import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MESSAGE_TYPE_DESC: Record<string, string> = {
  news: "Prise de nouvelles simple et sincère. Tu veux juste savoir comment ça va et si le projet avance.",
  three_months: "Ça fait 3 mois que la mission est terminée. Tu es curieuse de savoir ce qui a changé depuis.",
  annual: "Ça fait un an. Tu repenses à la collaboration et tu veux célébrer le chemin parcouru.",
  thought_of_you: "Tu es tombée sur quelque chose qui t'a fait penser à cette personne. Laisse un placeholder [à personnaliser] pour l'élément déclencheur.",
  referral: "Tu aimerais suggérer délicatement que si cette personne connaît quelqu'un qui a besoin d'aide en com', tu serais ravie d'en entendre parler. C'est une suggestion, PAS une demande.",
};

function formatNotes(notes: unknown): string {
  if (!notes) return '(aucune)';
  if (Array.isArray(notes)) {
    return notes.map((s: { title?: string; content?: string }) => `- ${s.title || ''}: ${s.content || ''}`).join('\n');
  }
  if (typeof notes === 'object') {
    return Object.entries(notes).map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  }
  return String(notes).slice(0, 2000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { mission_id, message_type } = await req.json();
    if (!mission_id || !message_type || !MESSAGE_TYPE_DESC[message_type]) {
      return new Response(JSON.stringify({ error: 'mission_id and valid message_type required' }), { status: 400, headers: corsHeaders });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [missionRes, discoveryRes, kickoffRes, actionsRes, sessionsRes, journalRes] = await Promise.all([
      sb.from('missions').select('client_name, mission_type, amount, notes').eq('id', mission_id).single(),
      sb.from('discovery_calls').select('structured_notes').eq('mission_id', mission_id).limit(1).maybeSingle(),
      sb.from('kickoffs').select('structured_notes').eq('mission_id', mission_id).limit(1).maybeSingle(),
      sb.from('actions').select('task, description, category, status').eq('mission_id', mission_id),
      sb.from('sessions').select('structured_notes, session_date').eq('mission_id', mission_id).order('session_date', { ascending: false }).limit(3),
      sb.from('journal_entries').select('content, entry_date').eq('mission_id', mission_id).order('entry_date', { ascending: false }).limit(5),
    ]);

    const mission = missionRes.data;
    if (!mission) {
      return new Response(JSON.stringify({ error: 'Mission not found' }), { status: 404, headers: corsHeaders });
    }

    const isBinome = mission.mission_type === 'binome';
    const tonDirective = isBinome
      ? "Tutoiement, chaleureux et complice"
      : "Vouvoiement, professionnel mais chaleureux";

    const systemPrompt = `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency. Tu rédiges un message de suivi pour un·e ancien·ne client·e avec qui la mission est terminée.

CE N'EST PAS UNE RELANCE COMMERCIALE. C'est un message sincère de prise de nouvelles. Tu te soucies vraiment de cette personne et de son projet.

TON : ${tonDirective}. Chaleureux, sincère, oral assumé mais pas surjoué. Écriture inclusive avec point médian.

TYPE DE MESSAGE : ${MESSAGE_TYPE_DESC[message_type]}

RÈGLES :
- Maximum 150-200 mots
- Mentionner des éléments concrets de la collaboration (sujets travaillés, victoires, défis surmontés)
- Ne JAMAIS mentionner de prix, d'offre, de promotion
- Ne JAMAIS utiliser de jargon marketing
- Ne JAMAIS utiliser de tiret cadratin (—), utiliser : ou ;
- Signer "Laetitia"
- Si le type est 'thought_of_you', laisser un placeholder [à personnaliser] pour l'élément déclencheur
- Si le type est 'referral', rester très délicat : c'est une suggestion, pas une demande

Réponds en JSON : { "subject": "Objet de l'email", "body": "Corps du message" }`;

    const actions = actionsRes.data || [];
    const sessions = sessionsRes.data || [];
    const journal = journalRes.data || [];

    const userPrompt = `### CLIENT·E
Nom : ${mission.client_name}
Type de mission : ${mission.mission_type}
${mission.amount ? `Montant : ${mission.amount}€ HT` : ''}
${mission.notes ? `Notes : ${mission.notes.slice(0, 500)}` : ''}

### NOTES DISCOVERY
${formatNotes(discoveryRes.data?.structured_notes)}

### NOTES KICKOFF
${formatNotes(kickoffRes.data?.structured_notes)}

### ACTIONS RÉALISÉES
${actions.length > 0 ? actions.map(a => `- [${a.status}] ${a.task}${a.category ? ` (${a.category})` : ''}${a.description ? ` : ${a.description.slice(0, 100)}` : ''}`).join('\n') : '(aucune)'}

### DERNIÈRES SESSIONS
${sessions.length > 0 ? sessions.map(s => `- ${s.session_date} : ${formatNotes(s.structured_notes).slice(0, 300)}`).join('\n') : '(aucune)'}

### JOURNAL
${journal.length > 0 ? journal.map(j => `- ${j.entry_date} : ${j.content.slice(0, 150)}`).join('\n') : '(aucun)'}`;

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
    const msg = error instanceof Error && error.name === 'AbortError'
      ? 'La génération a pris trop de temps. Réessaie.'
      : (error instanceof Error ? error.message : 'Erreur interne');
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
