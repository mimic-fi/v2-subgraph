import { Authorized, Unauthorized } from '../types/templates/Action/Action'

import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

export function handleAuthorized(event: Authorized): void {
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}
