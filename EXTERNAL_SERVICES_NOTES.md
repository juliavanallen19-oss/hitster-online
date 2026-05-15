Great questions — here's what's actually possible and what I'd recommend.

---

## 1. Can you hide the cover/title/artist and auto-play for free?

**Short answer: No, not with the standard Spotify Embed.**

The Spotify embed iframe always shows the album art, track title, and artist name — that's baked into what they serve. You can't CSS-hide it reliably because it lives inside an iframe from a different domain (Spotify's servers), so your code has no access to the content inside it. Browsers block that for security reasons.

Auto-play is also blocked. Modern browsers (Chrome, Firefox, Safari) require a real human click gesture before any audio starts playing. Even if you trigger `.play()` in JavaScript right after the page loads, the browser silently ignores it. This is a browser policy, not a Spotify restriction — it exists because auto-playing audio is annoying and abusive.

So the current setup (manual click, shows metadata) is essentially the best you can get from the free Spotify embed without a paid API plan.

---

## 2. How can you still use Spotify meaningfully?

The best approach is to **reframe what the button does** rather than fight the embed's limitations. Here are concrete ideas:

**Option A — "Listen after you guess" reward**
Keep the button exactly as it is, but change *when* it appears. Right now it seems to show before the reveal. Instead, only show it *after* the card has been placed and the year revealed. At that point, seeing the title and artist is totally fine — the guessing is over. Players can listen to the song they just played, which is actually a fun moment. This requires zero new code, just moving where in the turn flow the button appears.

**Option B — Audio-only workaround with a custom button**
This is more work but genuinely impressive. Spotify's *oEmbed* and *Web Playback SDK* exist, but they require Premium accounts. However, many songs have a **30-second preview MP3 URL** available through the **Spotify Web API** (free tier, just needs an app registered on developer.spotify.com). You'd fetch that URL server-side or at game load time, store it in your songs.json alongside the other song data, and play it with a plain HTML `<audio>` element. That gives you full control — you can show just a waveform or a timer, hide all metadata, and the user just hears the clip. This is genuinely feasible and would be a standout feature.

---

## 3. Other ideas to impress your professor

For a university programming project, professors typically look for: use of external data, some kind of async/network request, and creative problem-solving. Here's what fits your stack with reasonable effort:

**Difficulty ratings from a music API**
Using the Spotify Web API (free), you can pull the **popularity score** (0–100) of each song. You could use this to implement a "hard mode" where the deck is filtered to only obscure songs (low popularity), or display a difficulty indicator on each card. This demonstrates real API integration with JSON parsing.

**Wikipedia decade context cards**
When the year is revealed, make a quick fetch to the Wikipedia API to pull the top event from that year (e.g. "1985 — Back to the Future released"). Show it as a fun "Did you know?" after the reveal. Wikipedia has a completely free, open API that doesn't require any key. This is maybe 15 lines of JavaScript and looks impressive.

**Local leaderboard with localStorage**
Not an external API, but professors love persistent state. After each game, save the winner and their score to `localStorage`. Add a small "Hall of Fame" section on the setup screen. This demonstrates understanding of browser storage and JSON serialization.

**QR code for Spotify track page**
You already have QRCode.js loaded. Instead of (or alongside) the embed, generate a QR code that links directly to the Spotify track. Players can scan it with their phone and listen there, with no iframe visibility problem. Much simpler than fighting the embed, and you're actually making use of a library you already import.

---

## My recommendation

The cleanest path forward: use **Option A** (move the embed to post-reveal) immediately since it's trivial, and then separately implement the **30-second preview MP3** approach as your "technical highlight" for the project submission. That gives you a real async fetch, a custom audio player, and a genuine problem you solved creatively. It's the kind of thing that makes a grader say "they actually understood what they were building."

Want me to look into exactly how to get those preview URLs into your songs.json and wire up a simple audio player?
