import { Context, Markup, Telegraf } from "telegraf";

import { message } from "telegraf/filters";
import { Steps } from "./enums/steps.enum.js";
import fetch from "node-fetch";
import { promises as fs } from "fs";

import dotenv from "dotenv";
import { UserModel } from "./models/user.model.js";
import pool from "./config/database.js";
import { CallbackQuery, Update } from "telegraf/typings/core/types/typegram";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;

const bot = new Telegraf(token);
const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentStep: Steps = Steps.NON_STEP;
let user: UserModel = new UserModel();
let uploadBet = false;

bot.start((ctx) => {
  ctx.reply(
    "Te damos la bienvenida al Bot de Torneos de PROARG! Por favor, presiona en 'Inscribirme' si estás interesado/a en participar en el Torneo activo actualmente:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Inscribirme", "SIGNUP_BUTTON")],
    ])
  );
});

bot.action("SIGNUP_BUTTON", async (ctx) => {
  const userRegistered = await checkSubscription(ctx.from.id);
  if (userRegistered)
    return ctx.reply(
      "Ya te encuentras inscripto, muchas gracias por participar en el Torneo!"
    );
  ctx.reply(
    "Necesitaremos algunos datos para inscribirte en el Torneo. Por favor, ingresa tu Nombre y Apellido"
  );
  currentStep = Steps.NAME_LASTNAME_STEP;
});

bot.on("message", async (ctx) => {
  const message = ctx.text;

  if ("photo" in ctx.message) {
    try {
      if (!uploadBet)
        return ctx.reply(
          "No entiendo tu mensaje. Recuerda que si querés enviar tu apuesta primero debes usar el comando /enviarapuesta"
        );

      //checkFileExists(ctx);

      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();

      const buffer = Buffer.from(arrayBuffer);

      const fileExtension = file.file_path?.split(".").pop(); // Obtener la extensión del archivo
      const fileName = `${ctx.from.id}.${fileExtension}`; // Usar el ID del usuario y la extensión del archivo
      const filePath = path.join(__dirname, "assets", "bets_img", fileName); // Crear la ruta completa
      await fs.writeFile(filePath, buffer);

      ctx.reply("Imagen guardada correctamente!");
      return;
    } catch (error) {
      console.error("Error al guardar la imagen:", error);
      ctx.reply("Hubo un error al guardar la imagen.");
      return;
    }
  }

  if (!message?.startsWith("/")) {
    return ctx.reply(
      "No comprendo que queres decirme. Usa /ayuda para ver los comandos disponibles."
    );
  }

  if (message === "/ayuda") {
    const helpMessage = `
    Comandos disponibles:
    /start - Inicia el bot
    /inscribirme - Inicia el proceso de inscripción al Torneo activo
    `;
    return ctx.reply(helpMessage);
  }

  if (message == "/enviarapuesta") {
    const userSubscripted = checkSubscription(ctx.from.id);
    if (!userSubscripted)
      return ctx.reply(
        "Antes de enviar tu apuesta debes inscribirte al torneo con /inscribirme"
      );
    uploadBet = true;
    return ctx.reply(
      "Adjunta una foto de tu apuesta, procurá que no sean más de una."
    );
  }

  if (user.telegramId === -1) {
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, escribe /start para comenzar."
    );
  }

  if (currentStep === Steps.NAME_LASTNAME_STEP) {
    user.name = message;
    return ctx.reply(
      `Tu Nombre y Apellido es: ${message}. Es correcto?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Si", "CORRECT_NAME_LASTNAME")],
        [Markup.button.callback("No", "INCORRECT_NAME_LASTNAME")],
      ])
    );
  }

  if (currentStep === Steps.BIRTHDAY_STEP) {
    if (dateRegex.test(message)) {
      user.birthdate = message;
      ctx.reply(
        `Tu Fecha de Nacimiento es: ${message}. Es correcto?`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Si", "CORRECT_BIRTHDAY")],
          [Markup.button.callback("No", "INCORRECT_BIRTHDAY")],
        ])
      );
    } else {
      ctx.reply(
        "Has escrito una fecha inválida. El formato correcto es: DD/MM/YYYY"
      );
    }
  }

  if (currentStep === Steps.TELEGRAM_ALIAS_STEP) {
    user.telegramAlias = message;
    user.telegramId = ctx.from.id;
    return ctx.reply(
      `Tu alias en Telegram es: ${message}. Es correcto?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Si", "CORRECT_TELEGRAM_ALIAS")],
        [Markup.button.callback("No", "INCORRECT_TELEGRAM_ALIAS")],
      ])
    );
  }
});

bot.action("CORRECT_NAME_LASTNAME", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  ctx.reply(
    "Perfecto. Ahora ingresa tu Fecha de Nacimiento con el formato DD/MM/YYYY (ej: 25/04/2000)"
  );
  currentStep = Steps.BIRTHDAY_STEP;
});

bot.action("INCORRECT_NAME_LASTNAME", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  ctx.reply("Introduce tu Nombre y Apellido correctamente");
  currentStep = Steps.NAME_LASTNAME_STEP;
  user.name = "";
});

bot.action("CORRECT_BIRTHDAY", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  ctx.reply(
    "Excelente. Como último paso te pediremos tu alias en Telegram, es importante por si tenemos que contactarte"
  );
  currentStep = Steps.TELEGRAM_ALIAS_STEP;
});

bot.action("INCORRECT_BIRTHDAY", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  ctx.reply("Por favor, ingresa tu Fecha de Nacimiento (DD/MM/YYY)");
  user.birthdate = "";
});

bot.action("CORRECT_TELEGRAM_ALIAS", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  persistDatabaseUser(ctx);
});

bot.action("INCORRECT_TELEGRAM_ALIAS", (ctx) => {
  if (!checkSignupStart())
    return ctx.reply(
      "No has iniciado la inscripción al Torneo, usa /start para comenzar."
    );
  ctx.reply("Por favor, ingresa tu Alias en Telegram");
  user.telegramAlias = "";
});

const persistDatabaseUser = async (
  ctx: Context<Update.CallbackQueryUpdate<CallbackQuery>>
) => {
  try {
    const client = await pool.connect();
    const res = await client.query(
      "INSERT INTO users (name, birthdate, telegram_alias, telegram_id) VALUES ($1, $2, $3, $4) ON CONFLICT (telegram_id) DO NOTHING RETURNING *",
      [user.name, user.birthdate, user.telegramAlias, user.telegramId]
    );
    client.release();

    if (res.rowCount && res.rowCount > 0) {
      ctx.reply(
        `Felicitaciones! Tu inscripción se ha completado satisfactoriamente. Tu número de identificación es: ${user.telegramId}, no lo pierdas porque te servirá más adelante.`
      );
      user = new UserModel();
    }
  } catch (error) {
    console.log(error);
  } finally {
    await pool.end();
  }
};

const checkSignupStart = () => {
  return user.telegramId === -1 ? false : true;
};

const checkSubscription = async (telegram_id: number) => {
  try {
    const client = await pool.connect();
    const res = await client.query(
      "SELECT telegram_id FROM users WHERE telegram_id = $1",
      [telegram_id]
    );
    return res.rowCount;
  } catch (error) {
    console.log(error);
  } finally {
    pool.end();
  }
};

const checkFileExists = (ctx: Context) => {
  const userId = ctx.from?.id;

  if (!userId) {
    ctx.reply("No pude encontrar tu Telegram ID.");
    return;
  }

  // Define the folder path where the files are stored
  const folderPath = "./assets/bets_img";

  // Define the file path with the user's Telegram ID
  const filePath = path.join(folderPath, `${userId}`); // Change the extension if needed

  fs.access(filePath)
    .then((res) => {
      console.log(res);
    })
    .catch((err) => console.log(err));
};

// Manejar cualquier error
bot.catch((err) => {
  console.error("Error occurred:", err);
});

// Iniciar el bot
bot
  .launch()
  .then(() => {
    console.log("Bot is running...");
  })
  .catch((err) => {
    console.error("Failed to launch bot:", err);
  });
