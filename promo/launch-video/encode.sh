#!/usr/bin/env bash
# Blend every 3 subframes into one frame (motion blur), encode 60 fps H.264,
# and mux the soundtrack.
#
#   ./encode.sh <frames-dir> <soundtrack.wav> <out.mp4>
#
# The frames come from `node render.js full <lang> <frames-dir>`: 180 PNG per
# second, f_00000.png ... f_02699.png. tmix averages frames n-2..n and select
# keeps every third one, so output frame i is the mean of subframes 3i..3i+2.
set -euo pipefail
FRAMES="$1"; WAV="$2"; OUT="$3"
ffmpeg -y -hide_banner -loglevel warning \
  -framerate 180 -i "$FRAMES/f_%05d.png" -i "$WAV" \
  -filter_complex "[0:v]tmix=frames=3:weights='1 1 1',select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 60 \
  -c:v libx264 -preset slow -crf 16 -profile:v high \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of compact "$OUT"
