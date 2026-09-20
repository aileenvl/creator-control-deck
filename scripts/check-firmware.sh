#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT

# Arduino requires the sketch folder and .ino filename to match.
mkdir -p "$build_dir/creator_control_deck"
cp "$project_root/creator_control_deck.ino" "$build_dir/creator_control_deck/"
"${ARDUINO_CLI:-arduino-cli}" compile \
  --fqbn arduino:avr:uno --warnings all \
  --build-path "$build_dir/build" \
  "$@" "$build_dir/creator_control_deck"
