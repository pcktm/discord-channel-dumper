import {
  Attachment,
  BaseChannel,
  Collection, Message, MessageType, TextChannel,
} from 'discord.js';
import fs from 'fs-extra';
import path from 'path';

export async function* messagesInChannel(channel: TextChannel, chunkSize = 100) {
  let before = null;
  let done = false;
  while (!done) {
    // eslint-disable-next-line no-await-in-loop
    const messages = (await channel.messages.fetch({limit: chunkSize, before})) as Collection<string, Message<true>>;
    if (messages.size > 0) {
      before = messages.lastKey();
      yield messages;
    } else done = true;
  }
}

export function getFilenameFromAttachment(attachment: Attachment) {
  const filename = attachment.id;
  const extension = attachment.url.split('.').pop();
  return `${filename}.${extension}`;
}

export function getChannelDir(channel: TextChannel) {
  return path.join(process.cwd(), 'dump', 'channels', `${channel.name}-${channel.id}`);
}
