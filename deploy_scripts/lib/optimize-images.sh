#!/bin/bash
# optimize-images.sh - Resize oversized source images before build
#
# Since Next.js image optimization is disabled (unoptimized: true for static export),
# source images must be pre-optimized. This script resizes any JPEG/PNG images wider
# than MAX_WIDTH using macOS built-in sips.

MAX_IMAGE_WIDTH=800

IMAGE_FILE_PATTERN='-type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \)'

# get_image_width - Get pixel width of an image via sips
get_image_width() {
  sips -g pixelWidth "$1" 2>/dev/null | grep pixelWidth | awk '{print $2}'
}

# get_file_size - Get file size in bytes (cross-platform: macOS + Linux)
get_file_size() {
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null
}

# optimize_images - Find and resize oversized images
# Usage: optimize_images [image_directory]
# Defaults to src/images/ if no directory specified
optimize_images() {
  local image_dir="${1:-src/images}"

  log_step "Checking for oversized images in $image_dir"

  local resized_count=0
  local total_saved=0

  while IFS= read -r img; do
    local width
    width=$(get_image_width "$img")

    [ -z "$width" ] && continue
    [ "$width" -le "$MAX_IMAGE_WIDTH" ] && continue

    if [ "${DRY_RUN:-false}" = true ]; then
      resized_count=$((resized_count + 1))
      log_dry_run "Would resize: $(basename "$img") (${width}px -> ${MAX_IMAGE_WIDTH}px)"
    else
      local size_before
      size_before=$(get_file_size "$img")

      sips --resampleWidth "$MAX_IMAGE_WIDTH" "$img" >/dev/null 2>&1

      local size_after
      size_after=$(get_file_size "$img")
      local saved=$((size_before - size_after))
      total_saved=$((total_saved + saved))
      resized_count=$((resized_count + 1))

      local saved_kb=$((saved / 1024))
      log_info "Resized: $(basename "$img") (${width}px -> ${MAX_IMAGE_WIDTH}px, saved ${saved_kb}KB)"
    fi
  done < <(eval "find \"$image_dir\" $IMAGE_FILE_PATTERN")

  if [ "$resized_count" -eq 0 ]; then
    log_success "No oversized images found"
  elif [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would resize $resized_count images"
  else
    local total_saved_kb=$((total_saved / 1024))
    log_success "Resized $resized_count images (saved ${total_saved_kb}KB total)"
  fi
}
