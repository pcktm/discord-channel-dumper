import consola from 'consola';
import {
  ChannelType, Collection, Message, MessageType, TextChannel,
} from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import {Queue, Worker, Job} from 'bullmq';
import client from './client';
import {messagesInChannel, getChannelDir, getFilenameFromAttachment} from './utils';
import {attachmentQueue} from './attachmentDownloader';

const QUEUE_NAME = 'channels';
type JobType = {
  channelId: string;
};

export const channelQueue = new Queue<JobType>(QUEUE_NAME, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

export const channelWorker = new Worker(QUEUE_NAME, async (job: Job<JobType>) => {
  const channel = await client.channels.fetch(job.data.channelId);
  if (!channel) {
    consola.fatal(`Channel ${job.data.channelId} not found`);
    return;
  }
  if (channel.type !== ChannelType.GuildText) {
    consola.fatal(`Channel ${job.data.channelId} is not a text channel!`);
    return;
  }

  const dir = getChannelDir(channel);
  await fs.ensureDir(dir);
  const writeStream = fs.createWriteStream(path.join(dir, 'messages.ndjson'));
  let count = 0;

  for await (const messages of messagesInChannel(channel as TextChannel)) {
    const mapped = mapMessages(messages);
    for await (const message of mapped) {
      writeStream.write(JSON.stringify(message));
      writeStream.write('\n');
    }

    count += messages.size;
    job.updateProgress(count);
  }

  writeStream.end();
  consola.success(`Done writing ${channel.id}, dumped ${count} messages`);
}, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

export function mapMessages(messages: Collection<string, Message<true>>) {
  const filtered = messages.filter(
    (m) => (m.cleanContent.length > 0 || m.attachments.size > 0)
    && !m.author.bot
    && !m.system
    && [MessageType.Default, MessageType.Reply].includes(m.type),
  );
  attachmentQueue.addBulk(filtered.map((m) => m.attachments.map(
    (a) => ({
      name: m.id,
      data: {
        url: a.url,
        targetFilename: getFilenameFromAttachment(a),
        size: a.size,
        channelId: m.channel.id,
        channelName: m.channel.name,
      },
    }),
  )).flat());
  return filtered.map((m) => ({
    id: m.id,
    author: m.author.id,
    content: m.cleanContent,
    attachments: m.attachments.map((a) => getFilenameFromAttachment(a)),
    timestamp: m.createdTimestamp,
  }));
}
