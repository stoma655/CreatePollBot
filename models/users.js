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