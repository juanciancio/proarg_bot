import moment from 'moment-timezone';
import { Context, Markup, Telegraf, TelegramError } from 'telegraf';
import { Steps, UserStatus } from './enums/steps.enum.js';
import {
  checkUserStatus,
  checkUserSub,
  checkingBet,
  countUsersSubscribed,
  getUserState,
  handleFinishSubscription,
  scheduleMessage,
  uploadBet,
} from './functions/user.function.js';
import { UserState } from './models/user.state.js';
import {
  betSended,
  birthdateStep,
  birthdateStep_Repeat,
  firstStep,
  nameLastNameStep_Repeat,
  noStepActive,
  telegramAliasStep,
  telegramAliasStep_Repeat,
  uploadBetOk,
  welcomeMsg,
} from './utils/messages.js';

const bot = new Telegraf('7302706089:AAE5SqLasKdEYVnxYYFGRv6NWk4zfGG1Trw');
let botIsLaunched = false;
let blockedUsers = new Set();

if (!botIsLaunched) {
  bot
    .launch()
    .then(() => {
      botIsLaunched = true;
    })
    .catch((error) => console.log(`Ocurrió un error al ejecutar el Bot: ${error}`));
}

const userStates: { [key: number]: UserState } = {};

// **** BOT START ****
bot.start(async (ctx) => {
  try {
    if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep !== Steps.NON_STEP) return;
    if (blockedUsers.has(ctx.from.id)) {
      console.log(`No se envió el mensaje al usuario ${ctx.from.id} porque ha bloqueado el bot.`);
      return;
    }

    await ctx.reply(welcomeMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('Inscribirme', 'SIGNUP_BUTTON')]]),
    });
  } catch (error: any) {
    if (error.response && error.response.error_code === 403) {
      console.log(`El bot fue bloqueado por el usuario ${ctx.from.id} al enviar el mensaje`);
      // Agrega el usuario a la lista de usuarios bloqueados
      blockedUsers.add(ctx.from.id);
    }
  }
});

// **** BOT ACTIONS ****

// ---- SIGNUP ----
bot.action('SIGNUP_BUTTON', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (ctx.from) {
    const userSub = await checkUserSub(ctx.from.id);

    if (userSub)
      return ctx.reply('Ya te encuentras inscripto, muchas gracias por tu participación.');

    const userState = getUserState(userStates, ctx.chat.id);
    userStates[ctx.chat.id] = userState;
    userStates[ctx.chat.id].userInfo.telegramId = ctx.from.id;

    userStates[ctx.chat.id].currentStep = Steps.TELEGRAM_ALIAS_STEP;
    ctx.reply(firstStep);
  }
});

// ---- CONFIRM NAME ----
bot.action('CORRECT_NAME_LASTNAME', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (!ctx.text) return;
  if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  userStates[ctx.chat.id].currentStep = Steps.BIRTHDAY_STEP;
  ctx.reply(birthdateStep);
});

bot.action('INCORRECT_NAME_LASTNAME', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  ctx.reply(nameLastNameStep_Repeat);
});
// --------------------

// ---- CONFIRM BIRTHDATE ----
bot.action('CORRECT_BIRTHDATE', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (!ctx.text) return;
  if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  userStates[ctx.chat.id].currentStep = Steps.TELEGRAM_ALIAS_STEP;
  ctx.reply(telegramAliasStep);
});

bot.action('INCORRECT_BIRTHDATE', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep === Steps.NON_STEP) return;
  ctx.reply(birthdateStep_Repeat);
});
// --------------------

// ---- CONFIRM TELEGRAM ALIAS ----
bot.action('CORRECT_TELEGRAM_ALIAS', async (ctx: Context) => {
  try {
    if (!ctx.chat) return;
    if (!ctx.text) return;
    if (!userStates[ctx.chat.id]) return;
    userStates[ctx.chat.id].currentStep = Steps.NON_STEP;
    await handleFinishSubscription(userStates[ctx.chat.id], ctx);
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error al registrar la inscripción.');
  }
});

bot.action('INCORRECT_TELEGRAM_ALIAS', async (ctx: Context) => {
  if (!ctx.chat) return;
  if (!userStates[ctx.chat.id]) return;
  ctx.reply(telegramAliasStep_Repeat);
});
// --------------------

// **** COMMANDS ****

bot.command('enviarapuesta', async (ctx: Context) => {
  if (!ctx.from || !ctx.chat) return;
  if (userStates[ctx.chat.id] && userStates[ctx.chat.id].currentStep !== Steps.NON_STEP) return;

  try {
    const userSub = await checkUserSub(ctx.from.id);
    if (!userSub)
      return ctx.reply(
        'No pudimos encontrar tu Inscripción al Torneo, usa /start para más información.',
      );

    const checkUserState = await checkUserStatus(ctx.from.id);
    if (checkUserState == UserStatus.USER_ELIMINATED)
      return ctx.reply('No has clafisicado para la siguiente etapa. Mucha suerte la próxima!');

    const checkBet = await checkingBet(ctx.from.id);
    if (checkBet) return ctx.reply(betSended);

    ctx.reply('Adjunta una captura de tu apuesta, solo debe ser 1 imagen.');
    const userState = getUserState(userStates, ctx.chat.id);
    userStates[ctx.chat.id] = userState;
    userStates[ctx.chat.id].currentStep = Steps.UPLOAD_BET_STEP;
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error');
  }
});

bot.command('inscriptos', async (ctx: Context) => {
  if (!ctx.from || !ctx.chat) return;

  if (ctx.from.username !== 'MauroProArg' && ctx.from.username !== 'juanciancio') return;
  try {
    const usersSubscribed = await countUsersSubscribed();
    ctx.reply(`Actualmente hay ${usersSubscribed} usuarios inscriptos.`);
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error');
  }
});

// **** BOT CHAT FUNCTIONS ****

const processUploadBet = async (ctx: Context) => {
  try {
    if (!ctx.message || !ctx.chat || !ctx.from) return;

    if ('photo' in ctx.message) {
      if (!userStates[ctx.chat.id] || userStates[ctx.chat.id].currentStep === Steps.NON_STEP)
        return ctx.reply('No puedes enviar tu apuesta en este momento, usa /enviarapuesta');

      const checkUserState = await checkUserStatus(ctx.from.id);
      if (checkUserState == UserStatus.USER_ELIMINATED)
        return ctx.reply('No has clafisicado para la siguiente etapa. Mucha suerte la próxima!');

      const checkBet = await checkingBet(ctx.from.id);
      if (checkBet) return ctx.reply(betSended);

      if (ctx.message.media_group_id) return ctx.reply('Solo se permite enviar 1 captura.');
      await uploadBet(ctx, ctx.message.photo);
      userStates[ctx.chat.id].currentStep = Steps.NON_STEP;
      ctx.reply(uploadBetOk);
    }
  } catch (error) {
    console.log(error);
    ctx.reply('Ha ocurrido un error.');
  }
};

bot.on('message', async (ctx: Context) => {
  try {
    if (!ctx.chat) return;
    if (!ctx.message) return;
    if (!ctx.from) return;
    if ('photo' in ctx.message) {
      const checkBet = await checkingBet(ctx.from.id);
      if (checkBet) return ctx.reply(betSended);
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
        if (ctx.text.startsWith('@'))
          return ctx.reply('Debes introducir tu Alias de Telegram sin el @');

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
        ctx.reply('Para recibir tu apuesta debes enviar una captura de la misma. Máximo 1 imagen.');
        break;
      }
      default: {
        ctx.reply(noStepActive);
        userState.currentStep = Steps.NON_STEP;
        break;
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

const date = moment
  .tz('2024-06-11 09:00', 'YYYY-MM-DD HH:mm', 'America/Argentina/Buenos_Aires')
  .toDate();

scheduleMessage(bot, date, blockedUsers);
