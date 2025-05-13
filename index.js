const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cookieSession = require('cookie-session');

dotenv.config();

const app = express();
const port = 3000;


app.use(cookieSession({
  name: 'session',
  keys: ['chaveSuperSecreta'],
  maxAge: 24 * 60 * 60 * 1000
}));


const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);


app.get('/login', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/analytics.readonly'
    ]
  });
  res.send(`<a href="${url}"><button>Login com Google</button></a>`);
});


app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);


  req.session.tokens = tokens;

  res.redirect('/meus-dados');
});

app.get('/meus-dados', async (req, res) => {
  if (!req.session.tokens) {
    return res.redirect('/login');
  }

  oauth2Client.setCredentials(req.session.tokens);

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2'
  });

  const userinfo = await oauth2.userinfo.get();
  console.log('Usuário logado:', userinfo.data);


  const analyticsData = google.analyticsdata({
    version: 'v1',
    auth: oauth2Client
  });

  try {
    const result = await analyticsData.properties.runReport({
      property: `properties/SEU_PROPERTY_ID_FIXO_OU_OBTIDO`, 
      requestBody: {
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }]
      }
    });

    console.log('Dados GA4:', result.data);

    res.send(`
      <h2>Olá, ${userinfo.data.name}!</h2>
      <pre>${JSON.stringify(result.data, null, 2)}</pre>
    `);
  } catch (error) {
    console.error('Erro ao puxar dados do GA4:', error.message);
    res.status(500).send('Erro ao acessar o GA4. Verifique permissões da conta.');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
