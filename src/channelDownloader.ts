import consola from 'consola';
import {
  ChannelType, Collection, Message, MessageType, TextChannel,
} from 'discord.js';
import path from 'path';
import fs from 'fs-extra';
import {
  Queue, Worker, Job, QueueScheduler,
} from 'bullmq';
import client from './client';
import {messagesInChannel, getChannelDir, getFilenameFromAttachment} from './utils';
import {attachmentQueue} from './attachmentDownloader';

const QUEUE_NAME = 'channels';
type JobType = {
  lastMessageId?: string;
  index: number;
  channelId: string;
};

export const channelQueue = new Queue<JobType>(QUEUE_NAME, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  defaultJobOptions: {
    attempts: 6,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});
const channelQueueScheduler = new QueueScheduler(QUEUE_NAME);

export const channelWorker = new Worker(QUEUE_NAME, async (job: Job<JobType>) => {
  const channel = await client.channels.fetch(job.data.channelId);
  if (!channel) {
    consola.fatal(`Channel ${job.data.channelId} not found`);
    throw new Error(`Channel ${job.data.channelId} not found`);
  }
  if (channel.type !== ChannelType.GuildText) {
    consola.fatal(`Channel ${job.data.channelId} is not a text channel!`);
    throw new Error(`Channel ${job.data.channelId} is not a text channel!`);
  }

  const dir = getChannelDir(channel);
  await fs.ensureDir(dir);
  const filename = path.join(dir, `messages-${job.data.index}.ndjson`);
  const writeStream = fs.createWriteStream(filename);
  let count = 0;
  let lastMessageId = null;
  const limit = 1000;

  for await (const messages of messagesInChannel(channel as TextChannel, job.data.lastMessageId ?? null, limit)) {
    const mapped = mapMessages(messages);
    for await (const message of mapped) {
      writeStream.write(JSON.stringify(message));
      writeStream.write('\n');
    }

    count += messages.size;
    lastMessageId = messages.lastKey();
    job.updateProgress(Math.round((count / limit) * 100));
  }
  writeStream.end();

  if (lastMessageId) {
    await channelQueue.add(`${channel.name}, part ${job.data.index + 1}`, {
      channelId: job.data.channelId,
      index: job.data.index + 1,
      lastMessageId,
    });
  }

  consola.info(`Done writing ${channel.id} part ${job.data.index}, dumped ${count} messages`);
  job.updateProgress(100);
  if (count === 0) {
    consola.success(`No new messages dumped, might be done with ${channel.name}<${channel.id}>`);
    await fs.remove(filename);
    return dir;
  }

  return filename;
}, {
  concurrency: 4,
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
    author: `${m.author.username}#${m.author.discriminator}`,
    content: m.cleanContent,
    attachments: m.attachments.map((a) => getFilenameFromAttachment(a)),
    timestamp: new Date(m.createdTimestamp).toISOString(),
  }));
}
