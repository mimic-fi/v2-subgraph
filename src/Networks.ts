import { dataSource} from '@graphprotocol/graph-ts'

export function isEthNetwork(): boolean {
  return isMainnet() || isGoerli() || isArbitrum() || isOptimism()
}

export function isMaticNetwork(): boolean {
  return isPolygon() || isMumbai()
}

export function isMainnet(): boolean {
  return dataSource.network() == 'mainnet'
}

export function isGoerli(): boolean {
  return dataSource.network() == 'goerli'
}

export function isArbitrum(): boolean {
  return dataSource.network() == 'arbitrum' || dataSource.network() == 'arbitrum-one'
}

export function isOptimism(): boolean {
  return dataSource.network() == 'optimism'
}

export function isPolygon(): boolean {
  return dataSource.network() == 'matic' || dataSource.network() == 'polygon'
}

export function isMumbai(): boolean {
  return dataSource.network() == 'mumbai'
}

export function isAvalanche(): boolean {
  return dataSource.network() == 'avalanche'
}

export function isBinance(): boolean {
  return dataSource.network() == 'bsc'
}

export function isFantom(): boolean {
  return dataSource.network() == 'fantom'
}

export function isGnosis(): boolean {
  return dataSource.network() == 'gnosis'
}

export function getCurrentChainId(): i32 {
  if (isMainnet()) return 1
  if (isPolygon()) return 137
  if (isOptimism()) return 10
  if (isGnosis()) return 100
  if (isFantom()) return 250
  if (isArbitrum()) return 42161
  if (isAvalanche()) return 43114
  if (isBinance()) return 56
  if (isGoerli()) return 5
  if (isMumbai()) return 80001
  return 0
}
