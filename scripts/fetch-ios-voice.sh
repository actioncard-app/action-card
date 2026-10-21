#!/usr/bin/env bash
# Downloads the GPL-free sherpa-onnx + onnxruntime xcframeworks and the bundled English Kokoro voice files from this
# repo's GitHub releases, and checks every file against the SHA-256 committed in ios/voice-assets.json and
# src/lib/tts/voice-en-bundle.json. Used by the iOS workflows before xcodebuild. Nothing here is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=https://github.com/actioncard-app/action-card/releases/download
FW=ios/App/SherpaKit/Frameworks; VO=ios/App/App/Voices/en
mkdir -p "$FW" "$VO" build/voice-dl
check() { echo "$2  $1" | shasum -a 256 -c - >/dev/null || { echo "SHA-256 mismatch: $1"; exit 1; }; }
python3 - > build/voice-dl/list.txt <<'PY'
import json
a = json.load(open('ios/voice-assets.json'))
for f in a['files']: print('fw', a['release'], f['asset'], f['sha256'])
e = json.load(open('src/lib/tts/voice-en-bundle.json'))
for f in e['files']: print('en', e['release'], f['asset'], f['sha256'], f['name'])
PY
while read -r kind rel asset sha name; do
  out="build/voice-dl/$asset"
  [ -f "$out" ] && echo "$sha  $out" | shasum -a 256 -c - >/dev/null 2>&1 || curl -fsSL --retry 3 -o "$out" "$REPO/$rel/$asset"
  check "$out" "$sha"
  if [ "$kind" = fw ]; then rm -rf "$FW/${asset%.zip}"; ditto -x -k "$out" "$FW"; else cp "$out" "$VO/$name"; fi
done < build/voice-dl/list.txt
ls -la "$FW" "$VO"
du -sh "$VO"
