# Mirlo Blue

A darker, bluer take on the [Mirlo](https://mirlo.space) app. Find music, play it, buy it, keep it. Support the artists.

<img src="docs/preview.png" alt="Mirlo Blue home screen" width="300"/>

## Why

Music belongs to the people who make it and the people who love it. Not to the platforms in the middle.

Mirlo is a cooperative home for independent music. Artists get paid. Fans own what they buy. No algorithm deciding who's worth hearing. This app is a front door to that.

- **Pay artists.** Buy the album. Subscribe to Mirlo. The money goes to people, not shareholders.
- **Own your music.** Downloads are real files on your phone. No rental. No "this album is no longer available."
- **No lock-in.** Bring your own files too. They sit next to your Mirlo albums like equals.
- **Share the wealth.** Previews of new releases keep playing when your music runs out. Free ads for artists, not for corporations.

## What's in it

- **Nightwing look.** Dark blue, cyan, yellow bird.
- **Subscribe.** One tap on Home to support Mirlo itself.
- **Your library.** Everything you own, like, or wishlisted, plus downloads.
- **Offline.** Download albums or single songs you own, as MP3 or FLAC. Open the app with no signal and your music is there. Home tells you you're offline and sends you to your library.
- **Free albums.** Add a free album, then download it like any other.
- **Bring your own music.** Add files from your phone. The app reads the tags (MP3, FLAC, M4A, Ogg, Opus) for title, artist, album, track number and cover. Untagged files use the file name.
- **Edit your downloads.** Rename albums and songs, reorder tracks, swap covers, delete. All behind an Edit button so nothing goes by accident.
- **A real queue.** Drag songs around. See what's next and where it's coming from.
- **Never stops.** When your music runs out, it keeps going with previews of new releases.
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

**Android:** [download the app](https://expo.dev/artifacts/eas/KlegDJYLVUQ4RzrFPpINH5damdiEk0SGxSK83O6XbJs.apk) on your phone and install it. Android will ask you to allow installs from your browser. Say yes.

Or open the [build page](https://expo.dev/accounts/drhodesw/projects/mirlo-blue/builds/0db15ef6-c5cb-4ad4-9c33-0717a3ac1b40) and scan the QR code.

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
