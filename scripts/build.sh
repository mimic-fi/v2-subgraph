#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Mainnet
registry_mainnet=
block_mainnet=

# Polygon
registry_matic=
block_matic=

# Goerli
registry_goerli=0x5aaE001Ffb7a2982f01D17C0daAe9A1D67b5a2d3
block_goerli=7923525

# Validate network
networks=(mainnet matic goerli)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either mainnet, matic, or goerli.'
  exit 1
fi

# Use mainnet network in case of local deployment
if [[ "$NETWORK" = "localhost" ]]; then
  ENV='mainnet'
else
  ENV=${NETWORK}
fi

# Load start block
if [[ -z $BLOCK_NUMBER ]]; then
  BLOCK_NUMBER_VAR=block_$NETWORK
  BLOCK_NUMBER=${!BLOCK_NUMBER_VAR}
fi
if [[ -z $BLOCK_NUMBER ]]; then
  BLOCK_NUMBER=0
fi

# Load registry address
if [[ -z $REGISTRY_ADDRESS ]]; then
  REGISTRY_ADDRESS_VAR=registry_$NETWORK
  REGISTRY_ADDRESS=${!REGISTRY_ADDRESS_VAR}
fi

# Validate registry address
if [[ -z $REGISTRY_ADDRESS ]]; then
  echo 'Please make sure a Registry address is provided'
  exit 1
fi

#################################################################
#####                     FINALIZE                         ######
#################################################################

# Remove previous manifest if there is any
if [ -f subgraph.yaml ]; then
  echo 'Removing previous subgraph manifest...'
  rm subgraph.yaml
fi

# Build subgraph manifest for requested variables
echo "Preparing new subgraph manifest for Registry address ${REGISTRY_ADDRESS} and network ${NETWORK}"
cp subgraph.template.yaml subgraph.yaml
sed -i -e "s/{{network}}/${ENV}/g" subgraph.yaml
sed -i -e "s/{{registryAddress}}/${REGISTRY_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{blockNumber}}/${BLOCK_NUMBER}/g" subgraph.yaml
rm -f subgraph.yaml-e

# Run codegen and build
rm -rf ./types && yarn graph codegen -o types
yarn graph build
