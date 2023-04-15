import { task } from "hardhat/config";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist/utils";
import { SecretAccount } from "@eigen-secret/core/dist/account";
import { SecretSDK } from "@eigen-secret/sdk/dist/index";
require("dotenv").config()
const path = require("path");
const fs = require("fs");
const circuitPath = path.join(__dirname, "../circuits/");
const { buildEddsa } = require("circomlibjs");
import { defaultContractABI, defaultContractFile, defaultAccountFile } from "./common";
const createBlakeHash = require("blake-hash");

task("deposit", "Deposit asset from L1 to L2")
  .addParam("alias", "user alias", "Alice")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .setAction(async ({ alias, assetId, password, value }, { ethers }) => {
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
    let secretSDK = new SecretSDK(
        alias,
        sa,
        "http://127.0.0.1:3000",
        circuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };
    let nonce = 0; // get nonce from Metamask
    let receiver = sa.accountKey.pubKey.pubKey;

    // get tokenAddress by asset id
    let tokenAddress = await secretSDK.getRegisteredToken(BigInt(assetId))
    console.log(tokenAddress.toString());
    // approve
    let approveTx = await secretSDK.approve(tokenAddress.toString(), value);
    await approveTx.wait();

    let proofAndPublicSignals = await secretSDK.deposit(ctx, receiver, BigInt(value), Number(assetId), nonce);
    console.log(proofAndPublicSignals);
  })

task("send", "Send asset to receiver in L2")
  .addParam("alias", "user alias", "Alice")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .addParam("receiver", "receiver account public key or alias", "Alice")
  .setAction(async ({ alias, assetId, password, value, receiver }, { ethers }) => {
    console.log(receiver)
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    // const newEOAAccount = ethers.Wallet.createRandom();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
    let secretSDK = new SecretSDK(
        alias,
        sa,
        "http://127.0.0.1:3000",
        circuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };
    let _receiver = sa.accountKey.pubKey.pubKey;
    let proofAndPublicSignals = await secretSDK.send(ctx, _receiver, BigInt(value), Number(assetId));
    console.log(proofAndPublicSignals);
  })

task("withdraw", "Withdraw assert from L2 to L1")
  .addParam("alias", "user alias", "Alice")
  .addParam("assetId", "asset id/token id")
  .addParam("password", "password for key sealing", "<your password>")
  .addParam("value", "amount of transaction")
  .setAction(async ({ alias, assetId, password, value, receiver }, { ethers }) => {
    console.log(receiver)
    const eddsa = await buildEddsa();
    let timestamp = Math.floor(Date.now()/1000).toString();
    let [user] = await ethers.getSigners();
    const signature = await signEOASignature(user, rawMessage, user.address, alias, timestamp);
    const contractJson = require(defaultContractFile);
    let accountData = fs.readFileSync(defaultAccountFile);
    let key = createBlakeHash("blake256").update(Buffer.from(password)).digest();
    let sa = SecretAccount.deserialize(eddsa, key, accountData.toString());
    let secretSDK = new SecretSDK(
        alias,
        sa,
        "http://127.0.0.1:3000",
        circuitPath,
        eddsa,
        user,
        contractJson.spongePoseidon,
        contractJson.tokenRegistry,
        contractJson.poseidon2,
        contractJson.poseidon3,
        contractJson.poseidon6,
        contractJson.rollup,
        contractJson.smtVerifier
    );
    await secretSDK.initialize(defaultContractABI);
    const ctx = {
      alias: alias,
      ethAddress: user.address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };
    let _receiver = sa.accountKey.pubKey.pubKey;
    let proofAndPublicSignals = await secretSDK.withdraw(ctx, _receiver, BigInt(value), Number(assetId));
    console.log(proofAndPublicSignals);
  })