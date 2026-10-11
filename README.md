# Mirlo Blue

A darker, bluer take on [Mirlo](https://mirlo.space). Find music, play it, buy it, keep it. Support the artists.

<img src="docs/preview.png" alt="Mirlo Blue home screen" width="300"/>

## Why Mirlo Blue?

Music belongs to the creators and the listeners, not the platforms. Mirlo is a worker-owned, open-source solidarity economy. 

- **Direct Support:** Payments go to artists and workers, not shareholders.
- **True Ownership:** Downloads are permanent files. No rentals.
- **No Lock-in:** Mix your own local files with Mirlo albums.
- **Artist Discovery:** Integrated previews promote new music, not corporate ads.

## Features

- **Nightwing Theme:** High-contrast dark blue and cyan aesthetic.
- **Offline Mode:** Full library access without a connection (MP3/FLAC).
- **Local Integration:** Supports MP3, FLAC, M4A, Ogg, and Opus with tag reading.
- **Library Control:** Full editing for track order, covers, and metadata.
- **Smart Queue:** Drag-and-drop ordering with source tracking.
- **Live Radio:** Direct access to KEXP and Carbon Sound.
- **Privacy First:** No ads, no tracking.

## Quick Start

**Requirements:** Node 20+

```bash
npm install
```

Create a `.env` file:
```
EXPO_PUBLIC_API_ROOT=https://mirlo.space
EXPO_PUBLIC_API_KEY=
```

```bash
npm run web
```
Open http://localhost:8081.

## Installation

**Android:** [Download APK](https://expo.dev/artifacts/eas/KlegDJYLVUQ4RzrFPpINH5damdiEk0SGxSK83O6XbJs.apk) or scan the QR code on the [build page](https://expo.dev/accounts/drhodesw/projects/mirlo-blue/builds/0db15ef6-c5cb-4ad4-9c33-0717a3ac1b40).

Build from source:
```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

## Tests

```bash
npm test
```

## Credits & License

Built on the official [Mirlo mobile app](https://github.com/funmusicplace/mirlo-mobile). Go buy music on [mirlo.space](https://mirlo.space).

Released under the **AGPL-3.0** license. See [LICENSE](LICENSE) and [License.md](License.md).
