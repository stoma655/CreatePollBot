const { Telegraf, Markup } = require('telegraf');
// const LocalSession = require('telegraf-session-local');

const fs = require('fs');
const path = require('path');
const connectDB = require('./db');
const Tournament = require('./models/tournaments');
const Poll = require('./models/poll');
const User = require('./models/users');
const Registration = require('./models/registrations');
const Vote = require('./models/votes');
// const ChatUser = require('./models/chatUser');


const bot = new Telegraf('6302702257:AAHG8kSyIOcWSBBD3aAeiMR_dcO1OcfGp-U');

// const session = new LocalSession({ database: 'session_db.json' });
// bot.use(session.middleware());

// bot.use((new LocalSession({ storage: LocalSession.storageMemory })).middleware());

// async function setState(ctx, key, value) {
//   let user = await User.findOne({ telegramTag: ctx.from.username })
//   .catch(err => {
//       console.error(err);
//   });
//   if (user) {
//     user.state[key] = value; // добавляем новый ключ и значение
//     user.markModified('state'); // указываем Mongoose, что объект был изменен
//     await user.save(); // сохраняем изменения в базе данных
//   }
// };

async function setState(ctx, key, value, subKey) {
  let user = await User.findOne({ telegramTag: ctx.from.username })
  .catch(err => {
      console.error(err);
  });
  if (user) {
    if (subKey) { // если subKey предоставлен
      if (!user.state[key]) { // если свойства еще нет, создаем его
        user.state[key] = {};
      }
      user.state[key][subKey] = value; // добавляем новый ключ и значение внутри объекта
    } else { // если subKey не предоставлен
      user.state[key] = value; // добавляем новый ключ и значение
    }
    user.markModified('state'); // указываем Mongoose, что объект был изменен
    await user.save(); // сохраняем изменения в базе данных
  }
};


async function getState(ctx) {
  let user = await User.findOne({ telegramTag: ctx.from.username })
  .catch(err => {
      console.error(err);
  });
  ctx.state = user.state;
  return ctx;
};


async function deleteStateProperty(ctx, key, subKey) {
  let user = await User.findOne({ telegramTag: ctx.from.username })
  .catch(err => {
      console.error(err);
  });
  if (user && user.state[key]) {
    if (subKey) { // если subKey предоставлен
      delete user.state[key][subKey]; // удаляем свойство внутри объекта
    } else { // если subKey не предоставлен
      delete user.state[key]; // удаляем свойство
    }
    user.markModified('state'); // указываем Mongoose, что объект был изменен
    await user.save(); // сохраняем изменения в базе данных
  }
};


// Пароль админа
const ADMIN_PASSWORD = 'ss';

bot.start(async (ctx) => {
    ctx = await getState(ctx);
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
              chatId: ctx.chat.id, // сохранение chatId
              state: {isAdmin: false}
            });
  
            // Сохранение нового пользователя в базе данных
            newUser.save()
              .then(() => {
                if (ctx.state.isAdmin) {
                  ctx.reply('Привет, админ!', Markup.keyboard([
                    ['Создать турнир', 'Показать турниры'],
                    ['Создать опрос']
                  ]).resize());
                } else {
                  ctx.reply(
                    'Добро пожаловать!',
                    Markup.keyboard([
                      ['🔑 Регистрация в турнир', '🎮 Мои турниры']
                    ]).resize()
                  );
                }
              })
              .catch(error => console.error('Ошибка при сохранении пользователя:', error));
          } else {
            // Если пользователь уже существует, просто отправьте приветственное сообщение
            ctx.reply(
              'Добро пожаловать обратно!',
              Markup.keyboard([
                ['🔑 Регистрация в турнир', '🎮 Мои турниры']
              ]).resize()
            );
          }
        })
        .catch(error => console.error('Ошибка при поиске пользователя:', error));
    }
  });

  bot.command('test', (ctx) => {
    setState(ctx, 'newkey', 'vall');
  }); 


  bot.command('admin', (ctx) => {
    ctx.reply('Пожалуйста, введите пароль:');
    // ctx.session.awaitingPassword = true;
    setState(ctx, 'awaitingPassword', true);
  });

bot.command('user', (ctx) => {
  // ctx.session.isAdmin = false;
  setState(ctx, 'isAdmin', false);
  ctx.reply('Теперь вы в режиме пользователя.');
});

// bot.command('/clear', (ctx) => {
//     // Очистите сессию пользователя
//     ctx.session = null;
//     ctx.reply('Сессия успешно очищена!');
//   });
  
  bot.on('text', async (ctx) => {
    ctx = await getState(ctx);
    // if (ctx.session.awaitingPassword) {
    if (ctx.state.awaitingPassword) {
      if (ctx.message.text === ADMIN_PASSWORD) {
        console.log('установили админа в тру')
        await setState(ctx, 'isAdmin', true);
        ctx.reply('Привет, админ!', Markup.keyboard([
          ['Создать турнир', 'Показать турниры'],
          ['Создать опрос', 'Запросы на участие'],
          ['Создать оповещение'] // Добавьте новую кнопку здесь
        ]).resize());
      } else {
        ctx.reply('Неверный пароль.');
      }
      setState(ctx, 'awaitingPassword', false);
      // ctx.session.awaitingPassword = false;
    // } else if (ctx.session.isAdmin) {
    } else if (ctx.state.isAdmin) {
      handleAdminText(ctx);
    } else {
      handleUserText(ctx);
    }
  });

  async function handleAdminText(ctx) {
    // if (ctx.session.awaitingPassword) {
    if (ctx.state.awaitingPassword) {
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
        setState(ctx, 'awaitingPassword', false);
        // ctx.session.awaitingPassword = false;
      } else if (ctx.message.text === 'Создать оповещение') {
        // Получите список всех турниров
        Tournament.find().then(tournaments => {
          // Создайте массив кнопок. Первая кнопка - "Для всех пользователей", остальные - для каждого турнира
          const buttons = ['Для всех пользователей'].concat(tournaments.map(tournament => tournament.name));
          ctx.reply('Выберите, кому хотите отправить оповещение:', Markup.keyboard(buttons).oneTime().resize());
          setState(ctx, 'awaitingNotificationRecipient', true)
          // ctx.session.awaitingNotificationRecipient = true;
        }).catch(err => {
          console.log(err);
        });
      // } else if (ctx.session.awaitingNotificationRecipient) {
      } else if (ctx.state.awaitingNotificationRecipient) {
        // ctx.session.notificationRecipient = ctx.message.text;
        setState(ctx, 'notificationRecipient', ctx.message.text);
        ctx.reply('Введите текст оповещения:');
        setState(ctx, 'awaitingNotificationText', true);
        setState(ctx, 'awaitingNotificationRecipient', false);
        // ctx.session.awaitingNotificationText = true;
        // ctx.session.awaitingNotificationRecipient = false;
      // } else if (ctx.session.awaitingNotificationText) {
      } else if (ctx.state.awaitingNotificationText) {
        const notificationText = ctx.message.text;
        // ctx.session.awaitingNotificationText = false;
        setState(ctx, 'awaitingNotificationText', false);
      
        // if (ctx.session.notificationRecipient === 'Для всех пользователей') {
        if (ctx.state.notificationRecipient === 'Для всех пользователей') {
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
          // const tournamentName = ctx.session.notificationRecipient;
          const tournamentName = ctx.state.notificationRecipient; // Удалите "Для игроков " из начала строки
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
      } else if (ctx.message.text === 'Создать турнир') {
        ctx.reply('Введите название турнира:');
        setState(ctx, 'awaitingTournamentData', { step: 'name' })
        // ctx.session.awaitingTournamentData = { step: 'name' };
      // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'name') {
      } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'name') {
          // ctx.session.awaitingTournamentData.name = ctx.message.text;
          setState(ctx, 'awaitingTournamentData', 'name', ctx.message.text);
          ctx.reply('Введите описание турнира:');
          setState(ctx, 'awaitingTournamentData', 'step', 'description');
          // ctx.session.awaitingTournamentData.step = 'description';
        // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'description') {
        } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'description') {
          // ctx.session.awaitingTournamentData.description = ctx.message.text;
          setState(ctx, 'awaitingTournamentData', 'description', ctx.message.text);

          ctx.reply('Пожалуйста, введите URL изображения турнира:');
            // ctx.session.awaitingTournamentData.step = 'imageUrl';
          setState(ctx, 'awaitingTournamentData', 'step', 'imageUrl');
        // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'imageUrl') {
        } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'imageUrl') {
            // ctx.session.awaitingTournamentData.imageUrl = ctx.message.text;
            setState(ctx, 'awaitingTournamentData', 'imageUrl', ctx.message.text);

            // Переходите к следующему шагу
            ctx.reply('Введите дату начала турнира в формате ГГГГ-ММ-ДД:');
            // ctx.session.awaitingTournamentData.step = 'startDate';
            setState(ctx, 'awaitingTournamentData', 'step', 'startDate');
          // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'startDate') {
          } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'startDate') {
            const startDate = new Date(ctx.message.text);
            if (isNaN(startDate)) {
              ctx.reply('Неверный формат даты. Пожалуйста, введите дату начала турнира в формате ГГГГ-ММ-ДД:');
            } else {
              setState(ctx, 'awaitingTournamentData', 'startDate', startDate);
              // ctx.session.awaitingTournamentData.startDate = startDate;
              ctx.reply('Введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
              setState(ctx, 'awaitingTournamentData', 'step', 'endDate');
              // ctx.session.awaitingTournamentData.step = 'endDate';
            }
        // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'endDate') {
        } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'endDate') {
            const endDate = new Date(ctx.message.text);
            if (isNaN(endDate)) {
              ctx.reply('Неверный формат даты. Пожалуйста, введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
            } else {
              setState(ctx, 'awaitingTournamentData', 'endDate', endDate)
              // ctx.session.awaitingTournamentData.endDate = endDate;
              ctx.reply('Введите бай-ины через запятую:');
              setState(ctx, 'awaitingTournamentData', 'step', 'buyIns');
              // ctx.session.awaitingTournamentData.step = 'buyIns';

            }

        // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'buyIns') {
        } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'buyIns') {
            setState(ctx, 'awaitingTournamentData', 'buyIns', ctx.message.text.split(','))
            // ctx.session.awaitingTournamentData.buyIns = ctx.message.text.split(',');
            ctx.reply('Турнир является публичным или приватным?', Markup.keyboard(['public', 'private']).oneTime().resize());
            // ctx.session.awaitingTournamentData.step = 'type';
            setState(ctx, 'awaitingTournamentData', 'step', 'type');
          // } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'type') {
          } else if (ctx.state.awaitingTournamentData && ctx.state.awaitingTournamentData.step === 'type') {
            // ctx.session.awaitingTournamentData.type = ctx.message.text;
            setState(ctx, 'awaitingTournamentData', 'type', ctx.message.text);
            if (ctx.message.text.toLowerCase() === 'private') {
              ctx.reply('Введите пароль для регистрации в турнире:');
              setState(ctx, 'awaitingTournamentData', 'step', 'password')
              // ctx.session.awaitingTournamentData.step = 'password';
            } else {
              // Создание турнира
              // Создание нового турнира
                let newTournament = new Tournament({
                    name: ctx.state.awaitingTournamentData.name,
                    description: ctx.state.awaitingTournamentData.description,
                    startDate: ctx.state.awaitingTournamentData.startDate,
                    endDate: ctx.state.awaitingTournamentData.endDate,
                    buyIns: ctx.state.awaitingTournamentData.buyIns, // добавлено новое поле
                    type: ctx.state.awaitingTournamentData.type, // добавлено новое поле
                    password: '', // добавлено новое поле
                    image: ctx.state.awaitingTournamentData.imageUrl
                });

                newTournament.save()
                    .then(() => {
                    ctx.reply('Турнир успешно создан!');


                    deleteStateProperty(ctx, 'awaitingTournamentData');

                    // delete ctx.session.awaitingTournamentData;
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
    }else if (ctx.message.text === 'Показать турниры') {
        // Найдите все турниры в базе данных
        Tournament.find()
        .then(tournaments => {
            // Ваш код для получения турниров...
            for (const tournament of tournaments) {
                // Ваш код для обработки каждого турнира...
            
                // Добавьте две новые кнопки
                ctx.replyWithMarkdown(`*🏆 ${tournament.name}*...`, // Ваш текст сообщения
                Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Открытые опросы', `open_polls_${tournament._id}`)],
                    [Markup.button.callback('❌ Закрытые опросы', `closed_polls_${tournament._id}`)],
                    // Ваши другие кнопки...
                ])
                );
            }
        })
        .catch(error => console.error('Ошибка при поиске турниров:', error));
      } else if (ctx.message.text === 'Запросы на участие') { // Обработка нажатия на новую кнопку
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

  function handleUserText(ctx) {


    if (ctx.message.text === '🔑 Регистрация в турнир') {
        // Найдите все регистрации текущего пользователя
        Registration.find({ telegramTag: ctx.from.username })
          .then(async registrations => {
            const registeredTournaments = registrations.map(registration => registration.tournamentId.toString());
      
            // Найдите все турниры в базе данных
            const tournaments = await Tournament.find().sort({ name: 1 });
      
            // Отправьте каждый турнир пользователю
            for (const tournament of tournaments) {
              const tournamentRegistrations = await Registration.find({ tournamentId: tournament._id });
              const count = tournamentRegistrations.length;
              if (!registeredTournaments.includes(tournament._id.toString())) {
                let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций: ${count}`;
                if (tournament.image) {
                  message += `\n ${tournament.image}`;
                }
                ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
                  Markup.button.callback('✅ Присоединиться', `join_${tournament._id}`)
                ]));
              } else {
                const registration = registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
                let message = `*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n🚪 Количество регистраций: ${count}\n\n`;
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
          })
          .catch(error => console.error('Ошибка при поиске регистраций:', error));
      }
      else if (ctx.message.text === '🎮 Мои турниры') {
        // Найдите все одобренные регистрации текущего пользователя
        Registration.find({ telegramTag: ctx.from.username, status: 'approved' })
        .then(async registrations => {
            const registeredTournaments = registrations.map(registration => registration.tournamentId);
            const tournaments = await Tournament.find({ _id: { $in: registeredTournaments } }).sort({ name: 1 });

            if (tournaments.length === 0) {
            ctx.reply('📢 Вы не зарегистрированы ни в одном турнире. Исправьте это, нажав на кнопку "Регистрация в турнир"🚀🚀');
            } else {
            let delay = 0;
            for (const tournament of tournaments) {
                const registration = await registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
                setTimeout(() => {
                ctx.replyWithMarkdown(`*🏆 ${tournament.name}*\n📋 ${tournament.description}\n\n${tournament.type === 'private' ? '🔒 Приватный' : '🔓 Публичный'}\n\n💰 Бай-ин: ${registration.buyIn}`,
                    Markup.inlineKeyboard([
                    [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
                    [Markup.button.callback('Результаты матчей', `results_${tournament._id}`)],
                    [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
                    ])
                );
                }, delay);
                delay += 200;
            }
            }
        })
        .catch(error => console.error('Ошибка при поиске регистраций:', error));
      } else if (ctx.session.awaitingBuyIn) {
        const buyIn = ctx.message.text;
        console.log('Получили байн')
        if (buyIn === 'Фри') {
          console.log('Байин фри');
          // Найти пользователя по тегу Telegram
          User.findOne({ telegramTag: ctx.from.username })
            .then(user => {
              if (user) {
                console.log('Нашли пользователя')
                // Создание новой регистрации
                let newRegistration = new Registration({
                  userId: user._id, // Используйте ID найденного пользователя
                  telegramTag: ctx.from.username,
                  tournamentId: ctx.session.awaitingBuyIn.tournamentId,
                  tournamentTitle: ctx.session.awaitingBuyIn.tournamentTitle,
                  buyIn: buyIn,
                  walletNumber: buyIn === 'Фри' ? '' : walletNumber,
                  status: 'approved'
                });
                console.log('создали регистрацию начинаем регистрировать')
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
          ctx.reply('Пожалуйста, введите номер вашего крипто кошелька:');
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
                walletNumber: ctx.session.awaitingWalletNumber.buyIn === 'Фри' ? '' : walletNumber,
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
  
  bot.on('callback_query', (ctx) => {
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
          .then(async tournament => {
            if (tournament) {
                // Проверьте, является ли турнир приватным
                ///
                if (tournament.type === "private") {
                    // Если турнир приватный, попросите пользователя ввести пароль
                    // продолжение регистрации в приват находится в опбработчике текста пароля от юзера
                    await ctx.reply('Этот турнир является приватным. Пожалуйста, введите пароль для регистрации.');
                    ctx.session.awaitingTournamentPassword = {
                      tournamentId: tournamentId
                    };
                  } else {
                    console.log('публичный');
                    // Если турнир публичный, продолжите процесс регистрации как обычно
                                  // Проверить, есть ли уже регистрация на этот турнир
                    Registration.findOne({ tournamentId: tournament._id, telegramTag: ctx.from.username })
                    .then(registration => {
                        if (registration) {
                        // Если регистрация уже существует, сообщить пользователю
                        ctx.reply('🎟️ Вы уже зарегистрированы на этот турнир.');
                        } else {
                          console.log('Попали на выбор байина')
                        // Если регистрации нет, позволить пользователю зарегистрироваться
                        ctx.session.awaitingBuyIn = { 
                            tournamentId: tournament._id,
                            tournamentTitle: tournament.name
                          };
                
                        setTimeout(() => {
                          ctx.reply('Выберите бай-ин:', Markup.keyboard(tournament.buyIns).oneTime().resize());
                        }, 300)
                        

                        console.log(tournament._id)
                        console.log(tournament.name)
                   
                          
                        
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
            if (polls.length === 0) {
              // Если опросов нет, сообщить об этом
              ctx.reply('У этого турнира пока нет матчей.');
            } else {
              let activePolls = false; 
              // Отправьте каждый опрос пользователю
              for (const poll of polls) { 
                // Проверьте, не истекло ли время голосования
                if (new Date(poll.closingDate) > new Date()) { 
                  activePolls = true;
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
                }
              }

              if (!activePolls) {
                // Если нет активных опросов, отправьте сообщение об этом
                ctx.reply('Нет актуальных матчей на данный момент.');
              }


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
                        // Отправляем вступительное сообщение пользователю с названием турнира
                        ctx.reply(`💰👀 Результаты закрытых матчей в турнире "${tournament.name}".💰👀`);
                                
                        // Отправляем каждый закрытый опрос пользователю
                        closedPolls.forEach(poll => {
                            // Находим все голоса для этого опроса
                            Vote.find({ pollId: poll._id })
                            .then(votes => {
                                // Создаем массив для хранения результатов голосования
                                let voteResults = [];

                                // Проходим по каждому варианту ответа в опросе
                                poll.options.forEach((option, index) => {
                                // Находим все голоса за этот вариант ответа
                                const votesForOption = votes.filter(vote => vote.optionNumber === index);

                                // Добавляем результаты голосования за этот вариант ответа в массив результатов
                                voteResults.push({
                                    optionText: option.text,
                                    optionPoints: option.points,
                                    votesCount: votesForOption.length
                                });
                                });

                                // Сортируем результаты голосования по количеству голосов
                                voteResults.sort((a, b) => b.votesCount - a.votesCount);

                                // Формируем сообщение с результатами голосования
                                let message = `*🥇 ${poll.name}*\n📝 ${poll.description}\n\n🕒 Время закрытия: ${poll.closingDate}\n\n👥 Результаты голосования:\n`;
                                voteResults.forEach(result => {
                                message += `\n${result.optionText}: ${result.votesCount} голосов (${result.optionPoints} очков)`;
                                });

                                // Формируем список всех пользователей, которые голосовали в опросе
                                let votersList = '\n\n🔗 Ссылка на список голосовавших игроков и их выбор: ⬇️⬇️⬇️\n';

                                // votes.forEach(vote => {
                                //     votersList += `\nИгрок: ${vote.userName} Выбрал: ${poll.options[vote.optionNumber].text}`;
                                // });

                                // Добавляем список голосовавших пользователей к сообщению
                                message += votersList;

                                // Отправляем сообщение пользователю
                                ctx.replyWithMarkdown(message);
                            })
                            .catch(error => console.error('Ошибка при поиске голосов:', error));
                        });
                    }

                  })
                  .catch(error => console.error('Ошибка при поиске опросов:', error));
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