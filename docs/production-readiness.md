# Mise en production SOUCLOU

Cette liste distingue les contrôles présents dans le dépôt des décisions et
opérations qui dépendent du responsable du traitement, du conseil juridique et
de l'hébergeur. Elle ne constitue pas une attestation de conformité.

## Protections déjà présentes

- Les lectures et écritures applicatives exigent une session active et vérifient
  le périmètre d'organisation, d'établissement et les rôles côté serveur.
- Les changements sensibles et certains exports sont inscrits au journal
  d'audit ; les exports CSV neutralisent les formules de tableur.
- Les connexions credentials sont limitées à 8 tentatives par nom d'utilisateur
  normalisé et par fenêtre de 15 minutes. Les clés de quota sont des HMAC ; les
  compteurs inactifs depuis 24 heures sont purgés. Une protection complémentaire
  par IP reste à activer au niveau du proxy/CDN de confiance.
- Les headers `nosniff`, `X-Frame-Options`, `Referrer-Policy` et
  `Permissions-Policy` sont configurés. HSTS est envoyé en environnement de
  production.
- Les migrations sont versionnées. Le bootstrap crée le premier fondateur et
  peut réinitialiser les credentials d'un fondateur unique déjà existant, sans
  recréer son organisation.

## Décisions réglementaires à verser au dépôt

Le responsable du traitement doit fournir les décisions approuvées, leurs
références et la personne qui les a validées afin qu'elles deviennent des
exigences vérifiables :

- Identité du responsable du traitement, finalités et bases légales retenues
  pour les comptes, dossiers scolaires, présences, notes et notifications.
- Référence et statut des formalités applicables auprès de l'autorité ivoirienne
  de protection des données, tels que déterminés par le conseil compétent.
- Durées de conservation par catégorie de données, y compris les journaux
  d'audit, les exports, les comptes inactifs et les sauvegardes.
- Procédure et délais approuvés pour l'accès, la rectification, l'opposition,
  la suppression ou l'archivage des données et les demandes des familles.
- Règles pour les mineurs, les représentants légaux, le rattachement familial et
  les communications d'informations scolaires.
- Pays et régions de traitement, transferts éventuels, sous-traitants et
  contrats de traitement, y compris pour les services de notifications externes
  éventuellement retenus.
- Notice d'information approuvée, contact de confidentialité et procédure
  d'incident, y compris les délais de notification applicables.

Ne pas ajouter ici de données personnelles réelles. Les textes approuvés
peuvent être ajoutés au dépôt après validation et sans publier de dossiers
d'élèves.

## Informations nécessaires à l'opérateur

À fournir/configurer hors de cette conversation. Ne jamais coller les secrets
dans Git, les journaux ou les prompts :

- Hébergeur choisi, région de calcul, région PostgreSQL, stockage des médias et
  confirmation que ces régions respectent la décision de localisation.
- Domaine de production, DNS, terminaison TLS et reverse proxy/CDN de confiance.
  Configurer la limitation par IP à cette frontière ; ne pas se fier à un
  `X-Forwarded-For` fourni directement par un client.
- Secrets de production dans le gestionnaire de secrets : `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED` pour les migrations si le fournisseur la propose,
  `AUTH_SECRET` et `AUTH_URL`. En multi-instance, conserver une valeur stable de
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` pour un même build.
- Variables `BOOTSTRAP_USERNAME` et `BOOTSTRAP_PASSWORD` configurées
  temporairement et de façon sécurisée pour créer ou récupérer le fondateur;
  ne pas les conserver dans les logs ni les committer.
- Compte de déploiement, accès au dépôt GitHub et méthode de déploiement
  (CI/CD ou procédure manuelle). Le push du code ne crée pas l'infrastructure.
- Politique de sauvegardes chiffrées, rétention, objectifs RPO/RTO et preuve d'un
  exercice de restauration avant ouverture aux utilisateurs.
- Responsable d'astreinte, surveillance des erreurs et de la base, procédure de
  révocation/rotation des secrets et réponse aux incidents.

## Travaux applicatifs restant à cadrer

- Ajouter la limitation par IP au proxy/CDN après choix de la plateforme et de
  son mécanisme d'identification d'adresse client de confiance.
- Définir les canaux, modèles, consentements et préférences avant d'ajouter des
  notifications externes (SMS, WhatsApp ou e-mail hors connexion).
- Définir précisément les besoins d'exports supplémentaires, leurs colonnes,
  rôles, audit et règles de rétention avant de les implémenter.
- Ajouter et tester les workflows de demandes de droits et de suppression
  conformément aux décisions réglementaires fournies.
- Établir la stratégie de CSP à partir du domaine et des intégrations
  effectivement utilisés ; les règles CSP ne sont pas ajoutées sans cette
  configuration, pour éviter de bloquer Auth.js ou le rendu Next.js.

## Séquence de lancement

1. Consigner et faire relire les décisions réglementaires ci-dessus.
2. Choisir et valider l'hébergement, la région de base, les sous-traitants et
   les transferts.
3. Configurer TLS, proxy/CDN, limitation par IP, secrets, bootstrap du fondateur
  et sauvegardes dans les systèmes de l'opérateur.
4. Appliquer les migrations avec `npm.cmd run db:deploy` et créer ou récupérer
  le compte fondateur avec des secrets injectés de façon temporaire.
5. Tester en préproduction les accès refusés, l'isolation inter-écoles, le quota
  credentials, les exports, les notifications internes et la restauration.
6. Faire valider les tests d'acceptation et les notices avant d'importer toute
   donnée réelle.