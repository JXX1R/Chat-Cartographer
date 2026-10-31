# Chat Cartographer

A shared, branching expedition for Twitch. Viewers vote on the next route in chat; the map reveals the community's choice and remembers the journey.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open the local URL printed by Vite. The app works in demo mode without Twitch credentials: type `!vote 1`, `!vote 2`, or `!vote 3` to add a manual sample vote, then select **Reveal the route**. Demo mode does not generate automatic sample chat or votes. The streamer setup page lets you change the theme, expedition title, and voting timer. The app saves expedition progress in browser local storage.

To preconfigure the app owner's public Twitch Client ID for local development, copy `.env.example` to `.env.local` and set `VITE_TWITCH_CLIENT_ID`. Restart Vite after changing it. Do not put a Twitch Client Secret in a `VITE_` variable; Vite embeds these values in public browser code.

## Connect a Twitch channel

1. The app owner creates one application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps). Add the exact origin used by the app as an OAuth Redirect URL (locally, for example, `http://localhost:5173/`; when hosted, use its HTTPS URL).
2. Set `VITE_TWITCH_CLIENT_ID` to that app's public Client ID. Streamers enter only their channel login, then choose **Connect Twitch** and authorize the app.
3. Authorize the `user:read:chat` scope. Keep the app open in the browser where you authorized it.
4. Viewers vote in that channel's chat with `!vote 1`, `!vote 2`, or `!vote 3`.

This client-only prototype uses Twitch OAuth's implicit token flow and holds the short-lived access token in memory. It does not store the token in local storage. The channel broadcaster must have the required authorization to receive chat events. For a production deployment, use Authorization Code Grant with a backend, validate tokens, handle token expiry/revocation, and reconnect/resubscribe EventSub sessions.

## Host on Vercel

1. Push this project to a GitHub repository and import it into Vercel as a Vite project.
2. In Vercel project settings, add the environment variable `VITE_TWITCH_CLIENT_ID` with the Client ID from the app owner's Twitch Developer Console. Redeploy after setting it.
3. In the Twitch app settings, add the production site's exact HTTPS origin (for example, `https://your-project.vercel.app/`) as an OAuth Redirect URL. The app derives its callback from the URL in the browser, so the production URL must match exactly.
4. Share the production HTTPS site with streamers. They open **Streamer setup**, enter their channel login, connect Twitch, and authorize the app; they do not need a Twitch Developer account or Client ID.

The Vercel configuration builds the static Vite site into `dist/`. This prototype currently connects to Twitch from each user's browser. The separate OBS overlay page does not yet share live votes from the dashboard; use a window capture for a live demo until overlay state synchronization is added.

## Stream overlay

The overlay URL opens the map and vote panel without dashboard navigation. Its state is currently local to that page, so it will not mirror the connected dashboard's live Twitch votes yet. Use a window capture of the dashboard for a live demo in the meantime.

## Edit the world

Edit [`data/routes.json`](data/routes.json). It defines three themes, the round prompts and route choices, and each destination's discovery text and map coordinates. Route choices reference a location by its `destination` ID. Keep each theme's `start` and `locations` IDs consistent. The app currently includes three voting rounds per expedition.

## Stack

Vite serves a small browser app with no framework or backend. Twitch chat is received with EventSub WebSockets and `channel.chat.message`; the dashboard creates the subscription through the Twitch Helix API after OAuth. Demo mode uses the same vote handler as Twitch events.

