import axios from 'axios';
import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore';
import schedule from 'node-schedule';
import { Context, Telegraf } from 'telegraf';
import { PhotoSize } from 'telegraf/typings/core/types/typegram.js';
import { bucket, db } from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { UserState } from '../models/user.state.js';
import { ERROR, advertisement, finishStep, uploadBetOk } from '../utils/messages.js';

const token = process.env.TELEGRAM_BOT_TOKEN_TEST;

/**
 * Consulta si el usuario está o no registrado en la base de datos
 * @param telegramId
 * @returns
 */
export async function checkUserSub(telegramId: number): Promise<boolean> {
  try {
    const userRef = collection(db, 'registrations');
    const q = query(userRef, where('telegram_id', '==', telegramId), limit(1));
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty ? true : false;
  } catch (error) {
    throw error;
  }
}

/**
 * Devuelve el estado actual del Usuario en el Chat
 * @param chatId
 * @returns
 */
export function getUserState(userState: { [key: number]: UserState }, chatId: number): UserState {
  if (!userState[chatId]) {
    userState[chatId] = { currentStep: 0, userInfo: new UserModel(), cooldownUploadBet: 0 };
  }
  return userState[chatId];
}

/**
 * Registra en la base de datos un usuario
 * @param user
 * @param ctx
 * @returns
 */
export async function handleFinishSubscription(userState: UserState, ctx: Context): Promise<void> {
  try {
    const userData = {
      state: 'PARTICIPANDO',
      telegram_alias: userState.userInfo.telegramAlias,
      telegram_id: userState.userInfo.telegramId,
    };

    const usersRef = await addDoc(collection(db, 'registrations'), userData);
    usersRef.id ? ctx.reply(finishStep, { parse_mode: 'Markdown' }) : ctx.reply(ERROR);
  } catch (error) {
    await ctx.reply(ERROR);
    throw error; // Rechaza la promesa con el error
  }
}

/**
 * Carga la apuesta del usuario en formato imagen
 * @param ctx
 * @param photo
 * @returns
 */
export async function uploadBet(ctx: Context, photo: PhotoSize[]): Promise<boolean | undefined> {
  try {
    if (!ctx.message) return;
    let finish = false;

    const fileUrl = await ctx.telegram.getFileLink(photo[photo.length - 1].file_id);

    const response = await axios.get(fileUrl.href, { responseType: 'stream' });
    const [files] = await bucket.getFiles({ prefix: 'bets_images/' });

    const fileName = `bets_images/${files.length}_${ctx.from?.id}.jpg`;
    const file = bucket.file(fileName);

    // Carga la imagen en Firebase Storage
    const stream = response.data.pipe(
      file.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
          created_at: new Date().toUTCString(),
        },
      }),
    );

    stream.on('finish', async () => {
      finish = true;
    });

    stream.on('error', (err: any) => {
      console.error('Error al subir la imagen:', err);
      ctx.reply(ERROR);
    });
    if (finish) ctx.reply(uploadBetOk);
    return true;
  } catch (error) {
    throw error;
  }
}

export async function checkingBet(telegramId: number): Promise<boolean> {
  try {
    const [files] = await bucket.getFiles({ prefix: 'bets_images/' });
    const filePattern = new RegExp(`bets_images/\\d+_${telegramId}.jpg`);
    const fileExists = files.some((file) => filePattern.test(file.name));
    return fileExists;
  } catch (error) {
    console.error(`Error al leer el directorio: ${error}`);
    return false;
  }
}

/**
 * Cuenta todos los usuarios inscriptos y registrados en la base de datos
 * @returns
 */
export async function countUsersSubscribed(): Promise<number> {
  try {
    const userRef = collection(db, 'registrations');
    const querySnapshot = await getDocs(userRef);

    return querySnapshot.docs.length;
  } catch (error) {
    throw error;
  }
}

export async function scheduleMessage(bot: Telegraf, date: any, blockedUsers: any) {
  schedule.scheduleJob(date, async () => {
    const userRef = collection(db, 'users');
    const querySnapshot = await getDocs(userRef);

    if (querySnapshot.empty) {
      console.log('No hay usuarios registrados para enviar el mensaje.');
      return;
    }

    const userIds: number[] = [];
    querySnapshot.forEach((doc) => {
      userIds.push(doc.data().telegram_id);
    });

    const results = await Promise.all(
      userIds.map((chatId) => sendMessageSafe(bot, chatId, advertisement, blockedUsers)),
    );

    // Genera un resumen de los resultados
    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;
    const failedUsers = results.filter((result) => !result.success).map((result) => result.chatId);

    let responseMessage = `Difusión programada completada.\nMensajes enviados exitosamente: ${successCount}\nFallos: ${failedCount}`;
    if (failedCount > 0) {
      responseMessage += `\nUsuarios que fallaron: ${failedUsers.join(', ')}`;
    }

    console.log(responseMessage);
  });
}

export async function sendMessageSafe(
  bot: Telegraf,
  chatId: number,
  message: string,
  blockedUsers: any,
) {
  if (blockedUsers.has(chatId)) {
    console.log(`No se envió el mensaje al usuario ${chatId} porque ha bloqueado el bot.`);
    return { chatId, success: false, error: 'Usuario bloqueado' };
  }

  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    return { chatId, success: true };
  } catch (error: any) {
    if (error.response && error.response.error_code === 403) {
      console.log(`El bot fue bloqueado por el usuario ${chatId} al enviar el mensaje`);
      blockedUsers.add(chatId);
      return { chatId, success: false, error: 'Usuario bloqueado' };
    } else {
      console.error(`Error al enviar el mensaje al usuario ${chatId}`, error);
      return { chatId, success: false, error: error.message };
    }
  }
}
