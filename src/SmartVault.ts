import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { SmartVault as SmartVaultContract } from '../types/templates/SmartVault/SmartVault'

import {
  Balance,
  ERC20,
  FeeConfig,
  FeePaid,
  PriceFeed,
  PrimitiveExecution,
  Movement,
  SmartVault,
  Stats,
  TransactionCost
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
  Bridge,
  BridgeFeeSet,
  WithdrawFeeSet,
  PerformanceFeeSet,
  PriceOracleSet,
  PriceFeedSet,
  StrategySet,
  SwapConnectorSet,
  BridgeConnectorSet,
  Authorized,
  Unauthorized,
  FeeCollectorSet
} from '../types/templates/SmartVault/SmartVault'

import { rateInUsd, WETH } from './UniswapV2'
import { loadOrCreateERC20, loadOrCreateNativeToken } from './ERC20'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

const REDEEM_GAS_NOTE = '0x52454c41594552'
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
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  trackTransactionCost(event, smartVault, false)
}

export function handleCollect(event: Collect): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Collect'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokenOut = loadOrCreateERC20(event.params.token)
  createMovementOut(event, 1, execution, tokenOut, event.params.collected)

  trackTransactionCost(event, smartVault, false)
}

export function handleWithdraw(event: Withdraw): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Withdraw'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokenIn = loadOrCreateERC20(event.params.token)
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

  let amountUsd = rateInUsd(event.params.token, event.params.withdrawn)
  smartVault.totalValueManaged = smartVault.totalValueManaged.plus(amountUsd)

  let feeUsd = rateInUsd(event.params.token, event.params.fee)
  smartVault.totalFeesUsd = smartVault.totalFeesUsd.plus(feeUsd)

  let isRelayedTx = event.params.data.toHexString() == REDEEM_GAS_NOTE
  let gasRefundUsd = isRelayedTx ? amountUsd : BigInt.zero()
  let transactionCost = trackTransactionCost(event, smartVault, isRelayedTx)
  let relayedCostUsd = isRelayedTx ? transactionCost.costUsd : BigInt.zero()

  smartVault.totalGasRefundsUsd = smartVault.totalGasRefundsUsd.plus(gasRefundUsd)
  smartVault.totalRelayedCostUsd = smartVault.totalRelayedCostUsd.plus(relayedCostUsd)
  smartVault.save()

  trackGlobalStats(amountUsd, feeUsd, gasRefundUsd, relayedCostUsd)
}

export function handleWrap(event: Wrap): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Wrap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokenIn = loadOrCreateNativeToken()
  createMovementIn(event, 1, execution, tokenIn, event.params.wrapped)

  let tokenOut = ERC20.load(smartVault.wrappedNativeToken)!
  createMovementOut(event, 2, execution, tokenOut, event.params.wrapped)

  trackTransactionCost(event, smartVault, false)
}

export function handleUnwrap(event: Unwrap): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Unwrap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokenIn = ERC20.load(smartVault.wrappedNativeToken)!
  createMovementIn(event, 1, execution, tokenIn, event.params.unwrapped)

  let tokenOut = loadOrCreateNativeToken()
  createMovementOut(event, 2, execution, tokenOut, event.params.unwrapped)

  trackTransactionCost(event, smartVault, false)
}

export function handleClaim(event: Claim): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let rewardTokens = event.params.tokens
  let rewardAmounts = event.params.amounts

  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Claim'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  for (let i: i32 = 0; i < rewardTokens.length; i++) {
    let tokenOut = loadOrCreateERC20(rewardTokens[i])
    createMovementOut(event, i, execution, tokenOut, rewardAmounts[i])
  }

  trackTransactionCost(event, smartVault, false)
}

export function handleJoin(event: Join): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Join'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokensIn = event.params.tokensIn
  let amountsIn = event.params.amountsIn
  for (let i: i32 = 0; i < tokensIn.length; i++) {
    let amountIn = amountsIn[i]
    let tokenIn = loadOrCreateERC20(tokensIn[i])
    createMovementIn(event, i, execution, tokenIn, amountIn)
  }

  let tokensOut = event.params.tokensOut
  let amountsOut = event.params.amountsOut
  for (let i: i32 = 0; i < tokensOut.length; i++) {
    let amountOut = amountsOut[i]
    let tokenOut = loadOrCreateERC20(tokensOut[i])
    createMovementOut(event, i, execution, tokenOut, amountOut)
  }

  trackTransactionCost(event, smartVault, false)
}

export function handleExit(event: Exit): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Exit'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokensIn = event.params.tokensIn
  let amountsIn = event.params.amountsIn
  for (let i: i32 = 0; i < tokensIn.length; i++) {
    let amountIn = amountsIn[i]
    let tokenIn = loadOrCreateERC20(tokensIn[i])
    createMovementIn(event, i, execution, tokenIn, amountIn)
  }

  let fees = event.params.fees
  let tokensOut = event.params.tokensOut
  let amountsOut = event.params.amountsOut
  for (let i: i32 = 0; i < tokensOut.length; i++) {
    let amountOut = amountsOut[i]
    let tokenOut = loadOrCreateERC20(tokensOut[i])
    createMovementOut(event, i, execution, tokenOut, amountOut)

    if (!fees[i].isZero()) {
      let feeId = smartVault.id + '/paid-fees/' + getTransactionId(event) + '/' + i.toString()
      let fee = new FeePaid(feeId)
      fee.smartVault = smartVault.id
      fee.primitiveExecution = execution.id
      fee.token = tokenOut.id
      fee.amount = fees[i]
      fee.pct = getPerformanceFeePct(event.address)
      fee.feeCollector = getFeeCollector(event.address)
      fee.save()
    }

    let feeUsd = rateInUsd(tokensOut[i], fees[i])
    smartVault.totalFeesUsd = smartVault.totalFeesUsd.plus(feeUsd)
    smartVault.save()

    trackGlobalFees(feeUsd)
  }

  trackTransactionCost(event, smartVault, false)
}

export function handleSwap(event: Swap): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Swap'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let tokenIn = loadOrCreateERC20(event.params.tokenIn)
  createMovementIn(event, 1, execution, tokenIn, event.params.amountIn)

  let tokenOut = loadOrCreateERC20(event.params.tokenOut)
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

  let feeUsd = rateInUsd(event.params.tokenOut, event.params.fee)
  smartVault.totalFeesUsd = smartVault.totalFeesUsd.plus(feeUsd)
  smartVault.save()

  trackGlobalFees(feeUsd)
  trackTransactionCost(event, smartVault, false)
}

export function handleBridge(event: Bridge): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let executionId = smartVault.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Bridge'
  execution.smartVault = smartVault.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.sender = event.transaction.from.toHexString()
  execution.target = event.transaction.to
  execution.save()

  let token = loadOrCreateERC20(event.params.token)
  createMovementIn(event, 1, execution, token, event.params.amountIn)

  if (!event.params.fee.isZero()) {
    let feeId = smartVault.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.smartVault = smartVault.id
    fee.primitiveExecution = execution.id
    fee.token = token.id
    fee.amount = event.params.fee
    fee.pct = getBridgeFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }

  let feeUsd = rateInUsd(event.params.token, event.params.fee)
  smartVault.totalFeesUsd = smartVault.totalFeesUsd.plus(feeUsd)
  smartVault.save()

  trackGlobalFees(feeUsd)
  trackTransactionCost(event, smartVault, false)
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
  feed.feed = event.params.feed.toHexString()
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

export function handleBridgeConnectorSet(event: BridgeConnectorSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  smartVault.bridgeConnector = event.params.bridgeConnector.toHexString()
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

  smartVault.performanceFee = performanceFee.id
  smartVault.save()
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

  smartVault.withdrawFee = withdrawFee.id
  smartVault.save()
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

  smartVault.swapFee = swapFee.id
  smartVault.save()
}

export function handleBridgeFeeSet(event: BridgeFeeSet): void {
  let smartVault = loadOrCreateSmartVault(event.address)
  let bridgeFeeId = smartVault.id + '/bridge-fee'
  let bridgeFee = FeeConfig.load(bridgeFeeId)

  if (bridgeFee === null) {
    bridgeFee = new FeeConfig(bridgeFeeId)
    bridgeFee.smartVault = smartVault.id
  }

  bridgeFee.pct = event.params.pct
  bridgeFee.cap = event.params.cap
  bridgeFee.token = loadOrCreateERC20(event.params.token).id
  bridgeFee.period = event.params.period
  bridgeFee.save()

  smartVault.bridgeFee = bridgeFee.id
  smartVault.save()
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

function getBridgeFeePct(address: Address): BigInt {
  let wallet = SmartVaultContract.bind(address)
  let bridgeFeeCall = wallet.try_bridgeFee()

  if (!bridgeFeeCall.reverted) {
    return bridgeFeeCall.value.value0
  }

  log.warning('bridgeFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

export function loadOrCreateSmartVault(address: Address): SmartVault {
  let id = address.toHexString()
  let smartVault = SmartVault.load(id)

  if (smartVault === null) {
    smartVault = new SmartVault(id)
    smartVault.strategies = []
    smartVault.priceOracle = ZERO_ADDRESS.toHexString()
    smartVault.swapConnector = ZERO_ADDRESS.toHexString()
    smartVault.bridgeConnector = ZERO_ADDRESS.toHexString()
    smartVault.feeCollector = ZERO_ADDRESS.toHexString()
    smartVault.wrappedNativeToken = loadOrCreateERC20(getWrappedNativeToken(address)).id
    smartVault.totalValueManaged = BigInt.zero()
    smartVault.totalFeesUsd = BigInt.zero()
    smartVault.totalGasRefundsUsd = BigInt.zero()
    smartVault.totalRelayedCostUsd = BigInt.zero()
    smartVault.save()
  }

  return smartVault
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

function createMovementIn(
  event: ethereum.Event,
  index: number,
  execution: PrimitiveExecution,
  token: ERC20,
  amount: BigInt
): void {
  createMovement('In', event, index, execution, token, amount)

  let smartVault = loadOrCreateSmartVault(event.address)
  let balance = loadOrCreateBalance(smartVault, token)
  balance.amount = balance.amount.minus(amount)
  balance.save()
}

function createMovementOut(
  event: ethereum.Event,
  index: number,
  execution: PrimitiveExecution,
  token: ERC20,
  amount: BigInt
): void {
  createMovement('Out', event, index, execution, token, amount)

  let smartVault = loadOrCreateSmartVault(event.address)
  let balance = loadOrCreateBalance(smartVault, token)
  balance.amount = balance.amount.plus(amount)
  balance.save()
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

function trackTransactionCost(event: ethereum.Event, smartVault: SmartVault, relayed: boolean): TransactionCost {
  let id = event.transaction.hash.toHexString()
  let transaction = TransactionCost.load(id)

  if (transaction == null) {
    transaction = new TransactionCost(id)
    transaction.smartVault = smartVault.id
    transaction.gasUsed = BigInt.zero()
    transaction.gasPrice = BigInt.zero()
    transaction.costEth = BigInt.zero()
    transaction.costUsd = BigInt.zero()
    transaction.relayer = (relayed ? event.transaction.from : ZERO_ADDRESS).toHexString()
  }

  if (transaction.gasUsed.isZero()) transaction.gasUsed = event.receipt!.gasUsed
  if (transaction.gasPrice.isZero()) transaction.gasPrice = event.transaction.gasPrice
  if (transaction.costEth.isZero()) transaction.costEth = transaction.gasPrice.times(transaction.gasUsed)
  if (transaction.costUsd.isZero()) transaction.costUsd = rateInUsd(WETH, transaction.costEth)
  transaction.save()

  return transaction
}

function trackGlobalFees(feeUsd: BigInt): void {
  trackGlobalStats(BigInt.zero(), feeUsd, BigInt.zero(), BigInt.zero())
}

function trackGlobalStats(valueManagedUsd: BigInt, feeUsd: BigInt, gasRefundUsd: BigInt, relayedCostUsd: BigInt): void {
  let stats = Stats.load('MIMIC_STATS')

  if (stats == null) {
    stats = new Stats('MIMIC_STATS')
    stats.totalFeesUsd = BigInt.zero()
    stats.totalGasRefundsUsd = BigInt.zero()
    stats.totalRelayedCostUsd = BigInt.zero()
    stats.save()
  }

  stats.totalValueManaged = stats.totalValueManaged.plus(valueManagedUsd)
  stats.totalFeesUsd = stats.totalFeesUsd.plus(feeUsd)
  stats.totalGasRefundsUsd = stats.totalGasRefundsUsd.plus(gasRefundUsd)
  stats.totalRelayedCostUsd = stats.totalRelayedCostUsd.plus(relayedCostUsd)
  stats.save()
}

function getTransactionId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '/' + event.transactionLogIndex.toString()
}
