import { Address, log } from '@graphprotocol/graph-ts'

import { SmartVault as SmartVaultTemplate } from '../types/templates'
import { Registry as RegistryContract } from '../types/Registry/Registry'
import { Cloned } from '../types/Registry/Registry'

import { loadOrCreateSmartVault } from './SmartVault'

const SMART_VAULT_NAMESPACE = '0xdd327ba0ba6e7bb0e0099273577340e52e9e071b1b87834b866bafccdc4c14cb'

export function handleCloned(event: Cloned): void {
  let namespace = getImplementationNamespace(event.address, event.params.implementation)
  if (namespace == SMART_VAULT_NAMESPACE) {
    log.warning('New smart vault {}', [event.params.instance.toHexString()])
    SmartVaultTemplate.create(event.params.instance)
    loadOrCreateSmartVault(event)
  }
}

function getImplementationNamespace(address: Address, implementation: Address): string {
  let registryContract = RegistryContract.bind(address)
  let implementationDataCall = registryContract.try_implementationData(implementation)

  if (!implementationDataCall.reverted) {
    return implementationDataCall.value.value2.toHexString()
  }

  log.warning('implementationData() call reverted for {}', [implementation.toHexString()])
  return '0x0000000000000000000000000000000000000000000000000000000000000000'
}
