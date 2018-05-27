class Block {
  constructor(index, hash, previousHash, timestamp, data){
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
  }
}

const genesisBlock = new Block(
  0,
  "89885017C8C6F245BD5B52ED1C3E0CBA294DCCE78014DE17650777F6EBC62E73",
  null,
  1527430455015,
  "this is genesis block!"
)

let blockchain = [genesisBlock]

console.log(blockchain)
