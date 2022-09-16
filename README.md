## discord-channel-dumper

#### Setup
Install node.js, yarn and redis.
Fill out your discord bot credentials in `.env`:
```
DISCORD_CLIENT_ID=
DISCORD_TOKEN=
```
Then install dependencies:
```shell
$ yarn
```

#### Usage
Add the bot to your sever and run:
```shell
$ yarn dev
```
Monitoring UI is available at `http://localhost:3000/`.
To add a new channel to the queue make a GET request to `http://localhost:3000/addChannel?id=CHANNEL_ID`.