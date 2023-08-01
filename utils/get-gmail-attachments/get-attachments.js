import { google } from 'googleapis';
import { User } from '../../models/User.model.js';
import { getOAuth2Client } from '../../config/google-auth.js';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'node:fs/promises';
import { Base64 } from 'js-base64';
import { Message } from '../../models/Message.model.js';
import mongoose from 'mongoose';
import path from 'path'; 
// import { ConvertPdfToJson } from './pdf-to-json-parser.js';
// import { ConvertPdfToXlsx } from './pdf-to-xlsx.js'
// import { printRawItems } from "./read-pdf/parse.js";
// import { ConvertXlsToJson } from "./xls-to-json/xls-to-json-F.js";
import  ProcessPdfToXls    from "../pdf-to-xls/parse-pdf-to-xls2.js";
// const { ProcessPdfToXls } = require("../pdf-to-xls/parse-pdf-to-xls2.js");
 
const gmail = google.gmail('v1');

export async function getAttachments(userId, searchQuery) {
  try {
    const FILE_FORMAT = 'application/pdf';
  
    const user = await User.findById(userId);
    google.options({ auth: getOAuth2Client(user.refresh_token) });
  
    const messagesList = await gmail.users.messages.list({
      userId: user.email,
      q: `in:inbox has:attachment pdf ${searchQuery}`
    });
  
    if (!messagesList?.data?.messages?.length) {
      return null;
    }
  
    const messagesData = await Promise.all(messagesList.data.messages.map(async (message) => {
      const messageBody = await gmail.users.messages.get({
        id: message.id,
        userId: user.email
      });
  
      const attachmentDetails = messageBody.data.payload.parts
        .filter((msgPart) => msgPart.mimeType === FILE_FORMAT && msgPart.body.attachmentId)
        .map((msgPart) => ({
          fileName: msgPart.filename,
          attachmentId: msgPart.body.attachmentId
        }))[0];
  
      if (!attachmentDetails) return;
  
      const attachment = await gmail.users.messages.attachments.get({
        id: attachmentDetails.attachmentId,
        messageId: message.id,
        userId: user.email
      });

      const savedMessage = await Message.findOne({
        messageId: message.id
      });

      if (!savedMessage) {
        const decodedData = Base64.toUint8Array(attachment.data.data);
        const storedFileName = uuidv4() + '.pdf';
        await writeFile(`attachments/${storedFileName}`, decodedData);
  
        const messageData = new Message({
          _id: mongoose.Types.ObjectId(),
          userId: user.email,
          messageId: message.id,
          attachmentId: attachmentDetails.attachmentId,
          fileName: storedFileName,
          originalFileName: attachmentDetails.fileName,
          jsonFileName: storedFileName.replace('.pdf', '.json'),
          emailTitle: messageBody.data.payload.headers.find(header => header.name === 'Subject')?.value || '',
          emailReceiveDate: new Date(messageBody.data.payload.headers.find(header => header.name === 'Date')?.value)
        });
  
        await messageData.save();


        const Pages = "";
        const Password = "";
        const SourceFile = `./attachments/${storedFileName}`;
        console.log('SourceFile', SourceFile);
       
        const fileNameWithoutExt = path.basename(storedFileName, path.extname(storedFileName));
        const xlsFilePath = `./attachments/${fileNameWithoutExt}.xls`;
        console.log('xlsFilePath', xlsFilePath);

        await ProcessPdfToXls(SourceFile, Password, Pages, xlsFilePath);
  
        await User.findByIdAndUpdate(userId, {
          '$push': {
            'messages': messageData._id
          }
        });
      }
  
      return {
        originalFileName: attachmentDetails.fileName
      };
    }));
    
    return messagesData.filter((messageData) => !!messageData);
  } catch (err) {
    throw Error(err);
  }
}