import json, urllib.request, urllib.parse, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

def search_deezer(title, artist):
    query = urllib.parse.quote(f'artist:"{artist}" track:"{title}"')
    url   = f"https://api.deezer.com/search?q={query}&limit=5"
    req   = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        results = json.loads(resp.read()).get("data", [])
    for r in results:
        if r.get("preview"):
            return r["preview"]
    return None

print("Fetching Deezer preview URLs (skipping songs that already have one)...\n")

with open("data/songs.json") as f:
    songs = json.load(f)

already_done = sum(1 for s in songs if s.get("preview_url"))
print(f"Already have previews for {already_done} songs. Fetching the rest...\n")

missing = []

for i, song in enumerate(songs):
    if song.get("preview_url"):
        continue

    try:
        preview_url = search_deezer(song["title"], song["artist"])
        song["preview_url"] = preview_url
        if preview_url:
            print(f"  [{i+1:3}] OK:         {song['artist']} - {song['title']}")
        else:
            print(f"  [{i+1:3}] NO PREVIEW: {song['artist']} - {song['title']}")
            missing.append(song["title"])
    except Exception as e:
        print(f"  [{i+1:3}] ERROR:      {song['title']} — {e}")
        song["preview_url"] = None
        missing.append(song["title"])

    time.sleep(0.3)

with open("data/songs.json", "w") as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

total_with = sum(1 for s in songs if s.get("preview_url"))
print(f"\nDone! songs.json updated.")
print(f"Songs with preview:    {total_with}/200")
print(f"Songs without preview: {200 - total_with}/200")
if missing:
    print("\nSongs still missing a preview URL:")
    for title in missing:
        print(f"  - {title}")
