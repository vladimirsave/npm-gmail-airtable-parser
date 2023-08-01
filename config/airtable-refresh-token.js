import 'dotenv/config';
import axios from 'axios';
import qs from 'qs';
import mongoose from 'mongoose';
import './mongoose.js';
import { Token } from '../models/TokenAirtable.model.js';

async function RefreshToken() {
    console.log('Запрос обновления токена!');
  try {
    // Получение последнего сохраненного токена из базы данных
    const token = await Token.findOne();
    console.log('Токен найден в базе данных', token);

    if (!token) {
      console.error('Токен не найден в базе данных');
      return;
    }

    // Отправка запроса на обновление токена
    console.log('Из env', process.env.CLIENT_SECRET_AIRTABLE);
    const clientCredentials = `${process.env.CLIENT_ID_AIRTABLE}:${process.env.CLIENT_SECRET_AIRTABLE}`; // Замените YOUR_CLIENT_ID и YOUR_CLIENT_SECRET на ваши данные
    const authorizationHeader = `Basic ${Buffer.from(clientCredentials).toString('base64')}`;

    const url = 'https://www.airtable.com/oauth2/v1/token';
    const data = "grant_type=refresh_token&refresh_token=" + encodeURIComponent(token.refreshToken) + "&client_id=" + encodeURIComponent(process.env.CLIENT_ID_AIRTABLE) + "&client_secret=" + encodeURIComponent(process.env.CLIENT_SECRET_AIRTABLE);
   
    const headers = {
      Authorization: authorizationHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // 'Content-Type': 'application/json',

    const response = await axios.post(url, data, { headers });

    // Обновление токена в базе данных
    const updatedToken = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.refresh_expires_in,
    };
    const updatedTokenData = await Token.findOneAndUpdate({}, updatedToken, { new: true });

    console.log('Токен обновлен:', updatedTokenData);
  } catch (error) {
    console.error('Ошибка при обновлении токена:', error);
  }
}

// Запуск обновления токена каждые 50 минут
const interval = 30 * 60 * 1000; // 50 минут в миллисекундах
setInterval(RefreshToken, interval);

export default RefreshToken;

