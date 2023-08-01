// const mongoose = require('mongoose');
import { mongoose } from 'mongoose';

const tokenSchema = new mongoose.Schema({
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresIn: { type: Number, required: true },
  createdOn: { type: Date, default: Date.now }, 
});

export const Token = mongoose.model('Token', tokenSchema);

// module.exports = Token;
