const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

// === НАСТРОЙКИ ===
const STRAPI_URL = 'https://love.bigcheese.fun'; // Адрес твоего Strapi
const API_TOKEN = '6e7c9406b321a13cb0d84b7556608e62c57ec6e95de53a49a034bb4831ac56367395ebf7f47c58033d62cfdf6113ea7ae026fb9b0e24ee27410ba8dcccb07d64e6548862017e687ef73dc3bd8152c5f38d72013e53ca165a96a47b59d7a9db2f622a2e82fd96abb4d3f66cf7c77070ff682bdfb8b96d97856cce4361a44d1eec';
const CONTENT_TYPE = 'words'; // Например: 'words', 'es-words', 'it-words' — выбери нужную
const CSV_FILE = 'import/test.csv';

// === ПРОВЕРКА НАСТРОЕК ===
if (!STRAPI_URL || STRAPI_URL.trim() === '') {
  console.error('❌ STRAPI_URL не указан!');
  process.exit(1);
}

if (!API_TOKEN || API_TOKEN.trim() === '') {
  console.error('❌ API_TOKEN не указан!');
  process.exit(1);
}

if (!CONTENT_TYPE || CONTENT_TYPE.trim() === '') {
  console.error('❌ CONTENT_TYPE не указан!');
  process.exit(1);
}

if (!CSV_FILE || CSV_FILE.trim() === '') {
  console.error('❌ CSV_FILE не указан!');
  process.exit(1);
}

// === ПРОВЕРКА ФАЙЛА ===
if (!fs.existsSync(CSV_FILE)) {
  console.error(`❌ Файл ${CSV_FILE} не найден!`);
  console.error('Убедитесь, что файл существует в той же папке, что и скрипт.');
  process.exit(1);
}

// Проверяем, что файл не пустой
const stats = fs.statSync(CSV_FILE);
if (stats.size === 0) {
  console.error(`❌ Файл ${CSV_FILE} пустой!`);
  process.exit(1);
}

// === ВАЛИДАЦИЯ ДАННЫХ ===
const validateRow = (row) => {
  // Проверяем, что row является объектом
  if (!row || typeof row !== 'object') {
    return 'Строка данных не является объектом';
  }

  // Проверяем наличие заголовков в CSV
  const hasHeaders = Object.keys(row).some(key => 
    ['en', 'ru', 'es', 'it'].includes(key)
  );
  
  if (!hasHeaders) {
    return 'Отсутствуют заголовки в CSV файле. Добавьте первую строку с названиями столбцов (например: en,ru,fontSize,answerTime,correctAnswer)';
  }

  // Определяем обязательные поля в зависимости от типа контента
  let requiredFields;
  
  switch (CONTENT_TYPE) {
    case 'words':
    case 'ko-words':
      requiredFields = ['en', 'ru'];
      break;
    case 'es-words':
      requiredFields = ['ru', 'es'];
      break;
    case 'it-words':
      requiredFields = ['it', 'ru'];
      break;
    default:
      console.error(`❌ Неизвестный тип контента: ${CONTENT_TYPE}`);
      return `Неизвестный тип контента: ${CONTENT_TYPE}`;
  }
  
  for (const field of requiredFields) {
    if (!row[field] || row[field].toString().trim() === '') {
      return `Отсутствует обязательное поле: ${field}`;
    }
  }
  
  // Проверка числовых полей
  if (row.fontSize !== undefined && row.fontSize !== null && row.fontSize !== '') {
    const fontSize = Number(row.fontSize);
    if (isNaN(fontSize) || fontSize <= 0 || fontSize > 100) {
      return 'fontSize должен быть числом от 1 до 100';
    }
  }
  
  if (row.answerTime !== undefined && row.answerTime !== null && row.answerTime !== '') {
    const answerTime = Number(row.answerTime);
    if (isNaN(answerTime) || answerTime <= 0 || answerTime > 300) {
      return 'answerTime должен быть числом от 1 до 300 секунд';
    }
  }
  
  // Проверка boolean поля
  if (row.correctAnswer !== undefined && row.correctAnswer !== null && row.correctAnswer !== '') {
    const correctAnswer = row.correctAnswer.toString().toLowerCase();
    if (!['true', 'false', '1', '0', 'yes', 'no'].includes(correctAnswer)) {
      return 'correctAnswer должен быть true/false, 1/0, yes/no';
    }
  }
  
  return null;
};

// === ФУНКЦИЯ ИМПОРТА ОДНОЙ СТРОКИ ===
const importRow = async (row) => {
  try {
    // Валидация данных
    const validationError = validateRow(row);
    if (validationError) {
      console.error(`❌ Ошибка валидации: ${validationError}`);
      console.error('→ Данные строки:', row);
      return false; // Возвращаем false для подсчета ошибок валидации
    }

    // Подготовка данных для отправки
    const dataToSend = {
      ...row,
      fontSize: row.fontSize ? Number(row.fontSize) : 16,
      answerTime: row.answerTime ? Number(row.answerTime) : 30,
      correctAnswer: row.correctAnswer ? 
        ['true', '1', 'yes'].includes(row.correctAnswer.toString().toLowerCase()) : 
        true
    };

    // Удаляем пустые поля
    Object.keys(dataToSend).forEach(key => {
      if (dataToSend[key] === '' || dataToSend[key] === null || dataToSend[key] === undefined) {
        delete dataToSend[key];
      }
    });

    const res = await axios.post(`${STRAPI_URL}/api/${CONTENT_TYPE}`, {
      data: dataToSend
    }, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 секунд таймаут
    });

    if (res.data && res.data.data && res.data.data.id) {
      console.log(`✅ Импортировано: ID ${res.data.data.id}`);
    } else {
      console.log(`✅ Импортировано: ${JSON.stringify(res.data)}`);
    }
    return true; // Успешный импорт
  } catch (error) {
    console.error(`❌ Ошибка при импорте строки:`, row);
    if (error.response) {
      console.error('→ Статус:', error.response.status);
      console.error('→ Данные ошибки:', error.response.data);
      
      // Специальная обработка известных ошибок
      if (error.response.status === 401) {
        console.error('→ Проверьте правильность API токена');
      } else if (error.response.status === 403) {
        console.error('→ У токена нет прав на создание записей');
      } else if (error.response.status === 404) {
        console.error('→ Коллекция не найдена, проверьте CONTENT_TYPE');
      } else if (error.response.status === 422) {
        console.error('→ Ошибка валидации данных на сервере');
      } else if (error.response.status === 429) {
        console.error('→ Слишком много запросов, попробуйте позже');
      } else if (error.response.status >= 500) {
        console.error('→ Ошибка сервера, попробуйте позже');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('→ Таймаут запроса (10 секунд)');
    } else if (error.code === 'ENOTFOUND') {
      console.error('→ Не удается подключиться к серверу');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('→ Сервер отказал в подключении');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('→ Превышено время ожидания подключения');
    } else {
      console.error('→', error.message);
    }
    return false; // Ошибка импорта
  }
};

// === ОБРАБОТКА ОШИБОК И ЗАВЕРШЕНИЕ ===
let processedRows = 0;
let errorCount = 0;
let validationErrors = 0;
let successCount = 0;

const processRow = async (row) => {
  try {
    const result = await importRow(row);
    if (result) {
      successCount++;
    } else {
      validationErrors++;
    }
    processedRows++;
    
    // Добавляем небольшую задержку между запросами
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('❌ Неожиданная ошибка при обработке строки:', error.message);
    errorCount++;
  }
};

// === ЗАПУСК СКРИПТА ===
console.log(`🚀 Начинаем импорт из файла: ${CSV_FILE}`);
console.log(`📊 Тип контента: ${CONTENT_TYPE}`);
console.log(`🌐 Сервер: ${STRAPI_URL}`);
console.log('─'.repeat(50));

// Определяем заголовки в зависимости от типа контента
let csvHeaders;
switch (CONTENT_TYPE) {
  case 'words':
  case 'ko-words':
    csvHeaders = ['en', 'ru', 'fontSize', 'answerTime', 'correctAnswer'];
    break;
  case 'es-words':
    csvHeaders = ['ru', 'es', 'fontSize', 'answerTime', 'correctAnswer'];
    break;
  case 'it-words':
    csvHeaders = ['it', 'ru', 'fontSize', 'answerTime', 'correctAnswer'];
    break;
  default:
    console.error(`❌ Неизвестный тип контента: ${CONTENT_TYPE}`);
    process.exit(1);
}

let rowCount = 0;
let dataRowCount = 0;
let isFirstRow = true;

fs.createReadStream(CSV_FILE)
  .pipe(csv({ headers: csvHeaders }))
  .on('data', (row) => {
    rowCount++;
    
    // Пропускаем первую строку, если это заголовки
    if (isFirstRow) {
      isFirstRow = false;
      // Проверяем, является ли первая строка заголовками
      const hasHeaders = Object.keys(row).some(key => 
        ['en', 'ru', 'es', 'it'].includes(key)
      );
      if (hasHeaders) {
        console.log('📋 Обнаружены заголовки в CSV файле');
        return; // Пропускаем заголовки
      }
    }
    
    dataRowCount++; // Считаем только строки с данными
    processRow(row).catch(error => {
      console.error('❌ Неожиданная ошибка:', error.message);
      errorCount++;
    });
  })
  .on('end', () => {
    setTimeout(() => {
      console.log('─'.repeat(50));
      console.log('🏁 Импорт завершён.');
      console.log(`📈 Всего строк в файле: ${rowCount} (включая заголовки)`);
      console.log(`📊 Строк с данными: ${dataRowCount}`);
      console.log(`✅ Успешно импортировано: ${successCount}`);
      console.log(`⚠️ Ошибок валидации: ${validationErrors}`);
      if (errorCount > 0) {
        console.log(`❌ Ошибок импорта: ${errorCount}`);
      }
      
      // Итоговая статистика
      const totalProcessed = successCount + validationErrors + errorCount;
      if (totalProcessed > 0) {
        const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
        console.log(`📊 Успешность: ${successRate}%`);
      }
    }, 1000); // Ждем завершения всех асинхронных операций
  })
  .on('error', (error) => {
    console.error('❌ Ошибка чтения файла:', error.message);
    if (error.code === 'ENOENT') {
      console.error('→ Файл не найден');
    } else if (error.code === 'EACCES') {
      console.error('→ Нет прав на чтение файла');
    } else if (error.code === 'EISDIR') {
      console.error('→ Указанный путь является папкой, а не файлом');
    } else if (error.code === 'ENOTFOUND') {
      console.error('→ Файл не найден по указанному пути');
    }
    process.exit(1);
  });