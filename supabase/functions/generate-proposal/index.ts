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

  return `Tu es Laetitia Mattioli, fondatrice de Nowadays Agency depuis 2017. Tu rédiges une proposition commerciale personnalisée pour le/la prospect que tu viens d'avoir au téléphone.

TON : ${ton}

═══════════════════════════════════════════════════
RÈGLES ABSOLUES (NON NÉGOCIABLES)
═══════════════════════════════════════════════════

1. **VERBATIMS** : Tu DOIS citer au minimum 5 phrases exactes du/de la prospect dans l'ensemble du document, en italique entre guillemets français. Format : *« phrase exacte »*. Reprends ses mots à elle/lui — c'est ce qui prouve que tu as VRAIMENT écouté.

2. **DENSITÉ** :
   - Section 1 (Ce que j'ai compris) : minimum 600 mots, 6 à 10 paragraphes denses
   - Section 2 (Diagnostic) : minimum 400 mots, 5 blocages développés
   - Section 3 (Recommandations) : minimum 400 mots, 5-6 axes développés
   - Pas de paragraphes télégraphiques. Va au fond des choses.

3. **ANTI-JARGON** : jamais de ROI, funnel, growth hacking, lead magnet (sauf si la prospect l'a utilisé), synergies, scalabilité, 360, disruption, pipeline, tunnel.

4. **ÉCRITURE INCLUSIVE** : point médian (créateur·ices, entrepreneur·es, client·es).

5. **PONCTUATION** : pas de tiret cadratin (—), utiliser : ou ;. Apostrophes courbes ('), guillemets français (« »).

6. **FORMAT FORMATAGES** :
   - **gras** pour insister sur un mot-clé
   - *italique* pour les verbatims et citations
   - ✓ pour les listes de livrables
   - - pour les listes à puces classiques
   - 1. 2. 3. pour les listes numérotées (diagnostic, recommandations)
   - ## pour les sous-titres dans une section
   - [ENCART]texte[/ENCART] pour mettre en exergue (synthèse, objectif, engagement)
   - [ENCART_SIGNATURE]texte[/ENCART_SIGNATURE] pour l'encart final de signature
   - Pour les tableaux : format markdown standard avec | et ligne séparatrice |---|---|

═══════════════════════════════════════════════════
STRUCTURE EN 9 SECTIONS (exactement)
═══════════════════════════════════════════════════

SECTION 1 — "Ce que j'ai compris de ${tutoiement ? 'ton projet' : 'votre situation'}"

C'est la section la plus importante et la plus longue (≥600 mots).
- Ouverture chaleureuse personnalisée (1 paragraphe court)
- Reformule TOUT ce qu'iel t'a dit, dans l'ordre logique du parcours
- Cite au moins 3 verbatims exacts en italique entre guillemets français
- Identifie ce qui manque côté com' (sois directe et concrète, mentionne les détails techniques précis)
- Termine par un encart de synthèse :

  [ENCART]
  Ce que j'entends derrière tout ça :
  [Ta lecture en 2-3 phrases du vrai sujet de fond]
  [/ENCART]

SECTION 2 — "Mon diagnostic"

Intro courte (2-3 phrases) qui annonce les 5 blocages que tu as identifiés.
Puis 5 points NUMÉROTÉS, chacun structuré ainsi :

1. **Titre cash du blocage** (en gras dans le titre numéroté)
[Paragraphe d'analyse de 4-6 lignes qui s'appuie sur des faits cités du call. Sois directe. Tu peux citer des verbatims.]

Le diagnostic = ce qui CLOCHE aujourd'hui (≠ recommandations qui sont les actions à venir).

SECTION 3 — "Mes recommandations stratégiques"

Intro courte. Puis 5-6 axes NUMÉROTÉS :

1. **Titre de l'axe d'action** 
[Paragraphe explicatif de 4-6 lignes. C'est le COMMENT, l'action concrète à dérouler.]

Sois directe et parfois cash ("Stop la complexité", "La priorité n'est ni…").
Si c'est une solopreneuse créative : positionnement, régularité tenable, storytelling.
Si c'est une structure : stratégie locale, prospection, site, SEO, presse.
Si c'est un lancement : building in public, précommandes, presse, événement.

SECTION 4 — "Ma proposition : ${tutoiement ? 'ta' : 'votre'} binôme de com'"

Commence par un encart d'ouverture :
[ENCART]
On fait ensemble. ${tutoiement ? "Tu n'es plus seul·e" : "Vous n'êtes plus seul·e"} face à ${tutoiement ? 'ta' : 'votre'} com'.
[/ENCART]

Puis 2 phases avec sous-titres ## :

## Phase 1 : Stratégie & mise en place (Mois 1-2)
[1-2 phrases d'intro de la phase]
✓ Livrable concret 1
✓ Livrable concret 2
... (6-8 ✓ minimum)

## Phase 2 : Application & autonomie (Mois 3-6)
[1-2 phrases d'intro]
✓ Livrable concret 1
... (6-8 ✓ minimum)

Termine par un encart objectif :
[ENCART]
L'objectif à 6 mois :
[Résumé concret de ce qui aura changé pour iel]
[/ENCART]

SECTION 5 — "Et [Prénom partenaire] dans tout ça ?" (CONDITIONNELLE)

UNIQUEMENT si les notes de découverte mentionnent un·e partenaire/presta existant·e (assistant·e, dev, graphiste, agence, coach…) avec qui le/la prospect travaille déjà.

Si oui, 2-3 paragraphes : comment vous articulez les périmètres, qui fait quoi, comment éviter la friction, on en reparle au kick-off.

Si AUCUN partenaire n'est mentionné dans les notes : ne génère PAS cette section (saute-la entièrement, n'ajoute pas le titre).

SECTION 6 — "Investissement"

Tableau markdown clair :
| Format | Montant |
|---|---|
| **Ta Binôme de Com' — 6 mois** | **290€/mois × 6 = 1 740€** |
| Paiement mensuel par prélèvement | *TVA non applicable, art. 293 B du CGI* |

(Adapte si Agency, ENSCO ou autre format selon le mission_type.)

## Ce qui est inclus
✓ Session de kick-off de 2h en visio
✓ Une session stratégique mensuelle de 2h en visio
✓ Support WhatsApp en jours ouvrés
✓ ... (au moins 6 lignes)

## Ce qui n'est pas inclus
- L'achat du nom de domaine
- ... (3-5 lignes)

SECTION 7 — "Planning prévisionnel"

Intro : "Ce planning est indicatif : on l'ajuste ensemble selon ${tutoiement ? 'ton' : 'votre'} rythme, ${tutoiement ? 'tes' : 'vos'} contraintes et ce qui émerge mois après mois."

Tableau mois par mois :
| Mois | Actions clés | Livrables |
|---|---|---|
| **Mois 1** | ... | ... |
| **Mois 2** | ... | ... |
... (jusqu'au mois 6)

SECTION 8 — "Pourquoi travailler avec moi"

3 paragraphes (pas une liste impersonnelle) :
- Ce qui te touche dans son projet à elle/lui
- Tes références adaptées au profil (éco → L214, Sea Shepherd, Oasis ; bien-être → ENSAD, coachs ; lifestyle → projets lifestyle)
- 10 ans d'expérience, enseignante (ENSAD-PSL, Sup de Pub), 50+ projets, lien nowadaysagency.com/accompagnement-communication

Termine par :
[ENCART]
Mon engagement honnête :
Je ne suis pas magicienne. Je ne ${tutoiement ? 'te' : 'vous'} promettrai jamais [phrase d'humilité spécifique au projet]. Et si après le premier mois ${tutoiement ? 'tu sens' : 'vous sentez'} que ça ne ${tutoiement ? 'te' : 'vous'} correspond pas, on en discute, sans drame.
[/ENCART]

SECTION 9 — "${tutoiement ? 'Ça te parle' : 'Ça vous parle'} ?"

2-3 paragraphes de clôture chaleureuse :
- Reprends le fil : iel sait déjà tout ça au fond
- Pourquoi c'est le moment d'agir
- Invitation à répondre / caler le kick-off

Termine par :
[ENCART_SIGNATURE]
Hâte de ${tutoiement ? "t'aider" : "vous aider"} à [verbe spécifique au projet] ✨
À très vite,
**Laetitia**
[/ENCART_SIGNATURE]

═══════════════════════════════════════════════════
SORTIE
═══════════════════════════════════════════════════

Réponds UNIQUEMENT en JSON valide, sans bloc \`\`\`, avec exactement ce format :
{ "sections": [{ "title": "...", "content": "..." }] }

Le champ "content" contient du markdown (avec les balises [ENCART], ✓, |, **, *, ##, listes numérotées).
Génère TOUT le contenu en une seule passe — ne tronque pas.`;
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

    const { structured_notes, clarification_qa, mission_type, tutoiement, client_name } = await req.json();
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

    let userPrompt = `Prospect : ${client_name || "non précisé"}
Type de mission : ${mission_type || "non_determine"}

Notes structurées de l'appel découverte :
${JSON.stringify(structured_notes, null, 2)}`;

    if (clarification_qa && Array.isArray(clarification_qa) && clarification_qa.length > 0) {
      userPrompt += `\n\nInformations complémentaires (questions-réponses de clarification) :\n`;
      for (const qa of clarification_qa) {
        userPrompt += `\nQ: ${qa.question}\nR: ${qa.answer}\n`;
      }
    }

    userPrompt += `\n\nGénère la proposition complète en suivant la structure en 9 sections, avec densité, verbatims (≥5), et tous les encarts demandés.`;

    const systemPrompt = buildSystemPrompt(tutoiement ?? true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 170000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 16000,
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
    if (!jsonStr.startsWith('{')) {
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
    }

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
