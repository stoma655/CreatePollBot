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


const bot = new Telegraf('6302702257:AAHG8kSyIOcWSBBD3aAeiMR_dcO1OcfGp-U');

const session = new LocalSession({ database: 'session_db.json' });
bot.use(session.middleware());

// Пароль админа
const ADMIN_PASSWORD = 'ss';

bot.start((ctx) => {
    // Поиск пользователя в базе данных
    User.findOne({ telegramTag: ctx.from.username })
      .then(user => {
        if (!user) {
          // Создание нового пользователя, если он не найден
          let newUser = new User({
            telegramName: ctx.from.first_name + ' ' + ctx.from.last_name, // Используйте полное имя
            telegramTag: ctx.from.username,
            walletNumber: '' // Оставьте номер кошелька пустым
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
                  'Добро пожаловать!',
                  Markup.keyboard([
                    ['Регистрация в турнир', 'Мои турниры']
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
              ['Регистрация в турнир', 'Мои турниры']
            ]).resize()
          );
        }
      })
      .catch(error => console.error('Ошибка при поиске пользователя:', error));
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
          ['Создать опрос', 'Запросы на участие'] // Добавьте новую кнопку здесь
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
            ['Создать опрос', 'Запросы на участие'] // Добавьте новую кнопку здесь
          ]).resize());
        } else {
          ctx.reply('Неверный пароль.');
        }
        ctx.session.awaitingPassword = false;
      } else if (ctx.message.text === 'Создать турнир') {
        ctx.reply('Введите название турнира:');
        ctx.session.awaitingTournamentData = { step: 'name' };
      } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'name') {
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
              ctx.reply('Введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
              ctx.session.awaitingTournamentData.step = 'endDate';
            }
        } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'endDate') {
            const endDate = new Date(ctx.message.text);
            if (isNaN(endDate)) {
              ctx.reply('Неверный формат даты. Пожалуйста, введите дату окончания турнира в формате ГГГГ-ММ-ДД:');
            } else {
              ctx.session.awaitingTournamentData.endDate = endDate;
              ctx.reply('Введите бай-ины через запятую:');
              ctx.session.awaitingTournamentData.step = 'buyIns';

            }

        } else if (ctx.session.awaitingTournamentData && ctx.session.awaitingTournamentData.step === 'buyIns') {
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
                    endDate: ctx.session.awaitingTournamentData.endDate,
                    buyIns: ctx.session.awaitingTournamentData.buyIns, // добавлено новое поле
                    type: ctx.session.awaitingTournamentData.type, // добавлено новое поле
                    password: ctx.session.awaitingTournamentData.type.toLowerCase() === 'приватный' ? ctx.session.awaitingTournamentData.password : '', // добавлено новое поле
                    image: ctx.session.awaitingTournamentData.imageUrl
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
        ctx.reply('Введите варианты ответа через запятую:');
        ctx.session.awaitingPollData.step = 'options';
      } else if (ctx.session.awaitingPollData.step === 'options') {
        ctx.session.awaitingPollData.options = ctx.message.text.split(',');
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
              tournamentId: tournament._id
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
            // Отправьте каждый турнир администратору
            tournaments.forEach(tournament => {
            ctx.replyWithMarkdown(`*${tournament.name}*\n${tournament.description}`,
                Markup.inlineKeyboard([
                Markup.button.callback('Опросы турнира', `polls_${tournament._id}`)
                ])
            );
            });
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
    // if (ctx.message.text === 'Регистрация в турнир') {
    //     // Найдите все регистрации текущего пользователя
    //     Registration.find({ telegramTag: ctx.from.username })
    //       .then(registrations => {
    //         const registeredTournaments = registrations.map(registration => registration.tournamentId.toString());
      
    //         // Найдите все турниры в базе данных
    //         Tournament.find()
    //           .then(tournaments => {
    //             // Отправьте каждый турнир пользователю
    //             tournaments.forEach(async tournament => {
    //               const tournamentRegistrations = await Registration.find({ tournamentId: tournament._id });
    //               const count = tournamentRegistrations.length;
    //               if (!registeredTournaments.includes(tournament._id.toString())) {
    //                 if (tournament.image) {
    //                   ctx.replyWithPhoto(
    //                     { url: tournament.image },
    //                     { caption: `*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}`, parse_mode: 'Markdown' },
    //                     Markup.inlineKeyboard([
    //                       Markup.button.callback('Присоединиться', `join_${tournament._id}`)
    //                     ])
    //                   );
    //                 } else {
    //                   ctx.replyWithMarkdown(`*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}`, Markup.inlineKeyboard([
    //                     Markup.button.callback('Присоединиться', `join_${tournament._id}`)
    //                   ]));
    //                 }
    //               } else {
    //                 if (tournament.image) {
    //                   ctx.replyWithPhoto(
    //                     { url: tournament.image },
    //                     { caption: `*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}\n\nВы уже зарегистрированы на этот турнир.`, parse_mode: 'Markdown' }
    //                   );
    //                 } else {
    //                   ctx.replyWithMarkdown(`*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}\n\nВы уже зарегистрированы на этот турнир.`);
    //                 }
    //               }
    //             });
    //           })
    //           .catch(error => console.error('Ошибка при поиске турниров:', error));
    //       })
    //       .catch(error => console.error('Ошибка при поиске регистраций:', error));
    //   }

    if (ctx.message.text === 'Регистрация в турнир') {
        // Найдите все регистрации текущего пользователя
        Registration.find({ telegramTag: ctx.from.username })
          .then(registrations => {
            const registeredTournaments = registrations.map(registration => registration.tournamentId.toString());
      
            // Найдите все турниры в базе данных
            Tournament.find()
              .then(tournaments => {
                // Отправьте каждый турнир пользователю
                tournaments.forEach(async tournament => {
                  const tournamentRegistrations = await Registration.find({ tournamentId: tournament._id });
                  const count = tournamentRegistrations.length;
                  if (!registeredTournaments.includes(tournament._id.toString())) {
                    let message = `*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}`;
                    if (tournament.image) {
                      message += `\n ${tournament.image}`;
                    }
                    ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
                      Markup.button.callback('Присоединиться', `join_${tournament._id}`)
                    ]));
                  } else {
                    let message = `*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\n⏺ Количество регистраций: ${count}\n\nВы уже зарегистрированы на этот турнир.`;
                    if (tournament.image) {
                      message += `\n ${tournament.image}`;
                    }
                    ctx.replyWithMarkdown(message);
                  }
                });
              })
              .catch(error => console.error('Ошибка при поиске турниров:', error));
          })
          .catch(error => console.error('Ошибка при поиске регистраций:', error));
      }
       else if (ctx.message.text === 'Мои турниры') {
        // Найдите все регистрации текущего пользователя
        Registration.find({ telegramTag: ctx.from.username })
        .then(registrations => {
            // Получите список ID турниров, на которые зарегистрирован пользователь
            const registeredTournaments = registrations.map(registration => registration.tournamentId);

            // Найдите все турниры, на которые зарегистрирован пользователь
            Tournament.find({ _id: { $in: registeredTournaments } })
            .then(tournaments => {
                // Отправьте каждый турнир пользователю
                tournaments.forEach(tournament => {
                    const registration = registrations.find(reg => reg.tournamentId.toString() === tournament._id.toString());
                    ctx.replyWithMarkdown(`*${tournament.name}*\n${tournament.description}\nТип: ${tournament.type === 'private' ? 'Приватный' : 'Публичный'}\nБай-ин: ${registration.buyIn}`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('Матчи для ставок', `bets_${tournament._id}`)],
                        [Markup.button.callback('Результаты матчей', `results_${tournament._id}`)],
                        [Markup.button.callback('Турнирное положение', `standings_${tournament._id}`)]
                    ])
                    );
                });
            })
            .catch(error => console.error('Ошибка при поиске турниров:', error));
        })
        .catch(error => console.error('Ошибка при поиске регистраций:', error));
      } else if (ctx.session.awaitingBuyIn) {
        const buyIn = ctx.message.text;
        if (buyIn === 'Фри') {
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
                  walletNumber: buyIn === 'Фри' ? '' : walletNumber,
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
                        ctx.reply('Вы уже зарегистрированы на этот турнир.');
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

    if (action === 'polls') {
        // Найдите все опросы для этого турнира
        Poll.find({ tournamentId: id })
          .then(async polls => {
            // Найдите турнир по ID
            const tournament = await Tournament.findById(id);
            if (tournament) {
              // Отправьте вводное сообщение с названием турнира
              await ctx.reply(`🔽🔽🔽 Опросы для турнира "${tournament.name}" 🔽🔽🔽`);
            }
            if (polls.length === 0) {
              // Если опросов нет, сообщить об этом
              ctx.reply('У этого турнира пока нет опросов.');
            } else {
              // Отправьте каждый опрос пользователю
              polls.forEach(poll => {
                let options = '';
                poll.options.forEach((option, index) => {
                  options += `Вариант ${index + 1}: ${option}\n`;
                });
                ctx.replyWithMarkdown(
                  `*Name*: ${poll.name}\n` +
                  `*Descr*: ${poll.description}\n` +
                  `${options}` +
                  `*Votes*: ${poll.votesCount}\n` +
                  `*Close*: ${poll.closingDate}\n` +
                  `*Турнир*: ${tournament.name}`
                );
              });
            }
          })
          .catch(error => console.error('Ошибка при поиске опросов:', error));
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
                        ctx.reply('Вы уже зарегистрированы на этот турнир.');
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
            await ctx.reply(`🔽 Матчи для голосования в турнире "${tournament.name}". Будьте внимательны и удачи! 🔽`);
            if (polls.length === 0) {
              // Если опросов нет, сообщить об этом
              ctx.reply('У этого турнира пока нет матчей.');
            } else {
              // Отправьте каждый опрос пользователю
              for (const poll of polls) { 
                // Проверьте, не истекло ли время голосования
                if (new Date(poll.closingDate) > new Date()) { 
                  let options = '';
                  poll.options.forEach((option, index) => {
                    options += `Вариант ${index + 1}: ${option}\n`;
                  });
                  const buttons = poll.options.map((option, index) => Markup.button.callback(option, `vote_${poll._id}_${index}`));
                  
                  // Найдите голос пользователя в этом опросе
                  const vote = await Vote.findOne({ pollId: poll._id, userTag: ctx.from.username }); 
                  
                  let voteInfo = '';
                  if (vote) {
                    // Если голос найден, добавьте информацию о голосе
                    voteInfo = `\n\nВы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[vote.optionNumber]}`;
                  }
                  
                  // Рассчитайте оставшееся время до закрытия опроса
                  const timeLeft = new Date(poll.closingDate) - new Date();
                  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                  
                  await ctx.replyWithMarkdown( 
                    `Турнир: ${tournament.name}\n` +
                    `Матч: ${poll.name}\n` +
                    `Описание матча: ${poll.description}\n` +
                    `${options}` +
                    `\nВремя закрытия голосования: ${poll.closingDate}` +
                    `\nОпрос закроется через: ${daysLeft} дней ${hoursLeft} часов ${minutesLeft} минут` +
                    voteInfo, // Переместите voteInfo сюда
                    Markup.inlineKeyboard(buttons, { columns: 1 })
                  );
                }
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
                                        vote.optionText = poll.options[optionNumber];
                                        vote.save()
                                        .then(() => {
                                            ctx.answerCbQuery('Ваш голос был обновлен!');
        
                                            // Получаем текст существующего сообщения
                                            let oldText = ctx.callbackQuery.message.text;
                                            // Получаем существующие кнопки
                                            const oldMarkup = ctx.callbackQuery.message.reply_markup;
                                            // Удаляем старую информацию о голосе, если она есть
                                            const voteInfoIndex = oldText.indexOf('\n\nВы уже проголосовали в этом опросе.');
                                            if (voteInfoIndex !== -1) {
                                            oldText = oldText.substring(0, voteInfoIndex);
                                            }
                                            // Добавляем новую информацию о голосе
                                            const newText = `${oldText}\n\nВы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[optionNumber]}`;
                                            // Обновляем текст сообщения
                                            ctx.editMessageText(newText, { reply_markup: oldMarkup })
                                            .catch(error => console.error('Ошибка при обновлении текста сообщения:', error));
        
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
                                        optionText: poll.options[optionNumber]
                                        });
        
                                        newVote.save()
                                        .then(() => {
                                            ctx.answerCbQuery('Ваш голос был учтен!');
        
                                            // Получаем текст существующего сообщения
                                            let oldText = ctx.callbackQuery.message.text;
                                            // Получаем существующие кнопки
                                            const oldMarkup = ctx.callbackQuery.message.reply_markup;
                                            // Добавляем информацию о голосе
                                            const newText = `${oldText}\n\nВы уже проголосовали в этом опросе. Ваш выбор: ${poll.options[optionNumber]}`;
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