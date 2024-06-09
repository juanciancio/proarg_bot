import { promises as fs } from 'fs';
import path from 'path';
import { Context } from 'telegraf';
import { PhotoSize } from 'telegraf/typings/core/types/typegram.js';
import { dataSource } from '../config/database.js';
import { Bet } from '../entity/bet.entity.js';
import { User } from '../entity/user.entity.js';
import { UserModel } from '../models/user.model.js';
import { UserState } from '../models/user.state.js';
import { finishStep } from '../utils/messages.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Consulta si el usuario está o no registrado en la base de datos
 * @param telegramId
 * @returns
 */
export async function checkUserSub(telegramId: number): Promise<boolean> {
  try {
    const userRepository = dataSource.getRepository(User);
    const userSub = await userRepository.findOneBy({ telegramId: telegramId });
    return userSub ? true : false;
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
    const userRepository = dataSource.getRepository(User);
    const user = new User();
    user.name = userState.userInfo.name;
    user.birthdate = userState.userInfo.birthdate;
    user.telegramAlias = userState.userInfo.telegramAlias;
    user.telegramId = userState.userInfo.telegramId;
    user.state = 'PARTICIPANDO';
    userRepository.save(user);
    ctx.reply(finishStep);
  } catch (error) {
    await ctx.reply('Hubo un error en la inscripción del usuario.');
    throw error; // Rechaza la promesa con el error
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
    await persistBet(ctx.from.id);
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

async function persistBet(telegramId: number): Promise<void> {
  try {
    const betRepository = dataSource.getRepository(Bet);
    const bet = new Bet();
    bet.telegramId = telegramId;
    bet.date = new Date().toDateString();
    betRepository.save(bet);
  } catch (error) {
    throw error;
  }
}

/**
 * Chequea en la base de datos si el usuario ya registró su apuesta
 * @param telegramId
 * @returns
 */
export async function checkingBet(telegramId: number): Promise<boolean> {
  try {
    const betRepository = dataSource.getRepository(Bet);
    const userSub = await betRepository.findOneBy({ telegramId: telegramId });
    return userSub ? true : false;
  } catch (error) {
    throw error;
  }
}

/**
 * Cuenta todos los usuarios inscriptos y registrados en la base de datos
 * @returns
 */
export async function countUsersSubscribed(): Promise<number> {
  try {
    const userRepository = dataSource.getRepository(User);
    const countUsers = userRepository.count();
    return countUsers;
  } catch (error) {
    throw error;
  }
}
