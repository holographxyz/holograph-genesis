declare var global: any;
import { Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, Deployment } from '@holographxyz/hardhat-deploy-holographed/types';
import { networks } from '@holographxyz/networks';
import { txParams } from '../scripts/utils/helpers';
import { SuperColdStorageSigner } from 'super-cold-storage-signer';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const accounts = await hre.ethers.getSigners();
  let deployer: SignerWithAddress | SuperColdStorageSigner = accounts[0];

  if (global.__superColdStorage) {
    // address, domain, authorization, ca
    const coldStorage = global.__superColdStorage;
    deployer = new SuperColdStorageSigner(
      coldStorage.address,
      'https://' + coldStorage.domain,
      coldStorage.authorization,
      deployer.provider,
      coldStorage.ca
    );
  }

  let holographGenesis: Contract = await hre.ethers.getContract('HolographGenesis', deployer);

  let getSignedRawTx = async (nonce: number, approveDeployer: string): Promise<string> => {
    let txRequest: TransactionRequest = {
      to: holographGenesis.address,
      from: deployer.address,
      nonce,
      gasLimit: 100000,
      gasPrice: 0,
      data: (await holographGenesis.populateTransaction.approveDeployer(approveDeployer, true)).data,
      value: 0,
      chainId: networks[hre.network.name].chain,
    } as TransactionRequest;
    txRequest = await deployer.populateTransaction(txRequest);
    let sig = await deployer.signTransaction(txRequest);
    process.stdout.write('\n\n' + JSON.stringify(sig, undefined, 2) + '\n\n');
    await hre.ethers.provider.sendTransaction(sig);
    process.exit();
    return sig as string;
  };

  if (hre.network.name == 'localhost') {
    //await getSignedRawTx('0xC0FFEE78121f208475ABDd2cf0853a7afED64749', 1);
    // enable 0xC0FFEE78121f208475ABDd2cf0853a7afED64749 on localhost
    await hre.ethers.provider.sendTransaction(
      [
        '0x',
        'f8a70180830186a0940c8af56f7650a6e3685188d212044338c21d3f7380b844',
        'a07d7316000000000000000000000000c0ffee78121f208475abdd2cf0853a7a',
        'fed6474900000000000000000000000000000000000000000000000000000000',
        '00000001820a98a0b368d7739967c121cba8f37dfe889d8abc92c00fc9911266',
        '2a3a317965b37ecca07a4339634975930a18521ffe3d2eb2913cd9bb08858c72',
        'a558d9df7429a937c8',
      ].join('')
    );
    //await getSignedRawTx('0xdf5295149F367b1FBFD595bdA578BAd22e59f504', 2);
    // enable 0xdf5295149F367b1FBFD595bdA578BAd22e59f504 on localhost
    await hre.ethers.provider.sendTransaction(
      [
        '0x',
        'f8a70280830186a0940c8af56f7650a6e3685188d212044338c21d3f7380b844',
        'a07d7316000000000000000000000000df5295149f367b1fbfd595bda578bad2',
        '2e59f50400000000000000000000000000000000000000000000000000000000',
        '00000001820a98a0f0e433a1a287674ce73e27843cd73dd4ee59e862bf675a51',
        '381a4172796ee98aa03382f39928b8be21ce8e2583428d5b920e83936c3255c5',
        'a77910b91fe796f0d8',
      ].join('')
    );
  } else if (hre.network.name == 'localhost2') {
    //await getSignedRawTx('0xC0FFEE78121f208475ABDd2cf0853a7afED64749', 1);
    // enable 0xC0FFEE78121f208475ABDd2cf0853a7afED64749 on localhost2
    await hre.ethers.provider.sendTransaction(
      [
        '0x',
        'f8a70180830186a0940c8af56f7650a6e3685188d212044338c21d3f7380b844',
        'a07d7316000000000000000000000000c0ffee78121f208475abdd2cf0853a7a',
        'fed6474900000000000000000000000000000000000000000000000000000000',
        '00000001820a9aa0fdad2831e1ead5069c2c6e28e62afe0b1d563bc4242312bb',
        '555b0388003f89d8a01aa43771970f8bc0bf421a3bbbe76f43df751844cad394',
        'e80a8eb2d8b7cf1acc',
      ].join('')
    );
    //await getSignedRawTx('0xdf5295149F367b1FBFD595bdA578BAd22e59f504', 2);
    // enable 0xdf5295149F367b1FBFD595bdA578BAd22e59f504 on localhost2
    await hre.ethers.provider.sendTransaction(
      [
        '0x',
        'f8a70280830186a0940c8af56f7650a6e3685188d212044338c21d3f7380b844',
        'a07d7316000000000000000000000000df5295149f367b1fbfd595bda578bad2',
        '2e59f50400000000000000000000000000000000000000000000000000000000',
        '00000001820a99a0da75a4092b76b4061ddaad5166e0630fe20881abadc46496',
        'c614d9a9bc6f40c7a0056fcda9c2608868b7aee809f24f017077a974000ea8fb',
        '002ccb3e8cf98d4749',
      ].join('')
    );
  } else {
    if (!(await holographGenesis.isApprovedDeployer('0xC0FFEE78121f208475ABDd2cf0853a7afED64749'))) {
      //
      let tx = await holographGenesis.approveDeployer('0xC0FFEE78121f208475ABDd2cf0853a7afED64749', true, {
        ...(await txParams({
          hre,
          from: deployer,
          to: holographGenesis,
          data: holographGenesis.populateTransaction.approveDeployer(
            '0xC0FFEE78121f208475ABDd2cf0853a7afED64749',
            true
          ),
        })),
      });
      let receipt = await tx.wait();
    }
  }
};

export default func;
func.tags = ['GenesisDeployers'];
func.dependencies = ['HolographGenesis'];
