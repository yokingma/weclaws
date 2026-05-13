#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  capture_card.sh <input.html> <output.png> <ratio>

Environment:
  BROWSERLESS_API_URL   Browserless base URL, for example http://browserless:3000
  BROWSERLESS_API_KEY   Browserless token used by the screenshot API
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

if [[ $# -ne 3 ]]; then
  usage
fi

input_path=$1
output_path=$2
ratio_key=$3

case "$ratio_key" in
  "3:4")
    width=1500
    height=2000
    ;;
  "4:3")
    width=2000
    height=1500
    ;;
  "1:1")
    width=1800
    height=1800
    ;;
  "16:9")
    width=1920
    height=1080
    ;;
  "9:16")
    width=1080
    height=1920
    ;;
  "2.35:1")
    width=2350
    height=1000
    ;;
  "3:1")
    width=1800
    height=600
    ;;
  "5:2")
    width=2500
    height=1000
    ;;
  *)
    echo "Unsupported ratio: $ratio_key" >&2
    echo "Supported ratios: 3:4, 4:3, 1:1, 16:9, 9:16, 2.35:1, 3:1, 5:2" >&2
    exit 1
    ;;
esac

browserless_api_url=${BROWSERLESS_API_URL:-}
browserless_api_key=${BROWSERLESS_API_KEY:-}

if [[ "$browserless_api_url" == "" ]]; then
  echo "Missing BROWSERLESS_API_URL. This helper only supports remote Browserless in WeClaws." >&2
  exit 1
fi

if [[ "$browserless_api_key" == "" ]]; then
  echo "Missing BROWSERLESS_API_KEY. This helper only supports remote Browserless in WeClaws." >&2
  exit 1
fi

if [[ ! -f "$input_path" ]]; then
  echo "Input HTML not found: $input_path" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"

abs_output_path=$(cd "$(dirname "$output_path")" && pwd)/$(basename "$output_path")
payload_path=$(mktemp)
trap 'rm -f "$payload_path"' EXIT

launch_json=$(python3 - "$width" "$height" <<'PY'
import json
import sys

print(json.dumps({
    "defaultViewport": {
        "width": int(sys.argv[1]),
        "height": int(sys.argv[2]),
    }
}))
PY
)

python3 - "$input_path" "$width" "$height" > "$payload_path" <<'PY'
import json
import pathlib
import sys

input_path = pathlib.Path(sys.argv[1])
width = int(sys.argv[2])
height = int(sys.argv[3])

html = input_path.read_text(encoding='utf-8')

payload = {
    "html": html,
    "options": {
        "type": "png",
        "clip": {
            "x": 0,
            "y": 0,
            "width": width,
            "height": height,
        },
        "captureBeyondViewport": True,
        "omitBackground": False,
    },
}

print(json.dumps(payload))
PY

urlencode() {
  python3 - "$1" <<'PY'
import sys
import urllib.parse

print(urllib.parse.quote(sys.argv[1], safe=''))
PY
}

browserless_api_key_encoded=$(urlencode "$browserless_api_key")
launch_json_encoded=$(urlencode "$launch_json")
request_url="${browserless_api_url%/}/screenshot?token=${browserless_api_key_encoded}&launch=${launch_json_encoded}"

curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -X POST \
  --data @"$payload_path" \
  "$request_url" \
  --output "$abs_output_path"

echo "$abs_output_path"
