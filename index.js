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
    const initialData = {
      categories: [],
      storeInfo: {
        logoActive: false,
        logoUrl: "",
        description: ""
      },
      settings: {
        cb: { active: false, url: "" },
        paypal: { active: false, url: "" },
        crypto: { active: false, address: "" },
        virement: { active: false, iban: "" },
        support: { active: false, username: "" }
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!data.storeInfo) {
    data.storeInfo = { logoActive: false, logoUrl: "", description: "" };
  }
  if (!data.settings) {
    data.settings = {
      cb: { active: false, url: "" },
      paypal: { active: false, url: "" },
      crypto: { active: false, address: "" },
      virement: { active: false, iban: "" },
      support: { active: false, username: "" }
    };
  }
  return data;
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
    "👋 Bienvenue dans notre boutique !\n\nCliquez ci-dessous pour commander :",
    Markup.inlineKeyboard([
      [Markup.button.webApp("🛍️ Ouvrir la boutique", appUrl)]
    ])
  );
});

// --- PANNEAU ADMIN ---

bot.command("admin", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("⛔ Accès refusé.");

  ctx.reply(
    "⚙️ **Panneau d'administration**\nChoisissez une option :",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Ajouter une catégorie", "add_cat")],
      [Markup.button.callback("📦 Ajouter un produit", "add_prod")],
      [Markup.button.callback("🎨 Personnaliser Boutique (Logo & Intro)", "config_store")],
      [Markup.button.callback("💳 Configurer Paiements & Support", "config_pay")]
    ])
  );
});

// Menu Personnalisation Boutique
bot.action("config_store", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  const info = data.storeInfo;

  const buttons = [
    [Markup.button.callback(`${info.logoActive ? '✅' : '❌'} Logo Boutique`, "toggle_logo")],
    [Markup.button.callback("📝 Modifier la description", "set_store_desc")],
    [Markup.button.callback("⬅️ Retour Admin", "back_admin")]
  ];

  ctx.editMessageText("🎨 **Personnalisation de l'entête**\nGérez le logo et la description de votre boutique :", Markup.inlineKeyboard(buttons));
});

bot.action("toggle_logo", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  if (data.storeInfo.logoActive) {
    data.storeInfo.logoActive = false;
    saveData(data);
    ctx.reply("❌ Logo désactivé.");
  } else {
    adminState[ctx.from.id] = { step: "SET_LOGO_PHOTO" };
    ctx.reply("Envoyez l'image / photo du logo de votre boutique :");
  }
});

bot.action("set_store_desc", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  adminState[ctx.from.id] = { step: "SET_STORE_DESC" };
  ctx.reply("Entrez le texte de présentation de votre boutique (ou tapez 'effacer' pour supprimer) :");
});

// Menu Configuration des paiements
bot.action("config_pay", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  const s = data.settings;

  const buttons = [
    [Markup.button.callback(`${s.cb.active ? '✅' : '❌'} Carte Bancaire`, "toggle_cb")],
    [Markup.button.callback(`${s.paypal.active ? '✅' : '❌'} PayPal`, "toggle_paypal")],
    [Markup.button.callback(`${s.crypto.active ? '✅' : '❌'} Crypto`, "toggle_crypto")],
    [Markup.button.callback(`${s.virement.active ? '✅' : '❌'} Virement IBAN`, "toggle_virement")],
    [Markup.button.callback(`${s.support.active ? '✅' : '❌'} Bouton Support Chat`, "toggle_support")],
    [Markup.button.callback("⬅️ Retour Admin", "back_admin")]
  ];

  ctx.editMessageText("🛠️ **Gestion des Paiements & Support** :", Markup.inlineKeyboard(buttons));
});

bot.action("back_admin", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  ctx.editMessageText("⚙️ **Panneau d'administration**\nChoisissez une option :", Markup.inlineKeyboard([
    [Markup.button.callback("➕ Ajouter une catégorie", "add_cat")],
    [Markup.button.callback("📦 Ajouter un produit", "add_prod")],
    [Markup.button.callback("🎨 Personnaliser Boutique (Logo & Intro)", "config_store")],
    [Markup.button.callback("💳 Configurer Paiements & Support", "config_pay")]
  ]));
});

const togglePayment = (type, promptText) => (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  if (data.settings[type].active) {
    data.settings[type].active = false;
    saveData(data);
    ctx.reply(`❌ ${type.toUpperCase()} désactivé.`);
  } else {
    adminState[ctx.from.id] = { step: `SET_${type.toUpperCase()}` };
    ctx.reply(promptText);
  }
};

bot.action("toggle_cb", togglePayment('cb', "Entrez votre lien de paiement CB :"));
bot.action("toggle_paypal", togglePayment('paypal', "Entrez votre lien PayPal.me :"));
bot.action("toggle_crypto", togglePayment('crypto', "Entrez votre adresse Wallet Crypto :"));
bot.action("toggle_virement", togglePayment('virement', "Entrez vos coordonnées bancaires (IBAN/BIC) :"));
bot.action("toggle_support", togglePayment('support', "Entrez votre pseudo Telegram sans @ :"));

bot.action("add_cat", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  adminState[ctx.from.id] = { step: "WAITING_CAT_NAME" };
  ctx.reply("Veuillez saisir le nom de la nouvelle catégorie :");
});

bot.action("add_prod", (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  const data = loadData();
  if (data.categories.length === 0) return ctx.reply("Créez d'abord une catégorie.");

  const buttons = data.categories.map((cat, index) => [
    Markup.button.callback(cat.name, `admin_select_cat_${index}`)
  ]);
  ctx.reply("Sélectionnez la catégorie :", Markup.inlineKeyboard(buttons));
});

bot.action(/admin_select_cat_(\d+)/, (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return;
  adminState[ctx.from.id] = { step: "WAITING_PROD_TITLE", catIndex: parseInt(ctx.match[1]) };
  ctx.reply("Entrez le titre du produit :");
});

// Messages texte
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = adminState[userId];
  if (!state) return;

  const data = loadData();

  if (state.step === "SET_STORE_DESC") {
    if (ctx.message.text.toLowerCase() === "effacer") {
      data.storeInfo.description = "";
      ctx.reply("✅ Description supprimée.");
    } else {
      data.storeInfo.description = ctx.message.text;
      ctx.reply("✅ Description de la boutique enregistrée !");
    }
    saveData(data);
    delete adminState[userId];
    return;
  }

  if (state.step === "SET_CB") {
    data.settings.cb = { active: true, url: ctx.message.text };
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Carte Bancaire activée !");
  }
  if (state.step === "SET_PAYPAL") {
    data.settings.paypal = { active: true, url: ctx.message.text };
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ PayPal activé !");
  }
  if (state.step === "SET_CRYPTO") {
    data.settings.crypto = { active: true, address: ctx.message.text };
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Crypto activé !");
  }
  if (state.step === "SET_VIREMENT") {
    data.settings.virement = { active: true, iban: ctx.message.text };
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Virement activé !");
  }
  if (state.step === "SET_SUPPORT") {
    data.settings.support = { active: true, username: ctx.message.text.replace('@', '') };
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Support Chat activé !");
  }

  if (state.step === "WAITING_CAT_NAME") {
    state.catName = ctx.message.text;
    state.step = "WAITING_CAT_PHOTO";
    return ctx.reply(`Envoyez la photo pour la catégorie "${state.catName}" (ou tapez 'passer') :`);
  }
  if (state.step === "WAITING_CAT_PHOTO" && ctx.message.text.toLowerCase() === "passer") {
    data.categories.push({ name: state.catName, image: "", products: [] });
    saveData(data);
    delete adminState[userId];
    return ctx.reply(`✅ Catégorie "${state.catName}" ajoutée !`);
  }
  if (state.step === "WAITING_PROD_TITLE") {
    state.title = ctx.message.text;
    state.step = "WAITING_PROD_DESC";
    return ctx.reply("Entrez la description du produit :");
  }
  if (state.step === "WAITING_PROD_DESC") {
    state.description = ctx.message.text;
    state.step = "WAITING_PROD_PRICE";
    return ctx.reply("Entrez le prix du produit :");
  }
  if (state.step === "WAITING_PROD_PRICE") {
    state.price = ctx.message.text;
    state.step = "WAITING_PROD_PHOTO";
    return ctx.reply("Envoyez la photo du produit (ou tapez 'passer') :");
  }
  if (state.step === "WAITING_PROD_PHOTO" && ctx.message.text.toLowerCase() === "passer") {
    data.categories[state.catIndex].products.push({
      title: state.title,
      description: state.description,
      price: state.price,
      image: ""
    });
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Produit ajouté !");
  }
});

// Reception photos
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const state = adminState[userId];
  if (!state) return;

  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  const fileUrl = await ctx.telegram.getFileLink(fileId);
  const data = loadData();

  if (state.step === "SET_LOGO_PHOTO") {
    data.storeInfo.logoActive = true;
    data.storeInfo.logoUrl = fileUrl.href;
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Logo mis à jour et activé avec succès !");
  }

  if (state.step === "WAITING_CAT_PHOTO") {
    data.categories.push({ name: state.catName, image: fileUrl.href, products: [] });
    saveData(data);
    delete adminState[userId];
    return ctx.reply(`✅ Catégorie "${state.catName}" ajoutée avec photo !`);
  }

  if (state.step === "WAITING_PROD_PHOTO") {
    data.categories[state.catIndex].products.push({
      title: state.title,
      description: state.description,
      price: state.price,
      image: fileUrl.href
    });
    saveData(data);
    delete adminState[userId];
    return ctx.reply("✅ Produit ajouté avec photo !");
  }
});

bot.launch();

app.listen(PORT, () => {
  console.log(`Serveur Mini App actif sur le port ${PORT}`);
});
