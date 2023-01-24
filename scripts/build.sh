#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Arbitrum
old_registry_arbitrum=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_arbitrum=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_arbitrum=54001515

# Avalanche
old_registry_avalanche=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_avalanche=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_avalanche=25185623

# BSC
old_registry_bsc=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_bsc=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_bsc=24951117

# Fantom
old_registry_fantom=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_fantom=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_fantom=54077553

# Gnosis
old_registry_gnosis=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_gnosis=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_gnosis=26035218

# Goerli
old_registry_goerli=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_goerli=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_goerli=7936627

# Mainnet
old_registry_mainnet=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_mainnet=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_mainnet=15950104

# Mumbai
old_registry_mumbai=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_mumbai=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_mumbai=29929062

# Optimism
old_registry_optimism=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_optimism=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_optimism=69049113

# Polygon
old_registry_matic=0x53D627B1a2993139b32d5dF209A94498d691f21A
smart_vaults_factory_matic=0x8373c68629191EF10f654CE8e32bbfe3c7A1D743
block_matic=38251690

# Validate network
networks=(arbitrum avalanche bsc fantom gnosis goerli mainnet matic mumbai optimism)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either: arbitrum, avalanche, bsc, fantom, gnosis, goerli, mainnet, matic, mumbai, or optimism.'
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
  REGISTRY_ADDRESS_VAR=old_registry_$NETWORK
  REGISTRY_ADDRESS=${!REGISTRY_ADDRESS_VAR}
fi

# Validate registry address
if [[ -z $REGISTRY_ADDRESS ]]; then
  echo 'Please make sure a Registry address is provided'
  exit 1
fi

# Load smart vaults factory address
if [[ -z $SMART_VAULS_FACTORY_ADDRESS ]]; then
  SMART_VAULS_FACTORY_ADDRESS_VAR=smart_vaults_factory_$NETWORK
  SMART_VAULS_FACTORY_ADDRESS=${!SMART_VAULS_FACTORY_ADDRESS_VAR}
fi

# Validate smart vaults factory address
if [[ -z $SMART_VAULS_FACTORY_ADDRESS ]]; then
  echo 'Please make sure a Smart Vaults Factory address is provided'
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
echo "Preparing new subgraph manifest for network ${NETWORK}"
cp subgraph.template.yaml subgraph.yaml
sed -i -e "s/{{network}}/${ENV}/g" subgraph.yaml
sed -i -e "s/{{registryAddress}}/${REGISTRY_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{smartVaultsFactoryAddress}}/${SMART_VAULS_FACTORY_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{blockNumber}}/${BLOCK_NUMBER}/g" subgraph.yaml
rm -f subgraph.yaml-e

# Run codegen and build
rm -rf ./types && yarn graph codegen -o types
yarn graph build
