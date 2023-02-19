pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../third-party/circom-ecdsa/circuits/ecdsa.circom";
include "state_tree.circom";
include "account_note.circom";
include "nullifier_function.circom";
include "note_compressor.circom";

template JoinSplit(nLevel) {
    //constant
    var TYPE_DEPOSIT = 1;
    var TYPE_WITHDRAW = 2;
    var TYPE_SEND = 3;

    var NOTE_VALUE_BIT_LENGTH = 2**128;
    var NUM_ASSETS_BIT_LENGTH = 1000;

    // public input
    signal input proof_id;
    signal input public_input;
    signal input public_output;
    signal input public_asset_id;
    signal input output_nc_1_x; //(nc is short for note commitment)
    signal input output_nc_1_y;
    signal input output_nc_2_x;
    signal input output_nc_2_y;
    signal input nullifier_1;
    signal input nullifier_2;
    signal input input_owner;
    signal input output_owner;
    signal input data_tree_root;

    //private input
    signal input input_note_val[2];
    signal input input_note_nonce[2];
    signal input input_note_secret[2];
    signal input input_note_account_id[2];
    signal input input_note_asset_id[2];
    signal input siblings[2][nLevel];
    signal input output_note_val[2];
    signal input output_note_secret[2];
    signal input output_note_account_id[2];
    signal input output_note_asset_id[2];
    signal input output_note_nonce[2];
    signal input account_note_account_id;
    signal input account_note_npk[2][4]; // (npk=account public key)
    signal input account_note_spk[2][4]; // (spk=spending public key)
    signal input siblings_ac[nLevel];
    signal input note_num;
    signal input nk[4]; // (account private key)
    signal input msghash[4];
    signal input signature[2][4]; // ecdsa signature

    component is_deposit = IsEqual();
    is_deposit.in[0] <== proof_id;
    is_deposit.in[1] <== TYPE_DEPOSIT;

    component is_withdraw = IsEqual();
    is_withdraw.in[0] <== proof_id;
    is_withdraw.in[1] <== TYPE_WITHDRAW;

    var public_input_ = public_input * is_deposit.out;
    var public_output_ = public_output * is_withdraw.out;

    //range check
    component is_same_asset[2];
    component is_less_than[2][2];
    for(var i = 0;  i < 2; i ++) {
        is_same_asset[i] = IsEqual();
        is_same_asset[i].in[0] <== input_note_account_id[i];
        is_same_asset[i].in[1] <== account_note_account_id;
        is_same_asset[i].out === 1;

        is_less_than[i][0] = LessEqThan(252);
        is_less_than[i][0].in[0] <== input_note_val[i];
        is_less_than[i][0].in[1] <== NOTE_VALUE_BIT_LENGTH;

        is_less_than[i][1] = LessEqThan(252);
        is_less_than[i][1].in[0] <== input_note_asset_id[i];
        is_less_than[i][1].in[1] <== NUM_ASSETS_BIT_LENGTH;
    }

    //note validity check
    component nc[2];
    component nf[2];
    component ms[2];
    for(var i = 0;  i < 2; i ++) {
        nc[i] = NoteCompressor();
        nc[i].val <== input_note_val[i];
        nc[i].asset_id <== input_note_asset_id[i];
        nc[i].secret <== input_note_secret[i];
        nc[i].account_id <== input_note_account_id[i];
        nc[i].nonce <== input_note_nonce[i];

        ms[i] = Membership(nLevel);
        ms[i].key <== nc[i].out;
        ms[i].value <== note_num;
        ms[i].root <== data_tree_root;
        for (var j = 0; j < nLevel; j++) {
            ms[i].siblings[j] <== siblings[i][j];
        }

        nf[i] = NullifierFunction(nLevel);
        nf[i].nc <== nc[i].out;
        nf[i].nk <== nk;
        for (var j = 0; j < nLevel; j++) {
            nf[i].siblings[j] <== siblings[i][j];
        }

        nf[i].out === 0;
    }

    component ac = AccountNoteCompressor();
    ac.npk <== account_note_npk;
    ac.spk <== account_note_spk;
    ac.account_id <== account_note_account_id;

    component ams = Membership(nLevel);
    ams.key <== ac.out;
    ams.value <== 1; //TODO
    for (var j = 0; j < nLevel; j++) {
        ams.siblings[j] <== siblings_ac[j];
    }

    // check private key to public key
    component pri2pub = ECDSAPrivToPub(64, 4);
    pri2pub.privkey <== nk;
    pri2pub.pubkey === account_note_npk;

    //check signature
    component sig_verifier = ECDSAVerifyNoPubkeyCheck(64, 4);
    sig_verifier.r <== signature[0];
    sig_verifier.s <== signature[1];
    sig_verifier.msghash <== msghash;
    sig_verifier.pubkey <== account_note_npk;
    sig_verifier.result === 1;

    // check value
    //case 1: note_num < 1 && input_note_1.value == 0
    component note_num_less[2];
    note_num_less[0] = LessThan(252);
    note_num_less[0].in[0] <== note_num;
    note_num_less[0].in[1] <== 1;
    note_num_less[0].out * input_note_val[0] === 0;

    //case 2: note_num < 2 && input_note_2.value == 0
    note_num_less[1] = LessThan(252);
    note_num_less[1].in[0] <== note_num;
    note_num_less[1].in[1] <== 2;
    note_num_less[1].out * input_note_val[1] === 0;

    // transfer balance check
    var total_in_value = public_input_ + input_note_val[0] + input_note_val[1];
    var total_out_value = public_output + output_note_val[0] + output_note_val[1];
    total_in_value === total_out_value;

    // asset type check
    input_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === output_note_asset_id[1];
    //check: public_asset_id == input_note_1.asset_id <==> (public_input_ != 0 || public_output != 0)
    component public_input_1 = IsEqual();
    public_input_1.in[0] <== public_input_;
    public_input_1.in[1] <== 0;
    component public_output_1 = IsEqual();
    public_output_1.in[0] <== public_output_;
    public_output_1.in[1] <== 0;

    component xor = XOR();
    xor.a <== public_input_1.out;
    xor.b <== public_output_1.out;

    component asset_id_eq = IsEqual();
    asset_id_eq.in[0] <== public_asset_id;
    asset_id_eq.in[1] <== input_note_asset_id[0];

    component and = AND();
    and.a <== xor.out;
    and.b <== asset_id_eq.out;
    and.out === 1;
}

//component main = JoinSplit(3);