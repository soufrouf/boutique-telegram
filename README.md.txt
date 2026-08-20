# Guide d'installation rapide - Boutique Telegram Clé en Main

Félicitations pour votre achat ! Ce paquet contient tout le nécessaire pour lancer votre boutique Telegram.

## Étape 1 : Obtenir vos accès Telegram
1. Ouvrez Telegram et cherchez le bot officiel `@BotFather`.
2. Envoyez la commande `/newbot` et suivez les instructions pour créer votre bot.
3. Copiez le **Token API** fourni par BotFather.
4. Cherchez le bot `@userinfobot` sur Telegram et envoyez-lui un message pour récupérer votre **ID Telegram numérique** (ex: `123456789`).

## Étape 2 : Configuration
1. Renommez le fichier `.env.example` en `.env`.
2. Ouvrez le fichier `.env` avec un éditeur de texte et collez vos informations :
   ```env
   BOT_TOKEN=votre_token_botfather
   ADMIN_ID=votre_id_telegram