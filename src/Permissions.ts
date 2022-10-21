import { Address, Bytes } from '@graphprotocol/graph-ts'

import { Grantee, Permission } from '../types/schema'

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
  let granteeId = account.toHexString()
  let grantee = Grantee.load(granteeId)

  if (grantee === null) {
    grantee = new Grantee(granteeId)
    grantee.permissions = []
    grantee.save()
  }

  return grantee
}
