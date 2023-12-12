const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const fs = require('fs');
const path = require('path');
const connectDB = require('./db');
const Tournament = require('./models/tournaments');
const Poll = require('./models/poll');
const User = require('./models/users');
const Registration = require('./models/registrations');
const Vote = require('./models/votes');

// const ChatUser = require('./models/chatUser');

const sport = ['Football', 'Basketball', 'Hockey', 'Tennis',  'Dota2', 'CS2'];

const bot = new Telegraf('6302702257:AAHG8kSyIOcWSBBD3aAeiMR_dcO1OcfGp-U');

// const session = new LocalSession({ database: 'session_db.json' });
// bot.use(session.middleware());
const session = new LocalSession({
  storage: LocalSession.storageMemory
});

bot.use(session.middleware());


// Пароль админа
const ADMIN_PASSWORD = 'ss';

bot.start((ctx) => {
  ctx.session.create = true;
    // Проверяем наличие username
    if (!ctx.from.username) {
      // Если username отсутствует, отправляем сообщение пользователю
      ctx.reply('Пожалуйста, установите username в настройках Telegram, прежде чем использовать этого бота.');
    } else {
      // Если username есть, продолжаем как обычно
      // Поиск пользователя в базе данных
      User.findOne({ telegramTag: ctx.from.username })
        .then(user => {
          if (!user) {
            // Создание нового пользователя, если он не найден
            let newUser = new User({
              telegramName: ctx.from.first_name + ' ' + ctx.from.last_name, // Используйте полное имя
              telegramTag: ctx.from.username,
              walletNumber: '', // Оставьте номер кошелька пустым
              chatId: ctx.chat.id // сохранение chatId
            });
  
            // Сохранение нового пользователя в базе данных
            newUser.save()
              .then(() => {
                if (ctx.session.isAdmin) {
                  ctx.reply('Привет, админ!', Markup.keyboard([
                    ['Создать турнир', 'Показать турниры'],
                    ['Создать опрос']
                  ]).resize());
                } else {
                  ctx.reply(
                    'Выберите действие 👇',
                    Markup.keyboard([
                      ['🎮 Мои текущие турниры', '🎮 Мои прошедшие турниры'], // Эти кнопки будут на одной строке
                      ['🔑 Регистрация в турнир'] // Эта кнопка будет на следующей строке
                    ]).resize()
                  );
                }
              })
              .catch(error => console.error('Ошибка при сохранении пользователя:', error));
          } else {
            // Если пользователь уже существует, просто отправьте приветственное сообщение
            ctx.reply(
              'Выберите действие 👇',
              Markup.keyboard([
                ['🎮 Мои текущие турниры', '🎮 Мои прошедшие турниры'], // Эти кнопки будут на одной строке
                ['🔑 Регистрация в турнир'] // Эта кнопка будет на следующей строке
              ]).resize()
            );
          }
        })
        .catch(error => console.error('Ошибка при поиске пользователя:', error));
    }
  });



  bot.command('admin', (ctx) => {
    ctx.reply('Пожалуйста, введите пароль:');
    ctx.session.awaitingPassword = true;
  });

bot.command('user', (ctx) => {
  ctx.session.isAdmin = false;
  ctx.reply('Теперь вы в режиме пользователя.');
});





bot.command('/clear', (ctx) => {
    // Очистите сессию пользователя
    ctx.session = null;
    ctx.reply('Сессия успешно очищена!');
  });
  
  bot.on('text', (ctx) => {
    if (ctx.session.awaitingPassword) {
      if (ctx.message.text === ADMIN_PASSWORD) {
        ctx.session.isAdmin = true;
        ctx.reply('Привет, админ!', Markup.keyboard([
          ['Создать турнир', 'Показать турниры'],
          ['Создать опрос', 'Запросы на участие'],
          ['Создать оповещение'] // Добавьте новую кнопку здесь
        ]).resize());
      } else {
        ctx.reply('Неверный пароль.');
      }
      ctx.session.awaitingPassword = false;
    } else if (ctx.session.isAdmin) {
      handleAdminText(ctx);
    } else {
      handleUserText(ctx);
    }
  });

  function handleAdminText(ctx) {
    if (ctx.session.awaitingPassword) {
        if (ctx.message.text === ADMIN_PASSWORD) {
          ctx.session.isAdmin = true;
          ctx.reply('Привет, админ!', Markup.keyboard([
            ['Создать турнир', 'Показать турниры'],
            ['Создать опрос', 'Запросы на участие'],
            ['Создать оповещение'] // Добавьте новую кнопку здесь
          ]).resize());
        } else {
          ctx.reply('Неверный пароль.');
        }
        ctx.session.awaitingPassword = false;
      } else if (ctx.message.text === 'Создать оповещение') {
        // Получите список всех турниров
        Tournament.find().then(tournaments => {
          // Создайте массив кнопок. Первая кнопка - "Для всех пользователей", остальные - для каждого турнира
          const buttons = ['Для всех пользователей'].concat(tournaments.map(tournament => tournament.name));
          ctx.reply('Выберите, кому хотите отправить оповещение:', Markup.keyboard(buttons).oneTime().resize());
          ctx.session.awaitingNotificationRecipient = true;
        }).catch(err => {
          console.log(err);
        });
      } else if (ctx.session.awaitingNotificationRecipient) {
        ctx.session.notificationRecipient = ctx.message.text;
        ctx.reply('Введите текст оповещения:');
        ctx.session.awaitingNotificationText = true;
        ctx.session.awaitingNotificationRecipient = false;
      } else if (ctx.session.awaitingNotificationText) {
        const notificationText = ctx.message.text;
        ctx.session.awaitingNotificationText = false;
      
        if (ctx.session.notificationRecipient === 'Для всех пользователей') {
          // Если получатель - "Для всех пользователей", отправьте уведомление всем пользователям
          User.find().then(users => {
            users.forEach(user => {
              bot.telegram.sendMessage(user.chatId, notificationText);
            });
          }).catch(err => {
            console.log(err);
          });
        } else {
          // Если получатель - игроки турнира, отправьте уведомление только зарегистрированным в этом турнире пользователям
          const tournamentName = ctx.session.notificationRecipient; // Удалите "Для игроков " из начала строки
          Tournament.findOne({ name: tournamentName }).then(tournament => {
            Registration.find({ tournamentId: tournament._id }).then(registrations => {
              registrations.forEach(registration => {
                User.findOne({ _id: registration.userId }).then(user => {
                  bot.telegram.sendMessage(user.chatId, notificationText);
                }).catch(err => {
                  console.log(err);
                });
              });
            }).catch(err => {
              console.log(err);
            });
          }).catch(err => {
            console.log(err);
          });
        }
      } 


      
      else if (ctx.message.text === 'Создать турнир') {
        ctx.reply('Введите виды спорта через +, например: [Football + Basketball] примеры для ввода (Football, Basketball, Hockey, Tennis,  Dota2, CS2)');
        ctx.session.awaitingTournamentData = { step: 'sports' };
      } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'sports') {
        ctx.session.awaitingTournamentData.sports = ctx.message.text;

        ctx.reply('Введите название турнира:');
        ctx.session.awaitingTournamentData.step = 'name';
      }

      
      // else if (ctx.message.text === 'Создать турнир') {
      //   ctx.reply('Введите название турнира:');
      //   ctx.session.awaitingTournamentData = { step: 'name' };
      // } 
      else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'name') {
          ctx.session.awaitingTournamentData.name = ctx.message.text;
          ctx.reply('Введите описание турнира:');
          ctx.session.awaitingTournamentData.step = 'description';
        } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'description') {
          ctx.session.awaitingTournamentData.description = ctx.message.text;

          ctx.reply('Пожалуйста, введите URL изображения турнира:');
            ctx.session.awaitingTournamentData.step = 'imageUrl';

        } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'imageUrl') {
            ctx.session.awaitingTournamentData.imageUrl = ctx.message.text;

            // Переходите к следующему шагу
            ctx.reply('Введите дату начала турнира в формате ГГГГ-ММ-ДД:');
            ctx.session.awaitingTournamentData.step = 'startDate';
          } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'startDate') {
            const startDate = new Date(ctx.message.text);
            if (isNaN(startDate)) {
              ctx.reply('Неверный формат даты. Пожалуйста, введите дату начала турнира в формате ГГГГ-ММ-ДД:');
            } else {
              ctx.session.awaitingTournamentData.startDate = startDate;
              // ctx.reply('Введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
              // ctx.session.awaitingTournamentData.step = 'endDate';
              ctx.reply('Введите бай-ины через запятую:');
              ctx.session.awaitingTournamentData.step = 'buyIns';
            }
        } 
        // else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'endDate') {
        //     const endDate = new Date(ctx.message.text);
        //     if (isNaN(endDate)) {
        //       ctx.reply('Неверный формат даты. Пожалуйста, введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
        //     } else {
        //       ctx.session.awaitingTournamentData.endDate = endDate;
        //       ctx.reply('Введите бай-ины через запятую:');
        //       ctx.session.awaitingTournamentData.step = 'buyIns';

        //     }

        // }
         else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'buyIns') {
            ctx.session.awaitingTournamentData.buyIns = ctx.message.text.split(',');
            ctx.reply('Турнир является публичным или приватным?', Markup.keyboard(['public', 'private']).oneTime().resize());
            ctx.session.awaitingTournamentData.step = 'type';
          } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'type') {
            ctx.session.awaitingTournamentData.type = ctx.message.text;
            if (ctx.message.text.toLowerCase() === 'private') {
              ctx.reply('Введите пароль для регистрации в турнире:');
              ctx.session.awaitingTournamentData.step = 'password';
            } else {
              // Создание турнира
              // Создание нового турнира
                let newTournament = new Tournament({
                    name: ctx.session.awaitingTournamentData.name,
                    description: ctx.session.awaitingTournamentData.description,
                    startDate: ctx.session.awaitingTournamentData.startDate,
                    // endDate: ctx.session.awaitingTournamentData.endDate,
                    buyIns: ctx.session.awaitingTournamentData.buyIns, // добавлено новое поле
                    type: ctx.session.awaitingTournamentData.type, // добавлено новое поле
                    password: '', // добавлено новое поле
                    image: ctx.session.awaitingTournamentData.imageUrl,
                    sports: ctx.session.awaitingTournamentData.sports
                });

                newTournament.save()
                    .then(() => {
                    ctx.reply('Турнир успешно создан!');
                    delete ctx.session.awaitingTournamentData;
                    })
                    .catch(error => console.error('Ошибка при сохранении турнира:', error));
            }
          } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'password') {
            ctx.session.awaitingTournamentData.password = ctx.message.text;
            // Создание турнира
            // Создание нового турнира
            let newTournament = new Tournament({
                name: ctx.session.awaitingTournamentData.name,
                description: ctx.session.awaitingTournamentData.description,
                startDate: ctx.session.awaitingTournamentData.startDate,
                endDate: ctx.session.awaitingTournamentData.endDate,
                buyIns: ctx.session.awaitingTournamentData.buyIns, // добавлено новое поле
                type: ctx.session.awaitingTournamentData.type, // добавлено новое поле
                password: ctx.session.awaitingTournamentData.type.toLowerCase() === 'private' ? ctx.session.awaitingTournamentData.password : '', // добавлено новое поле
                image: ctx.session.awaitingTournamentData.imageUrl
            });

            newTournament.save()
                .then(() => {
                ctx.reply('Турнир успешно создан!');
                delete ctx.session.awaitingTournamentData;
                })
                .catch(error => console.error('Ошибка при сохранении турнира:', error));
          }
        
        
        
        else if (ctx.message.text === 'Создать опрос') {
      ctx.reply('Введите название опроса:');
      ctx.session.awaitingPollData = { step: 'name' };
    } else if (ctx.session.awaitingPollData) {
      if (ctx.session.awaitingPollData.step === 'name') {
        ctx.session.awaitingPollData.name = ctx.message.text;
        ctx.reply('Введите описание опроса:');
        ctx.session.awaitingPollData.step = 'description';
      } else if (ctx.session.awaitingPollData.step === 'description') {
        ctx.session.awaitingPollData.description = ctx.message.text;
        ctx.reply('Введите варианты ответа через запятую в формате: вариант_очки, вариант_очки');
        ctx.session.awaitingPollData.step = 'options';
      } else if (ctx.session.awaitingPollData.step === 'options') {
        // Разделите каждый вариант по символу "_", чтобы получить текст варианта и количество очков:
        let options = ctx.message.text.split(',');
        for (let i = 0; i < options.length; i++) {
            let [text, points] = options[i].trim().split('_');
            // Проверяем, является ли значение очков числом
            if (isNaN(points)) {
                // Если нет, сообщаем пользователю об ошибке и просим повторить ввод
                ctx.reply('Ошибка: значение очков для варианта ответа "' + text + '" не является числом. Пожалуйста, повторите ввод.');
                return;
            }
        }
        // Если все значения очков являются числами, сохраняем опции
        ctx.session.awaitingPollData.options = options.map(option => {
            const [text, points] = option.trim().split('_');
            return { text, points: Number(points) };
        });
    
        ctx.reply('Введите дату и время закрытия возможности голосовать в формате ГГГГ-ММ-ДД_ЧЧ:ММ');
        ctx.session.awaitingPollData.step = 'closingDate';
    } else if (ctx.session.awaitingPollData.step === 'closingDate') {
        const closingDate = new Date(ctx.message.text.replace('_', 'T') + ':00.000+03:00'); // Добавьте секунды и преобразуйте нижнее подчеркивание обратно в T
        if (isNaN(closingDate)) {
            ctx.reply('Неверный формат даты. Пожалуйста, введите дату и время закрытия возможности голосовать в формате ГГГГ-ММ-ДД_ЧЧ:ММ');
        } else {
            ctx.session.awaitingPollData.closingDate = closingDate;
                    // Найдите все турниры и покажите их администратору
            Tournament.find()
            .then(tournaments => {
            const tournamentNames = tournaments.map(tournament => tournament.name);
            ctx.reply('Выберите турнир, к которому относится этот опрос:', Markup.keyboard(tournamentNames).oneTime().resize());
            ctx.session.awaitingPollData.step = 'tournamentName';
            })
            .catch(error => console.error('Ошибка при поиске турниров:', error));
        }
  

      } else if (ctx.session.awaitingPollData.step === 'tournamentName') {
        Tournament.findOne({ name: ctx.message.text })
          .then(tournament => {
            if (!tournament) {
              return ctx.reply('Турнир с таким названием не найден.');
            }
  
            let newPoll = new Poll({
              name: ctx.session.awaitingPollData.name,
              description: ctx.session.awaitingPollData.description,
              options: ctx.session.awaitingPollData.options,
              closingDate: ctx.session.awaitingPollData.closingDate,
              tournamentId: tournament._id,
              result: ""
            });
  
            newPoll.save()
              .then(() => {
                ctx.reply('Опрос успешно создан!');
                delete ctx.session.awaitingPollData;
              })
              .catch(error => console.error('Ошибка при сохранении опроса:', error));
          })
          .catch(error => console.error('Ошибка при поиске турнира:', error));
      }
    }
    else if (ctx.message.text === 'Показать турниры') {
      // Найдите все турниры в базе данных
      Tournament.find()
      .then(tournaments => {
          // Ваш код для получения турниров...
          for (const tournament of tournaments) {
              // Ваш код для обработки каждого турнира...
  
              // Создайте массив кнопок
              let buttons = [
                  [Markup.button.callback('✅ Открытые опросы', `open_polls_${tournament._id}`)],
                  [Markup.button.callback('❌ Закрытые опросы', `closed_polls_${tournament._id}`)]
              ];
  
              // Если турнир не закрыт, добавьте кнопку "Закончить турнир"
              if (!tournament.closed) {
                  buttons.push([Markup.button.callback('🔚 Закончить турнир', `end_tournament_${tournament._id}`)]);
              }
  
              // Отправьте сообщение с кнопками
              ctx.replyWithMarkdown(`*🏆 ${tournament.name}*...${tournament.closed ? '\n\nЭтот турнир закрыт.' : ''}`, // Ваш текст сообщения
              Markup.inlineKeyboard(buttons)
              );
          }
      })
      .catch(error => console.error('Ошибка при поиске турниров:', error));
  }
       else if (ctx.message.text === 'Запросы на участие') { // Обработка нажатия на новую кнопку
        Registration.find({ status: 'pending' }) // Найти все регистрации со статусом "pending"
          .then(registrations => {
            // Если регистрации не найдены
            if (registrations.length === 0) {
              ctx.reply('Нет запросов на участие.');
            } else {
              // Если найдены регистрации, отправьте их обратно в чат администратора
              registrations.forEach(registration => {
                ctx.reply(
                  `id: ${registration._id}\n` +
                  `userId: ${registration.userId}\n` +
                  `telegramTag: ${registration.telegramTag}\n` +
                  `tournamentId: ${registration.tournamentId}\n` +
                  `tournamentTitle: ${registration.tournamentTitle}\n` +
                  `buyIn: ${registration.buyIn}\n` +
                  `walletNumber: ${registration.walletNumber}\n` +
                  `status: ${registration.status}`,
                  Markup.inlineKeyboard([
                    Markup.button.callback('Допустить', `approve_${registration._id}`),
                    Markup.button.callback('Отклонить', `reject_${registration._id}`)
                  ])
                );
              });
            }
          })
          .catch(error => console.error('Ошибка при поиске регистраций:', error));
      }
  }







  async function handleUserText(ctx) {






  if (ctx.message.text === '🔑 Регистрация в турнир') {
    // Получите все турниры
    const tournaments = await Tournament.find({ closed: { $ne: true } }).sort({ name: 1 });

    // Получите все уникальные виды спорта из турниров
    const sportsInTournaments = [...new Set(tournaments.flatMap(tournament => tournament.sports ? tournament.sports.split(' + ') : []))];

    // Создайте кнопки для каждого вида спорта и кнопку "Все"
    const buttons = sportsInTournaments.map(sport => Markup.button.text(sport));
    buttons.push(Markup.button.text('Все'));  

  ctx.reply('Выберите вид спорта или "Все":', Markup.keyboard(buttons).oneTime().resize());
  ctx.session.waitingSportChoice = true;
}
else if (ctx.message.text && ctx.session.waitingSportChoice == true) {
  ctx.session.waitingSportChoice = false; // Сбросить флаг

  // Получить выбранный вид спорта
  const chosenSport = ctx.message.text;

  // Найти все регистрации текущего пользователя
  const registrations = await Registration.find({ telegramTag: ctx.from.username });
  const registeredTournaments = registrations.map(registration => registration.tournamentId.toString());

  // Найти все турниры, которые не закрыты и соответствуют выбранному виду спорта
  let tournaments;
  if (chosenSport === 'Все') {
    tournaments = await Tournament.find({ closed: { $ne: true } }).sort({ name: 1 });
  } else {
    tournaments = await Tournament.find({ closed: { $ne: true }, sports: { $regex: chosenSport } }).sort({ name: 1 });
  }

  // Отправить каждый турнир пользователю
  for (const tournament of tournaments) {
    const tournamentRegistrations = await Registration.find({ tournamentId: tournament._id });

    // Сгруппируйте регистрации по бай-ину и подсчитайте количество регистраций для каждого бай-ина
    const buyInCounts = {};
    tournament.buyIns.forEach(buyIn => {
      buyInCounts[buyIn] = tournamentRegistrations.filter(registration => registration.buyIn === buyIn).length;
    });

    let buyInMessage = '';
    for (const buyIn in buyInCounts) {
      buyInMessage += `\n${buyIn} - ${buyInCounts[buyIn]} players`;
    }

    if (!registeredTournaments.includes(tournament._id.toString())) {
      let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n`;
      if (tournament.sports) {
        message += `🏅 Виды спорта: ${tournament.sports}\n\n`;
      }
      message += `${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций:${buyInMessage}\n\n⏳ Окончание регистрации: ${tournament.startDate.toLocaleString()}`;
      if (tournament.image) {
        message += `\n ${tournament.image}`;
      }
      ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
        Markup.button.callback('✅ Присоединиться', `join_${tournament._id}`)
      ]));
    } else {
      const registration = registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
      let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n`;
      if (tournament.sports) {
        message += `🏅 Виды спорта: ${tournament.sports}\n\n`;
      }
      message += `${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций:${buyInMessage}\n\n`;
      if (registration.status === 'approved') {
        message += '🎟️ Вы уже зарегистрированы на этот турнир.';
      } else if (registration.status === 'pending') {
        message += '⏳ Ваша заявка на участие ждет одобрения.';
      }
      if (tournament.image) {
        message += `\n ${tournament.image}`;
      }
      ctx.replyWithMarkdown(message);
    }
  }
}
// bot.on('callback_query', (ctx) => {
//     // Получите выбранный вид спорта из данных callback_query
//     const [action, sport] = ctx.callbackQuery.data.split('_');

//     if (action === 'filter') {
//         // Получите все турниры с выбранным видом спорта или все турниры, если выбрано "Все"
//         const tournaments = sport === 'all' ? await Tournament.find({ closed: { $ne: true } }).sort({ name: 1 }) : await Tournament.find({ closed: { $ne: true }, sports: { $regex: sport } }).sort({ name: 1 });

//         // Отправьте каждый турнир пользователю
//         for (const tournament of tournaments) {
//             // Здесь ваш код для отправки информации о турнире
//         }
//     }
// });

//   if (ctx.message.text === '🔑 Регистрация в турнир') {
//     // Найдите все регистрации текущего пользователя
//     Registration.find({ telegramTag: ctx.from.username })
//     .then(async registrations => {
//         const registeredTournaments = registrations.map(registration => registration.tournamentId.toString());

//         // Найдите все турниры в базе данных, которые не закрыты
//         const tournaments = await Tournament.find({ closed: { $ne: true } }).sort({ name: 1 });

//         // Отправьте каждый турнир пользователю
//         for (const tournament of tournaments) {
//             const tournamentRegistrations = await Registration.find({ tournamentId: tournament._id });

//             // Сгруппируйте регистрации по бай-ину и подсчитайте количество регистраций для каждого бай-ина
//             const buyInCounts = {};
//             tournament.buyIns.forEach(buyIn => {
//                 buyInCounts[buyIn] = tournamentRegistrations.filter(registration => registration.buyIn === buyIn).length;
//             });

//             let buyInMessage = '';
//             for (const buyIn in buyInCounts) {
//                 buyInMessage += `\n${buyIn} - ${buyInCounts[buyIn]} players`;
//             }

//             if (!registeredTournaments.includes(tournament._id.toString())) {
//                 let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n`;
//                 if (tournament.sports) {
//                     message += `🏅 Виды спорта: ${tournament.sports}\n\n`;
//                 }
//                 message += `${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций:${buyInMessage}\n\n⏳ Окончание регистрации: ${tournament.startDate.toLocaleString()}`;
//                 if (tournament.image) {
//                     message += `\n ${tournament.image}`;
//                 }
//                 ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
//                     Markup.button.callback('✅ Присоединиться', `join_${tournament._id}`)
//                 ]));
//             } else {
//                 const registration = registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
//                 let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n`;
//                 if (tournament.sports) {
//                     message += `🏅 Виды спорта: ${tournament.sports}\n\n`;
//                 }
//                 message += `${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций:${buyInMessage}\n\n`;
//                 if (registration.status === 'approved') {
//                     message += '🎟️ Вы уже зарегистрированы на этот турнир.';
//                 } else if (registration.status === 'pending') {
//                     message += '⏳ Ваша заявка на участие ждет одобрения.';
//                 }
//                 if (tournament.image) {
//                     message += `\n ${tournament.image}`;
//                 }
//                 ctx.replyWithMarkdown(message);
//             }
//         }
//     })
//     .catch(error => console.error('Ошибка при поиске регистраций:', error));
// }



    //   else if (ctx.message.text === '🎮 Мои текущие турниры') {
    //     // Найдите все одобренные регистрации текущего пользователя
    //     Registration.find({ telegramTag: ctx.from.username, status: 'approved' })
    //     .then(async registrations => {
    //         const registeredTournaments = registrations.map(registration => registration.tournamentId);
    //         const currentTimestamp = new Date(); // текущее время
    //         const tournaments = await Tournament.find({ _id: { $in: registeredTournaments }, endDate: { $gt: currentTimestamp } }).sort({ name: 1 });
    
    //         if (tournaments.length === 0) {
    //         ctx.reply('📢 Вы не зарегистрированы ни в одном текущем турнире. Исправьте это, нажав на кнопку "Регистрация в турнир"🚀🚀');
    //         } else {
    //         let delay = 0;
    //         for (const tournament of tournaments) {
    //             const registration = await registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
    //             setTimeout(() => {
    //             ctx.replyWithMarkdown(`*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n💰 Бай-ин: ${registration.buyIn}`,
    //                 Markup.inlineKeyboard([
    //                 [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
    //                 [Markup.button.callback('Прогнозы участников', `results_${tournament._id}`)],
    //                 [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
    //                 ])
    //             );
    //             }, delay);
    //             delay += 200;
    //         }
    //         }
    //     })
    //     .catch(error => console.error('Ошибка при поиске регистраций:', error));
    // }

    else if (ctx.message.text === '🎮 Мои текущие турниры') {
      // Найдите все одобренные регистрации текущего пользователя
      Registration.find({ telegramTag: ctx.from.username, status: 'approved' })
      .then(async registrations => {
          const registeredTournaments = registrations.map(registration => registration.tournamentId);
          const currentTimestamp = new Date(); // текущее время
  
          // Найдите все турниры, которые не закрыты
          const tournaments = await Tournament.find({ _id: { $in: registeredTournaments }, closed: { $ne: true } }).sort({ name: 1 });
  
          if (tournaments.length === 0) {
              ctx.reply('📢 Вы не зарегистрированы ни в одном текущем турнире. Исправьте это, нажав на кнопку "Регистрация в турнир"🚀🚀');
          } else {
              let tournamentNames = tournaments.map(tournament => tournament.name);
              ctx.reply('Выберите турнир:', Markup.keyboard(tournamentNames).oneTime().resize());
              ctx.session.awaitingActiveTournamentSelection = true;
          }
      })
      .catch(error => console.error('Ошибка при поиске регистраций:', error));
  }

  else if (ctx.message.text && ctx.session.awaitingActiveTournamentSelection == true) {
    // Обработайте выбор турнира
    const selectedTournamentName = ctx.message.text;
    const tournament = await Tournament.findOne({ name: selectedTournamentName });

    if (!tournament) {
        ctx.reply(`Извините, я не могу найти турнир с названием "${selectedTournamentName}". Пожалуйста, убедитесь, что вы правильно ввели название турнира.`);
    } else {
        const registration = await Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username });

         // Получите количество регистраций
        const registrationCount = await Registration.count({ tournamentId: tournament._id });

        // Проверьте, активен ли турнир
        if (tournament.closed) {
            ctx.reply(`Турнир "${selectedTournamentName}" закрыт.`);
        } else if (!registration) {
            ctx.reply(`Вы не зарегистрированы в турнире "${selectedTournamentName}".`);
        } else {
          ctx.replyWithMarkdown(`*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n💰 Бай-ин: ${registration.buyIn}\n\n🚪 Количество регистраций: ${registrationCount}`,
                Markup.inlineKeyboard([
                [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
                [Markup.button.callback('Прогнозы участников', `results_${tournament._id}`)],
                [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
                ])
            );
        }
    }

    // Сбросьте флаг в сессии пользователя
    ctx.session.awaitingActiveTournamentSelection = false;
}


else if (ctx.message.text === '🎮 Мои прошедшие турниры') {
  // Найдите все одобренные регистрации текущего пользователя
  Registration.find({ telegramTag: ctx.from.username, status: 'approved' })
  .then(async registrations => {
      const registeredTournaments = registrations.map(registration => registration.tournamentId);

      // Найдите все турниры, которые закрыты
      const tournaments = await Tournament.find({ _id: { $in: registeredTournaments }, closed: true }).sort({ name: 1 });

      if (tournaments.length === 0) {
          ctx.reply('📢 У вас нет прошедших турниров. Вы можете зарегистрироваться в новом турнире, нажав на кнопку "Регистрация в турнир"🚀🚀');
      } else {
          let tournamentNames = tournaments.map(tournament => tournament.name);
          ctx.reply('Выберите турнир:', Markup.keyboard(tournamentNames).oneTime().resize());
          // Установите флаг в сессии пользователя
          ctx.session.awaitingPastTournamentSelection = true;
      }
  })
  .catch(error => console.error('Ошибка при поиске регистраций:', error));
}



else if (ctx.message.text && ctx.session.awaitingPastTournamentSelection == true) {
  // Обработайте выбор турнира
  const selectedTournamentName = ctx.message.text;
  const tournament = await Tournament.findOne({ name: selectedTournamentName });

  if (!tournament) {
      ctx.reply(`Извините, я не могу найти турнир с названием "${selectedTournamentName}". Пожалуйста, убедитесь, что вы правильно ввели название турнира.`);
  } else {
      const registration = await Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username });


      // Получите количество регистраций
      const registrationCount = await Registration.count({ tournamentId: tournament._id });

      // Проверьте, прошел ли турнир
      if (!tournament.closed) {
          ctx.reply(`Турнир "${selectedTournamentName}" не является прошедшим.`);
      } else if (!registration) {
          ctx.reply(`Вы не зарегистрированы в турнире "${selectedTournamentName}".`);
      } else {
        ctx.replyWithMarkdown(`*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n💰 Бай-ин: ${registration.buyIn}\n\n🚪 Количество регистраций: ${registrationCount}`,
              Markup.inlineKeyboard([
              // [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
              [Markup.button.callback('Прогнозы участников', `results_${tournament._id}`)],
              [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
              ])
          );
      }
  }

  // Сбросьте флаг в сессии пользователя
  ctx.session.awaitingPastTournamentSelection = false;
}

else if (ctx.message.text && ctx.session.prognozyUchastnikov == true) {

  Poll.findOne({ name: ctx.message.text })
  .then(poll => {
    if (poll) {
      
      // Находим турнир по его ID
      Tournament.findById(poll.tournamentId)
      .then(tournament => {
          // Теперь у нас есть имя турнира
          const tournamentName = tournament.name;

          Vote.find({ pollId: poll._id })
          .then(votes => {

            // Определение стилей CSS
            let styles = `
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; }
            td, th { border: 1px solid #ddd; padding: 8px; }
            `;

            let html = `<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>\n${styles}\n</style>\n</head>\n<body>\n<h1>${tournamentName}</h1>\n<h2>${poll.name}</h2>\n<table>\n<tr><th>Имя</th><th>Выбранный ответ</th></tr>\n`;

            votes.forEach(vote => {
                html += `<tr><td>${vote.userName}</td><td>${poll.options[vote.optionNumber].text}</td></tr>\n`;
            });

            html += '</table>\n</body>\n</html>';

            fs.writeFile('results.html', html, err => {
              if (err) {
                  console.error('Ошибка при записи файла:', err);
              } else {
                  // Отправляем сообщение в чат
                  bot.telegram.sendMessage(ctx.chat.id, "Откройте этот файл в браузере для просмотра результатов.");

                  // Отправляем файл в чат
                  bot.telegram.sendDocument(ctx.chat.id, {
                      source: fs.createReadStream(path.join(__dirname, 'results.html')),
                      filename: 'results.html'
                  });
              }
            });
          })
          .catch(error => console.error('Ошибка при поиске голосов:', error));
      })
      .catch(error => console.error('Ошибка при поиске турнира:', error));

    } else {
      console.log(`Опрос с названием "${pollName}" не найден.`);
    }
  })
  .catch(error => console.error('Ошибка при поиске опроса:', error));


      


  ctx.session.prognozyUchastnikov = false;
}


// else if (ctx.message.text && ctx.session.awaitingPastTournamentSelection == true) {

//         // Обработайте выбор турнира
//         const selectedTournamentName = ctx.message.text;
//         const tournament = await Tournament.findOne({ name: selectedTournamentName });

//         if (!tournament) {
//             ctx.reply(`Извините, я не могу найти турнир с названием "${selectedTournamentName}". Пожалуйста, убедитесь, что вы правильно ввели название турнира.`);
//         } else {
//             const registration = await Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username });

//             ctx.replyWithMarkdown(`*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n💰 Бай-ин: ${registration.buyIn}`,
//                 Markup.inlineKeyboard([
//                 // [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
//                 [Markup.button.callback('Прогнозы участников', `results_${tournament._id}`)],
//                 [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
//                 ])
//             );
//         }

//         // Сбросьте флаг в сессии пользователя
//         ctx.session.awaitingPastTournamentSelection = false;
// }
     



      else if (ctx.session.awaitingBuyIn) {
        const buyIn = ctx.message.text;
        if (buyIn === 'Freeroll') {
          // Найти пользователя по тегу Telegram
          User.findOne({ telegramTag: ctx.from.username })
            .then(user => {
              if (user) {
                // Создание новой регистрации
                let newRegistration = new Registration({
                  userId: user._id, // Используйте ID найденного пользователя
                  telegramTag: ctx.from.username,
                  tournamentId: ctx.session.awaitingBuyIn.tournamentId,
                  tournamentTitle: ctx.session.awaitingBuyIn.tournamentTitle,
                  buyIn: buyIn,
                  walletNumber: buyIn === 'Freeroll' ? '' : walletNumber,
                  status: 'approved'
                });
    
                // Сохранение новой регистрации в базе данных
                newRegistration.save()
                  .then(() => {
                    ctx.reply(`Вы присоединились к турниру с бай-ином ${buyIn}`);
                    delete ctx.session.awaitingBuyIn;
                  })
                  .catch(error => console.error('Ошибка при сохранении регистрации:', error));
              } else {
                ctx.reply('Пользователь с таким тегом не найден.');
              }
            })
            .catch(error => console.error('Ошибка при поиске пользователя:', error));
        } else {
          // Запрос номера кошелька
          ctx.reply(`'Реквизиты для оплаты:\n\n'
          '[USDT  (TRC-20)]  TYgJJXoQsFv9Yxq6WgAk9jGiwM8ZKCGaCa\n\n'
          '[Toncoin (TON)]  UQD-tZPC3ibPM2apQH3oB8B6rqobrfokQ_iVu6ck78mokjGD\n\n'
          'Для покупки криптовалюты и оплаты можете воспользоваться @wallet\n\n'
          'Укажите адрес Вашего кошелька, с которого будет произведена оплата'`)
          ctx.session.awaitingWalletNumber = { 
            buyIn,
            tournamentId: ctx.session.awaitingBuyIn.tournamentId,
            tournamentTitle: ctx.session.awaitingBuyIn.tournamentTitle // Сохраните tournamentTitle
          };
          delete ctx.session.awaitingBuyIn;
        }
      } else if (ctx.session.awaitingWalletNumber) {
        const walletNumber = ctx.message.text;
    
        // Найти пользователя по тегу Telegram
        User.findOne({ telegramTag: ctx.from.username })
          .then(user => {
            if (user) {
              // Создание новой регистрации
              let newRegistration = new Registration({
                userId: user._id, // Используйте ID найденного пользователя
                telegramTag: ctx.from.username,
                tournamentId: ctx.session.awaitingWalletNumber.tournamentId, // Используйте сохраненный tournamentId
                tournamentTitle: ctx.session.awaitingWalletNumber.tournamentTitle,
                buyIn: ctx.session.awaitingWalletNumber.buyIn,
                walletNumber: ctx.session.awaitingWalletNumber.buyIn === 'Freeroll' ? '' : walletNumber,
                status: 'pending'
              });
    
              // Сохранение новой регистрации в базе данных
              newRegistration.save()
                .then(() => {
                  ctx.reply(`Вы присоединились к турниру с бай-ином ${ctx.session.awaitingWalletNumber.buyIn}. Ваша регистрация ожидает одобрения.`);
                  delete ctx.session.awaitingBuyIn;
                  delete ctx.session.awaitingWalletNumber;
                })
                .catch(error => console.error('Ошибка при сохранении регистрации:', error));
            } else {
              ctx.reply('Пользователь с таким тегом не найден.');
            }
          })
          .catch(error => console.error('Ошибка при поиске пользователя:', error));
      } else if (ctx.session.awaitingTournamentPassword) {
        const password = ctx.message.text;
        // Найдите турнир по ID
        Tournament.findById(ctx.session.awaitingTournamentPassword.tournamentId)
          .then(tournament => {
            if (tournament) {
              // Сравните введенный пароль с паролем турнира
              if (password === tournament.password) {
                // Если пароли совпадают, продолжите процесс регистрации
                
                Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username })
                    .then(registration => {
                        if (registration) {
                        // Если регистрация уже существует, сообщить пользователю
                        ctx.reply('🎟️ Вы уже зарегистрированы на этот турнир.');
                        } else {
                        // Если регистрации нет, позволить пользователю зарегистрироваться
                        ctx.reply('Выберите бай-ин:', Markup.keyboard(tournament.buyIns).oneTime().resize());
                        ctx.session.awaitingBuyIn = {
                            tournamentId: tournament._id,
                            tournamentTitle: tournament.name // Сохраните название турнира
                        };
                        }
                    })
                    .catch(error => console.error('Ошибка при поиске регистрации:', error));
                    delete ctx.session.awaitingTournamentPassword;

              } else {
                // Если пароли не совпадают, попросите пользователя ввести пароль еще раз
                ctx.reply('Неверный пароль. Пожалуйста, попробуйте еще раз.');
              }
            } else {
              ctx.reply('Турнир не найден.');
            }
          })
          .catch(error => console.error('Ошибка при поиске турнира:', error));
      }


  }
  
  bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data.split('_')[0];
    const id = ctx.callbackQuery.data.split('_')[1];





    if (ctx.callbackQuery.data.startsWith('open_polls_')) {
        // Извлеките id турнира из данных callbackQuery
        const id = ctx.callbackQuery.data.split('_')[2];
      
        // Найдите все открытые опросы для этого турнира
        const now = new Date();
        Poll.find({ tournamentId: id, closingDate: { $gt: now } })
          .then(async polls => {
            const tournament = await Tournament.findById(id);
            if (tournament) {
              await ctx.reply(`🔽🔽🔽 Открытые опросы для турнира "${tournament.name}" 🔽🔽🔽`);
            }
            if (polls.length === 0) {
              ctx.reply('У этого турнира пока нет открытых опросов.');
            } else {
                for (const poll of polls) {
                let options = '';
                poll.options.forEach((option, index) => {
                  options += `Вариант ${index + 1}: ${option}\n`;
                });
                await ctx.replyWithMarkdown(
                  `*Name*: ${poll.name}\n` +
                  `*Descr*: ${poll.description}\n` +
                  `${options}` +
                  `*Votes*: ${poll.votesCount}\n` +
                  `*Close*: ${poll.closingDate}\n` +
                  `*Турнир*: ${tournament.name}`
                );
              };
            }
          })
          .catch(error => console.error('Ошибка при поиске открытых опросов:', error));
      }




      if (ctx.callbackQuery.data.startsWith('end_tournament_')) {
        // Извлеките id турнира из данных callbackQuery
        const id = ctx.callbackQuery.data.split('_')[2];
    
        // Найдите турнир в базе данных по id
        Tournament.findById(id)
        .then(tournament => {
            // Установите поле closed в true
            tournament.closed = true;
    
            // Сохраните изменения
            tournament.save()
            .then(() => {
                // Отправьте сообщение пользователю
                ctx.reply('Турнир успешно закрыт!');
            })
            .catch(error => console.error('Ошибка при сохранении турнира:', error));
        })
        .catch(error => console.error('Ошибка при поиске турнира:', error));
    }

      if (ctx.callbackQuery.data.startsWith('closed_polls_')) {
        // Извлеките id турнира из данных callbackQuery
        const id = ctx.callbackQuery.data.split('_')[2];
        
        // Найдите все закрытые опросы для этого турнира
        const now = new Date();
        Poll.find({ tournamentId: id, closingDate: { $lt: now } })
          .then(async polls => {
            const tournament = await Tournament.findById(id);
            if (tournament) {
              await ctx.reply(`🚨🚨🚨 Закрытые опросы для турнира "${tournament.name}" 🚨🚨🚨`);
            }
            if (polls.length === 0) {
              ctx.reply('У этого турнира пока нет закрытых опросов.');
            } else {
            for (const poll of polls) {
                let options = '';
                let optionButtons = [];
                poll.options.forEach((option, index) => {
                  options += `Вариант ${index + 1}: ${option.text}, Очки: ${option.points}\n\n`;
                  optionButtons.push(Markup.button.callback(`${option.text} (${option.points} очков)`, `adminResult_${poll._id}_${index}`));
                });
                await  ctx.replyWithMarkdown(
                  `Name: ${poll.name}\n` +
                  `Descr: ${poll.description}\n\n` +
                  `${options}` +
                  `Close: ${poll.closingDate}\n` +
                  `Турнир: ${tournament.name}` +
                  `\n\n\n\⚠️⚠️ ВНИМАТЕЛЬНО! ⚠️⚠️ Нажатие кнопки определяет верный ответ! ⚠️⚠️` +
                  (poll.result ? `\n\n❗❗❗ Верный ответ уже указан: ${poll.result}` : ''),
                  Markup.inlineKeyboard(optionButtons)
                );
                };
            }
          })
          .catch(error => console.error('Ошибка при поиске закрытых опросов:', error));
      }

      if (ctx.callbackQuery.data.startsWith('adminResult_')) {
        const parts = ctx.callbackQuery.data.split('_');
        const pollId = parts[1];
        const optionIndex = Number(parts[2]);
      
        // Найдите опрос по ID
        Poll.findById(pollId)
          .then(async poll => {
            if (poll) {
              // Получите выбранный вариант ответа
              const selectedOption = poll.options[optionIndex];
      
              // Обновите поле result опроса
              poll.result = selectedOption.text;
              await poll.save();
      
              console.log('Опрос обновлен');
      
              // Найдите турнир по ID
              const tournament = await Tournament.findById(poll.tournamentId);
      
              // Обновите сообщение
              let options = '';
              let optionButtons = [];
              poll.options.forEach((option, index) => {
                options += `Вариант ${index + 1}: ${option.text}, Очки: ${option.points}\n\n`;
                optionButtons.push(Markup.button.callback(`${option.text} (${option.points} очков)`, `adminResult_${poll._id}_${index}`));
              });
              ctx.editMessageText(
                `Name: ${poll.name}\n` +
                `Descr: ${poll.description}\n\n` +
                `${options}` +
                `Close: ${poll.closingDate}\n` +
                `Турнир: ${tournament.name}` +
                `\n\n\n\⚠️⚠️ ВНИМАТЕЛЬНО! ⚠️⚠️ Нажатие кнопки определяет верный ответ! ⚠️⚠️` +
                `\n\n❗❗❗ Верный ответ: ${poll.result}`,
                Markup.inlineKeyboard(optionButtons)
              );
      
              // Отправьте уведомление в Telegram
              ctx.answerCbQuery('Верный ответ для опроса указан');
            }
          })
          .catch(error => console.error('Ошибка при поиске опроса:', error));
      }

      if (action === 'approve') {
        // Найти регистрацию по ID
        Registration.findById(id)
          .then(registration => {
            if (!registration) {
              // Если регистрация не найдена, сообщить об этом
              ctx.reply(`Регистрация ${id} не найдена.`);
            } else {
              // Обновить статус регистрации на 'approved'
              Registration.updateOne({ _id: id }, { status: 'approved' })
                .then(() => ctx.reply(`Регистрация ${id} была одобрена.`))
                .catch(error => console.error('Ошибка при обновлении статуса регистрации:', error));
            }
          })
          .catch(error => console.error('Ошибка при поиске регистрации:', error));
    }
    
    if (action === 'reject') {
        // Найти регистрацию по ID
        Registration.findById(id)
          .then(registration => {
            if (!registration) {
              // Если регистрация не найдена, сообщить об этом
              ctx.reply(`Регистрация ${id} не найдена.`);
            } else {
              // Удалить регистрацию из базы данных
              Registration.deleteOne({ _id: id })
                .then(() => ctx.reply(`Регистрация ${id} была отклонена.`))
                .catch(error => console.error('Ошибка при удалении регистрации:', error));
            }
          })
          .catch(error => console.error('Ошибка при поиске регистрации:', error));
    }


    if (ctx.callbackQuery.data.startsWith('join_')) {
        const tournamentId = ctx.callbackQuery.data.slice(5);
        // Найти турнир по ID
        Tournament.findById(tournamentId)
          .then(tournament => {
            if (tournament) {
                // Проверьте, является ли турнир приватным
                ///
                if (tournament.type === "private") {
                    // Если турнир приватный, попросите пользователя ввести пароль
                    // продолжение регистрации в приват находится в опбработчике текста пароля от юзера
                    ctx.reply('Этот турнир является приватным. Пожалуйста, введите пароль для регистрации.');
                    ctx.session.awaitingTournamentPassword = {
                      tournamentId: tournamentId
                    };
                  } else {
                    // Если турнир публичный, продолжите процесс регистрации как обычно
                                  // Проверить, есть ли уже регистрация на этот турнир
                    Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username })
                    .then(registration => {
                        if (registration) {
                        // Если регистрация уже существует, сообщить пользователю
                        ctx.reply('🎟️ Вы уже зарегистрированы на этот турнир.');
                        } else {
                        // Если регистрации нет, позволить пользователю зарегистрироваться
                        ctx.reply('Выберите бай-ин:', Markup.keyboard(tournament.buyIns).oneTime().resize());
                        ctx.session.awaitingBuyIn = { 
                            tournamentId: tournament._id,
                            tournamentTitle: tournament.name // Сохраните название турнира
                        };
                        }
                    })
                    .catch(error => console.error('Ошибка при поиске регистрации:', error));
                  }
                  ///
            } else {
              ctx.reply('Турнир не найден.');
            }
          })
          .catch(error => console.error('Ошибка при поиске турнира:', error));
        ctx.answerCbQuery();
      }



      // USER ZONE 
      ///////////
      ///////////
      ///////////
      ///////////






      if (ctx.callbackQuery.data.startsWith('bets_')) {
        const tournamentId = ctx.callbackQuery.data.slice(5);
        // Найдите все опросы для этого турнира
        Poll.find({ tournamentId: tournamentId }).sort('_id')
          .then(async polls => {
            const tournament = await Tournament.findById(tournamentId);
            // Отправьте вводное сообщение с названием турнира
            await ctx.reply(`🚨🎲 Матчи для голосования в турнире "${tournament.name}".🎲🚨 Будьте внимательны и удачи! 💸💸💸`);
            
            let activePollsExist = false; // Добавьте флаг для отслеживания активных опросов
    
            // Отправьте каждый опрос пользователю
            for (const poll of polls) { 
              // Проверьте, не истекло ли время голосования
              if (new Date(poll.closingDate) > new Date()) { 
                activePollsExist = true; // Если опрос активен, установите флаг в true
                let options = '';
                poll.options.forEach((option, index) => {
                  options += `Вариант ${index + 1}: ${option.text} - ${option.points} points\n`;
                });
                const buttons = poll.options.map((option, index) => Markup.button.callback(`${option.text} - ${option.points} points`, `vote_${poll._id}_${index}`));
                
                // Найдите голос пользователя в этом опросе
                const vote = await Vote.findOne({ pollId: poll._id, userTag: ctx.from.username }); 
                
                let voteInfo = '';
                if (vote) {
                  // Если голос найден, добавьте информацию о голосе
                  voteInfo = `\n\n✅ Вы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[vote.optionNumber].text}`;
                }
                
                // Рассчитайте оставшееся время до закрытия опроса
                const timeLeft = new Date(poll.closingDate) - new Date();
                const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                await ctx.replyWithMarkdown( 
                  `📊 Турнир: ${tournament.name}\n\n` +
                  `🔥 Матч: ${poll.name}\n` +
                  `📋 Описание матча: ${poll.description}\n\n` +
                  `${options}` +
                  `\n\n⏰ Опрос закроется через: ${daysLeft} дней ${hoursLeft} часов ${minutesLeft} минут` +
                  voteInfo, // Переместите voteInfo сюда
                  Markup.inlineKeyboard(buttons, { columns: 1 })
                );
                // ... остальной код ...
              }
            }
    
            if (!activePollsExist) { // Если активных опросов нет, отправьте соответствующее сообщение
              ctx.reply('На данный момент у этого турнира нет актуальных матчей.');
            }
          })
          .catch(error => console.error('Ошибка при поиске опросов:', error));
      }

      
        // Проверяем, что callback_query начинается с 'vote_'
        if (ctx.callbackQuery.data.startsWith('vote_')) {
            // Извлекаем ID опроса и номер выбранного варианта из callback_query
            const [_, pollId, optionNumber] = ctx.callbackQuery.data.split('_');
          
            // Находим опрос по ID
            Poll.findById(pollId)
            .then(poll => {
              if (poll) {
                // Проверьте, не истекло ли время голосования
                if (new Date(poll.closingDate) > new Date()) {
                  // Находим пользователя по тегу Telegram
                  User.findOne({ telegramTag: ctx.from.username })
                    .then(user => {
                      if (user) {
                        // Находим регистрацию пользователя на турнир
                        Registration.findOne({ userId: user._id, tournamentId: poll.tournamentId })
                          .then(registration => {
                            if (registration) {
                              // Находим голос пользователя в этом опросе
                              Vote.findOne({ pollId: poll._id, userId: user._id })
                                .then(vote => {
                                  if (vote) {
                                    // Если голос найден, обновляем его
                                    vote.optionNumber = optionNumber;
                                    vote.optionText = poll.options[optionNumber].text;
                                    vote.optionPoints = poll.options[optionNumber].points; // записываем количество очков
                                    vote.save()
                                    .then(() => {
                                      ctx.answerCbQuery('Ваш голос был обновлен!');
          
                                      // Получаем текст существующего сообщения
                                      let oldText = ctx.callbackQuery.message.text;
                                      // Получаем существующие кнопки
                                      const oldMarkup = ctx.callbackQuery.message.reply_markup;
                                      // Удаляем старую информацию о голосе, если она есть
                                      const voteInfoIndex = oldText.indexOf('\n\n✅ Вы уже проголосовали в этом опросе.');
                                      if (voteInfoIndex !== -1) {
                                        oldText = oldText.substring(0, voteInfoIndex);
                                      }
                                      // Добавляем новую информацию о голосе
                                      const newText = `${oldText}\n\n✅ Вы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[optionNumber].text}`;
                                      // Проверяем, отличается ли новый текст от старого
                                      if (newText !== ctx.callbackQuery.message.text) {
                                        // Обновляем текст сообщения
                                        ctx.editMessageText(newText, { reply_markup: oldMarkup })
                                          .catch(error => console.error('Ошибка при обновлении текста сообщения:', error));
                                      }
          
                                    })
                                    .catch(error => console.error('Ошибка при обновлении голоса:', error));
                                  } else {
                                    // Если голос не найден, создаем новый
                                    let newVote = new Vote({
                                      tournamentId: poll.tournamentId,
                                      tournamentName: poll.name,
                                      pollId: poll._id,
                                      pollName: poll.name,
                                      userId: user._id,
                                      userTag: ctx.from.username,
                                      userName: ctx.from.first_name,
                                      buyIn: registration.buyIn,
                                      optionNumber: optionNumber,
                                      optionText: poll.options[optionNumber].text,
                                      optionPoints: poll.options[optionNumber].points // записываем количество очков
                                    });
          
                                    newVote.save()
                                    .then(() => {
                                      ctx.answerCbQuery('Ваш голос был учтен!');
          
                                      // Получаем текст существующего сообщения
                                      let oldText = ctx.callbackQuery.message.text;
                                      // Получаем существующие кнопки
                                      const oldMarkup = ctx.callbackQuery.message.reply_markup;
                                      // Добавляем информацию о голосе
                                      const newText = `${oldText}\n\n✅ Вы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[optionNumber].text}`;
                                      // Обновляем текст сообщения
                                      ctx.editMessageText(newText, { reply_markup: oldMarkup })
                                        .catch(error => console.error('Ошибка при обновлении текста сообщения:', error));
          
                                    })
                                    .catch(error => console.error('Ошибка при сохранении голоса:', error));
                                  }
                                })
                                .catch(error => console.error('Ошибка при поиске голоса:', error));
                            } else {
                              ctx.answerCbQuery('Вы не зарегистрированы на этот турнир.');
                            }
                          })
                          .catch(error => console.error('Ошибка при поиске регистрации:', error));
                      } else {
                        ctx.answerCbQuery('Пользователь с таким тегом не найден.');
                      }
                    })
                    .catch(error => console.error('Ошибка при поиске пользователя:', error));
                } else {
                  ctx.answerCbQuery('Извините, но время голосования в этом опросе уже истекло.');
                }
              } else {
                ctx.answerCbQuery('Опрос не найден.');
              }
            })
            .catch(error => console.error('Ошибка при поиске опроса:', error));
          }




          if (ctx.callbackQuery.data.startsWith('results_')) {
            // Извлекаем ID турнира из callback_query
            const [_, tournamentId] = ctx.callbackQuery.data.split('_');
          
            // Находим турнир по его ID
            Tournament.findById(tournamentId)
              .then(tournament => {
                // Находим все опросы этого турнира
                Poll.find({ tournamentId: tournamentId })
                  .then(polls => {
                    // Фильтруем опросы, оставляя только те, которые уже закрыты
                    const closedPolls = polls.filter(poll => new Date(poll.closingDate) < new Date());
        
                    if (closedPolls.length === 0) {
                        ctx.reply(`👀В турнире "${tournament.name}" пока нет закрытых опросов👀`);
                    } else {
                        // Создаем массив кнопок с названиями опросов
                        const buttons = closedPolls.map(poll => Markup.button.callback(poll.name, `poll_${poll._id}`));
        
                        // Отправляем список кнопок пользователю
                        ctx.reply(`Выберите опрос:`, Markup.keyboard(buttons).oneTime().resize());
                        ctx.session.prognozyUchastnikov = true;
                    }
                  })
                  .catch(error => console.error('Ошибка при поиске опросов:', error));
              })
              .catch(error => console.error('Ошибка при поиске турнира:', error));
        }

          // if (ctx.callbackQuery.data.startsWith('results_')) {
          //   // Извлекаем ID турнира из callback_query
          //   const [_, tournamentId] = ctx.callbackQuery.data.split('_');
          
          //   // Находим турнир по его ID
          //   Tournament.findById(tournamentId)
          //     .then(tournament => {
          //       // Находим все опросы этого турнира
          //       Poll.find({ tournamentId: tournamentId })
          //         .then(polls => {
          //           // Фильтруем опросы, оставляя только те, которые уже закрыты
          //           const closedPolls = polls.filter(poll => new Date(poll.closingDate) < new Date());
          

          //           if (closedPolls.length === 0) {
          //               ctx.reply(`👀В турнире "${tournament.name}" пока нет закрытых опросов👀`);
          //           } else {
          //               // Отправляем вступительное сообщение пользователю с названием турнира
          //               ctx.reply(`💰👀 Результаты закрытых матчей в турнире "${tournament.name}".💰👀`);
                                
          //               // Отправляем каждый закрытый опрос пользователю
          //               closedPolls.forEach(poll => {
          //                 Vote.find({ pollId: poll._id })
          //                 .then(votes => {
          //                     let voteResults = [];
          //                     poll.options.forEach((option, index) => {
          //                         const votesForOption = votes.filter(vote => vote.optionNumber === index);
          //                         voteResults.push({
          //                             optionText: option.text,
          //                             optionPoints: option.points,
          //                             votesCount: votesForOption.length
          //                         });
          //                     });
          //                     voteResults.sort((a, b) => b.votesCount - a.votesCount);
          //                     let message = `*🥇 ${poll.name}*\n📝 ${poll.description}\n\n🕒 Время закрытия: ${poll.closingDate}\n\n👥 Результаты голосования:\n`;
          //                     voteResults.forEach(result => {
          //                         message += `\n${result.optionText}: ${result.votesCount} голосов (${result.optionPoints} очков)`;
          //                     });
                      
          //                     // if (poll.result) {
          //                         // message += '\n\n✅ Верный вариант ответа указан.';
          //                         // Создаем кнопку "Получить результаты"
          //                         ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
          //                             Markup.button.callback('Получить результаты', `get_result_html_${poll._id}`)
          //                         ]));
          //                     // } else {
          //                     //     message += '\n\n🔜 Скоро результаты голосования станут доступны.';
          //                     //     ctx.replyWithMarkdown(message);
          //                     // }
          //                 })
          //                 .catch(error => console.error('Ошибка при поиске голосов:', error));
          //             });
          //           }

          //         })
          //         .catch(error => console.error('Ошибка при поиске опросов:', error));
          //     })
          //     .catch(error => console.error('Ошибка при поиске турнира:', error));
          // }





        //   if (ctx.callbackQuery.data.startsWith('get_result_html')) {
        //     const pollId = ctx.callbackQuery.data.split('_')[3];
        //     console.log(pollId)
        
        //     Poll.findById(pollId)
        //     .then(poll => {
        //         // Находим турнир по его ID
        //         Tournament.findById(poll.tournamentId)
        //         .then(tournament => {
        //             // Теперь у нас есть имя турнира
        //             const tournamentName = tournament.name;
        
        //             Vote.find({ pollId: poll._id })
        //             .then(votes => {

        //               // Определение стилей CSS
        //               let styles = `
        //               body { font-family: Arial, sans-serif; }
        //               table { border-collapse: collapse; }
        //               td, th { border: 1px solid #ddd; padding: 8px; }
        //               `;

        //               let html = `<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>\n${styles}\n</style>\n</head>\n<body>\n<h1>${tournamentName}</h1>\n<h2>${poll.name}</h2>\n<table>\n<tr><th>Имя</th><th>Выбранный ответ</th></tr>\n`;

        //               votes.forEach(vote => {
        //                   html += `<tr><td>${vote.userName}</td><td>${poll.options[vote.optionNumber].text}</td></tr>\n`;
        //               });

        //               html += '</table>\n</body>\n</html>';

        //               fs.writeFile('results.html', html, err => {
        //                 if (err) {
        //                     console.error('Ошибка при записи файла:', err);
        //                 } else {
        //                     // Отправляем сообщение в чат
        //                     bot.telegram.sendMessage(ctx.chat.id, "Откройте этот файл в браузере для просмотра результатов.");

        //                     // Отправляем файл в чат
        //                     bot.telegram.sendDocument(ctx.chat.id, {
        //                         source: fs.createReadStream(path.join(__dirname, 'results.html')),
        //                         filename: 'results.html'
        //                     });
        //                 }
        //               });
        //             })
        //             .catch(error => console.error('Ошибка при поиске голосов:', error));
        //         })
        //         .catch(error => console.error('Ошибка при поиске турнира:', error));
        //     })
        //     .catch(error => console.error('Ошибка при поиске опроса:', error));
        // }




        // Если данные начинаются с 'standings_', это запрос на турнирное положение
        if (ctx.callbackQuery.data.startsWith('standings_')) {
          const tournamentId = ctx.callbackQuery.data.split('_')[1];
          console.log(tournamentId)
      
          Tournament.findById(tournamentId)
          .then(tournament => {
              Vote.find({ tournamentId: tournament._id })
              .then(votes => {
                  Poll.find({ tournamentId: tournament._id, result: { $ne: '' }, closingDate: { $lt: new Date() } })
                  .then(polls => {
                      let styles = `
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; }
      td, th { border: 1px solid #ddd; padding: 8px; }
      .correct { background-color: lightgreen; }
      `;
      
                      let html = `<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>\n${styles}\n</style>\n</head>\n<body>\n<h1>${tournament.name}</h1>\n<table>\n<tr><th>Имя</th>`;
      
                      polls.forEach(poll => {
                          html += `<th colspan="2">${poll.name}</th>`;
                      });
      
                      html += '</tr>\n<tr><th></th>';
      
                      polls.forEach(() => {
                          html += `<th>Выбранный вариант</th><th>Очки</th>`;
                      });
      
                      html += '</tr>\n';
      
                      let userNames = [...new Set(votes.map(vote => vote.userName))];
      
                      userNames.forEach(userName => {
                          html += `<tr><td>${userName}</td>`;
      
                          polls.forEach(poll => {
                              let userVote = votes.find(vote => vote.userName === userName && vote.pollId.equals(poll._id));
                              if (userVote) {
                                  let points = poll.options[userVote.optionNumber].text === poll.result ? userVote.optionPoints : 0;
                                  let correct = poll.options[userVote.optionNumber].text === poll.result ? 'correct' : '';
                                  html += `<td class="${correct}">${poll.options[userVote.optionNumber].text}</td><td class="${correct}">${points}</td>`;
                              } else {
                                  html += '<td></td><td></td>';
                              }
                          });
      
                          html += '</tr>\n';
                      });
      
                      // Добавляем итоговую таблицу
                      html += `</table>\n<h2>Итог:</h2>\n<table>\n<tr><th>Место</th><th>Имя</th><th>Общие очки</th></tr>\n`;
      
                      // Считаем общее количество очков для каждого игрока
                      let totalPoints = userNames.map(userName => {
                          let points = 0;
                          polls.forEach(poll => {
                              let userVote = votes.find(vote => vote.userName === userName && vote.pollId.equals(poll._id));
                              if (userVote && poll.options[userVote.optionNumber].text === poll.result) {
                                  points += userVote.optionPoints;
                              }
                          });
                          return { userName, points };
                      });
      
                      // Сортируем игроков по общему количеству очков
                      totalPoints.sort((a, b) => b.points - a.points);
      
                      totalPoints.forEach((player, index) => {
                          html += `<tr><td>${index + 1}</td><td>${player.userName}</td><td>${player.points}</td></tr>\n`;
                      });
      
                      html += '</table>\n</body>\n</html>';
      
                      fs.writeFile('standings.html', html, err => {
                        if (err) {
                            console.error('Ошибка при записи файла:', err);
                        } else {
                            ctx.reply("Откройте этот файл в браузере для просмотра турнирного положения.");
                            ctx.replyWithDocument({
                                source: fs.createReadStream(path.join(__dirname, 'standings.html')),
                                filename: 'standings.html'
                            });
                        }
                    });
                  })
                  .catch(error => console.error('Ошибка при поиске опросов:', error));
              })
              .catch(error => console.error('Ошибка при поиске голосов:', error));
          })
          .catch(error => console.error('Ошибка при поиске турнира:', error));
      }

  });


  bot.command('/cancel', (ctx) => {
    fs.writeFileSync(path.join(__dirname, 'session_db.json'), JSON.stringify({}));
    ctx.reply('Процесс создания был отменен.');
    ctx.session.awaitingTournamentData = null;
    ctx.session.awaitingPollData = null;
    ctx.session = null;
    ctx.reply('Процесс создания был отменен.');
  });



connectDB().then(() => bot.launch());