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

**Android:** [download the app](https://expo.dev/artifacts/eas/wUvhzsHQkq9Gndb06S2a5mX2VKw86OpZ5Sj-CkNpfMM.apk) on your phone and install it. Android will ask you to allow installs from your browser. Say yes.

Or open the [build page](https://expo.dev/accounts/drhodesw/projects/mirlo-blue/builds/bfb6ec96-c5aa-4d33-afc2-2384d40f3b67) and scan the QR code.

Want to build it yourself? Expo Go won't play music, so use Expo's free cloud builder:

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

## Tests

```bash
npm test
```

## Thanks

Built on the official [Mirlo mobile app](https://github.com/funmusicplace/mirlo-mobile). Go buy some music on [mirlo.space](https://mirlo.space).
