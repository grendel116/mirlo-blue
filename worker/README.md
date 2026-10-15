# MirloBlue Social Sharing & Image Proxy Worker

This worker allows every Mirlo track, radio station, and podcast shared from MirloBlue to generate rich OpenGraph preview cards on **Threads**, **Bluesky**, **Twitter/X**, **WhatsApp**, and **iMessage**.

It also fixes upstream Mirlo issue [#2494](https://github.com/funmusicplace/mirlo/issues/2494) by delivering album artwork with proper `Content-Type: image/webp` headers instead of `application/octet-stream`.

Podcast discovery reads Castopod Index's public catalog through `/api/podcasts`. It matches topic terms in show titles, descriptions, author names, and categories, then requires a valid publisher RSS URL and quality artwork. Podcast share links include episode audio and artwork when available, or use the latest audio enclosure in the show's RSS feed. Music, radio, and podcast share pages limit playback to 10 seconds. Curated shows remain available independently. To recommend a show that is missing from the index, submit its public RSS feed, show page, and artwork through a [MirloBlue issue](https://github.com/grendel116/mirlo-blue/issues). Radio and podcast preview requests without a usable artwork URL return `404` instead of showing a generic image.

---

## 1-Minute Deployment Options

### Option A: Cloudflare Web Dashboard (No CLI or install needed)
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/) (free account).
2. Go to **Workers & Pages** -> **Create Application** -> **Create Worker**.
3. Name it `mirlo-blue-share` and click **Deploy**.
4. Click **Edit Code**, paste the contents of [`src/index.js`](src/index.js), and click **Deploy**.
5. Copy your worker's public URL (e.g., `https://mirlo-blue-share.<your-subdomain>.workers.dev`).

### Option B: From Command Line
From the project root:
```bash
npx wrangler login
cd worker
npx wrangler deploy
```

---

## Linking into MirloBlue

Once deployed, set your worker URL in `.env`:
```env
EXPO_PUBLIC_SHARE_HUB_URL="https://mirlo-blue-share.<your-subdomain>.workers.dev/listen/"
```
Or paste the URL directly into `components/ShareTrackButton.tsx`.
