import { Address, log } from '@graphprotocol/graph-ts'

import { ERC20 as ERC20Entity } from '../types/schema'
import { ERC20 as ERC20Contract } from '../types/Registry/ERC20'

const NATIVE_TOKEN_ADDRESS = Address.fromString('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')

export function loadOrCreateNativeToken(): ERC20Entity {
  let id = NATIVE_TOKEN_ADDRESS.toHexString()
  let erc20 = ERC20Entity.load(id)

  if (erc20 === null) {
    erc20 = new ERC20Entity(id)
    erc20.name = 'Native Token'
    erc20.symbol = 'NTK'
    erc20.decimals = 18
    erc20.save()
  }

  return erc20
}

export function loadOrCreateERC20(address: Address): ERC20Entity {
  if (address.equals(NATIVE_TOKEN_ADDRESS)) return loadOrCreateNativeToken()

  let id = address.toHexString()
  let erc20 = ERC20Entity.load(id)

  if (erc20 === null) {
    erc20 = new ERC20Entity(id)
    erc20.name = getERC20Name(address)
    erc20.symbol = getERC20Symbol(address)
    erc20.decimals = getERC20Decimals(address)
    erc20.save()
  }

  return erc20
}

function getERC20Decimals(address: Address): i32 {
  let erc20Contract = ERC20Contract.bind(address)
  let decimalsCall = erc20Contract.try_decimals()

  if (!decimalsCall.reverted) {
    return decimalsCall.value
  }

  log.warning('decimals() call reverted for {}', [address.toHexString()])
  return 0
}

function getERC20Name(address: Address): string {
  let erc20Contract = ERC20Contract.bind(address)
  let nameCall = erc20Contract.try_name()

  if (!nameCall.reverted) {
    return nameCall.value
  }

  log.warning('name() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}

function getERC20Symbol(address: Address): string {
  let erc20Contract = ERC20Contract.bind(address)
  let symbolCall = erc20Contract.try_symbol()

  if (!symbolCall.reverted) {
    return symbolCall.value
  }

  log.warning('symbol() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}
