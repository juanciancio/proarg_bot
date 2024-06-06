import { Context, Markup, Telegraf, TelegramError } from 'telegraf';
import { Steps } from './enums/steps.enum.js';
import {
  checkFileExists,
  checkUserSub,
  getUserState,
  handleFinishSubscription,
  uploadBet,
} from './functions/user.function.js';
import { UserState } from './models/user.state.js';
import {
  birthdateStep,
  birthdateStep_Repeat,
  nameLastNameStep,
  nameLastNameStep_Repeat,
  noStepActive,
  telegramAliasStep,
  telegramAliasStep_Repeat,
  uploadBetOk,
  welcomeMsg,
} from './utils/messages.js';

const bot = new Telegraf('7302706089:AAE5SqLasKdEYVnxYYFGRv6NWk4zfGG1Trw');

bot.launch();

const userStates: { [key: number]: UserState } = {};

// **** BOT START ****
bot.start((ctx) => {
  ctx.reply(
    welcomeMsg,
    Markup.inlineKeyboard([[Markup.button.callback('Inscribirme', 'SIGNUP_BUTTON')]]),
  );
});

// **** BOT ACTIONS ****

// ---- SIGNUP ----
bot.action('SIGNUP_BUTTON', async (ctx: Context) => {
  if (ctx.from) {
    const userSub = await checkUserSub(ctx.from.id);

    if (userSub)
      return ctx.reply('Ya te encuentras inscripto, muchas gracias por tu participación.');

    if (ctx.chat) {
      const userState = getUserState(userStates, ctx.chat.id);
      userStates[ctx.chat.id] = userState;
      userStates[ctx.chat.id].userInfo.telegramId = ctx.from.id;

      userStates[ctx.chat.id].currentStep = Steps.NAME_LASTNAME_STEP;
      ctx.reply(nameLastNameStep);
    }
  }
});

// ---- CONFIRM NAME ----
bot.action('CORRECT_NAME_LASTNAME', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (!ctx.text) return;
  if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  userStates[ctx.chat.id].currentStep = Steps.BIRTHDAY_STEP;
  ctx.reply(birthdateStep);
});

bot.action('INCORRECT_NAME_LASTNAME', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  ctx.reply(nameLastNameStep_Repeat);
});
// --------------------

// ---- CONFIRM BIRTHDATE ----
bot.action('CORRECT_BIRTHDATE', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (!ctx.text) return;
  if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  userStates[ctx.chat.id].currentStep = Steps.TELEGRAM_ALIAS_STEP;
  ctx.reply(telegramAliasStep);
});

bot.action('INCORRECT_BIRTHDATE', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  ctx.reply(birthdateStep_Repeat);
});
// --------------------

// ---- CONFIRM TELEGRAM ALIAS ----
bot.action('CORRECT_TELEGRAM_ALIAS', async (ctx: Context) => {
  try {
    if (!ctx.chat) return;
    if (!ctx.text) return;
    if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
    userStates[ctx.chat.id].currentStep = Steps.NON_STEP;
    await handleFinishSubscription(userStates[ctx.chat.id], ctx);
    delete userStates[ctx.chat.id];
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error al registrar la inscripción.');
  }
});

bot.action('INCORRECT_TELEGRAM_ALIAS', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  ctx.reply(telegramAliasStep_Repeat);
});
// --------------------

// **** COMMANDS ****

bot.command('enviarapuesta', async (ctx: Context) => {
  if (!ctx.from || !ctx.chat) return;

  try {
    const userSub = await checkUserSub(ctx.from.id);
    if (!userSub)
      return ctx.reply(
        'No pudimos encontrar tu Inscripción al Torneo, usa /start para más información.',
      );

    const checkBet = await checkFileExists(ctx.from.id);
    if (checkBet)
      return ctx.reply('Ya has enviado tu apuesta, muchas gracias por tu participación.');

    ctx.reply('Adjunta una captura de tu apuesta, solo debe ser 1 imagen.');
    const userState = getUserState(userStates, ctx.chat.id);
    userStates[ctx.chat.id] = userState;
    userStates[ctx.chat.id].currentStep = Steps.UPLOAD_BET_STEP;
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error');
  }
});

// **** BOT CHAT FUNCTIONS ****

const processUploadBet = async (ctx: Context) => {
  if (!ctx.message) return;
  if (!ctx.chat) return;
  if ('photo' in ctx.message) {
    if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep === Steps.NON_STEP)
      return ctx.reply('No puedes enviar tu apuesta en este momento, usa /enviarapuesta');
    if (ctx.message.media_group_id) return ctx.reply('Solo se permite enviar 1 captura.');
    const upload = await uploadBet(ctx, ctx.message.photo);
    if (upload) return ctx.reply(uploadBetOk);
    userStates[ctx.chat.id].currentStep = Steps.NON_STEP;
  }
};
bot.on('message', (ctx: Context) => {
  try {
    if (ctx.chat && ctx.message) {
      if ('photo' in ctx.message) {
        return processUploadBet(ctx);
      }
      const chatId = ctx.chat.id;
      const userState = getUserState(userStates, chatId);

      if (!ctx.text) return;

      switch (userState.currentStep) {
        case Steps.NAME_LASTNAME_STEP: {
          userState.userInfo.name = ctx.text;
          ctx.reply(
            `Tu nombre y apellido es: "${ctx.text}". ¿Es correcto?`,
            Markup.inlineKeyboard([
              [Markup.button.callback('Si', 'CORRECT_NAME_LASTNAME')],
              [Markup.button.callback('No', 'INCORRECT_NAME_LASTNAME')],
            ]),
          );
          break;
        }
        case Steps.BIRTHDAY_STEP: {
          userState.userInfo.birthdate = ctx.text;
          ctx.reply(
            `Tu Fecha de Nacimiento es: "${ctx.text}". ¿Es correcto?`,
            Markup.inlineKeyboard([
              [Markup.button.callback('Si', 'CORRECT_BIRTHDATE')],
              [Markup.button.callback('No', 'INCORRECT_BIRTHDATE')],
            ]),
          );
          break;
        }
        case Steps.TELEGRAM_ALIAS_STEP: {
          userState.userInfo.telegramAlias = ctx.text;
          ctx.reply(
            `Tu Alias de Telegram es: "@${ctx.text}". ¿Es correcto?`,
            Markup.inlineKeyboard([
              [Markup.button.callback('Si', 'CORRECT_TELEGRAM_ALIAS')],
              [Markup.button.callback('No', 'INCORRECT_TELEGRAM_ALIAS')],
            ]),
          );
          break;
        }
        case Steps.UPLOAD_BET_STEP: {
          ctx.reply(
            'Para recibir tu apuesta debes enviar una captura de la misma. Máximo 1 imagen.',
          );
          break;
        }
        default: {
          ctx.reply(noStepActive);
          userState.currentStep = Steps.NON_STEP;
          break;
        }
      }
    }
  } catch (error) {
    if (error instanceof TelegramError) {
      console.error(`Telegram API error: ${error.response}`);
    } else {
      console.error(`Unexpected error: ${error}`);
    }
  }
});

// if (process.exit()) {
//   pool.end();
//   console.log('Termiando proceso y cerrando conexión de la base de datos.');
// }
