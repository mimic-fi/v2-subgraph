import { Address } from '@graphprotocol/graph-ts'

import {
  isArbitrum,
  isAvalanche,
  isBinance,
  isEthNetwork,
  isFantom,
  isGnosis,
  isGoerli,
  isMainnet,
  isMaticNetwork,
  isMumbai, isOptimism,
  isPolygon
} from './Networks'

export const NATIVE_TOKEN_ADDRESS = Address.fromString('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')

export function getUsdc(): Address {
  return Address.fromString(getUsdcAddress())
}

export function getWeth(): Address {
  return Address.fromString(getWethAddress())
}

function getUsdcAddress(): string {
  if (isMainnet()) return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  if (isPolygon()) return '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
  if (isOptimism()) return '0x7f5c764cbc14f9669b88837ca1490cca17c31607'
  if (isArbitrum()) return '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
  if (isAvalanche()) return '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
  if (isBinance()) return '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
  if (isFantom()) return '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75'
  if (isGnosis()) return '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'
  if (isGoerli()) return '0x98339D8C260052B7ad81c28c16C0b98420f2B46a'
  if (isMumbai()) return '0x6D4dd09982853F08d9966aC3cA4Eb5885F16f2b2'
  return '0x0000000000000000000000000000000000000000'
}

function getWethAddress(): string {
  if (isMainnet()) return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  if (isPolygon()) return '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
  if (isOptimism()) return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  if (isArbitrum()) return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  if (isAvalanche()) return '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'
  if (isBinance()) return '0x4DB5a66E937A9F4473fA95b1cAF1d1E1D62E29EA'
  if (isFantom()) return '0x74b23882a30290451A17c44f4F05243b6b58C76d'
  if (isGnosis()) return '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1'
  if (isGoerli()) return '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
  if (isMumbai()) return '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
  return '0x0000000000000000000000000000000000000000'
}

export function getNativeTokenSymbol(): string {
  if (isEthNetwork()) return 'ETH'
  if (isMaticNetwork()) return 'MATIC'
  if (isAvalanche()) return 'AVAX'
  if (isBinance()) return 'BNB'
  if (isFantom()) return 'FTM'
  if (isGnosis()) return 'DAI'
  return 'Unknown'
}

export function getNativeTokenName(): string {
  if (isEthNetwork()) return 'Ether'
  if (isMaticNetwork()) return 'Matic'
  if (isAvalanche()) return 'Avax'
  if (isBinance()) return 'BNB'
  if (isFantom()) return 'Fantom'
  if (isGnosis()) return 'Dai'
  return 'Unknown'
}
