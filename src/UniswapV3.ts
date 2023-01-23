import { Address, BigInt, dataSource, log } from '@graphprotocol/graph-ts'

import { getUsdc, getWeth } from './Tokens'
import { isEthNetwork, isMaticNetwork } from './Networks'
import { ERC20 } from '../types/templates/SmartVault/ERC20'
import { UniswapRouter } from '../types/templates/SmartVault/UniswapRouter'
import { UniswapFactory } from '../types/templates/SmartVault/UniswapFactory'

const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')
const UNISWAP_V3_ROUTER = Address.fromString('0xE592427A0AEce92De3Edee1F18E0157C05861564')

export function rateInUsd(token: Address, amount: BigInt): BigInt {
  if (!isEthNetwork() && !isMaticNetwork()) return BigInt.zero()

  const USDC = getUsdc()
  const WETH = getWeth()

  if (dataSource.network() != 'mainnet') return BigInt.zero()
  if (token.equals(USDC)) return amount
  if (token.equals(WETH)) return convert(WETH, USDC, amount)
  return convert(WETH, USDC, convert(token, WETH, amount))
}

function convert(tokenIn: Address, tokenOut: Address, amountIn: BigInt): BigInt {
  if (amountIn.isZero()) return BigInt.zero()
  let poolAddress = getPool(tokenIn, tokenOut)
  if (poolAddress.equals(ZERO_ADDRESS)) return BigInt.zero()

  let tokenInReserve = getBalanceOf(tokenIn, poolAddress)
  if (tokenInReserve.isZero()) return BigInt.zero()

  let tokenOutReserve = getBalanceOf(tokenOut, poolAddress)
  return amountIn.times(tokenOutReserve).div(tokenInReserve)
}

function getBalanceOf(token: Address, pool: Address): BigInt {
  let erc20 = ERC20.bind(token)
  let balanceOf_call = erc20.try_balanceOf(pool)

  if (!balanceOf_call.reverted) {
    return balanceOf_call.value
  }

  log.warning('balanceOf() call reverted for token {} and pool {}', [token.toHexString(), pool.toHexString()])
  return BigInt.zero()
}

function getPool(tokenA: Address, tokenB: Address): Address {
  let pool500 = getPoolForFee(tokenA, tokenB, 500)
  if (!pool500.equals(ZERO_ADDRESS)) return pool500

  let pool3000 = getPoolForFee(tokenA, tokenB, 3000)
  if (!pool3000.equals(ZERO_ADDRESS)) return pool3000

  let pool10000 = getPoolForFee(tokenA, tokenB, 10000)
  return pool10000
}

function getPoolForFee(tokenA: Address, tokenB: Address, fee: i32): Address {
  let factory = UniswapFactory.bind(getFactory())
  let poolCall = factory.try_getPool(tokenA, tokenB, fee)

  if (!poolCall.reverted) {
    return poolCall.value
  }

  log.warning('getPool() call reverted for tokens {} {} and fee {}', [tokenA.toHexString(), tokenB.toHexString(), fee.toString()])
  return ZERO_ADDRESS
}

function getFactory(): Address {
  let router = UniswapRouter.bind(UNISWAP_V3_ROUTER)
  let factoryCall = router.try_factory()

  if (!factoryCall.reverted) {
    return factoryCall.value
  }

  log.warning('factory() call reverted for Uniswap V3 router {}', [UNISWAP_V3_ROUTER.toHexString()])
  return ZERO_ADDRESS
}
