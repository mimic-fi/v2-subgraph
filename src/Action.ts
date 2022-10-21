import { Action, ActionExecution } from '../types/schema'
import { Executed, Authorized, Unauthorized } from '../types/templates/Action/Action'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

export function handleExecuted(event: Executed): void {
  let action = Action.load(event.address.toHexString())!
  let id = event.address.toHexString() + '/executions/' + event.transaction.hash.toHexString()
  let execution = new ActionExecution(id)
  execution.vault = action.vault
  execution.action = action.id
  execution.executor = event.transaction.from.toHexString()
  execution.executedAt = event.block.timestamp
  execution.transaction = event.transaction.hash.toHexString()
  execution.save()
}

export function handleAuthorized(event: Authorized): void {
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}
