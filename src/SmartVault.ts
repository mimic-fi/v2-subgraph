import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { Strategy as StrategyContract } from '../types/templates/SmartVault/Strategy'
import { SmartVault as SmartVaultContract } from '../types/templates/SmartVault/SmartVault'

import {
  Balance,
  ERC20,
  FeeConfig,
  FeePaid,
  PriceFeed,
  PrimitiveExecution,
  Movement,
  SmartVault
} from '../types/schema'

import {
  Call,
  Collect,
  Withdraw,
  Wrap,
  Unwrap,
  Claim,
  Join,
  Exit,
  Swap,
  SwapFeeSet,
  WithdrawFeeSet,
  PerformanceFeeSet,
  PriceOracleSet,
  PriceFeedSet,
  StrategySet,
  SwapConnectorSet,
  Authorized,
  Unauthorized,
  FeeCollectorSet
} from '../types/templates/SmartVault/SmartVault'

import { loadOrCreateERC20, loadOrCreateNativeToken } from './ERC20'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')

export function handleAuthorized(event: Authorized): void {
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleCall(event: Call): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Call'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleCollect(event: Collect): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenOut = loadOrCreateERC20(event.params.token)
  let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.collected)
  balanceOut.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Collect'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementOut(event, 1, execution, tokenOut, event.params.collected)
}

export function handleWithdraw(event: Withdraw): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenIn = loadOrCreateERC20(event.params.token)
  let balanceIn = loadOrCreateBalance(smartVault, tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.withdrawn)
  balanceIn.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Withdraw'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementIn(event, 1, execution, tokenIn, event.params.withdrawn)

  if (!event.params.fee.isZero()) {
    let feeId = smartVault.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.smartVault = smartVault.id
    fee.primitiveExecution = execution.id
    fee.token = tokenIn.id
    fee.amount = event.params.fee
    fee.pct = getWithdrawFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleWrap(event: Wrap): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenIn = loadOrCreateNativeToken()
  let balanceIn = loadOrCreateBalance(smartVault, tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.wrapped)
  balanceIn.save()

  let tokenOut = ERC20.load(smartVault.wrappedNativeToken)!
  let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.wrapped)
  balanceOut.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Wrap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementIn(event, 1, execution, tokenIn, event.params.wrapped)
  createMovementOut(event, 2, execution, tokenOut, event.params.wrapped)
}

export function handleUnwrap(event: Unwrap): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenIn = ERC20.load(smartVault.wrappedNativeToken)!
  let balanceIn = loadOrCreateBalance(smartVault, tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.unwrapped)
  balanceIn.save()

  let tokenOut = loadOrCreateNativeToken()
  let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.unwrapped)
  balanceOut.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Unwrap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementIn(event, 1, execution, tokenIn, event.params.unwrapped)
  createMovementOut(event, 2, execution, tokenOut, event.params.unwrapped)
}

export function handleClaim(event: Claim): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let eventTokens = event.params.tokens
  let eventAmounts = event.params.amounts

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Claim'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  for (let i: i32 = 0; i < eventTokens.length; i++) {
    let tokenOut = loadOrCreateERC20(eventTokens[i])
    let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
    balanceOut.amount = balanceOut.amount.plus(eventAmounts[i])
    balanceOut.save()

    createMovementOut(event, i, execution, tokenOut, eventAmounts[i])
  }
}

export function handleJoin(event: Join): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenIn = loadOrCreateERC20(getStrategyToken(event.params.strategy))
  let balanceIn = loadOrCreateBalance(smartVault, tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.invested)
  balanceIn.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Join'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementIn(event, 1, execution, tokenIn, event.params.invested)
  // TODO: handle liquidity pool tokens
}

export function handleExit(event: Exit): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenOut = loadOrCreateERC20(getStrategyToken(event.params.strategy))
  let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.received)
  balanceOut.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Exit'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementOut(event, 1, execution, tokenOut, event.params.received)
  // TODO: handle liquidity pool tokens

  if (!event.params.fee.isZero()) {
    let feeId = smartVault.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.smartVault = smartVault.id
    fee.primitiveExecution = execution.id
    fee.token = tokenOut.id
    fee.amount = event.params.fee
    fee.pct = getPerformanceFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleSwap(event: Swap): void {
  let smartVault = loadOrCreateSmartVault(event.address)

  let tokenIn = loadOrCreateERC20(event.params.tokenIn)
  let balanceIn = loadOrCreateBalance(smartVault, tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.amountIn)
  balanceIn.save()

  let tokenOut = loadOrCreateERC20(event.params.tokenOut)
  let balanceOut = loadOrCreateBalance(smartVault, tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.amountOut)
  balanceOut.save()

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Swap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  createMovementIn(event, 1, execution, tokenIn, event.params.amountIn)
  createMovementOut(event, 2, execution, tokenOut, event.params.amountOut)

  if (!event.params.fee.isZero()) {
    let feeId = smartVault.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.smartVault = smartVault.id
    fee.primitiveExecution = execution.id
    fee.token = tokenOut.id
    fee.amount = event.params.fee
    fee.pct = getSwapFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleStrategySet(event: StrategySet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let strategies = smartVault.strategies

  let strategy = event.params.strategy.toHexString()
  let index = strategies.indexOf(strategy)
  if (event.params.allowed && index < 0) strategies.push(strategy)
  else if (!event.params.allowed && index >= 0) strategies.splice(index, 1)

  smartVault.strategies = strategies
  smartVault.save()
}

export function handlePriceOracleSet(event: PriceOracleSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  smartVault.priceOracle = event.params.priceOracle.toHexString()
  smartVault.save()
}

export function handlePriceFeedSet(event: PriceFeedSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let feedId = smartVault.id + '/feeds/' + event.params.base.toHexString() + '/' + event.params.quote.toHexString()
  let feed = new PriceFeed(feedId)
  feed.base = event.params.base.toHexString()
  feed.quote = event.params.quote.toHexString()
  feed.smartVault = smartVault.id
  feed.save()
}

export function handleSwapConnectorSet(event: SwapConnectorSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  smartVault.swapConnector = event.params.swapConnector.toHexString()
  smartVault.save()
}

export function handleFeeCollectorSet(event: FeeCollectorSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  smartVault.feeCollector = event.params.feeCollector.toHexString()
  smartVault.save()
}

export function handlePerformanceFeeSet(event: PerformanceFeeSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let performanceFeeId = smartVault.id + '/performance-fee'
  let performanceFee = FeeConfig.load(performanceFeeId)

  if (performanceFee === null) {
    performanceFee = new FeeConfig(performanceFeeId)
    performanceFee.smartVault = smartVault.id
  }

  performanceFee.pct = event.params.pct
  performanceFee.cap = event.params.cap
  performanceFee.token = loadOrCreateERC20(event.params.token).id
  performanceFee.period = event.params.period
  performanceFee.save()
}

export function handleWithdrawFeeSet(event: WithdrawFeeSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let withdrawFeeId = smartVault.id + '/withdraw-fee'
  let withdrawFee = FeeConfig.load(withdrawFeeId)

  if (withdrawFee === null) {
    withdrawFee = new FeeConfig(withdrawFeeId)
    withdrawFee.smartVault = smartVault.id
  }

  withdrawFee.pct = event.params.pct
  withdrawFee.cap = event.params.cap
  withdrawFee.token = loadOrCreateERC20(event.params.token).id
  withdrawFee.period = event.params.period
  withdrawFee.save()
}

export function handleSwapFeeSet(event: SwapFeeSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let swapFeeId = smartVault.id + '/swap-fee'
  let swapFee = FeeConfig.load(swapFeeId)

  if (swapFee === null) {
    swapFee = new FeeConfig(swapFeeId)
    swapFee.smartVault = smartVault.id
  }

  swapFee.pct = event.params.pct
  swapFee.cap = event.params.cap
  swapFee.token = loadOrCreateERC20(event.params.token).id
  swapFee.period = event.params.period
  swapFee.save()
}

function loadOrCreateBalance(smartVault: SmartVault, token: ERC20): Balance {
  let id = smartVault.id + '/balances/' + token.id
  let balance = Balance.load(id)

  if (balance === null) {
    balance = new Balance(id)
    balance.smartVault = smartVault.id
    balance.token = token.id
    balance.amount = BigInt.zero()
    balance.save()
  }

  return balance
}

export function getWrappedNativeToken(address: Address): Address {
  let wallet = SmartVaultContract.bind(address)
  let wrappedNativeTokenCall = wallet.try_wrappedNativeToken()

  if (!wrappedNativeTokenCall.reverted) {
    return wrappedNativeTokenCall.value
  }

  log.warning('wrappedNativeToken() call reverted for {}', [address.toHexString()])
  return Address.fromString('0x0000000000000000000000000000000000000000')
}

function getFeeCollector(address: Address): string {
  let wallet = SmartVaultContract.bind(address)
  let feeCollectorCall = wallet.try_feeCollector()

  if (!feeCollectorCall.reverted) {
    return feeCollectorCall.value.toHexString()
  }

  log.warning('feeCollector() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}

function getWithdrawFeePct(address: Address): BigInt {
  let wallet = SmartVaultContract.bind(address)
  let withdrawFeeCall = wallet.try_withdrawFee()

  if (!withdrawFeeCall.reverted) {
    return withdrawFeeCall.value.value0
  }

  log.warning('withdrawFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

function getPerformanceFeePct(address: Address): BigInt {
  let wallet = SmartVaultContract.bind(address)
  let performanceFeeCall = wallet.try_performanceFee()

  if (!performanceFeeCall.reverted) {
    return performanceFeeCall.value.value0
  }

  log.warning('performanceFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

function getSwapFeePct(address: Address): BigInt {
  let wallet = SmartVaultContract.bind(address)
  let swapFeeCall = wallet.try_swapFee()

  if (!swapFeeCall.reverted) {
    return swapFeeCall.value.value0
  }

  log.warning('swapFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

function getStrategyToken(address: Address): Address {
  let strategy = StrategyContract.bind(address)
  let tokenCall = strategy.try_token()

  if (!tokenCall.reverted) {
    return tokenCall.value
  }

  log.warning('token() call reverted for {}', [address.toHexString()])
  return ZERO_ADDRESS
}

function getTransactionId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '/' + event.transactionLogIndex.toString()
}

function createMovementIn(
  event: ethereum.Event,
  index: number,
  execution: PrimitiveExecution,
  token: ERC20,
  amount: BigInt
): void {
  createMovement('In', event, index, execution, token, amount)
}

function createMovementOut(
  event: ethereum.Event,
  index: number,
  execution: PrimitiveExecution,
  token: ERC20,
  amount: BigInt
): void {
  createMovement('Out', event, index, execution, token, amount)
}

function createMovement(
  type: string,
  event: ethereum.Event,
  index: number,
  execution: PrimitiveExecution,
  token: ERC20,
  amount: BigInt
): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let movementId = smartVault.id + '/movements/' + getTransactionId(event) + '/' + index.toString()
  let movement = new Movement(movementId)
  movement.type = type
  movement.smartVault = smartVault.id
  movement.token = token.id
  movement.amount = amount
  movement.primitiveExecution = execution.id
  movement.save()
}

export function loadOrCreateSmartVault(address: Address): SmartVault {
  let id = address.toHexString()
  let smartVault = SmartVault.load(id)

  if (smartVault === null) {
    smartVault = new SmartVault(id)
    smartVault.save()
  }

  return smartVault
}
