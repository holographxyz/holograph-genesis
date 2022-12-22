import { BigNumber } from '@ethersproject/bignumber';
import { Block, BlockWithTransactions } from '@ethersproject/abstract-provider';
import { WebSocketProvider, JsonRpcProvider } from '@ethersproject/providers';
import { NetworkKeys, networks } from '@holographxyz/networks';

export type GasPricing = {
  isEip1559: boolean;
  // For non EIP-1559 transactions
  gasPrice: BigNumber | null;
  // For EIP-1559 transactions
  nextBlockFee: BigNumber | null;
  // For EIP-1559 transactions
  nextPriorityFee: BigNumber | null;
  // For EIP-1559 transactions
  maxFeePerGas: BigNumber | null;

  lowestBlockFee: BigNumber | null;
  averageBlockFee: BigNumber | null;
  highestBlockFee: BigNumber | null;

  lowestPriorityFee: BigNumber | null;
  averagePriorityFee: BigNumber | null;
  highestPriorityFee: BigNumber | null;
};

// Implemented from https://eips.ethereum.org/EIPS/eip-1559
export function calculateNextBlockFee(parent: Block | BlockWithTransactions): BigNumber {
  const zero: BigNumber = BigNumber.from('0');
  if (parent.baseFeePerGas === undefined) {
    return zero;
  }

  const one: BigNumber = BigNumber.from('1');
  const elasticityMultiplier: BigNumber = BigNumber.from('2');
  const baseFeeMaxChangeDenominator: BigNumber = BigNumber.from('8');
  const baseFeePerGas: BigNumber = parent.baseFeePerGas!;
  const parentGasTarget: BigNumber = parent.gasLimit.div(elasticityMultiplier);
  if (parent.gasUsed.eq(parentGasTarget)) {
    return baseFeePerGas;
  }

  let gasUsedDelta: BigNumber;
  let baseFeeDelta: BigNumber;

  // If the parent block used more gas than its target, the baseFee should increase.
  if (parent.gasUsed.gt(parentGasTarget)) {
    gasUsedDelta = parent.gasUsed.sub(parentGasTarget);
    baseFeeDelta = baseFeePerGas.mul(gasUsedDelta).div(parentGasTarget).div(baseFeeMaxChangeDenominator);
    if (one.gt(baseFeeDelta)) {
      baseFeeDelta = one;
    }

    return baseFeePerGas.add(baseFeeDelta);
  }

  // Otherwise if the parent block used less gas than its target, the baseFee should decrease.
  gasUsedDelta = parentGasTarget.sub(parent.gasUsed);
  baseFeeDelta = baseFeePerGas.mul(gasUsedDelta).div(parentGasTarget).div(baseFeeMaxChangeDenominator);

  return baseFeePerGas.sub(baseFeeDelta);
}

// This function is here to accomodate instances where a network has a minimum BaseBlockFee
export function adjustBaseBlockFee(network: string, baseBlockFee: BigNumber): BigNumber {
  // Avalanche has a minimum BaseBlockFee of 25 GWEI
  // https://docs.avax.network/quickstart/transaction-fees#base-fee
  if (
    (network === networks['avalanche' as NetworkKeys].key ||
      network === networks['avalancheTestnet' as NetworkKeys].key) &&
    baseBlockFee.lt(BigNumber.from('25000000000'))
  ) {
    return BigNumber.from('25000000000');
  }
  // Arbitrum has a minimum BaseBlockFee of 0.1 GWEI
  else if (
    (network === networks['arbitrum' as NetworkKeys].key ||
      network === networks['arbitrumTestnetGoerli' as NetworkKeys].key) &&
    baseBlockFee.lt(BigNumber.from('100000000'))
  ) {
    return BigNumber.from('100000000');
  }
  else if (
    (network === networks['canto' as NetworkKeys].key ||
      network === networks['cantoTestnet' as NetworkKeys].key) &&
    baseBlockFee.lt(BigNumber.from('100000000000'))
  ) {
    return BigNumber.from('100000000000');
  }
  else if (
    (network === networks['kekChain' as NetworkKeys].key ||
      network === networks['kekChainTestnet' as NetworkKeys].key) &&
    baseBlockFee.lt(BigNumber.from('1500000000'))
  ) {
    return BigNumber.from('1500000000');
  }
  else if (
    (network === networks['bobaEthereumTestnetGoerli' as NetworkKeys].key ||
      network === networks['bobaAvalancheTestnet' as NetworkKeys].key ||
      network === networks['bobaBinanceChainTestnet' as NetworkKeys].key ||
      network === networks['bobaMoonbeamTestnet' as NetworkKeys].key ||
      network === networks['bobaFantomTestnet' as NetworkKeys].key) &&
    baseBlockFee.lt(BigNumber.from('1000000000'))
  ) {
    return BigNumber.from('1000000000');
  }
  else if (
    network === networks['ethereumTestnetRinkeby' as NetworkKeys].key &&
    baseBlockFee.lt(BigNumber.from('1500000000'))
  ) {
    return BigNumber.from('1500000000');
  }

  return baseBlockFee;
}

export async function initializeGasPricing(
  network: string,
  provider: JsonRpcProvider | WebSocketProvider
): Promise<GasPricing> {
  const block: Block = await provider.getBlock('latest');
  const gasPrices: GasPricing = updateGasPricing(network, block, {
    isEip1559: false,
    gasPrice: null,
    nextBlockFee: null,
    nextPriorityFee: null,
    maxFeePerGas: null,
    lowestBlockFee: null,
    averageBlockFee: null,
    highestBlockFee: null,
    lowestPriorityFee: null,
    averagePriorityFee: null,
    highestPriorityFee: null,
  } as GasPricing);
  if (!gasPrices.isEip1559) {
    // need to replace this with internal calculations
    gasPrices.gasPrice = await provider.getGasPrice();
  }

  return gasPrices;
}

export function updateGasPricing(
  network: string,
  block: Block | BlockWithTransactions,
  gasPricing: GasPricing
): GasPricing {
  if (block.baseFeePerGas) {
    gasPricing.isEip1559 = true;
    gasPricing.nextBlockFee = adjustBaseBlockFee(network, calculateNextBlockFee(block));
    gasPricing.maxFeePerGas = gasPricing.nextBlockFee!;
    if (gasPricing.nextPriorityFee === null) {
      gasPricing.nextPriorityFee = BigNumber.from('0');
      gasPricing.gasPrice = gasPricing.nextBlockFee;
    } else {
      gasPricing.maxFeePerGas = gasPricing.nextBlockFee!.add(gasPricing.nextPriorityFee!);
      gasPricing.gasPrice = gasPricing.maxFeePerGas;
    }
  } else {
    if (gasPricing.gasPrice == null) {
      gasPricing.gasPrice = BigNumber.from('0');
    }
    gasPricing.gasPrice = adjustBaseBlockFee(network, gasPricing.gasPrice);
  }

  return gasPricing;
}
