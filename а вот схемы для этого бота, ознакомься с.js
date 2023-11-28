а вот схемы для этого бота, ознакомься с ними внимательно и опиши их 

вот схема юзера 

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Определение схемы Users
const UserSchema = new Schema({
  telegramName: {
    type: String,
    required: true
  },
  telegramTag: {
    type: String,
    required: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  walletNumber: {
    type: String
  },
  chatId: { // новое поле для хранения идентификатора чата
    type: Number,
    required: true
  }
});

// Создание модели
const User = mongoose.model('User', UserSchema);

module.exports = User;

вот схема голосов 

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VoteSchema = new Schema({
  tournamentId: {
    type: Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  tournamentName: {
    type: String,
    required: true
  },
  pollId: {
    type: Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  pollName: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userTag: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  buyIn: {
    type: String,
    required: true
  },
  optionNumber: {
    type: Number,
    required: true
  },
  optionText: {
    type: String,
    required: true
  },
  optionPoints: { 
    type: Number,
    required: true
  }
});

const Vote = mongoose.model('Vote', VoteSchema);

module.exports = Vote;


вот схема регистраций в турнирах 

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Определение схемы Registrations
const RegistrationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramTag: {
    type: String,
    required: true
  },
  tournamentId: {
    type: Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  tournamentTitle: {
    type: String,
    required: true
  },
  buyIn: {
    type: String,
    required: true
  },
  walletNumber: {
    type: String
  },
  status: {
    type: String,
    enum : ['approved', 'pending'],
    default: 'pending'
  }
});

// Создание модели
const Registration = mongoose.model('Registration', RegistrationSchema);

module.exports = Registration;



вот схема турниров

const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  buyIns: [{ // новое поле для бай-инов
    type: String
  }],
  type: { // новое поле для типа турнира (публичный или приватный)
    type: String
  },
  password: { // новое поле для пароля (если турнир приватный)
    type: String
  },
  image: {
    type: String
  },
  closed: {
    type: Boolean
  },
  sports: {
    type: String
  }
});

const Tournament = mongoose.model('Tournament', TournamentSchema);

module.exports = Tournament;


вот схема опросов в турнирах 

const PollSchema = new Schema({
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    options: [{
      text: {
        type: String,
        required: true
      },
      points: {
        type: Number,
        required: true
      }
    }],
    votesCount: {
      type: Number,
      default: 0
    },
    closingDate: {
      type: Date,
      required: true
    },
    tournamentId: {
      type: Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true
    },
    result: {
        type: String,
        default: ''
      }
  });
  
  const Poll = mongoose.model('Poll', PollSchema);
  
  module.exports = Poll;