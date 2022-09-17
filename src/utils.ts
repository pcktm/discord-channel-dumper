import {
  Attachment,
  BaseChannel,
  Collection, Message, MessageType, TextChannel,
} from 'discord.js';
import fs from 'fs-extra';
import path from 'path';

export async function* messagesInChannel(channel: TextChannel, startFrom: string = null, limit = 1000, chunkSize = 100) {
  let before = startFrom;
  let done = false;
  let generatedCount = 0;
  while (!done) {
    // eslint-disable-next-line no-await-in-loop
    const messages = (await channel.messages.fetch({limit: chunkSize, before})) as Collection<string, Message<true>>;
    if (messages.size > 0 && generatedCount < limit) {
      before = messages.lastKey();
      generatedCount += messages.size;
      yield messages;
    } else {
      done = true;
    }
  }
}

export function getFilenameFromAttachment(attachment: Attachment) {
  const filename = attachment.id;
  const extension = attachment.url.split('.').pop();
  return `${filename}.${extension}`;
}

export function getChannelDir(channel: TextChannel) {
  return path.join(process.cwd(), 'dump', `${channel.name}-${channel.id}`);
}
