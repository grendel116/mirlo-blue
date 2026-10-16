# Mirlo-Blue Architectural & Ethos Rules

## Foundational References & Standards
Always orient architecture and development decisions around the **Chorus Protocol** (formerly drafted as Canimus) and federated open-music standards:
- **Mirlo Federation API**: https://docs.mirlo.space/api/#fairplayer-canimus-federation
- **Fairplayer Interop Specifications**: https://codeberg.org/fairplayer/interop (and https://interop.fairplayer.org)
- **Chorus Protocol Specification**: The open standard for syndicating decentralized music catalogs, streaming previews, and artist metadata across the Social Music Network.

Review these references whenever modifying catalog ingestion, streaming pipelines, discovery systems, or user media playback.

## Governing Principles

1. **Respect Artist Consent & Sovereignty**:
   - Only syndicate and stream content from artists who explicitly opt in to social streaming.
   - Respect revocation and deletions immediately: when processing catalog updates from Chorus feeds, purge any entities returned in the `deleted` array from local cache and state.
   - Honor play count limits and preview thresholds set by artists. Respond to `402 Payment Required` cleanly and inform the listener without retrying aggressively.

2. **Decentralized Federation ("You host, we all syndicate")**:
   - Keep playback decoupled from any single origin server.
   - Support discovery across independent catalogs and nodes (Mirlo instances, Chorus/Canimus feeds, Faircamp static sites).
   - Use the two-step authorized external streaming flow (`/v1/tracks/{id}/stream/external/playlist.m3u8` with `social-music-userid` and short-lived `social-music-playtoken`) for federated streams.

3. **True Ownership & No DRM**:
   - Save downloaded tracks as standard, permanent audio files (FLAC, MP3, Ogg, Opus, AAC) with full metadata tags.
   - Never wrap downloads in encrypted or expiring DRM wrappers.

4. **Consolidated Architecture & Root-Cause Solutions**:
   - Build cohesive data models and unified query hooks.
   - Address root causes directly rather than adding defensive layers or regex patches.
   - Maintain clean, affirmative directives across code and documentation.
