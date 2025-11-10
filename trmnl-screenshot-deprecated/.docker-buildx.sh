#!/bin/bash
set -e

REGISTRY="ghcr.io/chbarnhouse"
ADDON_NAME="addon-trmnl-screenshot"
VERSION="0.1.0"

# Build for each architecture
for ARCH in amd64 armv7 aarch64; do
  case $ARCH in
    amd64)
      PLATFORM="linux/amd64"
      BASE_IMAGE="ghcr.io/home-assistant/amd64-base-nodejs:latest"
      ;;
    armv7)
      PLATFORM="linux/arm/v7"
      BASE_IMAGE="ghcr.io/home-assistant/armv7-base-nodejs:latest"
      ;;
    aarch64)
      PLATFORM="linux/arm64"
      BASE_IMAGE="ghcr.io/home-assistant/aarch64-base-nodejs:latest"
      ;;
  esac

  TAG="${REGISTRY}/${ARCH}-${ADDON_NAME}:${VERSION}"
  TAG_LATEST="${REGISTRY}/${ARCH}-${ADDON_NAME}:latest"

  echo "Building for $ARCH (platform: $PLATFORM)..."
  docker buildx build \
    --platform "$PLATFORM" \
    --tag "$TAG" \
    --tag "$TAG_LATEST" \
    --build-arg "BUILD_FROM=$BASE_IMAGE" \
    --push \
    .
  
  echo "✓ Pushed $TAG"
done

echo "All architecture builds complete!"
