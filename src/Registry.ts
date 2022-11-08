import { Address, log } from '@graphprotocol/graph-ts'

import { SmartVault as SmartVaultTemplate } from '../types/templates'
import { Implementation, Instance, Registry } from '../types/schema'
import { Registered, Deprecated, Cloned, Authorized, Unauthorized } from '../types/Registry/Registry'

import { loadOrCreateSmartVault } from './SmartVault'
import { processAuthorizedEvent, processUnauthorizedEvent } from './Permissions'

const SMART_VAULT_NAMESPACE = '0xdd327ba0ba6e7bb0e0099273577340e52e9e071b1b87834b866bafccdc4c14cb'

export function handleAuthorized(event: Authorized): void {
  loadOrCreateRegistry(event.address)
  processAuthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleUnauthorized(event: Unauthorized): void {
  loadOrCreateRegistry(event.address)
  processUnauthorizedEvent(event.address, event.params.what, event.params.who)
}

export function handleRegistered(event: Registered): void {
  let registry = loadOrCreateRegistry(event.address)
  let implementation = new Implementation(event.params.implementation.toHexString())
  implementation.registry = registry.id
  implementation.namespace = event.params.namespace.toHexString()
  implementation.stateless = event.params.stateless
  implementation.deprecated = false
  implementation.registrar = event.transaction.from.toHexString()
  implementation.createdAt = event.block.timestamp
  implementation.save()
}

export function handleDeprecated(event: Deprecated): void {
  let implementation = Implementation.load(event.params.implementation.toHexString())!
  implementation.deprecated = true
  implementation.save()
}

export function handleCloned(event: Cloned): void {
  let implementation = Implementation.load(event.params.implementation.toHexString())!

  let instance = new Instance(event.params.instance.toHexString())
  instance.implementation = implementation.id
  instance.creator = event.transaction.from.toHexString()
  instance.createdAt = event.block.timestamp
  instance.save()

  if (implementation.namespace == SMART_VAULT_NAMESPACE) {
    log.warning('New smart vault {}', [event.params.instance.toHexString()])
    SmartVaultTemplate.create(event.params.instance)
    loadOrCreateSmartVault(event.params.instance)
  }
}

function loadOrCreateRegistry(address: Address): Registry {
  let id = address.toHexString()
  let registry = Registry.load(id)

  if (registry === null) {
    registry = new Registry(id)
    registry.save()
  }

  return registry
}
