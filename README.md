# SOUCLOU

Plateforme de gestion scolaire destinée aux établissements de Côte d'Ivoire,
en cours de construction. Aucune donnée réelle d'élève ne doit y être ajoutée.

## Stack technique

- Next.js App Router, React et TypeScript strict
- Tailwind CSS
- PostgreSQL et Prisma
- Auth.js avec identifiants locaux, lien e-mail Resend optionnel et validation manuelle du compte
- ESLint, vérification TypeScript et Vitest
- Interface française (`fr-CI`) et fuseau par défaut `Africa/Abidjan`

## Développement local

Prérequis : Node.js compatible avec Next.js 16 et npm.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:bootstrap
npm.cmd run dev
```

Ouvrir http://localhost:3000. Dans PowerShell, `npm.cmd` évite le blocage de
`npm.ps1` si la politique locale interdit l'exécution des scripts.

Pour créer une base PostgreSQL locale avec Docker, choisissez un mot de passe
de développement et utilisez-le dans `DATABASE_URL` :

```powershell
docker run --name souclou-postgres --restart unless-stopped `
  -e POSTGRES_USER=souclou -e POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD `
  -e POSTGRES_DB=souclou -p 127.0.0.1:55432:5432 `
  -v souclou_pgdata:/var/lib/postgresql/data -d postgres:17-alpine
```

Remplacez `YOUR_LOCAL_PASSWORD` par le même mot de passe que dans
`DATABASE_URL`.

Le port est publié uniquement sur la boucle locale. Si le port `55432` est
occupé, choisissez un autre port côté hôte et adaptez `DATABASE_URL`. Le client
Prisma est généré automatiquement à l'installation.

La première organisation et son fondateur se créent une seule fois après la
migration. Renseigner les variables `BOOTSTRAP_*` décrites ci-dessous avant
d'exécuter `db:bootstrap`. Si une organisation existe déjà, cette commande
met à jour les identifiants du seul fondateur actif existant sans modifier
l'organisation; dans ce cas seuls `BOOTSTRAP_USERNAME` et
`BOOTSTRAP_PASSWORD` sont nécessaires. Le fondateur se connecte avec son nom
d'utilisateur et son mot de passe. L'opération est transactionnelle et refuse
une base sans fondateur unique ou un compte fondateur suspendu.

Pour récupérer le fondateur de production, renseigner la connexion PostgreSQL
à jour et `BOOTSTRAP_USERNAME` / `BOOTSTRAP_PASSWORD` dans `.env`, puis exécuter
`npm.cmd run db:bootstrap:production`. Cette commande ne charge pas
`.env.local` et utilise `DATABASE_URL_UNPOOLED` si elle est renseignée. Ne
transmettre ni mot de passe ni URL de base dans un message ou un journal.

## Contrôles

Pour démarrer PostgreSQL localement avec la composition fournie :

```powershell
docker compose up -d postgres
```

Le service écoute uniquement sur `127.0.0.1:55432` et utilise le volume
`souclou_pgdata`. Remplacez le mot de passe d’exemple dans `.env.local` avant
les migrations ; n’utilisez jamais de données réelles dans cet environnement.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run build
```

## Variables d'environnement

La connexion par identifiants locaux fonctionne sans fournisseur e-mail. Pour
activer les liens de connexion Resend, renseigner `RESEND_API_KEY` et
`RESEND_FROM` dans l'environnement local ou de production. Ces valeurs restent
des secrets et ne doivent jamais être ajoutées au dépôt.

Renseigner localement `DATABASE_URL`, `AUTH_SECRET` et `AUTH_URL` pour activer
la connexion par identifiants. Le bootstrap utilise `BOOTSTRAP_USERNAME`,
`BOOTSTRAP_PASSWORD`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`,
`BOOTSTRAP_ORGANIZATION`, `BOOTSTRAP_SCHOOL` et `BOOTSTRAP_SCHOOL_CODE`.
Ne jamais committer `.env.local`, un secret ou des données scolaires réelles.
Utiliser uniquement des données fictives pour les développements et tests.

Générer `AUTH_SECRET` localement avant d'activer Auth.js :

```powershell
node.exe -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Fondations livrées

Le schéma Prisma pose les utilisateurs en attente d'approbation, organisations,
établissements, appartenances à périmètre organisation/établissement, années
scolaires, classes, élèves, inscriptions et journal d'audit. Les années et
classes sont propres à un établissement ; les cycles proposés sont
préscolaire, primaire, collège et lycée. Les dates scolaires sont configurées
par établissement plutôt qu'imposées. Les actions de structure sont réservées
au fondateur ou à la direction des études ; les inscriptions sont accessibles à
la direction et au personnel administratif. Les inscriptions exigent une
classe de l'année active. La saisie quotidienne des présences est accessible à
la direction, aux éducateurs et aux enseignants affectés à la classe. Les
modules pédagogiques permettent de rattacher un parent après approbation de la
direction, d'affecter des enseignants, de saisir et corriger des notes avec
contrôle de l'année scolaire et journalisation des corrections, et de configurer
des emplois du temps sans chevauchement. L'espace famille limite les notes et
présences aux élèves liés au compte parent. Les événements d'audit ne
contiennent pas les noms d'élèves. La migration initiale empêche les
modifications/suppressions du journal et rattache chaque entrée d'établissement
à la bonne organisation.

Auth.js utilise les identifiants locaux par défaut et peut utiliser les liens
Resend lorsque les variables correspondantes sont configurées. Créer le
fondateur initial avec la commande de bootstrap ; les comptes suivants sont
créés par l'utilisateur avec nom d'utilisateur et mot de passe puis sont
approuvés par l'administration avant d'accéder au portail. Seul un fondateur
peut attribuer les rôles de direction des études et d'éducateur, qui disposent
du pouvoir d'approbation des comptes. L'identifiant transmis aux services
d'autorisation doit provenir d'une session vérifiée côté serveur. Les lectures
et écritures pédagogiques et familiales contrôlent également le périmètre
d'établissement et les appartenances actives.

## Sécurité et périmètre

Les contrôles d'accès devront être faits côté serveur pour chaque lecture et
écriture. Le périmètre d'établissement devra provenir de l'appartenance active
de l'utilisateur, jamais d'un identifiant fourni par le navigateur. Les accès
parent-enfant devront être vérifiés ; les accès inter-établissements seront
refusés sans délégation explicite. La gouvernance des publications est
configurable par catégorie (avis, événements et informations officielles), avec
des rôles approbateurs et un quorum distinct. L'auteur ne peut pas approuver sa
propre publication ; seules les publications approuvées sont visibles des
familles. Les notifications internes sont limitées aux appartenances actives.
Les exports CSV du registre des élèves et des feuilles d'appel quotidiennes
sont journalisés, accessibles aux seuls rôles autorisés et neutralisent les
formules de tableur. L'export des présences est limité à une classe, une date et
une année scolaire active ; les élèves sans statut saisi sont explicitement
signalés. Le registre permet la correction des informations, le
retrait/rétablissement d'une inscription et l'archivage/restauration d'un
élève ; l'archivage désactive les inscriptions et les liens familiaux actifs
sans effacer l'historique.

Le produit cible la Côte d'Ivoire. Les mots de passe sont stockés avec un
hachage sécurisé et les tentatives de connexion sont limitées par username.
Les comptes en attente restent bloqués jusqu'à validation. Les headers de
sécurité de base sont configurés dans Next.js. Une limitation complémentaire
par IP doit encore être activée au niveau du proxy/CDN de confiance choisi
pour la production.
Les décisions juridiques peuvent être établies hors du dépôt, mais leurs
références, durées de conservation, bases légales, règles concernant les
mineurs et transferts doivent être consignés avant de qualifier l'application
de conforme. Le détail des entrées nécessaires et des opérations restant à
configurer est suivi dans [docs/production-readiness.md](docs/production-readiness.md).
En attendant leur intégration et la validation de l'hébergement, ne pas utiliser
de données réelles ni ouvrir l'application à des établissements sans validation
opérationnelle et réglementaire.
