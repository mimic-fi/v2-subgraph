import { Address, BigInt, log } from '@graphprotocol/graph-ts'

import { rateInUsd as rateInUsdInUniV2 } from './UniswapV2'
import { rateInUsd as rateInUsdInUniV3 } from './UniswapV3'
import { getERC20Symbol } from '../ERC20'
import { isArbitrum, isAvalanche, isBinance, isFantom, isGnosis, isMainnet, isOptimism, isPolygon } from '../Networks'

const SUSHISWAP_FACTORY = Address.fromString('0xc35dadb65012ec5796536bd9864ed8773abc74c4')
const HONEYSWAP_FACTORY = Address.fromString('0xA818b4F111Ccac7AA31D0BCc0806d64F2E0737D7')

export function rateInUsd(token: Address, amount: BigInt): BigInt {
  if (isMainnet() || isPolygon() || isOptimism() || isArbitrum()) return rateInUsdInUniV3(token, amount)
  if (isFantom() || isAvalanche() || isBinance()) return rateInUsdInUniV2(token, amount, SUSHISWAP_FACTORY)
  if (isGnosis()) return rateInUsdInUniV2(token, amount, HONEYSWAP_FACTORY)

  let symbol = getERC20Symbol(token)
  log.warning('Could not compute rate in USD for token {} ({})', [symbol, token.toHexString()])

  return BigInt.zero()
}
