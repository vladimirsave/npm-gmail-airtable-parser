import axios from 'axios';
import fs from 'fs';
import XLSX from 'xlsx';
import 'dotenv/config';
import { Token } from '../../models/TokenAirtable.model.js';
import SendDataToAirtable from './send-numbers-to-air-table-FT.js';

const { AIRTABLE_BASE_ID } = process.env;
const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/v0';

export default async function ListTables(tableIdOrName) {
  console.log('Start 2');
  console.log('путь для получения', tableIdOrName);
  
  try {
    console.log('Start 2_1');
    // Получение токена из базы данных
    const token = await Token.findOne();
    console.log(token);

    if (!token) {
      console.error('Токен не найден в базе данных');
      return;
    }

    const responseTables = await axios.get(
      `${AIRTABLE_API_BASE_URL}/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const tables = responseTables.data.tables;
    console.log('\nДоступные таблицы:');
    tables.forEach((table) => {
      console.log(`- ${table.name} (ID: ${table.id})`);
    });

    // Вызываем функцию для проверки и создания указанной таблицы
    checkAndCreateTable(tableIdOrName);
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
  }
}

async function checkAndCreateTable(tableIdOrName) {
  console.log('Start 3');
  try {
    // Получение токена из базы данных
    const token = await Token.findOne();
    // console.log(token);

    if (!token) {
      console.error('Токен не найден в базе данных');
      return;
    }

    const responseTables = await axios.get(`${AIRTABLE_API_BASE_URL}/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const tables = responseTables.data.tables;
    const tableExists = tables.some((table) => table.id === tableIdOrName || table.name === tableIdOrName);

    if (!tableExists) {
      await createTable(tableIdOrName);
      console.log(`Таблица "${tableIdOrName}" успешно создана.`);
    } else {
      console.log(`Таблица "${tableIdOrName}" уже существует.`);
    }
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
  }
}

// Функция для создания таблицы в Airtable и загрузки данных из файла
async function createTable(tableIdOrName) {
  console.log('Начало 4');

  try {
    const filePath = tableIdOrName;  
    const workbook = XLSX.readFile(filePath);

    // Получение листа, который необходимо обработать
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Получаем количество столбцов в таблице (по количеству букв в названиях колонок)
    const columnCount = XLSX.utils.decode_range(worksheet['!ref']).e.c + 1;

    // Объединяем значения из ячеек таблицы с заголовками строки 4 и 5
    const columnNames = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const topCell = worksheet[XLSX.utils.encode_cell({ r: 4, c: colIndex })];
      const bottomCell = worksheet[XLSX.utils.encode_cell({ r: 5, c: colIndex })];
      const columnName = XLSX.utils.format_cell(topCell) + " " + XLSX.utils.format_cell(bottomCell);
      columnNames.push(columnName);
    }

    // Массив для хранения данных JSON
    const jsonData = [];

    // Читаем данные каждой строки и создаем объект с информацией
    let rowIndex = 6; // Начинаем с 6-й строки (первая заполненная строка)
    while (true) {
      // const firstCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
      const firstCell = worksheet[cellAddress];
      if (!firstCell || typeof firstCell.v === 'undefined') {
        console.log('Закончились данные в строках таблицы');
        break; // Если данные закончились, выходим из цикла
      }
   

      const rowData = {};
      for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const cellValue = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })]?.v;
        const columnName = columnNames[colIndex];
        rowData[columnName] = cellValue;
      }

      jsonData.push(rowData);
      console.log('rowData', rowData);

      rowIndex++; // Переходим к следующей строке
    }

    // Получение текущей даты в формате ГГГГ-ММ-ДД
    const currentDate = new Date().toISOString().split('T')[0];
    const sanitizedName = `${tableIdOrName}_${currentDate}`.replace(/[^\w]+/g, "");
    const tableData = {
      description: 'Список задач мест для посещения',
      fields: columnNames.map((columnName) => ({
        description: '',
        name: columnName,
        type: 'singleLineText',
      })),
      name: sanitizedName, // Добавляем текущую дату к названию таблицы
    };

    // Получение токена из базы данных
    const token = await Token.findOne();
    // console.log(token);

    if (!token) {
      console.error('Токен не найден в базе данных');
      return;
    }

    // Отправляем запрос на создание таблицы
    const response = await axios.post(`${AIRTABLE_API_BASE_URL}/meta/bases/${AIRTABLE_BASE_ID}/tables`, tableData, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Получаем ID созданной таблицы из ответа сервера
    const createdTableId = response.data.id;

    console.log(`Таблица "${tableIdOrName}" (ID: ${createdTableId}) успешно создана.`);

    // Теперь у вас есть ID созданной таблицы, который вы можете использовать по вашему усмотрению
    SendDataToAirtable(createdTableId, jsonData);

  } catch (err) {
    console.log('Ошибка:', err);
    throw new Error(err);
  }
}

