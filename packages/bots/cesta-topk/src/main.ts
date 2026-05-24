import { CestaTopKBot } from './bot.js';

const bot = new CestaTopKBot();

bot.start().catch((err) => {
  console.error(err);
  process.exit(1);
});

function shutdown() {
  bot.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
