import axios from 'axios';
import 'dotenv/config';
import { Token } from '../../models/TokenAirtable.model.js';

export default async function SendDataToAirtable(createdTableId, jsonDataTable) {
  try {
    console.log('Отправка данных в таблицу');

    // Получение токена из базы данных
    const token = await Token.findOne();

    if (!token) {
      console.error('Токен не найден в базе данных');
      return;
    }

    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json'
    };

    const jsonData = jsonDataTable;

    // Функция для обработки и проверки значений полей
    const addQuotesIfNeeded = (value) => {
    
      if 
      (typeof value === 'number' 
      // || 
      // (typeof value === 'string' && !isNaN(value))
      ) 
      {
        return `${value}`;
      }
      return value;
    //   return value.replace(/['"]+/g, '');
    };

    const processFieldValues = (fields) => {
      const processedFields = {};
      for (const key in fields) {
        const value = fields[key];
        processedFields[key] = addQuotesIfNeeded(value);
        console.log(processedFields[key])
      }
      return processedFields;
    };

    // Преобразование исходных данных в требуемый формат
    const records = jsonData.map((data) => {
      return {
        fields: processFieldValues(data),
      };
    });

    // Разбиваем данные на части по 5 записей
    const chunkedRecords = [];
    const chunkSize = 5;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      chunkedRecords.push(chunk);
    }

    // Отправка данных в AirTable с интервалом 15 секунд (4 запроса в минуту)
    for (let i = 0; i < chunkedRecords.length; i++) {
      const data = {
        records: chunkedRecords[i],
      };

      console.log('DATA', JSON.stringify(data, null, 2));
      // Выводим объект данных

      const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${createdTableId}`;
      const response = await axios.post(url, data, { headers });

      // Обработка ответа
      if (response.status === 200) {
        const created_records = response.data.records || [];
        created_records.forEach(record => {
          const record_id = record.id;
          const created_time = record.createdTime;
          // Доступ к значениям ячеек записи
          const fields = record.fields || {};
          // Обработка полученных данных
        });
      } else {
        // Обработка ошибки при выполнении запроса
      }

      // Добавляем интервал в 15 секунд между запросами
      if (i < chunkedRecords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }

  } catch (error) {
    // Обработка ошибки
    console.error(error);
  }
}

