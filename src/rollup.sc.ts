import { ethers } from "hardhat";
import { assert } from "chai";
import { uint8Array2Bigint, parseProof } from "../src/utils";
const createBlakeHash = require("blake-hash");

/*
    Here we want to test the smart contract's deposit functionality.
*/

export class RollupSC {
    userAccount: any;
    rollup: any;
    tokenRegistry: any;
    testToken: any;
    spongePoseidon: any;
    eddsa: any;

    alias: string;
    aliasHash: any;

    spongePoseidonAddress: string;
    tokenRegistryAddress: string;
    poseidon2Address: string;
    poseidon3Address: string;
    poseidon6Address: string;
    rollupAddress: string;
    testTokenAddress: string;

    constructor(
        eddsa: any,
        alias: string,
        userAccount: any,
        spongePoseidonAddress: string,
        tokenRegistryAddress: string,
        poseidon2Address: string,
        poseidon3Address: string,
        poseidon6Address: string,
        rollupAddress: string,
        testTokenAddress: string = ""
    ) {
        this.eddsa = eddsa;
        this.alias = alias;
        this.userAccount = userAccount;
        this.rollup = undefined;
        this.tokenRegistry = undefined;
        this.testToken = undefined;
        this.spongePoseidon = undefined;
        this.eddsa = undefined;
        this.aliasHash = undefined;

        this.spongePoseidonAddress = spongePoseidonAddress;
        this.tokenRegistryAddress = tokenRegistryAddress;
        this.poseidon2Address = poseidon2Address;
        this.poseidon3Address = poseidon2Address;
        this.poseidon6Address = poseidon2Address;
        this.rollupAddress = rollupAddress;
        this.testTokenAddress = testTokenAddress;
    }

    async initialize() {
        const aliasHashBuffer = this.eddsa.pruneBuffer(
            createBlakeHash("blake512").update(this.alias).digest().slice(0, 32)
        );
        this.aliasHash = uint8Array2Bigint(aliasHashBuffer);
        const SpongePoseidonFactory = await ethers.getContractFactory("SpongePoseidon", {
            libraries: {
                PoseidonUnit6L: this.poseidon6Address
            }
        });
        this.spongePoseidon = SpongePoseidonFactory.attach(this.spongePoseidonAddress);

        let factoryTR = await ethers.getContractFactory("TokenRegistry");
        this.tokenRegistry = factoryTR.attach(this.tokenRegistryAddress);

        let factoryR = await ethers.getContractFactory(
            "Rollup",
            {
                libraries: {
                    SpongePoseidon: this.spongePoseidon.address
                }
            }
        );
        this.rollup = factoryR.attach(this.rollupAddress);

        if (this.testTokenAddress != "") {
            let factoryTT = await ethers.getContractFactory("TestToken");
            this.testToken = factoryTT.attach(this.testTokenAddress);
        }
    }

    async deposit(pubkeyEigenAccountKey: bigint[], assetId: number, value: number, nonce: number) {
        let userAccount = this.userAccount;
        assert(this.rollup);
        let approveToken = await this.testToken.connect(userAccount).approve(
            this.rollup.address, value,
            { from: userAccount.address }
        )
        assert(approveToken, "approveToken failed")
        let deposit0 = await this.rollup.connect(userAccount).deposit(
            pubkeyEigenAccountKey,
            assetId,
            value,
            nonce,
            { from: userAccount.address }
        )
        assert(deposit0, "deposit0 failed");
        return deposit0;
    }

    async processDeposits(userAccount: any, keysFound: any, valuesFound: any, siblings: any) {
        assert(this.rollup);
        let processDeposit1: any;
        try {
            processDeposit1 = await this.rollup.connect(userAccount).processDeposits(
                keysFound,
                valuesFound,
                siblings,
                { from: userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }

    async update(proofAndPublicSignal: any) {
        assert(this.rollup);
        let processDeposit1: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        try {
            processDeposit1 = await this.rollup.connect(this.userAccount).update(
                proof.a,
                proof.b,
                proof.c,
                proofAndPublicSignal.publicSignals,
                { from: this.userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }

    async withdraw(receiverAccount: any, txInfo: any, proofAndPublicSignal: any) {
        assert(this.rollup);
        let processDeposit1: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        console.log(txInfo, receiverAccount.address, proof);
        try {
            processDeposit1 = await this.rollup.connect(this.userAccount).withdraw(
                txInfo,
                receiverAccount.address,
                proof.a,
                proof.b,
                proof.c,
                { from: this.userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }
}