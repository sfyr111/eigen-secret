import { ethers } from "ethers";
const buildBabyjub = require("circomlibjs").buildBabyjub;
const buildEddsa = require("circomlibjs").buildEddsa;
const buildPoseidon = require("circomlibjs").buildPoseidon;
const { Scalar, utils } = require("ffjavascript");
const createBlakeHash = require("blake-hash");
const { Buffer } = require("buffer");
import { StateTree } from "./state_tree";
import { getPublicKey, sign as k1Sign, verify as k1Verify, Point } from "@noble/secp256k1";
import { bigint2Array, bigint2Uint8Array, bigint2Tuple } from "./utils";
const fs = require("fs");

type UnpackFunc = () => Promise<[any, any]>;
interface Address {
    protocol: string;
    pubKey: string;
    unpack: UnpackFunc;
}
export class EigenAddress implements Address {
    protocol: string = "eig:";
    pubKey: string;
    constructor(pubKey: string) {
        this.pubKey = pubKey;
    }
    unpack: UnpackFunc = async () => {
        let pubKey = this.pubKey;
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let babyJub = await buildBabyjub();
        let bPubKey = Buffer.from(pubKey, "hex");
        let pPubKey = babyJub.unpackPoint(bPubKey);
        return Promise.resolve(pPubKey);
    };
}

export class EthAddress implements Address {
    protocol: string = "eth:";
    pubKey: string;
    constructor(pubKey: string) {
        this.pubKey = pubKey;
    }
    unpack: UnpackFunc = async () => {
        let pubKey = this.pubKey;
        if (pubKey.startsWith(this.protocol)) {
            pubKey = pubKey.substring(this.protocol.length);
        }
        let p = Point.fromHex(pubKey);
        return Promise.resolve([p.x, p.y]);
    }
}

type NewKeyFunc = (seed: string | undefined) => Promise<IKey>;
type SignFunc = (msghash: Uint8Array) => Promise<any>;
type VerifyFunc = (signature: Uint8Array | any, msghash: Uint8Array) => Promise<boolean>;
type KeyToCircuitInput = () => Promise<bigint[][]>;
export interface IKey {
    prvKey: bigint;
    pubKey: any;
    newKey: NewKeyFunc;
    sign: SignFunc;
    verify: VerifyFunc;
    toCircuitInput: KeyToCircuitInput;
}


// eddsa
export class SigningKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: EigenAddress = new EigenAddress("");
    constructor() {}
    newKey: NewKeyFunc = async (_seed: string | undefined) => {
        let eddsa = await buildEddsa();
        let rawpvk = Buffer.from(ethers.utils.randomBytes(31));
        let pubKey = eddsa.prv2pub(rawpvk);
        let pPubKey = eddsa.babyJub.packPoint(pubKey);
        let hexPubKey = "eig:" + Buffer.from(pPubKey).toString("hex");
        this.prvKey = rawpvk;
        this.pubKey = new EigenAddress(hexPubKey);
        return Promise.resolve(this)
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
        let eddsa = await buildEddsa();
        let F = eddsa.F;
        let result = eddsa.signPoseidon(this.prvKey, msghash);
        return {
            R8: [F.toObject(result.R8[0]), F.toObject(result.R8[1])],
            S: result.S
        }
    }
    verify: VerifyFunc = async (signature: Uint8Array | any, msghash: Uint8Array) => {
        let eddsa = await buildEddsa();
        let pubKey = await this.pubKey.unpack();
        return Promise.resolve(eddsa.verifyPoseidon(msghash, signature, pubKey));
    }
    toCircuitInput: KeyToCircuitInput = async () => {
        let eddsa = await buildEddsa();
        let pPub = await this.pubKey.unpack();

        const pvk = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.prvKey).digest().slice(0, 32));
        const S = Scalar.shr(utils.leBuff2int(pvk), 3);

        return [[
            eddsa.F.toObject(pPub[0]),
            eddsa.F.toObject(pPub[1])
        ], [S]];
    }
}

// ecdsa
export class AccountOrNullifierKey implements IKey {
    prvKey: bigint = 0n;
    pubKey: EthAddress = new EthAddress("");
    constructor() {}
    // signature hex string
    newKey: NewKeyFunc = async (signature: string | undefined) => {
        // return the first 32bytes as account key
        if (signature === undefined) {
            signature = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        }
        let prvKey = ethers.utils.arrayify(signature).slice(0, 32);
        // let pubKey: Point = Point.fromPrivateKey(prvKey);
        let pubKey = getPublicKey(prvKey);
        let hexPubKey = "eth:" + Buffer.from(pubKey).toString("hex");
        this.prvKey = Buffer.from(prvKey);
        this.pubKey = new EthAddress(hexPubKey);
        return Promise.resolve(this);
    }
    sign: SignFunc = async (msghash: Uint8Array) => {
        // let sig: Uint8Array = await k1Sign(msghash, this.prvKey, { canonical: true, der: false })
        // return Promise.resolve(sig);
        throw new Error("Unimplemented");
    }
    verify: VerifyFunc = async (signature: Uint8Array | any, msghash: Uint8Array) => {
        let pPub = await this.pubKey.unpack();
        return Promise.resolve(k1Verify(signature, msghash, new Point(pPub[0], pPub[1])));
    }
    toCircuitInput: KeyToCircuitInput = async () => {
        let pPub = await this.pubKey.unpack();
        return [bigint2Tuple(pPub[0]), bigint2Tuple(pPub[1])];
    }
}


export async function compress(
    accountKey: SigningKey,
    signingKey: SigningKey,
    aliasHash: bigint) {
    let npk = await accountKey.toCircuitInput();
    let spk = await signingKey.toCircuitInput();

    return await rawCompress(npk[0], spk[0], aliasHash);
}

export async function rawCompress(
    npk: bigint[],
    spk: bigint[],
    aliasHash: bigint) {
    let poseidon = await buildPoseidon();
    let input: bigint[] = [];
    input.push(npk[0]);
    input.push(npk[1]);
    input.push(spk[0]);
    input.push(spk[1]);
    input.push(aliasHash);
    return poseidon.F.toObject(poseidon(input));
}

export async function accountDigest(
    aliasHash: bigint,
    accountPubKeyX: bigint,
    newAccountPubKeyX: bigint,
    newSigningPubKey1X: bigint,
    newSigningPubKey2X: bigint,
    nullifier1: bigint,
    nullifier2: bigint
) {
    let poseidon = await buildPoseidon();
    return poseidon([
        aliasHash,
        accountPubKeyX,
        newAccountPubKeyX,
        newSigningPubKey1X,
        newSigningPubKey2X,
        nullifier1,
        nullifier2
    ]);
}

export async function aliashHashDigest(aliasHash: bigint) {
    let poseidon = await buildPoseidon();
    let result = poseidon([
        aliasHash
    ]);
    return poseidon.F.toObject(result);
}

export async function newAccountDigest(newAccountPubKey: bigint[]) {
    let poseidon = await buildPoseidon();
    let result = poseidon([
        newAccountPubKey[0],
        newAccountPubKey[1]
    ]);
    return poseidon.F.toObject(result);
}

export class AccountCircuit {
    static readonly PROOF_ID_TYPE_INVALID: number = 0;
    static readonly PROOF_ID_TYPE_CREATE: number = 11;
    static readonly PROOF_ID_TYPE_MIGRATE: number = 12;
    static readonly PROOF_ID_TYPE_UPDATE: number = 13;

    proofId: number;
    outputNCs: bigint[];

    dataTreeRoot: bigint;
    siblingsAC: bigint[];

    aliasHash: bigint;
    accountPubKey: bigint[];
    signingPubKey: bigint[];

    newAccountPubKey: bigint[];
    newSigningPubKey1: bigint[];
    newSigningPubKey2: bigint[];

    signatureR8: bigint[];
    signatureS: bigint;

    constructor(
        proofId: number,
        outputNCs: bigint[],
        dataTreeRoot: bigint,
        siblingsAC: bigint[],
        aliasHash: bigint,
        accountPubKey: bigint[],
        signingPubKey: bigint[],
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        signatureR8: bigint[],
        signatureS: bigint
    ) {
        this.proofId = proofId;
        this.outputNCs = outputNCs;
        this.dataTreeRoot = dataTreeRoot;
        this.siblingsAC = siblingsAC;
        this.aliasHash = aliasHash;
        this.accountPubKey = accountPubKey;
        this.signingPubKey = signingPubKey;
        this.newAccountPubKey = newAccountPubKey;
        this.newSigningPubKey1 = newSigningPubKey1;
        this.newSigningPubKey2 = newSigningPubKey2;
        this.signatureR8 = signatureR8;
        this.signatureS = signatureS;
    }

    static async createProofInput(
        proofId: number,
        accountKey: SigningKey,
        signingKey: SigningKey,
        newAccountPubKey: bigint[],
        newSigningPubKey1: bigint[],
        newSigningPubKey2: bigint[],
        aliasHash: bigint,
        state: StateTree
    ) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;

        let accountPubKey = await accountKey.pubKey.unpack();
        accountPubKey = [F.toObject(accountPubKey[0]), F.toObject(accountPubKey[1])];

        let signingPubKey = await accountKey.pubKey.unpack();
        signingPubKey = [F.toObject(signingPubKey[0]), F.toObject(signingPubKey[1])];

        let accountNC = await rawCompress(accountPubKey, signingPubKey, aliasHash);
        let outputNC1 = await rawCompress(newAccountPubKey, newSigningPubKey1, aliasHash);
        let outputNC2 = await rawCompress(newAccountPubKey, newSigningPubKey2, aliasHash);

        let nullifier1 = proofId == AccountCircuit.PROOF_ID_TYPE_CREATE? (await aliashHashDigest(aliasHash)): 0;
        let nullifier2 = proofId == (AccountCircuit.PROOF_ID_TYPE_CREATE ||
            proofId == AccountCircuit.PROOF_ID_TYPE_MIGRATE) ?
            (await newAccountDigest(newAccountPubKey)): 0;

        let msghash = await accountDigest(
            aliasHash,
            accountPubKey[0],
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            nullifier1,
            nullifier2
        );

        await state.insert(F.e(accountNC), 1);

        let leaf = await state.find(F.e(accountNC));

        console.log("msghash", F.toObject(msghash));
        let sig = await accountKey.sign(msghash);
        return new AccountCircuit(
            proofId,
            [outputNC1, outputNC2],
            F.toObject(state.root()),
            leaf.siblings,
            aliasHash,
            accountPubKey,
            signingPubKey,
            newAccountPubKey,
            newSigningPubKey1,
            newSigningPubKey2,
            sig.R8,
            sig.S
        );
    }

    toCircuitInput() {
        let result = {
            proof_id: this.proofId,
            public_value: 0n,
            public_owner: 0n,
            num_input_notes: 0n,
            output_nc_1: this.outputNCs[0],
            output_nc_2: this.outputNCs[1],
            data_tree_root: this.dataTreeRoot,
            public_asset_id: 0n,
            alias_hash: this.aliasHash,
            account_note_npk: this.accountPubKey,
            account_note_spk: this.signingPubKey,
            new_account_note_npk: this.newAccountPubKey,
            new_account_note_spk1: this.newSigningPubKey1,
            new_account_note_spk2: this.newSigningPubKey2,
            siblings_ac: this.siblingsAC,
            signatureR8: this.signatureR8,
            signatureS: this.signatureS
        }
        fs.writeFileSync("circuits/account.input.json", JSON.stringify(result));
        return result;
    }
}