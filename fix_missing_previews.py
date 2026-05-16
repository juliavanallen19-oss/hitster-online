import json, urllib.request, urllib.parse, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

def search_deezer(title, artist):
    # Strip "ft." and everything after — only use main artist
    main_artist = artist.split(" ft.")[0].split(" feat.")[0].strip()
    query = urllib.parse.quote(f'artist:"{main_artist}" track:"{title}"')
    url   = f"https://api.deezer.com/search?q={query}&limit=5"
    req   = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        results = json.loads(resp.read()).get("data", [])
    for r in results:
        if r.get("preview"):
            return r["preview"]
    # Fallback: search with simplified title too
    simple_title = title.split(" with ")[0].split("!")[0].strip()
    if simple_title != title:
        query2 = urllib.parse.quote(f'artist:"{main_artist}" track:"{simple_title}"')
        url2   = f"https://api.deezer.com/search?q={query2}&limit=5"
        req2   = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req2, timeout=10, context=ctx) as resp2:
            results2 = json.loads(resp2.read()).get("data", [])
        for r in results2:
            if r.get("preview"):
                return r["preview"]
    return None

missing_titles = [
    "Tainted Love",
    "Killing Me Softly with His Song",
    "Yeah!",
    "Blurred Lines",
    "Shake It Off",
    "I Like It",
    "Paint the Town Red",
    "Seven",
    "Birds of a Feather"
]

with open("data/songs.json") as f:
    songs = json.load(f)

print("Retrying 9 missing songs with fixed search...\n")

for song in songs:
    if song["title"] not in missing_titles:
        continue
    try:
        preview_url = search_deezer(song["title"], song["artist"])
        song["preview_url"] = preview_url
        if preview_url:
            print(f"  OK:         {song['artist']} - {song['title']}")
        else:
            print(f"  NO PREVIEW: {song['artist']} - {song['title']}")
    except Exception as e:
        print(f"  ERROR:      {song['title']} — {e}")
        song["preview_url"] = None
    time.sleep(0.3)

with open("data/songs.json", "w") as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

total = sum(1 for s in songs if s.get("preview_url"))
print(f"\nDone! Total songs with preview: {total}/200")
