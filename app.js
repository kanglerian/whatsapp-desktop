const express = require('express');
const socketIO = require('socket.io');
const rimraf = require('rimraf');
const http = require('http');
const fs = require('fs');
const { Client } = require('whatsapp-web.js');
const { phoneNumberFormatter } = require('./helpers/formatter');
const qrCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
// app.use(express.static('public'));

const client = new Client();

app.get('/', (req, res) => {
  res.sendFile('index.html',{root: __dirname});
  // res.send('Halo semuanya');
});

client.initialize();

io.on('connection', async (socket) => {
  socket.emit('message', 'Connecting...');

  client.on('qr', (qr) => {
    qrCode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code Received, scan please!');
    });
  });

  client.on('ready', () => {
    socket.emit('ready', 'Whatsapp is ready!');
    socket.emit('message', 'Whatsapp is ready!');
  });

  client.on('authenticated', () => {
    socket.emit('message', 'Whatsapp is authenticated!');
  });

  client.on('auth_failure', () => {
    socket.emit('authenticated', 'Whatsapp is authenticated!');
    socket.emit('message', 'Auth failure. Restarting...');
  });

  client.on('disconnected', () => {
    socket.emit('disconnected', 'Whatsapp is disconnected!');
    socket.emit('message', 'Whatsapp is disconnected, please wait...');
    client.destroy();
    rimraf.sync("./.wwebjs_auth");
    client.initialize();
  });

});

app.get('/coba', async (req, res) => {
  fs.readFile('coba.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    var obj = [];
    let total = data.split("\n").length;
    for (let i = 0; i < total; i++) {
      let item = data.split("\n")[i];
      let contact = item.split("-");
      let cont = [];
      for (let i = 0; i < contact.length; i++) {
        cont.push(contact[i])
      }
      obj.push(JSON.stringify(cont))
    }
    console.log(JSON.parse(obj));
  });
});

app.post('/send', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const count = req.body.count;
  const message = req.body.message;
  try {
    for (let i = 0; i < count; i++) {
      await client.sendMessage(number, message);
    }
    io.on('connection', async (socket) => {
      await socket.emit('sended', 'Pesan terkirim!');
      await socket.emit('message', 'Pesan Terkirim');
    });
  } catch (error) {
    io.on('connection', (socket) => {
      socket.emit('message', 'Pesan Tidak Terkirim');
    });
  }
});


app.post('/send-blast', async (req, res) => {
  var numbers = [];
  fs.readFile('coba.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    let total = data.split("\n").length;
    for (let i = 0; i < total; i++) {
      let item = data.split("\n")[i];
      let contact = item.split(",");
      let contactString = JSON.stringify(Object.assign({}, contact));
      let contactObject = JSON.parse(contactString);
      numbers.push(contactObject);
      // console.log(contactString);
    }
    // console.log(numbers);
    try {
      for (let i = 0; i < numbers.length; i++) {
        var phone = phoneNumberFormatter(numbers[i]['1']);
        var reqMessage = `${req.body.message}`;
        let subject = Object.assign(numbers[i]);
        let source = Object.values(subject);
        let object = {};
        for (let i = 0; i < source.length; i++) {
          object[`&var${i}`] = source[i];
        }
        let key = Object.keys(object).join('|');
        var message = reqMessage.replace(new RegExp(key,"g"), matched => object[matched]);
        client.sendMessage(phone, message);
      }
      io.on('connection', async (socket) => {
        await socket.emit('sended', 'Pesan terkirim!');
        await socket.emit('message', 'Pesan Terkirim');
      });
    } catch (error) {
      io.on('connection', (socket) => {
        socket.emit('message', 'Pesan Tidak Terkirim');
      });
    }
  });
});

server.listen(3001, () => {
  console.log(`apps run on: http://localhost:3001`);
});