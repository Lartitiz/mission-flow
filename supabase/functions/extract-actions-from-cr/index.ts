import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistante IA de Laetitia Mattioli (Nowadays Agency). Tu analyses un compte-rendu de réunion pour en extraire les actions à faire.

Tu reçois aussi la liste des actions existantes pour éviter les doublons et pour proposer des mises à jour de statut.

RÈGLE CRITIQUE — PÉRIMÈTRE CONTRACTUEL :
Si une "Proposition validée" est fournie, elle définit le périmètre du travail dû. Tu dois :
- Ne créer une action QUE si elle correspond à un livrable/engagement présent dans la proposition, OU si elle est explicitement demandée dans le compte-rendu.
- NE JAMAIS ajouter de "bonnes idées", suggestions d'amélioration, optimisations ou tâches d'anticipation que personne n'a demandées.
- NE PAS découper un livrable en dix micro-tâches : reste au niveau des engagements réels de la proposition.
- Toute action explicitement demandée en séance mais absente de la proposition doit être marquée out_of_scope=true, avec out_of_scope_reason court (ex : "demandé en séance, non prévu dans la proposition") et un scope_hint parmi :
  - "atelier" : sujet à traiter/creuser lors d'un prochain atelier (pas un livrable supplémentaire)
  - "avenant" : vrai travail supplémentaire, à cadrer/facturer à part
Les actions dans le périmètre ont out_of_scope=false.
Si aucune proposition n'est fournie, mets out_of_scope=false partout, et reste malgré tout strictement collé à ce qui est dit dans le compte-rendu.

Extrais :
- NOUVELLES ACTIONS : tâches mentionnées qui n'existent pas encore
- MISES À JOUR : changements de statut, de date, ou de description pour des actions existantes

RÈGLE CRITIQUE — ZÉRO DOUBLON AVEC LE PLAN EXISTANT :
Avant de proposer une nouvelle action, compare-la au SENS (pas seulement au libellé) de TOUTES les actions existantes, quel que soit leur statut (y compris terminées, livrées, validées ou faites) et quelle que soit la personne assignée.
- Même livrable ou même tâche reformulée (ex : "Rédiger la page À propos" / "Écrire le texte de la page qui je suis") = DOUBLON → ne crée rien.
- Si le compte-rendu apporte une info nouvelle sur une action existante (date, précision, avancement), propose une MISE À JOUR de cette action, jamais une nouvelle action.
- Une sous-partie d'une action existante (ex : "choisir les photos" alors que "Refaire la page d'accueil" existe) n'est PAS une nouvelle action, sauf si elle est explicitement assignée à une autre personne (typiquement une validation ou un envoi côté client·e).
- Dans le doute, ne crée pas : un doublon coûte plus cher qu'un oubli, Laetitia peut toujours ajouter une action à la main.

RÈGLE CRITIQUE — PISTES ABANDONNÉES :
Une transcription contient beaucoup d'idées évoquées puis écartées. Tu n'extrais que ce qui est DÉCIDÉ à l'issue de l'échange.
- Une idée explorée puis écartée dans la même réunion ("finalement non", "on laisse tomber", "pas pour l'instant", "on verra plus tard", "c'est pas prioritaire", ou remplacée par une autre option) → aucune action.
- Si plusieurs options ont été discutées, ne garde que celle retenue.
- Une simple réflexion à voix haute, une hypothèse ou une envie sans décision ("ce serait bien de…", "on pourrait peut-être…") → aucune action, sauf si une suite concrète est actée.
- Si un "Historique de la mission" est fourni (décisions des sessions précédentes, journal) : ne repropose JAMAIS une piste qui y a été abandonnée, reportée ou remplacée, sauf si le compte-rendu la relance explicitement (dans ce cas, précise-le dans la description : "relancé en séance du …").
- Si des "Suggestions déjà écartées par Laetitia" sont fournies : ne les repropose pas, même reformulées, sauf demande explicite et nouvelle dans le compte-rendu.

STATUTS VALIDES (pour les mises à jour de statut) :
- Actions de Laetitia : not_started, in_progress, to_validate, validated, delivered, done (= terminée).
- Actions de la cliente : not_started, in_progress, done (= fait).

RÈGLE CRITIQUE — ÉQUILIBRE LAETITIA / CLIENT·E (dans les limites du périmètre) :
Pour CHAQUE sujet abordé dans le CR, tu te poses systématiquement DEUX questions :
1. "Qu'est-ce que Laetitia doit faire ?" → action avec assignee="laetitia"
2. "Qu'est-ce que le/la décisionnaire côté client doit faire ?" → action avec assignee="client"

Les actions client typiques à NE PAS oublier :
- Validations à donner (sur un visuel, un texte, une offre, un tarif)
- Contenus à fournir (photos, textes, témoignages, chiffres internes)
- Décisions à prendre (arbitrages stratégiques, choix d'options)
- Infos à transmettre (accès comptes, documents, contacts)
- Retours à faire (feedback sur livrable, relecture)
- Tests/expérimentations à mener côté terrain
- RDV/échanges à organiser de leur côté (équipe interne, prestataire)

Si le CR mentionne un livrable de Laetitia, il y a presque toujours une action client associée (valider, relire, partager). Ne te limite JAMAIS aux seules tâches de Laetitia. Cet équilibre ne t'autorise pas à sortir du périmètre : il s'applique aux sujets réellement abordés.

Pour chaque nouvelle action, détermine :
- assignee : "laetitia" ou "client"
- category : la catégorie la plus adaptée parmi : Cadrage, Messages, Site web, Social media, Emailing, Branding, Cross-posting, Influence/Presse, Formation, Commercial, Support, Finalisation, Autre
- task : intitulé court (verbe d'action)
- description : détail (1-2 phrases)
- channel : si applicable, parmi : Instagram, LinkedIn, Pinterest, Site web, Brevo, Facebook, Telegram/WhatsApp, Identité, Orga, Autre
- target_date : si mentionnée (format YYYY-MM-DD)
- phase : la phase temporelle de l'action. Pour un accompagnement Binôme 6 mois : "mois_1_2", "mois_3", "mois_4_5", "mois_6". Pour Agency 3 mois : "mois_1", "mois_2", "mois_3". Mission courte : "phase_1", "phase_2". Récurrent : "continu".
- out_of_scope : true/false
- out_of_scope_reason : string (vide si dans le périmètre)
- scope_hint : "atelier" | "avenant" | "" (vide si dans le périmètre)

Réponds UNIQUEMENT en JSON valide : { "new_actions": [{ "assignee": "...", "category": "...", "task": "...", "description": "...", "channel": "...", "target_date": "...", "phase": "...", "out_of_scope": false, "out_of_scope_reason": "", "scope_hint": "" }], "updates": [{ "action_id": "...", "field": "status|target_date|description", "old_value": "...", "new_value": "...", "reason": "..." }] }`;

// Même normalisation que src/lib/action-dedupe.ts (non importable depuis Deno).
const normalizeTask = (task: string): string =>
  (task || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isSameTask = (a: string, b: string): boolean => {
  const na = normalizeTask(a);
  const nb = normalizeTask(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 15 && nb.length >= 15) return na.includes(nb) || nb.includes(na);
  return false;
};

// Sections des notes structurées qui portent les arbitrages d'une session.
const HISTORY_SECTIONS = ["résultats clés", "décisions prises", "points de vigilance"];

type HistoryContext = { historyText: string; rejected: { task: string; assignee?: string | null }[] };

// Récupère l'historique de la mission (décisions des sessions précédentes,
// journal, suggestions déjà écartées) pour que l'IA ne ressorte pas des pistes
// abandonnées. En cas d'erreur, on continue sans : l'extraction reste possible.
async function loadHistory(
  supabase: ReturnType<typeof createClient>,
  missionId: string,
  currentSessionId: string | null,
): Promise<HistoryContext> {
  const [{ data: sessions }, { data: journal }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date, topic, structured_notes")
      .eq("mission_id", missionId)
      .order("session_date", { ascending: true }),
    supabase
      .from("journal_entries")
      .select("entry_date, content")
      .eq("mission_id", missionId)
      .order("entry_date", { ascending: false })
      .limit(40),
  ]);

  const rejected: HistoryContext["rejected"] = [];
  const sessionBlocks: string[] = [];
  for (const sess of (sessions ?? []) as any[]) {
    const sn = sess.structured_notes ?? {};
    if (Array.isArray(sn._rejected_suggestions)) {
      for (const r of sn._rejected_suggestions) {
        if (r?.task) rejected.push({ task: r.task, assignee: r.assignee ?? null });
      }
    }
    if (sess.id === currentSessionId) continue;
    const sections = Array.isArray(sn.sections) ? sn.sections : [];
    const kept = sections
      .filter((sec: any) => HISTORY_SECTIONS.includes(String(sec?.title ?? "").trim().toLowerCase()))
      .map((sec: any) => `### ${sec.title}\n${sec.content}`);
    if (kept.length) {
      sessionBlocks.push(`## Session du ${sess.session_date}${sess.topic ? ` (${sess.topic})` : ""}\n${kept.join("\n")}`);
    }
  }

  const journalLines = ((journal ?? []) as any[])
    .reverse()
    .map((j) => `- ${j.entry_date} : ${j.content}`);

  let historyText = "";
  if (sessionBlocks.length) historyText += `Décisions des sessions précédentes :\n\n${sessionBlocks.join("\n\n")}\n\n`;
  if (journalLines.length) historyText += `Journal de bord (récent) :\n${journalLines.join("\n")}\n\n`;
  // Les sessions les plus récentes comptent le plus : on coupe par le début.
  if (historyText.length > 20000) historyText = "…\n" + historyText.slice(-20000);

  return { historyText, rejected };
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meeting_notes, existing_actions, mission_type, proposal_content, mission_id, session_id } = await req.json();

    if (!meeting_notes || typeof meeting_notes !== "string") {
      return new Response(JSON.stringify({ error: "meeting_notes est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let proposalText = "";
    if (proposal_content) {
      const sections = (proposal_content as any).sections ?? proposal_content;
      proposalText = Array.isArray(sections)
        ? sections.map((s: any) => `## ${s.title}\n${s.content}`).join("\n\n")
        : JSON.stringify(proposal_content);
      if (proposalText.length > 30000) proposalText = proposalText.slice(0, 30000);
    }

    let history: HistoryContext = { historyText: "", rejected: [] };
    if (typeof mission_id === "string" && mission_id) {
      try {
        history = await loadHistory(supabase, mission_id, typeof session_id === "string" ? session_id : null);
      } catch (e) {
        console.warn("Historique de mission indisponible:", e);
      }
    }
    const rejectedText = history.rejected.length
      ? `Suggestions déjà écartées par Laetitia (ne pas reproposer) :\n${history.rejected
          .slice(-150)
          .map((r) => `- ${r.task}${r.assignee ? ` (${r.assignee})` : ""}`)
          .join("\n")}\n\n`
      : "";

    const userPrompt = `${
      proposalText
        ? `Proposition validée (périmètre contractuel de référence) :\n\n${proposalText}\n\n---\n\n`
        : `Aucune proposition validée fournie pour cette mission.\n\n`
    }${
      history.historyText ? `Historique de la mission (pour repérer les pistes abandonnées) :\n\n${history.historyText}---\n\n` : ""
    }${rejectedText}Compte-rendu de réunion :

${meeting_notes}

Actions existantes :
${JSON.stringify(existing_actions ?? [], null, 2)}

Type de mission : ${mission_type || "non_determine"}`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        model: "claude-sonnet-5-5",
        thinking: { type: "between_tools" },
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
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
    const textContent = result.content?.find((b: any) => b.type === "text")?.text;
    if (!textContent) {
      return new Response(JSON.stringify({ error: "Réponse Claude vide" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonStr = textContent.trim();
    // Réponse tronquée (max_tokens) : la fence fermante manque, on prend tout
    // ce qui suit l'ouverture.
    const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1].trim();
    else jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();

    // Répare un JSON coupé en plein vol : on remonte au dernier objet complet
    // et on referme les tableaux/objets ouverts, plutôt que de tout perdre.
    const repairTruncatedJson = (s: string): string => {
      let depth = 0, inStr = false, esc = false, lastSafe = -1;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") { depth--; if (depth === 0) return s.slice(0, i + 1); }
        else if (c === "," && depth === 2) lastSafe = i;
      }
      if (lastSafe === -1) return s;
      let head = s.slice(0, lastSafe);
      // referme les niveaux encore ouverts (objet racine + tableau courant)
      const openers: string[] = [];
      let d = 0; inStr = false; esc = false;
      for (let i = 0; i < head.length; i++) {
        const c = head[i];
        if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === "{" || c === "[") { openers.push(c); d++; }
        else if (c === "}" || c === "]") { openers.pop(); d--; }
      }
      while (openers.length) head += openers.pop() === "[" ? "]" : "}";
      return head;
    };

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      try {
        parsed = JSON.parse(repairTruncatedJson(jsonStr));
        console.warn("JSON tronqué réparé", { stop_reason: result.stop_reason });
      } catch {
        console.error("Invalid JSON from Claude:", result.stop_reason, textContent.slice(0, 2000));
        return new Response(JSON.stringify({ error: "Réponse JSON invalide" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (!Array.isArray(parsed?.new_actions)) parsed.new_actions = [];
    if (!Array.isArray(parsed?.updates)) parsed.updates = [];

    // Filet de sécurité : l'IA laisse parfois passer un doublon évident ou une
    // suggestion déjà écartée. On les retire avant de les présenter.
    const existingList = (Array.isArray(existing_actions) ? existing_actions : []) as {
      task?: string;
      assignee?: string;
    }[];
    const kept: any[] = [];
    let dropped = 0;
    for (const a of parsed.new_actions) {
      const task = String(a?.task ?? "");
      const sameAssignee = (other?: string | null) => !a?.assignee || !other || other === a.assignee;
      const duplicate =
        !task.trim() ||
        existingList.some((e) => sameAssignee(e.assignee) && isSameTask(e.task ?? "", task)) ||
        history.rejected.some((r) => sameAssignee(r.assignee) && isSameTask(r.task, task)) ||
        kept.some((k) => sameAssignee(k.assignee) && isSameTask(k.task, task));
      if (duplicate) dropped++;
      else kept.push(a);
    }
    parsed.new_actions = kept;
    if (dropped) parsed.filtered_duplicates = dropped;


    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-actions-from-cr error:", e);
    const message = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
