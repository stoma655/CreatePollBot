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