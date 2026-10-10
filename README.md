# Mirlo Blue

A darker, bluer take on the [Mirlo](https://mirlo.space) app. Find music, play it, buy it, support the artists.

<img src="docs/preview.png" alt="Mirlo Blue home screen" width="300"/>

## What's in it

- **Nightwing look.** Dark blue, cyan, yellow bird.
- **Your library.** Everything you own, like, or wishlisted, plus downloads.
- **A real queue.** Drag songs around. See what's next and where it's coming from.
- **Never stops.** When your music runs out, it keeps going with previews of new releases. Free ads for artists.
- **Radio.** KEXP (Seattle) and Carbon Sound (Minneapolis) right on the home screen. Tap any song to listen live.

## Run it

You need [Node](https://nodejs.org) 20 or newer.

```bash
npm install
```

Make a file called `.env` with this in it:

```
EXPO_PUBLIC_API_ROOT=https://mirlo.space
EXPO_PUBLIC_API_KEY=
```

Then:

```bash
npm run web
```

Open http://localhost:8081. That's it.

## On your phone

Expo Go won't play music, so you need a real build. Use Expo's free cloud builder:

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

It hands you a link. Open it on your phone and install.

## Tests

```bash
npm test
```

## Thanks

Built on the official [Mirlo mobile app](https://github.com/funmusicplace/mirlo-mobile). Go buy some music on [mirlo.space](https://mirlo.space).
