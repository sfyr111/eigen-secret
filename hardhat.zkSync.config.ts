import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";

import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import "hardhat-gas-reporter";

import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import { task } from "hardhat/config";

require("./zksync-tasks/index");

dotenvConfig({ path: resolve(__dirname, "./server/.env") });

task("demo", "zkSync tasks demo", async (taskArgs, hre) => {


});

module.exports = {
  solidity: {
    version: '0.8.16',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
          }
        }
      }
    }
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  },
  mocha: {
    timeout: 10000000,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: {
      ropsten: '8HHE3RBH3MZ29E9I9XYP8VP6D9SQIINUIU'
    }
  },
  zksolc: {
    version: "1.3.10",
    compilerSource: "binary",
    settings: {},
  },
  defaultNetwork: "zkSyncTestnet",
  networks: {
    hardhat: {
      zksync: false,
      chainId: 1337, // https://github.com/NomicFoundation/hardhat/issues/1731
    },
    zkSyncTestnet: {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      zksync: true
    },
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 20,
    token: 'ETH',
    gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    coinmarketcap: 'f6673cc5-a673-4e07-8461-f7281a5de7d7',
    onlyCalledMethods: false
  }
}
