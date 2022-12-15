declare var global: any;
import fs from 'fs';
import '@typechain/hardhat';
import '@holographxyz/hardhat-deploy-holographed';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { types, task, HardhatUserConfig } from 'hardhat/config';
import '@holographxyz/hardhat-holograph-contract-builder';
import { BigNumber } from 'ethers';
import { Environment, getEnvironment } from '@holographxyz/environment';
import { NetworkType, Network, Networks, networks } from '@holographxyz/networks';
import { GasService } from './scripts/utils/gas-service';
import dotenv from 'dotenv';
dotenv.config();

function hex2buffer(input: string): Uin8Array {
  input = input.toLowerCase().trim();
  if (input.startsWith('0x')) {
    input = input.substring(2).trim();
  }
  if (input.length % 2 !== 0) {
    input = '0' + input;
  }
  let bytes: number[] = [];
  for (let i = 0; i < input.length; i += 2) {
    bytes.push(parseInt(input.substring(i, i + 2), 16));
  }
  return Uint8Array.from(bytes);
}

const currentEnvironment = Environment[getEnvironment()];
process.stdout.write(`\n👉 Environment: ${currentEnvironment}\n\n`);

const SOLIDITY_VERSION = process.env.SOLIDITY_VERSION || '0.8.13';

const MNEMONIC = process.env.MNEMONIC || 'test '.repeat(11) + 'junk';
const DEPLOYER = process.env.DEPLOYER || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

if (
  process.env.SUPER_COLD_STORAGE_ENABLED &&
  process.env.SUPER_COLD_STORAGE_ENABLED == 'true' &&
  process.env.npm_lifecycle_event == 'deploy'
) {
  global.__superColdStorage = {
    address: process.env.SUPER_COLD_STORAGE_ADDRESS,
    domain: process.env.SUPER_COLD_STORAGE_DOMAIN,
    authorization: process.env.SUPER_COLD_STORAGE_AUTHORIZATION, //String.fromCharCode.apply(null, hex2buffer(process.env.SUPER_COLD_STORAGE_AUTHORIZATION)),
    ca: String.fromCharCode.apply(null, hex2buffer(process.env.SUPER_COLD_STORAGE_CA)),
  };
}

const setDeployerKey = function (fallbackKey: string | number): string | number {
  if ('__superColdStorage' in global) {
    return ('super-cold-storage://' + global.__superColdStorage.address) as string;
  } else {
    return fallbackKey;
  }
};

const AVALANCHE_PRIVATE_KEY = process.env.AVALANCHE_PRIVATE_KEY || DEPLOYER;
const AVALANCHE_TESTNET_PRIVATE_KEY = process.env.AVALANCHE_TESTNET_PRIVATE_KEY || DEPLOYER;
const BINANCE_SMART_CHAIN_PRIVATE_KEY = process.env.BINANCE_SMART_CHAIN_PRIVATE_KEY || DEPLOYER;
const BINANCE_SMART_CHAIN_TESTNET_PRIVATE_KEY = process.env.BINANCE_SMART_CHAIN_TESTNET_PRIVATE_KEY || DEPLOYER;
const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || DEPLOYER;
const ETHEREUM_TESTNET_GOERLI_PRIVATE_KEY = process.env.ETHEREUM_TESTNET_GOERLI_PRIVATE_KEY || DEPLOYER;
const ETHEREUM_TESTNET_RINKEBY_PRIVATE_KEY = process.env.ETHEREUM_TESTNET_RINKEBY_PRIVATE_KEY || DEPLOYER;
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || DEPLOYER;
const POLYGON_TESTNET_PRIVATE_KEY = process.env.POLYGON_TESTNET_PRIVATE_KEY || DEPLOYER;

const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY || '';
const POLYGONSCAN_API_KEY: string = process.env.POLYGONSCAN_API_KEY || '';
const AVALANCHE_API_KEY: string = process.env.AVALANCHE_API_KEY || '';

const DEPLOYMENT_SALT = parseInt(process.env.DEPLOYMENT_SALT || '0');

const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH || 'deployments';

global.__DEPLOYMENT_SALT = '0x' + DEPLOYMENT_SALT.toString(16).padStart(64, '0');

// this task runs before the actual hardhat deploy task
task('deploy', 'Deploy contracts').setAction(async (args, hre, runSuper) => {
  // set gas parameters
  global.__gasLimitMultiplier = BigNumber.from(process.env.GAS_LIMIT_MULTIPLIER || '10000');
  global.__gasPriceMultiplier = BigNumber.from(process.env.GAS_PRICE_MULTIPLIER || '10000');
  global.__maxGasPrice = BigNumber.from(process.env.MAXIMUM_GAS_PRICE || '0');
  global.__maxGasBribe = BigNumber.from(process.env.MAXIMUM_GAS_BRIBE || '0');
  // start gas price monitoring service
  process.stdout.write('Loading Gas Price Service\n');
  const gasService: GasService = new GasService(hre.network.name, hre.ethers.provider, 'DEBUG' in process.env);
  process.stdout.write('Seeding Gas Price Service\n');
  await gasService.init();
  process.stdout.write('\nReady to start deployments\n');
  // run the actual hardhat deploy task
  return runSuper(args);
});

task('abi', 'Create standalone ABI files for all smart contracts')
  .addOptionalParam('silent', 'Provide less details in the output', false, types.boolean)
  .setAction(async (args, hre) => {
    if (!fs.existsSync('./artifacts')) {
      throw new Error('The directory "artifacts" was not found. Make sure you run "yarn compile" first.');
    }
    const recursiveDelete = function (dir: string) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (let i = 0, l = files.length; i < l; i++) {
        if (files[i].isDirectory()) {
          recursiveDelete(dir + '/' + files[i].name);
          fs.rmdirSync(dir + '/' + files[i].name);
        } else {
          fs.unlinkSync(dir + '/' + files[i].name);
        }
      }
    };
    const extractABIs = function (sourceDir: string, deployDir: string) {
      const files = fs.readdirSync(sourceDir, { withFileTypes: true });
      for (let i = 0, l = files.length; i < l; i++) {
        const file = files[i].name;
        if (files[i].isDirectory()) {
          extractABIs(sourceDir + '/' + file, deployDir);
        } else {
          if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
            if (!args.silent) {
              console.log(' -- exporting', file.split('.')[0], 'ABI');
            }
            const data = JSON.parse(fs.readFileSync(sourceDir + '/' + file, 'utf8')).abi;
            fs.writeFileSync(deployDir + '/' + file, JSON.stringify(data, undefined, 2));
          }
        }
      }
    };
    if (!fs.existsSync('./abi')) {
      fs.mkdirSync('./abi');
    }
    if (!fs.existsSync('./abi')) {
      fs.mkdirSync('./abi');
    } else {
      recursiveDelete('./abi');
    }
    extractABIs('./artifacts/contracts', './abi');
  });

/**
 * Go to https://hardhat.org/config/ to learn more
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  paths: {
    deployments: DEPLOYMENT_PATH,
  },
  defaultNetwork: 'localhost',
  networks: {
    localhost: {
      url: networks.localhost.rpc,
      chainId: networks.localhost.chain,
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 11,
        passphrase: '',
      },
      companionNetworks: {
        // https://github.com/wighawag/hardhat-deploy#companionnetworks
        l2: 'localhost2',
      },
      saveDeployments: false,
    },
    localhost2: {
      url: networks.localhost2.rpc,
      chainId: networks.localhost2.chain,
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 11,
        passphrase: '',
      },
      companionNetworks: {
        // https://github.com/wighawag/hardhat-deploy#companionnetworks
        l2: 'localhost',
      },
      saveDeployments: false,
    },
    avalanche: {
      url: networks.avalanche.rpc,
      chainId: networks.avalanche.chain,
      accounts: [AVALANCHE_PRIVATE_KEY],
    },
    avalancheTestnet: {
      url: networks.avalancheTestnet.rpc,
      chainId: networks.avalancheTestnet.chain,
      accounts: [AVALANCHE_TESTNET_PRIVATE_KEY],
    },
    binanceSmartChain: {
      url: networks.binanceSmartChain.rpc,
      chainId: networks.binanceSmartChain.chain,
      accounts: [BINANCE_SMART_CHAIN_PRIVATE_KEY],
    },
    binanceSmartChainTestnet: {
      url: networks.binanceSmartChainTestnet.rpc,
      chainId: networks.binanceSmartChainTestnet.chain,
      accounts: [BINANCE_SMART_CHAIN_TESTNET_PRIVATE_KEY],
    },
    ethereum: {
      url: networks.ethereum.rpc,
      chainId: networks.ethereum.chain,
      accounts: [ETHEREUM_PRIVATE_KEY],
    },
    ethereumTestnetRinkeby: {
      url: networks.ethereumTestnetRinkeby.rpc,
      chainId: networks.ethereumTestnetRinkeby.chain,
      accounts: [ETHEREUM_TESTNET_RINKEBY_PRIVATE_KEY],
    },
    ethereumTestnetGoerli: {
      url: networks.ethereumTestnetGoerli.rpc,
      chainId: networks.ethereumTestnetGoerli.chain,
      accounts: [ETHEREUM_TESTNET_GOERLI_PRIVATE_KEY],
    },
    polygon: {
      url: networks.polygon.rpc,
      chainId: networks.polygon.chain,
      accounts: [POLYGON_PRIVATE_KEY],
    },
    polygonTestnet: {
      url: networks.polygonTestnet.rpc,
      chainId: networks.polygonTestnet.chain,
      accounts: [POLYGON_TESTNET_PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: setDeployerKey(0),
    lzEndpoint: 10,
  },
  solidity: {
    version: SOLIDITY_VERSION,
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },
  mocha: {
    timeout: 1000 * 60 * 60,
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      rinkeby: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      avalanche: AVALANCHE_API_KEY,
      avalancheFujiTestnet: AVALANCHE_API_KEY,
    },
  },
  hardhatHolographContractBuilder: {
    runOnCompile: true,
    verbose: false,
  },
};

export default config;
