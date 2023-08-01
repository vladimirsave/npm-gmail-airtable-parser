import express from 'express';
import 'dotenv/config';
import { getGoogleAuthURL, getGoogleUser } from './config/google-auth.js';
import { User } from './models/User.model.js';
// import { Token } from './models/TokenAirtable.model.js';
import mongoose from 'mongoose';
import './config/mongoose.js';
import './config/airtable-auth3.js';
import { getAttachments } from './utils/get-gmail-attachments/get-attachments.js';
// import { pdfToJson } from './utils/pdf-to-json-parser.js';
// import { ConvertXlsToJson } from "./utils/xls-to-json/xls-to-json-F.js";

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.get('/convert', async (req, res) =>  {
//   try {
//     const pdfFilePath = 'attachments/sample.pdf';
//     const json = await pdfToJson(pdfFilePath);
//  console.log('File converted to pdf');
//   } catch (error) {
//     // Обработка ошибок конвертации
//     res.status(500).json({ error: error.message });
//   }
// });

app.get('/', (req, res) => {
  res.render('pages/index');
});

app.get('/auth/google', (req, res) => {
  res.redirect(getGoogleAuthURL());
});

app.get('/auth/callback', async(req, res) => {
  try {
    const googleUser = await getGoogleUser(req.query);
  
    const { id, email, name } = googleUser.data;

    let user = await User.findOne({email});

    if (!user) {
      user = new User({
        _id: new mongoose.Types.ObjectId(),
        googleId: id,
        name,
        email,
        refresh_token: googleUser.refresh_token
      });
      
      await user.save();
    }
    res.redirect(`/messages/search/${user._id}`);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/messages/search/:userId', async(req, res) => {
  try {
    const attachments = await getAttachments(req.params.userId, '');
  
    if(!attachments) {
      return res.render('pages/search-messages', { data: {
          errorMsg: 'No Results found'
        }
      })
    }
  
    const attachmentNames = attachments.map((data) => data.originalFileName);
    return res.render('pages/search-messages', { data: {
      attachmentNames
    }});
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/messages/search/:userId', async(req, res) => {
  try {
    const searchQuery = req.body.searchQuery;
    const attachments = await getAttachments(req.params.userId, searchQuery);

    if(!attachments) {
      return res.render('pages/search-messages', { data: {
          errorMsg: 'No Results found',
          searchQuery
        }
      })
    }

    const attachmentNames = attachments.map((data) => data.originalFileName);

    return res.render('pages/search-messages', { data: {
      attachmentNames,
      searchQuery
    }});
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
})
// await ConvertXlsToJson('3.xls');
app.listen(3000, () => console.log('Server running on port 3000'));