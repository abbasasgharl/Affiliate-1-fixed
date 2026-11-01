#!/usr/bin/env bash
set -euo pipefail

: "${NODE_IMAGE:?Set NODE_IMAGE to a Node base image pinned by sha256 digest}"
: "${IMAGE_TAG:?Set IMAGE_TAG to the private registry image tag}"

if [[ ! "${NODE_IMAGE}" =~ @sha256:[a-f0-9]{64}$ ]]; then
  echo "NODE_IMAGE must end with @sha256:<64 lowercase hex characters>." >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required." >&2
  exit 2
fi

metadata_file="$(mktemp)"
trap 'rm -f "$metadata_file"' EXIT

TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"

docker buildx build \
  --platform "${TARGET_PLATFORM}" \
  --push \
  --metadata-file "${metadata_file}" \
  --build-arg "NODE_IMAGE=${NODE_IMAGE}" \
  --file packages/agent-engine/sandbox-image/Dockerfile \
  --tag "${IMAGE_TAG}" \
  .

digest="$(node -e "const m=require(process.argv[1]); process.stdout.write(m['containerimage.digest'] || '')" "${metadata_file}")"
if [[ ! "${digest}" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "Build completed but no valid immutable image digest was returned." >&2
  exit 1
fi

image_repository="${IMAGE_TAG%:*}"
echo "Use this immutable reference in AGENT_SANDBOX_IMAGES:"
echo "${image_repository}@${digest}"
