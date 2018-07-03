"use strict";

const CryptoJS = require("crypto-js"),
  hexToBinary = require("hex-to-binary"),
  Wallet = require("./wallet");

const { getPublicFromWallet, getBalance } = Wallet;

class Block {
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce){
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const genesisBlock = new Block(
  0,
  "89885017C8C6F245BD5B52ED1C3E0CBA294DCCE78014DE17650777F6EBC62E73",
  null,
  1527430455015,
  "this is genesis block!",
  0,
  0
);

let blockchain = [genesisBlock];

let uTxOuts = [];

const BLOCK_GENERATION_TIME = 10;

const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => new Date().getTime();

const getBlockchain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) => 
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

const findDifficulty = () => {
  const newestBlock = getNewestBlock();
  if (newestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
      newestBlock.index !== 0
  ) {
    return findNewDifficulty(getNewestBlock(), blockchain);
  } else {
    return newestBlock.difficulty;
  }
};

const findNewDifficulty = (newestBlock, blockchain) => {
  const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected = BLOCK_GENERATION_TIME * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
  if (timeExpected < timeTaken / 2) {
    return lastCalculatedBlock.difficulty + 1;
  } else if (timeExpected > timeTaken*2) {
    return lastCalculatedBlock.difficulty - 1;
  } else {
    return lastCalculatedBlock.difficulty;
  }
};

const createNewBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();
  const difficulty = findDifficulty();
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newTimestamp,
    data,
    difficulty
  );
  addBlockToChain(newBlock);
  require('./p2p').broacastNewBlock();
  return newBlock;
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while (true) {
    console.log("current nonce:", nonce);
    const hash = createHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index, 
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
    nonce++; 
  }
};

const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash); 
  const requiredZeros = "0".repeat(difficulty);
  console.log("Trying difficulty:", difficulty, "with hash", hashInBinary);
  return hashInBinary.startsWith(requiredZeros);
};

const getBlocksHash = block => 
  createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const isTimestampValid = (newBlock, oldBlock) => {
  return (
    oldBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getTimestamp()
  );
          
};

const isBlockValid = (candidateBlock, latestBlock) => {
  if (!isBlockStructureValid(candidateBlock)) {
    console.log("the structure of the block is not valid");
    return false;
  } else if (latestBlock.index + 1 !== candidateBlock.index) {
    console.log("the candidate block contains wrong index");
    return false;
  } else if (latestBlock.hash !== candidateBlock.previousHash) {
    console.log("the candidate block's previous block has the wrong hash");
    return false;
  } else if (candidateBlock.hash !== getBlocksHash(candidateBlock)) {
    console.log("the hash of this block is invalid");
    return false;
  } else if (!isTimestampValid(candidateBlock, latestBlock)) {
    console.log("the timestamp of this block is dodgy");
    return false;
  }

  return true;
};

const isBlockStructureValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash  === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "string"
  );
};

const isChainValid = (candidateChain) => {
  const isGenesisValid = block => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };
  if (!isGenesisValid(candidateChain[0])) {
    console.log("The candidateChain's genesisBlock is not the same as our genesisBlock");
    return false;
  }
  for (let i=1; i < candidateChain.length; i++) {
    if (!isBlockValid(candidateChain[i], candidateChain[i - 1])) {
      return false;
    }
  }
  return true;
};

const sumDifficulty = anyBlockchain => 
  anyBlockchain
    .map(block => block.difficulty)
    .map(difficulty => Math.pow(difficulty, 2))
    .reduce((a, b) => a + b);

const replaceChain = newChain => {
  if (isChainValid(newChain) && 
      sumDifficulty(newChain) > sumDifficulty(getBlockchain())
  ) {
    blockchain = newChain;
    return true;
  } else {
    return false;
  }
};

const addBlockToChain = candidateBlock => {
  if (isBlockValid(candidateBlock, getNewestBlock())) {
    getBlockchain().push(candidateBlock);
    return true;
  } else {
    return false;
  }
};

const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);

module.exports = {
  getBlockchain,
  createNewBlock,
  getNewestBlock,
  isBlockStructureValid,
  replaceChain,
  addBlockToChain,
  getAccountBalance
};
