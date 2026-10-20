#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${AWS_REGION:?Set AWS_REGION}"

repo="${ECR_REPOSITORY:-aether-desk}"
registry="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
image="${registry}/${repo}:latest"

if ! aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$repo" --region "$AWS_REGION" >/dev/null
fi

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
docker build -t "$image" .
docker push "$image"
echo "Pushed ${image}"
