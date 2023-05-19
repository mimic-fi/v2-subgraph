import { Address, BigInt, log } from '@graphprotocol/graph-ts'

import { UniswapPairV2 as UniswapPair } from '../../types/templates/SmartVault/UniswapPairV2'
import { UniswapFactoryV2 as UniswapFactory } from '../../types/templates/SmartVault/UniswapFactoryV2'

import { getUsdc, getWrappedNativeToken } from '../Tokens'

const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')
const NATIVE_TOKEN_ADDRESS = Address.fromString('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')

export function rateInUsdc(token: Address, amount: BigInt, factoryAddress: Address): BigInt {
  const USDC = getUsdc()
  if (token.equals(USDC)) return amount

  const wrappedNativeToken = getWrappedNativeToken()
  const factory = UniswapFactory.bind(factoryAddress)

  const isWrappedOrNative = token.equals(wrappedNativeToken) || token.equals(NATIVE_TOKEN_ADDRESS)
  if (isWrappedOrNative) return convert(factory, wrappedNativeToken, USDC, amount)

  const usdcAmount = convert(factory, token, USDC, amount)
  if (!usdcAmount.isZero()) return usdcAmount

  const wethAmount = convert(factory, token, wrappedNativeToken, amount)
  return convert(factory, wrappedNativeToken, USDC, wethAmount)
}

function convert(factory: UniswapFactory, tokenIn: Address, tokenOut: Address, amountIn: BigInt): BigInt {
  if (amountIn.isZero()) return BigInt.zero()

  let poolAddress = getPool(factory, tokenIn, tokenOut)
  if (poolAddress.equals(ZERO_ADDRESS)) {
    log.warning('Could not find pool for tokens {} and {}', [tokenIn.toHexString(), tokenOut.toHexString()])
    return BigInt.zero()
  }

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

function getPool(factory: UniswapFactory, tokenA: Address, tokenB: Address): Address {
  let pairCall = factory.try_getPair(tokenA, tokenB)

  if (!pairCall.reverted) {
    return pairCall.value
  }

  log.warning('getPair() call reverted for tokens {} {}', [tokenA.toHexString(), tokenB.toHexString()])
  return ZERO_ADDRESS
}
