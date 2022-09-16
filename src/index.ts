import dotenv from 'dotenv';
import consola from 'consola';
import {createBullBoard} from '@bull-board/api';
import {BullMQAdapter} from '@bull-board/api/bullMQAdapter';
import {ExpressAdapter} from '@bull-board/express';
import express from 'express';
import client from './client';
import {attachmentQueue} from './attachmentDownloader';
import {channelQueue} from './channelDownloader';

dotenv.config();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

const {
  addQueue, removeQueue, setQueues, replaceQueues,
} = createBullBoard({
  queues: [new BullMQAdapter(channelQueue), new BullMQAdapter(attachmentQueue)],
  serverAdapter,
});

const app = express();
app.use('/', serverAdapter.getRouter());

app.get('/addChannel', (req, res) => {
  const {id} = req.query;
  if (!id) {
    res.status(400).send('Missing query "id"');
    return;
  }
  const channelId = String(id);
  channelQueue.add(channelId, {channelId});
  res.send(`Added ${channelId} to queue`);
});

app.listen(3000, () => {
  consola.success('Running on :3000...');
  consola.info('For the UI, open http://localhost:3000/');
  consola.warn('Make sure Redis is running on port 6379 by default');
});

client.on('ready', async () => {
  consola.success(`Logged in as ${client?.user?.tag}!`);
  consola.info(`Dem guildz:${client?.guilds.cache.reduce((acc, guild) => `${acc} ${guild.name}<${guild.id}>`, '')}`);
});

client.login(process.env.DISCORD_TOKEN);
