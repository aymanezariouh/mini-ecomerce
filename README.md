# Mini E-commerce — Sprint 02

API pédagogique Node.js / Express / MongoDB : catalogue public, authentification JWT, commandes clients et gestion vendeur. Les montants sont des **centimes entiers sûrs**. SQLite est un exercice autonome : il ne sert pas de base à l'API.

## Architecture

```text
src/
  app.js              Application Express, routes, Swagger et erreurs
  server.js           Connexion MongoDB puis écoute HTTP
  config/db.js        Connexion Mongoose
  controllers/        Validation et logique métier ; calcul des commandes
  routes/             Endpoints et permissions
  middleware/         Authentification, rôles, erreurs JSON
  modules/            Modèles Mongoose User, Product, Order
  seed/               Vendeur et démonstration MongoDB
sql/                  Schéma, seed, requêtes et scripts SQLite indépendants
tests/                Tests Jest + Supertest sur MongoDB temporaire
docs/openapi.json     Contrat OpenAPI servi par Swagger
postman/              Collection et environnement importables
```

Les lignes sont embarquées dans une seule commande MongoDB. Tous les produits et quantités sont validés avant l'unique sauvegarde. Chaque ligne conserve le nom et le prix au moment de l'achat. L'identité client provient du JWT et de l'utilisateur en base ; le total envoyé par le client est ignoré.

## Prérequis et installation

- Node.js **24.11 ou version 24 ultérieure**, npm.
- MongoDB 8 pour l'exécution locale, ou Docker Desktop / Docker Engine avec Compose.
- Accès réseau lors de l'installation et du premier téléchargement du binaire MongoDB des tests.

```sh
npm ci
```

Copier `.env.example` vers `.env` (`cp .env.example .env` ou `Copy-Item .env.example .env` dans PowerShell), puis remplir les valeurs. Ne pas écraser un `.env` existant. Sous PowerShell, utiliser `npm.cmd` si la stratégie d'exécution bloque `npm.ps1`.

## Variables d'environnement

| Variable | Utilisation |
| --- | --- |
| `PORT` | Port HTTP local, 3000 par défaut |
| `MONGODB_URI` | URI MongoDB locale, exemple sans identifiants dans `.env.example` |
| `JWT_SECRET` | Secret aléatoire privé, obligatoire pour l'authentification |
| `SELLER_EMAIL`, `SELLER_PASSWORD` | Identifiants du vendeur créé par les seeds |
| `CUSTOMER_ONE_EMAIL`, `CUSTOMER_ONE_PASSWORD` | Premier client du seed de démonstration |
| `CUSTOMER_TWO_EMAIL`, `CUSTOMER_TWO_PASSWORD` | Second client du seed de démonstration |
| `SELLER_NAME`, `CUSTOMER_ONE_NAME`, `CUSTOMER_TWO_NAME` | Noms facultatifs des comptes du seed |

Choisir trois emails distincts et des mots de passe d'au moins huit caractères. Générer par exemple le secret JWT avec :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Les fichiers `.env`, les bases locales et les fichiers temporaires sont ignorés par Git et Docker. Aucun identifiant réel ni JWT n'est livré.

## Démarrage local

Avec MongoDB démarré et `MONGODB_URI` configuré :

```sh
npm run seed
npm run dev
```

`npm start` lance le serveur sans surveillance des fichiers. Santé : `http://localhost:3000/api/health`.

## Démonstration MongoDB

```sh
npm run seed
# Pour créer uniquement le vendeur :
npm run seed:seller
```

Sur une base vide, le seed crée **1 vendeur, 2 clients et 5 produits**, dont un casque indisponible. Il normalise les emails et hache les mots de passe avec bcrypt. Il se relance sans doublons grâce aux emails uniques et aux identifiants fixes des produits de démonstration.

Les comptes, mots de passe et produits déjà présents sont conservés : modifier un mot de passe dans `.env` ne change pas celui d'un compte déjà créé. Un email associé à un autre rôle provoque un refus, jamais une promotion implicite. L'inscription publique crée toujours un client, même si un rôle vendeur est envoyé.

## Docker

Remplir `.env`, notamment `JWT_SECRET`, puis :

```sh
docker compose config --quiet
docker compose up --build -d --wait
docker compose exec api node src/seed/demoSeed.js
docker compose logs api
```

L'API est accessible sur `http://localhost:3000` (ou le `PORT` choisi). Compose utilise automatiquement `mongodb://mongo:27017/mini_ecommerce`, le port interne 3000 et un volume MongoDB persistant. MongoDB n'est pas publié sur l'hôte ; l'API est liée à `127.0.0.1`. L'API attend que MongoDB soit sain ; les deux services redémarrent avec `unless-stopped`. L'image utilise `npm ci --omit=dev` et un utilisateur non root.

```sh
docker compose down
```

Cette commande arrête les services et conserve le volume. Ne pas ajouter `--volumes` si les données doivent être conservées.

## Endpoints et permissions

Les routes protégées attendent `Authorization: Bearer <token>`. Le login renvoie `{ message, token, user: { id, name, email, role } }`, sans hash. Les produits et commandes utilisent `_id`.

| Méthode | Endpoint | Accès | Résultat |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | 200, état du serveur |
| POST | `/api/auth/register` | Public | 201, nouveau client |
| POST | `/api/auth/login` | Public | 200, JWT valable un jour |
| GET | `/api/products` | Public | 200, tous les produits, disponibles ou non |
| GET | `/api/products/:id` | Public | 200, produit |
| POST | `/api/products` | Vendeur | 201, produit créé |
| PATCH | `/api/products/:id` | Vendeur | 200, produit modifié |
| POST | `/api/orders` | Client | 201, commande calculée et sauvegardée |
| GET | `/api/orders/me` | Client | 200, ses commandes uniquement |
| GET | `/api/orders` | Vendeur | 200, toutes les commandes, client avec nom et email |
| GET | `/api/orders/:id` | Propriétaire ou vendeur | 200, détail de commande |
| PATCH | `/api/orders/:id/status` | Vendeur | 200, passage à `processed` |
| GET | `/api/docs` | Public | Interface Swagger (redirection vers `/api/docs/`) |
| GET | `/api/docs.json` | Public | Contrat OpenAPI JSON |

Création d'un produit :

```json
{ "name": "Clavier", "description": "Clavier USB", "priceCents": 2500, "available": true }
```

Seuls `name`, `description`, `priceCents` et `available` sont acceptés. Le nom doit être non vide ; le prix strictement positif et entier sûr. `available` est un booléen, `true` par défaut. La description est facultative et limitée à 500 caractères. Une modification doit contenir au moins un champ autorisé.

Création d'une commande (remplacer les identifiants par ceux des produits) :

```json
{
  "items": [
    { "productId": "650000000000000000000001", "quantity": 2 },
    { "productId": "650000000000000000000002", "quantity": 1 }
  ]
}
```

Une commande contient 1 à 10 produits distincts et chaque quantité est un entier de 1 à 10. Les produits doivent exister et être disponibles. Les prix, noms, total, statut initial et identité client sont calculés par le serveur. Toute ligne invalide ou tout dépassement de précision entière empêche la sauvegarde. Le traitement vendeur accepte seulement `{ "status": "processed" }` ; il est idempotent, y compris pour `updatedAt`, et le retour à `new` est refusé.

Toutes les erreurs API ont la structure :

```json
{ "error": { "message": "Description" } }
```

`400` : données ou identifiant invalides ; `401` : authentification absente/invalide ; `403` : rôle ou propriétaire incorrect ; `404` : ressource absente ; `409` : email déjà utilisé ou produit indisponible ; `500` : erreur interne.

## Swagger / OpenAPI

Ouvrir **http://localhost:3000/api/docs**. Les 12 opérations métier/santé sont décrites avec paramètres, corps, exemples, réponses, statuts et permissions. Utiliser **Authorize** avec le JWT obtenu au login pour essayer les routes protégées.

`docs/openapi.json` décrit les routes implémentées ; les requêtes Postman suivent ce contrat. Toute modification future d'une route doit être reportée dans ces deux fichiers.

## Postman

Importer les deux fichiers de `postman/` :

- `Mini-Ecommerce.postman_collection.json` ;
- `Mini-Ecommerce.postman_environment.json`.

Sélectionner l'environnement, régler `baseUrl` puis renseigner localement `sellerEmail` et `sellerPassword` avec le compte du seed. Exécuter la collection entière **dans l'ordre** avec Collection Runner sur une base de démonstration. Elle crée deux clients aux emails uniques, trois produits et une commande à chaque passage ; elle vérifie les succès, erreurs, permissions, totaux et prix historiques. Les JWT et identifiants de travail sont capturés dans les variables temporaires de l'exécution.

Pour envoyer les requêtes individuellement, renseigner les variables d'environnement correspondantes (`customerToken`, `sellerToken`, identifiants de produits/commande) après inscription et connexion. Garder les mots de passe et tokens uniquement dans les valeurs locales ; ne pas exporter un environnement rempli.

## Tests automatisés

```sh
npm test
npm run sql:verify
```

Jest + Supertest exécutent les huit scénarios obligatoires : calcul multiligne, quantités invalides, authentification, interdiction de créer un produit pour un client, faux total, isolation des clients, refus d'un produit indisponible sans sauvegarde et conservation des prix historiques.

Chaque suite crée **son propre processus MongoDB temporaire** avec `mongodb-memory-server`, sans charger `.env` ni utiliser `MONGODB_URI`. Les suppressions de tests sont limitées à cette connexion après contrôle du nom, de l'hôte et du port. Le développement et la production ne sont jamais nettoyés. Les cas sont réinitialisés indépendamment et exécutés en série.

Le premier lancement télécharge MongoDB 8.2.6 dans le cache ignoré `node_modules/.cache/mongodb-memory-server`. Pour une machine hors ligne, définir `MONGOMS_SYSTEM_BINARY` vers un exécutable `mongod` 8.2.6 déjà installé. L'avertissement Node relatif aux modules VM expérimentaux est attendu avec Jest en ES modules ; la commande est conforme à la [documentation Jest](https://jestjs.io/docs/ecmascript-modules).

## SQLite indépendant

Le pilote `better-sqlite3` est déjà inclus dans les dépendances. Aucun serveur SQLite ni connexion MongoDB n'est nécessaire.

```sh
npm run sql:init
npm run sql:init
npm run sql:orders -- 2
npm run sql:orders -- 3
npm run sql:verify
```

L'initialisation applique `sql/schema.sql` puis `sql/seed.sql` dans **`sql/demo.db`**. Elle est relançable sans doublons et conserve les données existantes. Le fichier historique `boutique.db` n'est pas utilisé implicitement. Pour choisir une autre base de démonstration neuve :

```sh
npm run sql:init -- sql/another-demo.db
npm run sql:orders -- 2 sql/another-demo.db
```

Les quatre tables sont `users`, `products`, `orders` et `order_items`. Elles comportent clés primaires/étrangères, email unique, contraintes de rôles/statuts, noms non vides, prix entiers sûrs, quantités de 1 à 10 et unicité d'un produit par commande. Les clés étrangères sont activées **sur chaque connexion** avec `PRAGMA foreign_keys = ON`.

Le seed contient 1 vendeur, 2 clients, 3 produits, 2 commandes et 3 lignes. Les totaux calculés sont 6000 et 4500 centimes. Les hashes SQL sont des marqueurs pédagogiques non utilisables pour une connexion à l'API. Une commande historique peut référencer un produit devenu indisponible.

Les quatre requêtes de `sql/queries.sql` affichent : produits disponibles, commandes d'un client, détail avec JOINs, total calculé depuis les prix historiques. Avec le CLI SQLite facultatif :

```sh
sqlite3 sql/demo.db ".read sql/queries.sql"
```

`getCustomerOrders.js` accepte un identifiant client entier positif et utilise `WHERE orders.customerId = ?` avec `query.all(customerId)`. Il ouvre la base en lecture seule et affiche notamment `customerNote`. Les clients 2 et 3 ne récupèrent respectivement que les commandes 1 et 2.

### Clés étrangères et adaptation customerNote

`npm run sql:verify` crée une base temporaire, exécute réellement deux initialisations, les quatre requêtes et le script des deux clients. Il vérifie aussi l'impossibilité d'une ligne orpheline, les contraintes, la note facultative et les tentatives d'injection. L'équivalent manuel du contrôle de clé étrangère est :

```sql
PRAGMA foreign_keys = ON;
INSERT INTO order_items (orderId, productId, productName, quantity, unitPriceCents)
VALUES (999999, 1, 'Mouse', 1, 2500);
-- Résultat attendu : FOREIGN KEY constraint failed.
```

Le schéma neuf inclut `orders.customerNote TEXT`, nullable. Pour une ancienne base qui ne possède pas cette colonne, après sauvegarde et vérification de `PRAGMA table_info(orders)`, appliquer **une seule fois** :

```sql
ALTER TABLE orders ADD COLUMN customerNote TEXT;
```

Cette adaptation seule ne remplace pas les nouvelles contraintes du schéma : utiliser une base neuve avec `sql:init` pour reproduire toute la démonstration. Exemple d'insertion/lecture de la note sans laisser de donnée supplémentaire :

```sql
PRAGMA foreign_keys = ON;
BEGIN;
INSERT INTO orders (customerId, totalCents, customerNote)
VALUES (2, 2500, 'Livrer apres 18 h');
SELECT id, customerNote FROM orders WHERE id = last_insert_rowid();
ROLLBACK;
```

Les fichiers `.db`, `.db-wal`, `.db-shm`, `.sqlite` et `.sqlite3` ne doivent pas être commités. `customerNote` concerne uniquement l'exercice SQLite.
