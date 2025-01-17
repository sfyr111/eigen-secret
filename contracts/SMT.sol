// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @dev Interface poseidon hash function with 2 inputs
 */
contract Poseidon2Unit {
  function poseidon(uint256[2] memory) public pure returns(uint256) {}
}

/**
 * @dev Interface poseidon hash function with 3 inputs
 */
contract Poseidon3Unit {
  function poseidon(uint256[3] memory) public pure returns(uint256) {}
}

/**
 * @dev Rollup helper functions
 */
contract SMT {

  Poseidon2Unit insPoseidon2Unit;
  Poseidon3Unit insPoseidon3Unit;

  /**
   * @dev Load poseidon smart contract
   * @param _poseidon2InputsContractAddr poseidon contract with 2 inputs address
   * @param _poseidon3InputsContractAddr poseidon contract with 3 inputs address
   */
  constructor (address _poseidon2InputsContractAddr, address _poseidon3InputsContractAddr) public {
    insPoseidon2Unit = Poseidon2Unit(_poseidon2InputsContractAddr);
    insPoseidon3Unit = Poseidon3Unit(_poseidon3InputsContractAddr);
  }

  /**
   * @dev hash poseidon for sparse merkle tree nodes
   * @param left input element array
   * @param right input element array
   * @return poseidon hash
   */
  function hashNode(uint256 left, uint256 right) internal view returns (uint256){
    uint256[2] memory inputs = [left, right];
    // inputs[0] = left;
    // inputs[1] = right;
    return insPoseidon2Unit.poseidon(inputs);
  }

  /**
   * @dev hash poseidon for sparse merkle tree final nodes
   * @param key input element array
   * @param value input element array
   * @return poseidon hash1
   */
  function hashFinalNode(uint256 key, uint256 value) internal view returns (uint256){
    uint256[3] memory inputs = [key, value, 1];
    return insPoseidon3Unit.poseidon(inputs);
  }
  
   /**
   * @dev Verify sparse merkle tree proof
   * @param siblings all siblings
   * @param key key to verify
   * @param value value to verify
   * @param isNonExistence existence or non-existence verification
   * @param isOld indicates non-existence non-empty verification
   * @param oldKey needed in case of non-existence proof with non-empty node
   * @param oldValue needed in case of non-existence proof with non-empty node
   * @return true if verification is correct, false otherwise
   */
  function smtVerifier(uint256[] memory siblings,
    uint256 key, uint256 value, uint256 oldKey, uint256 oldValue,
    bool isNonExistence, bool isOld, uint256 maxLevels) public view returns (uint256){

    // Step 1: check if proof is non-existence non-empty
    uint256 newHash;
    if (isNonExistence && isOld) {
      // Check old key is final node
      uint exist = 0;
      uint levCounter = 0;
      while ((exist == 0) && (levCounter < maxLevels)) {
        exist = (uint8(oldKey >> levCounter) & 0x01) ^ (uint8(key >> levCounter) & 0x01);
        levCounter += 1;
      }

      if (exist == 0) {
        return 0;
      }
      newHash = hashFinalNode(oldKey, oldValue);
    }

    // Step 2: Calcuate root
    uint256 nextHash = isNonExistence ? newHash : hashFinalNode(key, value);
    uint256 siblingTmp;
    for (int256 i = int256(siblings.length) - 1; i >= 0; i--) {
      siblingTmp = siblings[uint256(i)];
      bool leftRight = (uint8(key >> uint256(i)) & 0x01) == 1;
      nextHash = leftRight ? hashNode(siblingTmp, nextHash)
                           : hashNode(nextHash, siblingTmp);
    }

    // Step 3: return root
    return nextHash;
  }
}
