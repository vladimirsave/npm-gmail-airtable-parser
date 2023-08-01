import 'dotenv/config';
import crypto from 'crypto';
import { URL } from 'url';
import axios from 'axios';
import qs from 'qs';
import mongoose from 'mongoose';
import './mongoose.js';
import express from 'express';
import bodyParser from 'body-parser';
import { Token } from '../models/TokenAirtable.model.js'; // Путь к модели Token
import RefreshToken from './airtable-refresh-token.js'; //Обновление токена Airtable Refresh каждые 50 мин
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// set up environment variables
// if you have not created a .env file by following the README instructions this will not work
const config = {
    // Uses the PORT variable declared here, the path is defined in code
    port: 4000,
    redirectUri: 'http://localhost:4000/airtable-oauth',
    clientId: process.env.CLIENT_ID_AIRTABLE,
    // If you're not using a client secret, set to the empty string: ""
    clientSecret: process.env.CLIENT_SECRET_AIRTABLE,
    airtableUrl: 'https://www.airtable.com',
    // space delimited list of Airtable scopes, update to the list of scopes you want for your integration
    scope: 'data.records:read data.records:write schema.bases:write schema.bases:read data.recordComments:read data.recordComments:write',
    

};

const clientId = config.clientId.trim();
const clientSecret = config.clientSecret.trim();
// if you edit the port you will need to edit the redirectUri
const port = config.port;
// if you edit the path of this URL will you will need to edit the /airtable-oauth route to match your changes
const redirectUri = config.redirectUri.trim();
const scope = config.scope.trim();
const airtableUrl = config.airtableUrl.trim();

const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const authorizationHeader = `Basic ${encodedCredentials}`;

// book keeping to make using this easier, not needed in a real implementation
let latestTokenRequestState = 'NONE';

function getCodeChallenge(codeVerifier) {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const base64Url = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return base64Url;
}

function setLatestTokenRequestState(state, dataToFormatIfExists) {
    latestTokenRequestState = {
        state,
    };

    if (dataToFormatIfExists) {
        const json = JSON.stringify(dataToFormatIfExists, null, 2);
        // access and refresh tokens are difficult to copy paste in normal JSON formatting,
        // to make it easier we put them on a newline without the quotes
        const formattedData = json
            .split('\n')
            .map((line) =>
                line.replace(/^(\s+"(access_token|refresh_token)":)\s+"(.*)",$/g, '$1\n$3'),
            )
            .join('\n');
        latestTokenRequestState.formattedData = formattedData;
        console.log("HERE", state, latestTokenRequestState);
    }
}

function formatLatestTokenRequestStateForDeveloper() {
    let formatRequestState = '';

    switch (latestTokenRequestState.state) {
        case 'NONE':
            break;
        case 'LOADING':
            formatRequestState =
                'The request for the access token from your latest authorization is still outstanding, check the terminal or refresh';
            break;
        case 'AUTHORIZATION_ERROR':
            formatRequestState = 'Your latest authorization request failed, the error was:';
            break;
        case 'UNKNOWN_AUTHORIZATION_ERROR':
            formatRequestState =
                'The request for the access token from your latest authorization failed, check the terminal for details';
            break;
        case 'REFRESH_ERROR':
            formatRequestState = 'Your latest refresh request failed, the error was:';
            break;
        case 'UNKNOWN_REFRESH_ERROR':
            formatRequestState =
                'Your latest request to refresh your access token failed, see the terminal for details';
            break;
        case 'AUTHORIZATION_SUCCESS':
            formatRequestState = 'Your authorization succeeded, the response data is below:';
            break;
        case 'REFRESH_SUCCESS':
            formatRequestState = 'Your refresh succeeded, the response data is below:';
            break;
        default:
            formatRequestState = `Unexpected State, ${latestTokenRequestState.state}`;
    }

    if (latestTokenRequestState.formattedData) {
        return `
      <p>${formatRequestState}</p>
      <pre><code>${latestTokenRequestState.formattedData}</code></pre>
    `;
    }

    return `<p>${formatRequestState}</p>`;
}

app.get('/', (req, res) => {
    const latestRequestStateDisplayData = formatLatestTokenRequestStateForDeveloper();
    res.send(`
    <div>
      <h3> New Token</h3>
      <a href="redirect-testing">Click to authorize and create a new access token</a>
      <br/>
      <h3>Refresh a token</h3>
      ${latestRequestStateDisplayData}
      <p>
          To test refreshing a token, enter it into the input and press "submit"
          <br/>
          In your own code, refreshing should occur as a background process.
      </p>
      <form action="/refresh_token" method="post" >
          <label for="refresh">Refresh token:
          <input type="text" id="refresh" name="refresh_token" autocomplete="off" minLength="64"/>
          <input type="submit">
      </form>
    `);
});

const authorizationCache = {};
app.get('/redirect-testing', (req, res) => {
    // prevents others from impersonating Airtable
    const state = crypto.randomBytes(100).toString('base64url');

    // prevents others from impersonating you
    const codeVerifier = crypto.randomBytes(96).toString('base64url'); // 128 characters
    const codeChallenge = getCodeChallenge(codeVerifier);
    const codeChallengeMethod = 'S256';

    authorizationCache[state] = codeVerifier;

    const authorizationUrl = new URL(`${airtableUrl}/oauth2/v1/authorize`);
    authorizationUrl.searchParams.append('client_id', clientId);
    authorizationUrl.searchParams.append('redirect_uri', redirectUri);
    authorizationUrl.searchParams.append('scope', scope);
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('code_challenge', codeChallenge);
    authorizationUrl.searchParams.append('code_challenge_method', codeChallengeMethod);
    authorizationUrl.searchParams.append('response_type', 'code');

    res.redirect(authorizationUrl.href);
});



app.get('/airtable-oauth', async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        res.status(400).send('Недопустимый ответ авторизации');
        return;
    }

    if (!authorizationCache[state]) {
        res.status(400).send('Недопустимое состояние запроса');
        return;
    }

    const codeVerifier = authorizationCache[state];

    delete authorizationCache[state];

    setLatestTokenRequestState('LOADING');

    const tokenUrl = `${airtableUrl}/oauth2/v1/token`;

    try {
        const response = await axios.post(
            tokenUrl,
            qs.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                redirect_uri: redirectUri,
                code: code,
                code_verifier: codeVerifier,
            }),
            {
                headers: {
                    Authorization: authorizationHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const responseData = response.data;

        // Сохранить токен в базе данных
        console.log('Тут1');
        const currentDateTime = Date.now(); // Получите текущую дату и время
        const expiresInMilliseconds = responseData.refresh_expires_in * 1000;
        const expirationDateTime = currentDateTime + expiresInMilliseconds;

        const tokenToDb = new Token({
            accessToken: responseData.access_token,
            refreshToken: responseData.refresh_token,
            expiresIn: expirationDateTime,
        });

        try {
            await tokenToDb.save();
            console.log('Токен сохранен в базе данных');
            RefreshToken();
        } catch (error) {
            console.error('Ошибка при сохранении токена:', error);
        }

        setLatestTokenRequestState('AUTHORIZATION_SUCCESS', responseData);

        res.send(`
            <h2>Успешная авторизация</h2>
            <pre><code>${JSON.stringify(responseData, null, 2)}</code></pre>
        `);
    } catch (error) {
        if (error.response) {
            setLatestTokenRequestState('AUTHORIZATION_ERROR', error.response.data);

            res.status(400).send(`
                <h2>Не удалось авторизоваться</h2>
                <pre><code>${JSON.stringify(error.response.data, null, 2)}</code></pre>
            `);
        } else {
            setLatestTokenRequestState('UNKNOWN_AUTHORIZATION_ERROR');

            res.status(500).send(`
                <h2>Неизвестная ошибка авторизации</h2>
                <p>Во время процесса авторизации произошла неизвестная ошибка. Пожалуйста, повторите попытку.</p>
            `);
        }
    }
});


app.post('/refresh_token', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        res.status(400).send('Invalid request');
        return;
    }

    setLatestTokenRequestState('LOADING');

    const tokenUrl = `${airtableUrl}/oauth2/v1/token`;

    try {
        const response = await axios.post(
            tokenUrl,
            qs.stringify({
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: refresh_token,
            }),
            {
                headers: {
                    Authorization: authorizationHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const responseData = response.data;

        // Сохранить обновленный токен в базу данных
        const updatedToken = await Token.findOneAndUpdate(
            {},
            {
                accessToken: responseData.access_token,
                refreshToken: responseData.refresh_token,
                expiresIn: responseData.refresh_expires_in,
            },
            { new: true, upsert: true }
        );


        setLatestTokenRequestState('REFRESH_SUCCESS', responseData);

        res.send(`
      <h2>Refresh succeeded</h2>
      <pre><code>${JSON.stringify(responseData, null, 2)}</code></pre>
    `);
    } catch (error) {
        if (error.response) {
            setLatestTokenRequestState('REFRESH_ERROR', error.response.data);

            res.status(400).send(`
        <h2>Refresh failed</h2>
        <pre><code>${JSON.stringify(error.response.data, null, 2)}</code></pre>
      `);
        } else {
            setLatestTokenRequestState('UNKNOWN_REFRESH_ERROR');

            res.status(500).send(`
        <h2>Unknown refresh error</h2>
        <p>An unknown error occurred during the refresh process. Please try again.</p>
      `);
        }
    }
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});