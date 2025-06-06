const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// QR Code endpoint
app.get('/qr', (req, res) => {
  try {
    const qrData = fs.readFileSync(path.join(__dirname, 'qr.txt'), 'utf8');
    res.send(`
      <html>
        <body style="text-align:center; padding:50px">
          <h2>WhatsApp Pairing Code</h2>
          <pre>${qrData}</pre>
          <p>Generated at: ${new Date().toLocaleTimeString()}</p>
        </body>
      </html>
    `);
  } catch {
    res.status(404).send('QR code not available. Please check console.');
  }
});

// Start server
app.listen(port, () => console.log(`QR available at: http://localhost:${port}/qr`));

// QR Handling
client.on('qr', qr => {
  qrcode.generate(qr, { small: true }, (qrcode) => {
    fs.writeFileSync('qr.txt', qrcode);
    console.log('New QR generated!');
  });
});

client.on('authenticated', () => {
  console.log('Authentication successful!');
  if (fs.existsSync('qr.txt')) fs.unlinkSync('qr.txt');
});

client.on('ready', () => console.log('Bot ready!'));

// Command Handling
client.on('message', async msg => {
  const text = msg.body.toLowerCase();

  if (text === '!menu') {
    const menu = `🎵 *BOT COMMANDS* 🎵\n\n`
      + `• !menu - Show commands\n`
      + `• !play [song] - Download music\n\n`
      + `⚠️ _Educational use only_`;
    await msg.reply(menu);
  }

  if (text.startsWith('!play')) {
    const songName = msg.body.slice(6).trim();
    if (!songName) return await msg.reply('Example: !play yellow coldplay');
    
    try {
      const search = await ytsr(songName, { limit: 1 });
      const video = search.items[0];
      await msg.reply(`⬇️ Downloading *${video.title}*...`);
      
      const audio = ytdl(video.url, { filter: 'audioonly' });
      const filename = `temp_${Date.now()}.mp3`;
      
      await new Promise((resolve) => {
        require('fluent-ffmpeg')(audio)
          .audioBitrate(128)
          .save(filename)
          .on('end', resolve);
      });
      
      const media = MessageMedia.fromFilePath(filename);
      await msg.reply(media, null, { caption: video.title });
      fs.unlinkSync(filename);
    } catch (error) {
      console.error(error);
      await msg.reply('❌ Download failed');
    }
  }
});

client.initialize();
