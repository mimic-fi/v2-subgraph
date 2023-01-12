import { Address, BigInt, dataSource, log } from '@graphprotocol/graph-ts'

import { UniswapPair } from '../types/templates/SmartVault/UniswapPair'
import { UniswapFactory } from '../types/templates/SmartVault/UniswapFactory'

const WETH = Address.fromString('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
const USDC = Address.fromString('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
const UNISWAP_V2_FACTORY = Address.fromString('0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f')

const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')

export function rateInUsd(token: Address, amount: BigInt): BigInt {
  if (dataSource.network() != 'mainnet') return BigInt.zero()
  if (token.toHexString().toLowerCase() == USDC.toHexString().toLowerCase()) return amount
  if (token.toHexString().toLowerCase() == WETH.toHexString().toLowerCase()) return convert(WETH, USDC, amount)
  return convert(WETH, USDC, convert(token, WETH, amount))
}

function convert(tokenIn: Address, tokenOut: Address, amountIn: BigInt): BigInt {
  if (amountIn.isZero()) return BigInt.zero()
  let poolAddress = getPool(tokenIn, tokenOut)
  if (poolAddress.equals(ZERO_ADDRESS)) return BigInt.zero()

  let reserves = getReserves(poolAddress)
  let isTokenInLtTokenOut = tokenIn.toHexString().toLowerCase() < tokenOut.toHexString().toLowerCase()
  let tokenInReserve = isTokenInLtTokenOut ? reserves[0] : reserves[1]
  let tokenOutReserve = isTokenInLtTokenOut ? reserves[1] : reserves[0]
  return amountIn.times(tokenOutReserve).div(tokenInReserve)
}

function getReserves(address: Address): Array<BigInt> {
  let pool = UniswapPair.bind(address)
  let reservesCall = pool.try_getReserves()

  if (!reservesCall.reverted) {
    return [reservesCall.value.value0, reservesCall.value.value1]
  }

  log.warning('getReserves() call reverted for {}', [address.toHexString()])
  return [BigInt.zero(), BigInt.zero()]
}

function getPool(tokenA: Address, tokenB: Address): Address {
  let factory = UniswapFactory.bind(UNISWAP_V2_FACTORY)
  let pairCall = factory.try_getPair(tokenA, tokenB)

  if (!pairCall.reverted) {
    return pairCall.value
  }

  log.warning('getPair() call reverted for tokens {} {}', [tokenA.toHexString(), tokenB.toHexString()])
  return ZERO_ADDRESS
}
