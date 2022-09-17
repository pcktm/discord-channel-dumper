import dotenv from 'dotenv';
import {
  ActivityType, ChannelType, Client, GatewayIntentBits,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    activities: [
      {
        name: 'your messages',
        type: ActivityType.Watching,
      },
    ],
  },
});

export default client;
