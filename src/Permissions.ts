import { Address, Bytes, log } from '@graphprotocol/graph-ts'

import { Grantee, Permission } from '../types/schema'
import { Action as ActionEntity } from '../types/schema'
import { Action as ActionTemplate } from '../types/templates'
import { Action as ActionContract } from '../types/templates/Action/Action'

export function processAuthorizedEvent(target: Address, method: Bytes, account: Address): void {
  let permission = loadOrCreatePermission(target, method)
  let grantee = loadOrCreateGrantee(account)

  let permissions = grantee.permissions
  permissions.push(permission.id)
  grantee.permissions = permissions
  grantee.save()
}

export function processUnauthorizedEvent(target: Address, method: Bytes, account: Address): void {
  let permission = loadOrCreatePermission(target, method)
  let grantee = loadOrCreateGrantee(account)

  let permissions = grantee.permissions
  let index = permissions.indexOf(permission.id)
  permissions.splice(index, 1)
  grantee.permissions = permissions
  grantee.save()
}

function loadOrCreatePermission(target: Address, method: Bytes): Permission {
  let permissionId = target.toHexString() + '/permissions/' + method.toHexString()
  let permission = Permission.load(permissionId)

  if (permission === null) {
    permission = new Permission(permissionId)
    permission.method = method.toHexString()
    permission.target = target.toHexString()
    permission.save()
  }

  return permission
}

function loadOrCreateGrantee(account: Address): Grantee {
  tryAction(account)
  let granteeId = account.toHexString()
  let grantee = Grantee.load(granteeId)

  if (grantee === null) {
    grantee = new Grantee(granteeId)
    grantee.permissions = []
    grantee.save()
  }

  return grantee
}

function tryAction(address: Address): void {
  let actionContract = ActionContract.bind(address)
  let smartVaultCall = actionContract.try_smartVault()

  if (!smartVaultCall.reverted) {
    let action = new ActionEntity(address.toHexString())
    action.smartVault = smartVaultCall.value.toHexString()
    action.save()

    log.warning('New smart vault action {}', [address.toHexString()])
    ActionTemplate.create(address)
  }
}
