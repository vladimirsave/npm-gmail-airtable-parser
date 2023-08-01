import { mongoose } from 'mongoose';

const messageSchema = mongoose.Schema({
  messageId: String,
  userId: String,
  attachmentId: String,
  fileName: String,
  originalFileName: String,
  emailTitle: String,
  emailRecieveDate: String
});

export const Message = mongoose.model('Message', messageSchema);
