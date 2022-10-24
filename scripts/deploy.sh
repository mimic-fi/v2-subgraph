#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Run graph build
yarn build:$NETWORK

# Require $GRAPHKEY to be set
if [[ -z "${GRAPHKEY}" ]]; then
  echo "Please set \$GRAPHKEY to your The Graph deploy key to run this command."
  exit 1
fi

# Deploy subgraph
graph deploy mimic-fi/v2-goerli --product hosted-service --access-token "$GRAPHKEY"
