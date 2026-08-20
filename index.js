const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN) {
  console.error("ERREUR : Le BOT_TOKEN est manquant.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const DATA_FILE = path.join(__dirname, 'data.json');

// Servir les fichiers statiques (notre dossier public avec index.html)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lecture des données
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = { categories: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Route API pour envoyer les produits à la Mini App
app.get('/api/products', (req, res) => {
  const data = loadData();
  res.json(data);
});

// --- COMMANDE DU BOT TELEGRAM ---

bot.start((ctx) => {
  // Récupère automatiquement l'URL de Render
  const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  ctx.reply(
    "👋 Bienvenue dans notre boutique !\n\nCliquez sur le bouton ci-dessous pour ouvrir la boutique en plein écran :",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🛍️ Ouvrir la boutique", appUrl)]
    ])
  );
});

// Lancement simultané du bot et du serveur web
bot.launch();

app.listen(PORT, () => {
  console.log(`Serveur Mini App actif sur le port ${PORT}`);
});
