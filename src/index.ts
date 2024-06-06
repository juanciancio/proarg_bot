import { Context, Markup, Telegraf } from "telegraf";
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
  const msg = `
  📣 Bienvenidos a la 1ra edición del Torneo de apuestas de Pronósticos Argentinos😘

  ⚠️La participación en el torneo es GRATUITA y tendrá un cupo limite de 200 inscriptos, si llegas a registarte, serás uno de ellos. Es necesario que seás mayor de 18 años de edad para participar🫦
  
  ➡️El torneo consisitirá en varias rondas preliminares, donde comenzarán los 200 competidores, hasta llegar a la suma de 32 participantes. Una vez llegados a esa cifra, comenzará el torneo principal. 
  ➡️Cada ronda tendrá diferentes métodos de apuestas y reglas básicas a seguir, las cuales iremos informando a medida que avancemos.
  
  ⌨️⌨️⌨️⌨️⌨️⌨️⌨️
  
  ⌨️Respeta las indicaciones de los administradores, cada ronda eliminatoria tendrá sus condiciones, es importante leer para no confundirse.
  ⌨️No envies más apuestas de las solicitadas por ronda. Deberás enviar las imagenes de tus apuestas por este medio
  ⌨️No es necesario que realices la apuesta con tu dinero, de igual manera, es necesario enviar el boleto elegido con una screenshot.
  ⌨️Respeta los tiempos de espera, debemos corroborar muchas selecciones.
  
  💰PREMIOS:
  
  🥇 Puesto:💵350.000 pesos.
  🥈 Puesto:💵100.000 pesos.
  🥉 Puesto:💵50.000 pesos.
  
  ❗️Para registarte, dale click al botón 'Inscribirme':
  
  ❓Si tienes alguna duda, contactate con @ValenProArg  o con @NahueProArg
  `;
  ctx.reply(
    msg,
    Markup.inlineKeyboard([
      [Markup.button.callback("Inscribirme", "SIGNUP_BUTTON")],
    ])
  );
});

bot.command("/start", (ctx) => {
  user.telegramId = ctx.from.id;
  console.log(user.telegramId)
})

bot.action("SIGNUP_BUTTON", async (ctx) => {
  const freeSlots = await checkFreeSlots();
  if (freeSlots && freeSlots >= 200)
    return ctx.reply(
      "Hemos alcanzado el cupo máximo de inscripciones para es Torneo, ¡mucha suerte para el próximo!"
  );
  const userSubscripted = await checkSubscription(ctx.from.id);
  if (userSubscripted) {
    return ctx.reply('Ya te encuentras inscripto, muchas gracias por tu participación');
  }
  ctx.reply(
    "Necesitaremos algunos datos para realizar la inscripción. Ingresa tu Nombre y Apellido."
  );
  currentStep = Steps.NAME_LASTNAME_STEP;
  user.telegramId = ctx.from.id;
});

bot.on("message", async (ctx) => {
  const message = ctx.text;

  if ("photo" in ctx.message) {
    try {
      if (!uploadBet)
        return ctx.reply(
          "Para adjuntar una imagen de tu apuesta primero debes usar el comando /enviarapuesta."
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

      const msg = `
      Tu apuesta ha sido enviada y guardada con éxito. ¡Mucha suerte!

      Importante: Leer las condiciones. En caso de que el boleto enviado no cumpla las condiciones solicitadas, su apuesta quedará eliminada del torneo. 
      `;
      ctx.reply(msg);
      return;
    } catch (error) {
      console.error("Error al guardar la imagen:", error);
      ctx.reply("Hubo un error al guardar tu apuesta.");
      return;
    }
  }


  if (!message?.startsWith("/") && currentStep === Steps.NON_STEP) {
    return ctx.reply(
      "No comprendo que queres decirme. Usa /help para ver los comandos disponibles."
    );
  }

  if (!message) return;

  if (message == "/enviarapuesta") {
    const userSubscripted = checkSubscription(ctx.from.id);
    if (!userSubscripted)
      return ctx.reply(
        "Antes de enviar tu apuesta debes inscribirte al Toreo. Usa /start para más información"
      );
    uploadBet = true;
    return ctx.reply(
      "Adjunta una foto de tu apuesta, solo puedes enviar una, si detectamos que son más de una imagen no podremos procesar el envío de tu apuesta."
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
      `Tu Nombre y Apellido es: ${message}. ¿Es correcto?`,
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
        `Tu Fecha de Nacimiento es: ${message}. ¿Es correcto?`,
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
    if (message.includes('@')) return ctx.reply('El nombre de usuario no debe contener el @');
    user.telegramAlias = message;
    user.telegramId = ctx.from.id;
    return ctx.reply(
      `Tu alias en Telegram es: "@${message}". ¿Es correcto?`,
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
    "¡Perfecto! Ingresa tu fecha de nacimiento con el formato DD/MM/YYYY. (Ej: 25/04/2000)."
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
    "¡Excelente! Como ultimo paso, solicitamos tu Alias de Telegram ( sin el @ ). Es importante para contactarte por cualquier situación."
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
  ctx.reply("Por favor, ingresa tu Alias en Telegram sin el @");
  user.telegramAlias = "";
});

const persistDatabaseUser = async (
  ctx: Context<Update.CallbackQueryUpdate<CallbackQuery>>
) => {
  try {
    const client =  await withTimeout(pool.connect(), 2000);
    const res = await client.query(
      "INSERT INTO users (name, birthdate, telegram_alias, telegram_id) VALUES ($1, $2, $3, $4)",
      [user.name, user.birthdate, user.telegramAlias, user.telegramId]
    );
    client.release();
    

    if (res.rowCount && res.rowCount > 0) {
      ctx.reply(
        `¡Felicitaciones! Tu inscripción se ha completado satisfactoriamente, te deseamos muchos exitos en el torneo. Por cualquier inquietud, contacta a @nahuelproarg o @valenproarg. (Tu número de identificación es: ${user.telegramId})`
      );
      user = new UserModel();
    }
  } catch (error) {
    console.log(error);
  }
};

const checkSignupStart = () => {
  return user.telegramId === -1 ? false : true;
};

const checkSubscription = async (telegram_id: number) => {
  try {
    const client =  await withTimeout(pool.connect(), 2000);
    const res = await client.query(
      "SELECT telegram_id FROM users WHERE telegram_id = $1",
      [telegram_id]
    );
    return res.rowCount;
  } catch (error) {
    console.log(error);
  } 
};

const checkFreeSlots = async () => {
  try {
    const client = await withTimeout(pool.connect(), 2000);
    const res = await client.query(
      "SELECT COUNT(id) FROM users"
    );
    return res.rowCount;
  } catch (error) {
    console.log(error);
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

const withTimeout = (promise: any, ms: any) => {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
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

const shutdown = async () => {
  try {
    await bot.stop();
    await pool.end();
  } catch (error) {
    console.error('Error al cerrar el pool de conexiones:', error);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);