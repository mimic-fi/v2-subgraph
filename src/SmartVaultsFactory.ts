import { log } from '@graphprotocol/graph-ts'

import { SmartVault as SmartVaultTemplate } from '../types/templates'
import { Created } from '../types/SmartVaultsFactory/SmartVaultsFactory'

export function handleCreated(event: Created): void {
  log.warning('New smart vault {}', [event.params.instance.toHexString()])
  SmartVaultTemplate.create(event.params.instance)
}
