const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    type: String,
    required: true
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
  }
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;