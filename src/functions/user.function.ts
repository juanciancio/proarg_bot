import { promises as fs } from 'fs';
import path from 'path';
import { Context } from 'telegraf';
import { PhotoSize } from 'telegraf/typings/core/types/typegram.js';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { UserState } from '../models/user.state.js';
import { finishStep } from '../utils/messages.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Consulta si el usuario está o no registrado en la base de datos
 * @param telegramId
 * @returns
 */
export async function checkUserSub(telegramId: number): Promise<boolean> {
  let client;
  try {
    client = await pool.connect();
    const query = await client.query('SELECT id FROM users WHERE telegram_id = $1 LIMIT 1', [
      telegramId,
    ]);
    return query.rowCount ? true : false;
  } catch (error) {
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Devuelve el estado actual del Usuario en el Chat
 * @param chatId
 * @returns
 */
export function getUserState(userState: { [key: number]: UserState }, chatId: number): UserState {
  if (!userState[chatId]) {
    userState[chatId] = { currentStep: 0, userInfo: new UserModel() };
  }
  return userState[chatId];
}

/**
 * Registra en la base de datos un usuario
 * @param user
 * @param ctx
 * @returns
 */
export async function handleFinishSubscription(user: UserState, ctx: Context): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO users (name, birthdate, telegram_alias, telegram_id) VALUES ($1, $2, $3, $4)`,
      [
        user.userInfo.name,
        user.userInfo.birthdate,
        user.userInfo.telegramAlias,
        user.userInfo.telegramId,
      ],
    );
    ctx.reply(finishStep);
  } catch (error) {
    await ctx.reply('Hubo un error en la inscripción del usuario.');
    throw error; // Rechaza la promesa con el error
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Carga la apuesta del usuario en formato imagen
 * @param ctx
 * @param photo
 * @returns
 */
export async function uploadBet(ctx: Context, photo: PhotoSize[]): Promise<boolean> {
  try {
    if (!ctx.from) return false;
    const fileId = photo[photo.length - 1].file_id;

    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const fileExtension = file.file_path?.split('.').pop(); // Obtener la extensión del archivo
    const fileName = `${ctx.from.id}.${fileExtension}`; // Usar el ID del usuario y la extensión del archivo
    const filePath = path.join('dist', 'assets', 'bets_img', fileName); // Crear la ruta completa
    await fs.writeFile(filePath, buffer);
    return true;
  } catch (error) {
    throw error;
  }
}

export async function checkFileExists(userId: number): Promise<boolean> {
  const directoryPath = path.join('dist', 'assets', 'bets_img');

  try {
    const files = await fs.readdir(directoryPath);
    return files.some((file) => file.startsWith(userId.toString()));
  } catch (error) {
    console.error(`Error al leer el directorio: ${error}`);
    return false;
  }
}
