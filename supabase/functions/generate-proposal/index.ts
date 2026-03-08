import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(tutoiement: boolean): string {
  const ton = tutoiement
    ? "Tutoiement. Ton chaleureux, direct, complice. Comme une discussion entre ami·es. Oral assumé : 'bon', 'en vrai', 'franchement', 'le truc c'est que'. Parfois cash : 'Je vais être directe'. Des apartés entre parenthèses."
    : "Vouvoiement. Ton professionnel mais chaleureux. Direct et efficace. Pas corporate, pas familier. Rassurant : on montre qu'on gère.";

  return `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency depuis 2017. Tu rédiges une proposition commerciale personnalisée.

TON : ${ton}

STRUCTURE DE LA PROPOSITION :

Tu dois produire exactement 6 sections. Pour chaque section, adapte le contenu AU CAS PRÉCIS du/de la prospect. Pas de généralités. Pas de template générique. Chaque phrase doit montrer que tu as VRAIMENT écouté.

SECTION 1 — "Ce que j'ai compris de ${tutoiement ? 'ton projet' : 'votre situation'}"

C'est la section la plus importante. Tu reformules TOUT ce que le/la prospect t'a dit, avec tes mots à toi. Tu montres que tu as capté l'essence du projet, pas juste les faits.

- Commence par situer le projet (qui, quoi, depuis quand, contexte)

- Utilise des encarts [ENCART] pour mettre en exergue : soit une phrase coup de poing de toi, soit une citation du/de la prospect reformulée

- Identifie ce qui manque aujourd'hui dans leur com' (sois directe et concrète)

- 5-8 paragraphes minimum. C'est la section la plus longue.

Format encart : [ENCART]Texte de l'encart[/ENCART]

SECTION 2 — "${tutoiement ? 'Le vrai sujet stratégique' : 'Les vrais leviers pour [nom du projet]'}"

Des recommandations numérotées (1, 2, 3, 4, 5) avec un titre en gras pour chaque point et un paragraphe d'explication concret. Pas de blabla générique. Chaque recommandation est adaptée au cas précis.

- Si c'est une solopreneuse créative : parler de positionnement, régularité tenable, Instagram, storytelling

- Si c'est une structure : parler de stratégie locale, prospection, site, référencement, presse

- Si c'est un lancement : parler de building in public, précommandes, presse, événement

Sois directe et parfois cash. Dis clairement ce qui n'est PAS prioritaire ("La priorité n'est ni Instagram, ni LinkedIn" si c'est le cas).

SECTION 3 — "Ma proposition : ${tutoiement ? 'ta binôme de com\'' : 'votre binôme de com\''}"

Commence par un encart : [ENCART]On fait ensemble. ${tutoiement ? "Tu n'es plus seul·e" : "Vous n'êtes plus seul·e"} face à ${tutoiement ? 'ta' : 'votre'} com'.[/ENCART]

Puis détaille en 2 phases :

- Phase 1 : Stratégie (Mois 1-2) — liste de ✓ avec chaque livrable concret adapté au projet

- Phase 2 : Application (Mois 3-6) — liste de ✓ avec les actions concrètes

Si c'est une mission Agency ou un format court (pas 6 mois), adapte les phases au devis réel.

Toujours finir par un encart objectif : [ENCART]L'objectif à X mois : [résumé concret de ce que ça va changer][/ENCART]

SECTION 4 — "Investissement"

Tableau clair avec le prix.

- Binôme standard : 250€ HT/mois × 6 mois = 1 500€ HT, paiement mensuel

- Agency : adapter au devis

- Autre format : adapter (comme ENSCO : 800€ en 2 fois)

Puis liste de ce qui est inclus avec des ✓.

Puis liste de ce qui n'est PAS inclus (si pertinent).

SECTION 5 — "Planning prévisionnel"

Tableau mois par mois (ou semaine par semaine si mission courte) avec les étapes clés et les livrables.

SECTION 6 — "Pourquoi travailler avec moi"

Court (2-3 paragraphes). Pas de liste de références impersonnelle.

- Adapter au profil : si le prospect est dans l'éco → mentionner L214, Oasis, Sea Shepherd

- Si c'est du yoga/bien-être → mentionner l'ENSAD, les projets lifestyle

- Toujours mentionner : 10 ans d'expérience, enseignante (ENSAD, Sup de Pub), + de 50 projets

- Mentionner le lien nowadaysagency.com/accompagnement-communication

RÈGLES ABSOLUES :

- Pas de jargon : jamais de ROI, funnel, growth hacking, synergies, scalabilité, 360, disruption

- Pas de promesses exagérées

- Écriture inclusive point médian (créateur·ices, entrepreneur·es, client·es)

- Pas de tiret cadratin (—), utiliser : ou ;

- Les ✓ sont utilisés pour les listes de livrables

- Les [ENCART]...[/ENCART] seront transformés en boîtes visuelles dans le Word

Réponds UNIQUEMENT en JSON valide : { "sections": [{ "title": "...", "content": "..." }] }`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { structured_notes, clarification_qa, mission_type, tutoiement } = await req.json();
    if (!structured_notes) {
      return new Response(JSON.stringify({ error: "structured_notes requis" }), {
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

    let userPrompt = `Type de mission : ${mission_type || "non_determine"}\n\nNotes structurées de l'appel découverte :\n${JSON.stringify(structured_notes, null, 2)}`;

    if (clarification_qa && Array.isArray(clarification_qa) && clarification_qa.length > 0) {
      userPrompt += `\n\nInformations complémentaires (questions-réponses de clarification) :\n`;
      for (const qa of clarification_qa) {
        userPrompt += `\nQ: ${qa.question}\nR: ${qa.answer}\n`;
      }
    }

    const systemPrompt = buildSystemPrompt(tutoiement ?? true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
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

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Invalid JSON from Claude:", textContent);
      return new Response(JSON.stringify({ error: "Réponse JSON invalide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    const message = e instanceof Error && e.name === "AbortError"
      ? "Timeout : la génération a pris trop de temps"
      : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
