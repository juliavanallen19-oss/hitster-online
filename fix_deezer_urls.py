import json, urllib.request, urllib.parse, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

def search_itunes(title, artist, retries=4):
    main_artist = artist.split(' ft.')[0].split(' feat.')[0].strip()
    query = urllib.parse.quote(f"{main_artist} {title}")
    url   = f"https://itunes.apple.com/search?term={query}&entity=song&limit=5"
    req   = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                results = json.loads(resp.read()).get("results", [])
            for r in results:
                if r.get("previewUrl"):
                    return r["previewUrl"]
            return None
        except urllib.error.HTTPError as e:
            if e.code == 403:
                wait = 30 * (attempt + 1)
                print(f"    Rate limited — waiting {wait}s...")
                time.sleep(wait)
            else:
                raise
    return None

with open("data/songs.json") as f:
    songs = json.load(f)

deezer_songs = [s for s in songs if "dzcdn" in s.get("preview_url", "") or "deezer" in s.get("preview_url", "")]
print(f"Replacing {len(deezer_songs)} Deezer URLs with iTunes URLs...\n")

fixed  = 0
failed = []

for i, song in enumerate(deezer_songs):
    preview = search_itunes(song["title"], song["artist"])
    if preview:
        song["preview_url"] = preview
        print(f"  [{i+1:3}/{len(deezer_songs)}] OK:      {song['artist']} - {song['title']}")
        fixed += 1
    else:
        print(f"  [{i+1:3}/{len(deezer_songs)}] MISSING: {song['artist']} - {song['title']}")
        failed.append(song["title"])
    time.sleep(2)

with open("data/songs.json", "w") as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

print(f"\nDone! Replaced {fixed}/{len(deezer_songs)} Deezer URLs with iTunes URLs.")
if failed:
    print("Still on Deezer (not found on iTunes):")
    for t in failed: print(f"  - {t}")
