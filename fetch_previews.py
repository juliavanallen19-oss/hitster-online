import json, urllib.request, urllib.parse, ssl, base64, time, re, sys

if len(sys.argv) != 3:
    print("Usage: python3 fetch_previews.py YOUR_CLIENT_ID YOUR_CLIENT_SECRET")
    sys.exit(1)

CLIENT_ID     = sys.argv[1]
CLIENT_SECRET = sys.argv[2]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE

def get_token():
    credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    data        = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req         = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data    = data,
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type":  "application/x-www-form-urlencoded"
        }
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read())["access_token"]

def get_preview_url(track_id, token):
    req = urllib.request.Request(
        f"https://api.spotify.com/v1/tracks/{track_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
        return json.loads(resp.read()).get("preview_url")

print("Fetching Spotify token...")
token = get_token()
print("Token received. Starting preview URL fetch for all 200 songs...\n")

with open("data/songs.json") as f:
    songs = json.load(f)

missing = []

for i, song in enumerate(songs):
    match = re.search(r"track/([A-Za-z0-9]+)", song.get("spotify_url", ""))
    if not match:
        print(f"  [{i+1}] SKIPPED (no track ID): {song['title']}")
        continue

    track_id = match.group(1)
    try:
        preview_url = get_preview_url(track_id, token)
        song["preview_url"] = preview_url
        if preview_url:
            print(f"  [{i+1}] OK:      {song['artist']} - {song['title']}")
        else:
            print(f"  [{i+1}] NO PREVIEW: {song['artist']} - {song['title']}")
            missing.append(song["title"])
    except Exception as e:
        print(f"  [{i+1}] ERROR: {song['title']} — {e}")
        song["preview_url"] = None
        missing.append(song["title"])

    time.sleep(0.1)

with open("data/songs.json", "w") as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

print(f"\nDone! songs.json updated.")
print(f"Songs with preview:    {200 - len(missing)}/200")
print(f"Songs without preview: {len(missing)}/200")
if missing:
    print("\nSongs missing a preview URL:")
    for title in missing:
        print(f"  - {title}")
