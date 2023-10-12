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
  endDate: {
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
  }
});

const Tournament = mongoose.model('Tournament', TournamentSchema);

module.exports = Tournament;