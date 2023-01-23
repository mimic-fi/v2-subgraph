import { dataSource } from '@graphprotocol/graph-ts'

export function getCurrentChainId(): i32 {
  let network = dataSource.network()
  if (network == 'mainnet') return 1
  if (network == 'polygon' || network == 'matic') return 137
  if (network == 'optimism') return 10
  if (network == 'gnosis') return 100
  if (network == 'fantom') return 250
  if (network == 'arbitrum') return 42161
  if (network == 'avalanche') return 43114
  if (network == 'bsc') return 56
  if (network == 'goerli') return 5
  if (network == 'mumbai') return 80001
  return 0
}
