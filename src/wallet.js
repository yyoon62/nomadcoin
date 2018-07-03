"use strict";

const fs = require("fs"),
  path = require("path"),
  elliptic = require("elliptic"),
  _ = require("lodash"), 
  Transactions = require("./transactions");

const {
  getPublicKey, 
  getTxId, 
  signTxIn, 
  TxIn, 
  TxOut, 
  Transaction
} = Transactions;

const ec = new elliptic.ec("secp256k1");

const privateKeyLocation = path.join(__dirname, "privateKey");

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, "utf-8");
  return buffer.toString();
};

const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = ec.keyFromPrivate(privateKey, "hex");
  return key.getPublic().encode("hex");
};

const initWallet = () => {
  if (fs.existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivateKey();

  fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

const getBalance = (address, uTxOuts) => {
  return _(uTxOuts)
    .filter(uTxO => uTxO.address === address)
    .map(uTxO => uTxO.amount)
    .sum();
};

const findAmountInUTxOuts = (amountNeeded, myUTxOuts) => {
  let currentAmount = 0;
  const includedUTxOuts = [];

  for (const myUTxOut of myUTxOuts) {
    includedUTxOuts.push(myUTxOut);
    currentAmount = currentAmount + myUTxOut.amount;

    if (currentAmount >= amountNeeded) {
      const leftOverAmount = amountNeeded - currentAmount;
      return { includedUTxOuts, leftOverAmount };
    }
  }
  console.log("Not enought funds!!");
  return false;
};

const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  const receiverTxOut = new TxOut(receiverAddress, amount);

  if (leftOverAmount === 0) {
    return [receiverTxOut];
  } else {
    const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
    return [receiverTxOut, leftOverTxOut];
  }
};

const createTx = (receiverAddress, amount, privateKey, uTxOutList) => {
  const myAddress = getPublicKey(privateKey);
  const myUTxOuts = uTxOutList.filter(uTxO => uTxO.address === myAddress);

  const { includedUTxOuts, leftOverAmount } = findAmountInUTxOuts(
    amount,
    myUTxOuts
  );

  const toUnsignedTxIn = uTxOut => {
    const txIn = new TxIn();
    txIn.txOutId = uTxOut.id;
    txIn.index = uTxOut.index;
  };

  const unsignedTxIns = includedUTxOuts.map(toUnsignedTxIn);

  const tx = new Transaction();

  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  
  tx.id = getTxId(tx);

  tx.txIns = tx.txIns.map((txIn, index) => {
      txIn.signature = signTxIn(tx, index, privateKey, uTxOutList);
      return txIn;
    });
};

module.exports = {
  initWallet,
  getBalance,
  getPublicFromWallet
};

