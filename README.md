# Chat Cartographer

A Twitch travel picker. Chat votes for the next country and the app charts the trip on a 3D globe.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open the local URL printed by Vite. Demo mode works without Twitch credentials: enter `!vote 1` through `!vote 10` to add a sample vote, then select **Reveal the route**. Demo mode does not generate automatic sample chat or votes. Streamer setup lets you change the title and voting timer. Trip progress is saved in browser local storage.

Set `VITE_TWITCH_CLIENT_ID` in `.env.local` to preconfigure the public Twitch Client ID. Do not put a Twitch Client Secret in a `VITE_` variable; Vite embeds these values in public browser code.

## Connect Twitch

1. Register the app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps), including the hosted app URL as an OAuth Redirect URL.
2. Set `VITE_TWITCH_CLIENT_ID` in Vercel and redeploy.
3. Open Streamer setup, enter the channel login, and connect Twitch.
4. Chat votes with `!vote 1` through `!vote 10`.

Each Twitch username can contribute one vote per round. The manual demo vote form is hidden while Twitch is connected. The prototype uses Twitch OAuth's implicit token flow in the browser; a production OAuth flow should use a backend with token validation and refresh handling.

## Countries and globe

The app offers ten destinations: Japan, Italy, Brazil, New Zealand, Morocco, Iceland, South Korea, Peru, Kenya, and Greece. Votes select the next country for the streamer to visit. The map displays visited destinations on a shaded 3D-style globe. The OBS overlay currently keeps its state local to that page; use a window capture of the dashboard for a live view.

## Hosting

Vercel builds this Vite app into `dist/`. The Twitch OAuth redirect URL must exactly match the deployed HTTPS origin.

