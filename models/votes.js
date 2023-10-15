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
