import { Action, Wallet } from '../types/schema'
import { Action as ActionTemplate, Wallet as WalletTemplate } from '../types/templates'
import { WalletSet, ActionSet, Authorized, Unauthorized } from '../types/templates/SmartVault/SmartVault'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'
import { getWrappedNativeToken } from './Wallet'
import {loadOrCreateERC20} from './ERC20'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function handleWalletSet(event: WalletSet): void {
  let id = event.params.wallet.toHexString()
  let wallet = Wallet.load(id)

  if (wallet === null) {
    WalletTemplate.create(event.params.wallet)

    wallet = new Wallet(event.params.wallet.toHexString())
    wallet.vault = event.address.toHexString()
    wallet.strategies = []
    wallet.priceOracle = ZERO_ADDRESS
    wallet.feeCollector = ZERO_ADDRESS
    wallet.swapConnector = ZERO_ADDRESS
    wallet.wrappedNativeToken = loadOrCreateERC20(getWrappedNativeToken(event.params.wallet)).id
    wallet.save()
  }
}

export function handleActionSet(event: ActionSet): void {
  let id = event.params.action.toHexString()
  let action = Action.load(id)

  if (action === null) {
    ActionTemplate.create(event.params.action)
    action = new Action(id)
    action.vault = event.address.toHexString()
  }

  action.allowed = event.params.whitelisted
  action.save()
}

export function handleAuthorized(event: Authorized): void {
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}
