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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// État temporaire de la création admin
const adminState = {};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = { categories: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Route API consommée par la Mini App
app.get('/api/products', (req, res) => {
  const data = loadData();
  res.json(data);
});

// --- COMMANDES ET ACTIONS TELEGRAM ---

bot.start((ctx) => {
  const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  ctx.reply(
    "👋 Bienvenue dans notre boutique !\n\nCliquez sur le bouton ci-dessous pour ouvrir la boutique en plein écran :",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🛍️ Ouvrir la boutique", appUrl)]
    ])
  );
});

bot.command("admin", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.reply("⛔ Accès refusé.");
  }

  ctx.reply(
    "⚙️ **Panneau d'administration**\nQue souhaitez-vous faire ?",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Ajouter une catégorie", "add_cat")],
      [Markup.button.callback("📦 Ajouter un produit", "add_prod")]
    ])
  );
});

bot.action("add_cat", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  adminState[ctx.from.id] = { step: "WAITING_CAT_NAME" };
  ctx.reply("Veuillez saisir le nom de la nouvelle catégorie :");
});

bot.action("add_prod", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  if (data.categories.length === 0) {
    return ctx.reply("Veuillez d'abord créer au moins une catégorie avec /admin.");
  }

  const buttons = data.categories.map((cat, index) => [
    Markup.button.callback(cat.name, `admin_select_cat_${index}`)
  ]);

  ctx.reply("Dans quelle catégorie souhaitez-vous ajouter le produit ?", Markup.inlineKeyboard(buttons));
});

bot.action(/admin_select_cat_(\d+)/, (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const catIndex = parseInt(ctx.match[1]);
  adminState[ctx.from.id] = { step: "WAITING_PROD_TITLE", catIndex };
  ctx.reply("Entrez le titre du produit :");
});

bot.on("text", (ctx) => {
  const userId = ctx.from.id;
  const state = adminState[userId];
  if (!state) return;

  if (state.step === "WAITING_CAT_NAME") {
    const data = loadData();
    data.categories.push({ name: ctx.message.text, products: [] });
    saveData(data);
    delete adminState[userId];
    return ctx.reply(`✅ Catégorie "${ctx.message.text}" ajoutée avec succès !`);
  }

  if (state.step === "WAITING_PROD_TITLE") {
    state.title = ctx.message.text;
    state.step = "WAITING_PROD_PRICE";
    return ctx.reply("Entrez le prix du produit (ex: 20€) :");
  }

  if (state.step === "WAITING_PROD_PRICE") {
    state.price = ctx.message.text;
    const data = loadData();
    data.categories[state.catIndex].products.push({
      title: state.title,
      price: state.price
    });
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Produit ajouté au catalogue !");
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Serveur Mini App actif sur le port ${PORT}`);
});
