## Diagnostic

L'erreur vient de `clarify-proposal` (appel fait juste avant `generate-proposal` dans le flux du bouton "Générer la proposition"). Les logs montrent un 500 — c'était dû au modèle Claude obsolète (`claude-sonnet-4-20250514`), corrigé au tour précédent vers `claude-sonnet-4-5-20250929`.

Si l'erreur revient, deux causes possibles :
1. La nouvelle version n'est pas encore active côté serveur.
2. Un autre échec API (rate-limit 429, crédits, timeout Opus pour generate-proposal) masqué par le message générique "Erreur API Claude".

## Plan

1. **Améliorer le reporting d'erreur** dans `clarify-proposal/index.ts` et `generate-proposal/index.ts` : au lieu de renvoyer `"Erreur API Claude"`, propager le status + le message Anthropic (ex : `"Claude 404: model not found"`, `"Claude 529: overloaded"`, `"Claude 429: rate limit"`). Cela permet d'identifier immédiatement la vraie cause au prochain essai.

2. **Skip intelligent de `clarify-proposal`** côté frontend (`ProposalTab.tsx`) : si la clarification échoue (500/timeout), continuer quand même vers `generate-proposal` au lieu de bloquer toute la génération. Une clarification ratée ne doit pas empêcher de produire la proposition.

3. **Vérifier le modèle Opus** dans `generate-proposal` (`claude-opus-4-1-20250805`) — confirmer qu'il répond bien via un appel test et, sinon, basculer sur l'alias stable `claude-opus-4-5` si nécessaire.

Aucune modification du prompt, de la structure de proposition, ni du modèle si l'API répond — uniquement résilience et lisibilité des erreurs.