import {Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { Wallet as WalletContract } from '../types/templates/Wallet/Wallet'
import { Strategy as StrategyContract } from '../types/templates/Wallet/Strategy'
import { Balance, ERC20, FeeConfig, FeePaid, PriceFeed, PrimitiveExecution, Wallet } from '../types/schema'
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
} from '../types/templates/Wallet/Wallet'


const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')

import { loadOrCreateERC20, loadOrCreateNativeToken } from './ERC20'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

export function handleCall(event: Call): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Call'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleCollect(event: Collect): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let token = loadOrCreateERC20(event.params.token)
  let balance = loadOrCreateBalance(wallet, token)

  balance.amount = balance.amount.plus(event.params.collected)
  balance.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Collect'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenIn = token.id
  execution.amountIn = event.params.collected
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleWithdraw(event: Withdraw): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let token = loadOrCreateERC20(event.params.token)
  let balance = loadOrCreateBalance(wallet, token)

  balance.amount = balance.amount.minus(event.params.withdrawn)
  balance.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Withdraw'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenOut = token.id
  execution.amountOut = event.params.withdrawn
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  if (!event.params.fee.isZero()) {
    let feeId = wallet.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.vault = wallet.vault
    fee.wallet = wallet.id
    fee.primitive = execution.id
    fee.token = token.id
    fee.amount = event.params.fee
    fee.pct = getWithdrawFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleWrap(event: Wrap): void {
  let wallet = Wallet.load(event.address.toHexString())!

  let tokenOut = loadOrCreateNativeToken()
  let balanceOut = loadOrCreateBalance(wallet, tokenOut)
  balanceOut.amount = balanceOut.amount.minus(event.params.wrapped)
  balanceOut.save()

  let tokenIn = ERC20.load(wallet.wrappedNativeToken)!
  let balanceIn = loadOrCreateBalance(wallet, tokenIn)
  balanceIn.amount = balanceIn.amount.plus(event.params.wrapped)
  balanceIn.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Wrap'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenOut = tokenOut.id
  execution.amountOut = event.params.wrapped
  execution.tokenIn = tokenIn.id
  execution.amountIn = event.params.wrapped
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleUnwrap(event: Unwrap): void {
  let wallet = Wallet.load(event.address.toHexString())!

  let tokenOut = ERC20.load(wallet.wrappedNativeToken)!
  let balanceOut = loadOrCreateBalance(wallet, tokenOut)
  balanceOut.amount = balanceOut.amount.minus(event.params.unwrapped)
  balanceOut.save()

  let tokenIn = loadOrCreateNativeToken()
  let balanceIn = loadOrCreateBalance(wallet, tokenIn)
  balanceIn.amount = balanceIn.amount.plus(event.params.unwrapped)
  balanceIn.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Unwrap'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenOut = tokenOut.id
  execution.amountOut = event.params.unwrapped
  execution.tokenIn = tokenIn.id
  execution.amountIn = event.params.unwrapped
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleClaim(event: Claim): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let eventTokens = event.params.tokens
  let eventAmounts = event.params.amounts

  for (let i: i32 = 0; i < eventTokens.length; i++) {
    let tokenIn = loadOrCreateNativeToken()
    let balance = loadOrCreateBalance(wallet, tokenIn)
    balance.amount = balance.amount.plus(eventAmounts[i])
    balance.save()

    let executionId = wallet.id + '/executions/' + getTransactionId(event) + '/' + i.toString()
    let execution = new PrimitiveExecution(executionId)
    execution.type = 'Claim'
    execution.vault = wallet.vault
    execution.wallet = wallet.id
    execution.tokenIn = tokenIn.id
    execution.amountIn = eventAmounts[i]
    execution.data = event.params.data.toHexString()
    execution.executedAt = event.block.timestamp
    execution.transaction = event.transaction.hash.toHexString()
    execution.save()
  }
}

export function handleJoin(event: Join): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let token = loadOrCreateERC20(getStrategyToken(event.params.strategy))
  let balance = loadOrCreateBalance(wallet, token)

  balance.amount = balance.amount.minus(event.params.invested)
  balance.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Join'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenOut = token.id
  execution.amountOut = event.params.invested
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  // TODO: handle liquidity pool tokens
}

export function handleExit(event: Exit): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let token = loadOrCreateERC20(getStrategyToken(event.params.strategy))
  let balance = loadOrCreateBalance(wallet, token)

  balance.amount = balance.amount.plus(event.params.received)
  balance.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Exit'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenIn = token.id
  execution.amountIn = event.params.received
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  // TODO: handle liquidity pool tokens

  if (!event.params.fee.isZero()) {
    let feeId = wallet.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.vault = wallet.vault
    fee.wallet = wallet.id
    fee.primitive = execution.id
    fee.token = token.id
    fee.amount = event.params.fee
    fee.pct = getPerformanceFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleSwap(event: Swap): void {
  let wallet = Wallet.load(event.address.toHexString())!

  // The token in for the swap is the token out in the wallet
  let tokenOut = loadOrCreateERC20(event.params.tokenIn)
  let balanceOut = loadOrCreateBalance(wallet, tokenOut)
  balanceOut.amount = balanceOut.amount.minus(event.params.amountIn)
  balanceOut.save()

  // The token in for the swap is the token out in the wallet
  let tokenIn = loadOrCreateERC20(event.params.tokenOut)
  let balanceIn = loadOrCreateBalance(wallet, tokenIn)
  balanceIn.amount = balanceIn.amount.plus(event.params.amountOut)
  balanceIn.save()

  let executionId = wallet.id + '/executions/' + getTransactionId(event)
  let execution = new PrimitiveExecution(executionId)
  execution.type = 'Swap'
  execution.vault = wallet.vault
  execution.wallet = wallet.id
  execution.tokenIn = tokenIn.id
  execution.amountIn = event.params.amountOut
  execution.tokenOut = tokenOut.id
  execution.amountOut = event.params.amountIn
  execution.data = event.params.data.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()

  // TODO: handle liquidity pool tokens

  if (!event.params.fee.isZero()) {
    let feeId = wallet.id + '/paid-fees/' + getTransactionId(event)
    let fee = new FeePaid(feeId)
    fee.vault = wallet.vault
    fee.wallet = wallet.id
    fee.primitive = execution.id
    fee.token = tokenIn.id
    fee.amount = event.params.fee
    fee.pct = getSwapFeePct(event.address)
    fee.feeCollector = getFeeCollector(event.address)
    fee.save()
  }
}

export function handleStrategySet(event: StrategySet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let strategies = wallet.strategies

  let strategy = event.params.strategy.toHexString()
  let index = strategies.indexOf(strategy)
  if (event.params.allowed && index < 0) strategies.push(strategy)
  else if (!event.params.allowed && index >= 0) strategies.splice(index, 1)

  wallet.strategies = strategies
  wallet.save()
}

export function handlePriceOracleSet(event: PriceOracleSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  wallet.priceOracle = event.params.priceOracle.toHexString()
  wallet.save()
}

export function handlePriceFeedSet(event: PriceFeedSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let feedId = wallet.id + '/feeds/' + event.params.base.toHexString() + '/' + event.params.quote.toHexString()
  let feed = new PriceFeed(feedId)
  feed.base = event.params.base.toHexString()
  feed.quote = event.params.quote.toHexString()
  feed.vault = wallet.vault
  feed.wallet = wallet.id
  feed.save()
}

export function handleSwapConnectorSet(event: SwapConnectorSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  wallet.swapConnector = event.params.swapConnector.toHexString()
  wallet.save()
}

export function handleFeeCollectorSet(event: FeeCollectorSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  wallet.feeCollector = event.params.feeCollector.toHexString()
  wallet.save()
}

export function handlePerformanceFeeSet(event: PerformanceFeeSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let performanceFeeId = wallet.id + '/performance-fee'
  let performanceFee = FeeConfig.load(performanceFeeId)

  if (performanceFee === null) {
    performanceFee = new FeeConfig(performanceFeeId)
    performanceFee.vault = wallet.vault
    performanceFee.wallet = wallet.id
  }

  performanceFee.pct = event.params.pct
  performanceFee.cap = event.params.cap
  performanceFee.token = loadOrCreateERC20(event.params.token).id
  performanceFee.period = event.params.period
  performanceFee.save()
}

export function handleWithdrawFeeSet(event: WithdrawFeeSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let withdrawFeeId = wallet.id + '/withdraw-fee'
  let withdrawFee = FeeConfig.load(withdrawFeeId)

  if (withdrawFee === null) {
    withdrawFee = new FeeConfig(withdrawFeeId)
    withdrawFee.vault = wallet.vault
    withdrawFee.wallet = wallet.id
  }

  withdrawFee.pct = event.params.pct
  withdrawFee.cap = event.params.cap
  withdrawFee.token = loadOrCreateERC20(event.params.token).id
  withdrawFee.period = event.params.period
  withdrawFee.save()
}

export function handleSwapFeeSet(event: SwapFeeSet): void {
  let wallet = Wallet.load(event.address.toHexString())!
  let swapFeeId = wallet.id + '/swap-fee'
  let swapFee = FeeConfig.load(swapFeeId)

  if (swapFee === null) {
    swapFee = new FeeConfig(swapFeeId)
    swapFee.vault = wallet.vault
    swapFee.wallet = wallet.id
  }

  swapFee.pct = event.params.pct
  swapFee.cap = event.params.cap
  swapFee.token = loadOrCreateERC20(event.params.token).id
  swapFee.period = event.params.period
  swapFee.save()
}

export function handleAuthorized(event: Authorized): void {
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}

function loadOrCreateBalance(wallet: Wallet, token: ERC20): Balance {
  let id = wallet.id + '/balances/' + token.id
  let balance = Balance.load(id)

  if (balance === null) {
    balance = new Balance(id)
    balance.vault = wallet.vault
    balance.wallet = wallet.id
    balance.token = token.id
    balance.amount = BigInt.zero()
    balance.save()
  }

  return balance
}

export function getWrappedNativeToken(address: Address): Address {
  let wallet = WalletContract.bind(address)
  let wrappedNativeTokenCall = wallet.try_wrappedNativeToken()

  if (!wrappedNativeTokenCall.reverted) {
    return wrappedNativeTokenCall.value
  }

  log.warning('wrappedNativeToken() call reverted for {}', [address.toHexString()])
  return Address.fromString('0x0000000000000000000000000000000000000000')
}

function getFeeCollector(address: Address): string {
  let wallet = WalletContract.bind(address)
  let feeCollectorCall = wallet.try_feeCollector()

  if (!feeCollectorCall.reverted) {
    return feeCollectorCall.value.toHexString()
  }

  log.warning('feeCollector() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}

function getWithdrawFeePct(address: Address): BigInt {
  let wallet = WalletContract.bind(address)
  let withdrawFeeCall = wallet.try_withdrawFee()

  if (!withdrawFeeCall.reverted) {
    return withdrawFeeCall.value.value0
  }

  log.warning('withdrawFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

function getPerformanceFeePct(address: Address): BigInt {
  let wallet = WalletContract.bind(address)
  let performanceFeeCall = wallet.try_performanceFee()

  if (!performanceFeeCall.reverted) {
    return performanceFeeCall.value.value0
  }

  log.warning('performanceFee() call reverted for {}', [address.toHexString()])
  return BigInt.zero()
}

function getSwapFeePct(address: Address): BigInt {
  let wallet = WalletContract.bind(address)
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
