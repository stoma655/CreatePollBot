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
  endDate: { // новое поле для времени закрытия турнира
    type: Date,
    required: true
  },
  registrationEndDate: { // новое поле для времени окончания регистрации
    type: Date,
    required: true
  },
  buyIns: [{ 
    type: String
  }],
  type: { 
    type: String
  },
  password: { 
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
