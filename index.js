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

app.get('/api/products', (req, res) => {
  const data = loadData();
  res.json(data);
});

bot.start((ctx) => {
  const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  ctx.reply(
    "👋 Bienvenue dans notre boutique !\n\nCliquez sur le bouton ci-dessous pour ouvrir la boutique :",
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

// Traitement des messages texte
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = adminState[userId];
  if (!state) return;

  if (state.step === "WAITING_CAT_NAME") {
    state.catName = ctx.message.text;
    state.step = "WAITING_CAT_PHOTO";
    return ctx.reply(`Envoyez la photo pour la catégorie "${state.catName}" (ou tapez 'passer') :`);
  }

  if (state.step === "WAITING_CAT_PHOTO" && ctx.message.text.toLowerCase() === "passer") {
    const data = loadData();
    data.categories.push({ name: state.catName, image: "", products: [] });
    saveData(data);
    delete adminState[userId];
    return ctx.reply(`✅ Catégorie "${state.catName}" ajoutée avec succès !`);
  }

  if (state.step === "WAITING_PROD_TITLE") {
    state.title = ctx.message.text;
    state.step = "WAITING_PROD_DESC";
    return ctx.reply("Entrez la description du produit :");
  }

  if (state.step === "WAITING_PROD_DESC") {
    state.description = ctx.message.text;
    state.step = "WAITING_PROD_PRICE";
    return ctx.reply("Entrez le prix du produit (ex: 20€) :");
  }

  if (state.step === "WAITING_PROD_PRICE") {
    state.price = ctx.message.text;
    state.step = "WAITING_PROD_PHOTO";
    return ctx.reply("Envoyez directement la photo du produit dans le tchat (ou tapez 'passer') :");
  }

  if (state.step === "WAITING_PROD_PHOTO" && ctx.message.text.toLowerCase() === "passer") {
    const data = loadData();
    data.categories[state.catIndex].products.push({
      title: state.title,
      description: state.description,
      price: state.price,
      image: ""
    });
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Produit ajouté sans photo !");
  }
});

// Traitement de l'envoi de photos
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const state = adminState[userId];
  if (!state) return;

  const photoArray = ctx.message.photo;
  const fileId = photoArray[photoArray.length - 1].file_id;
  const fileUrl = await ctx.telegram.getFileLink(fileId);

  if (state.step === "WAITING_CAT_PHOTO") {
    const data = loadData();
    data.categories.push({ name: state.catName, image: fileUrl.href, products: [] });
    saveData(data);
    delete adminState[userId];
    return ctx.reply(`✅ Catégorie "${state.catName}" ajoutée avec photo !`);
  }

  if (state.step === "WAITING_PROD_PHOTO") {
    const data = loadData();
    data.categories[state.catIndex].products.push({
      title: state.title,
      description: state.description,
      price: state.price,
      image: fileUrl.href
    });
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Produit ajouté avec succès avec sa photo !");
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Serveur Mini App actif sur le port ${PORT}`);
});
