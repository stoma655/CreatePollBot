const mongoose = require('mongoose');

const ChatUserSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  }
});

const ChatUser = mongoose.model('ChatUser', ChatUserSchema);

module.exports = ChatUser;