const { fork } = require('child_process');
const path = require('path');

const botEmails = [
  { email: 'bot_1@ludofusion.app', password: 'botpass123' },
  { email: 'bot_2@ludofusion.app', password: 'botpass123' },
];

botEmails.forEach((bot, i) => {
  setTimeout(() => {
    const child = fork(path.join(__dirname, 'index.js'), [], {
      env: {
        ...process.env,
        BOT_EMAIL: bot.email,
        BOT_PASSWORD: bot.password,
      },
      stdio: 'pipe',
    });
    child.stdout.on('data', (data) => {
      console.log(`[Bot ${i + 1}] ${data.toString().trim()}`);
    });
    child.stderr.on('data', (data) => {
      console.error(`[Bot ${i + 1}] ${data.toString().trim()}`);
    });
  }, i * 1000);
});
