# ZKZRU: Eigen ZK-ZKRollup

Eigen ZK-ZKRollup provides confidential transaction for users with low gas cost. The ZK-Rollup is an extention of [RollupNC](https://github.com/eigmax/RollupNC) and the transcation's confidentiality is inspired by Perdersen Commitment and [Stealth Address](https://www.investopedia.com/terms/s/stealth-address-cryptocurrency.asp).
The circuits is written by Circom, and the verifier is generated by [EigenZKit](https://github.com/ieigen/EigenZKit).

## Archtecture

Apart from the TX Tree and Account Tree, we extend the operations on the leaf nodes to abstract storage layer for all kinds of assets' operation, including normal and confidential ERC20, ERC721 and Swap etc.

![arch](./docs/arch.png)


## Spec
The new spec isn't open-source yet. the old Rollup Spec can be found [here](./docs/README.old.md).


## Test
1. Use the generate_xxx_verifier.js to generate the corresponding input.json.  
2. Clone [EigenZKit](https://github.com/ieigen/EigenZKit/), run `cargo build --release` to get generated binary program in target/release/zkit and then set it in $PATH with name zkit.  
3. Use the zkit_test_xxx.sh to generate the corresponding smart contract.  
4. Run `yarn test`.  