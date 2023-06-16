import { task } from "hardhat/config";
import { deploySpongePoseidon, deployPoseidons } from "../core/lib/deploy_poseidons.zksync.util";
import { defaultContractFile } from "./common";
import zk, { utils, Wallet, Web3Provider, Provider } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const fs = require("fs");
const path = require("path");

const richWalletsPath = path.resolve(__dirname, "../rich-wallets.json");

const richWallets = JSON.parse(fs.readFileSync(richWalletsPath).toString());
task("deploy", "Deploy all smart contract")
.addParam("testTokenAddress", "test token address, default none", "")
.addParam("contractFile", "[output] contract address", defaultContractFile)
.setAction(async ({ testTokenAddress, contractFile }, hre) => {
  const { ethers } = hre;

  const admin = new Wallet(richWallets[0].privateKey)
  const deploy = new Wallet(richWallets[2].privateKey)

  const provider = Provider.getDefaultProvider();
  const signer = await provider.getSigner();
  console.log(signer._address)
  // console.log(await signer.getAddress())
  // const signer = new ethers.Wallet('0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110', provider);

  const adminDeployer = new Deployer(hre, admin);

  const depositHandle = await adminDeployer.zkWallet.deposit({
    to: adminDeployer.zkWallet.address,
    token: utils.ETH_ADDRESS,
    amount: ethers.BigNumber.from(10)
  });
  // Wait until the deposit is processed on zkSync
  await depositHandle.wait();

  // @ts-ignore
  let poseidonContracts = await deployPoseidons(adminDeployer, [2, 3, 6]);
  let contractJson = new Map<string, string>();

  console.log("Using account ", admin.address);
  contractJson.set("admin", admin.address);

  let spongePoseidon = await deploySpongePoseidon(ethers, poseidonContracts[2].address);
  contractJson.set("spongePoseidon", spongePoseidon.address);
  contractJson.set("poseidon2", poseidonContracts[0].address);
  contractJson.set("poseidon3", poseidonContracts[1].address);
  contractJson.set("poseidon6", poseidonContracts[2].address);

  let factoryTR = await ethers.getContractFactory("TokenRegistry");
  let tokenRegistry = await factoryTR.deploy(admin.address)
  await tokenRegistry.deployed()
  console.log("tokenRegistry deployed to:", tokenRegistry.address);
  contractJson.set("tokenRegistry", tokenRegistry.address);

  let factoryR = await ethers.getContractFactory(
    "Rollup",
    {
      libraries: {
        SpongePoseidon: spongePoseidon.address
      }
    }
  );
  let rollup = await factoryR.deploy();
  await rollup.deployed();
  console.log("rollup deployed to:", rollup.address);
  contractJson.set("rollup", rollup.address);

  let factoryMP = await ethers.getContractFactory("ModuleProxy");
  const initData = factoryR.interface.encodeFunctionData(
    "initialize(address,address,address)",
    [poseidonContracts[0].address,
      poseidonContracts[1].address,
      tokenRegistry.address]
  );
  let moduleProxy = await factoryMP.deploy(rollup.address, deploy.address, initData);
  await moduleProxy.deployed();
  console.log("The proxy of rollup is set with ", rollup.address)
  contractJson.set("moduleProxy", moduleProxy.address);

  if (testTokenAddress == "") {
    let factoryTT = await ethers.getContractFactory("TestToken");
    let testToken = await factoryTT.connect(admin).deploy();
    await testToken.deployed();
    console.log("TestToken deployed to:", testToken.address);
    testTokenAddress = testToken.address;
  }
  contractJson.set("testToken", testTokenAddress);

  console.log(contractJson);
  fs.writeFileSync(contractFile, JSON.stringify(Object.fromEntries(contractJson)))
})
