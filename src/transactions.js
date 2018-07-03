"use strict";

const CryptoJS = require("crypto-js"),
  elliptic = require("elliptic"),
  utils = require("./utils");

const ec = elliptic.ec("secp256k1");

const COINBASE_AMOUNT = 50;

class TxOut {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  // TxOutId
  // TxOutIndex
  // Signature
}

class Transaction {
  // ID
  // txIns[]
  // txOuts[]
}

class UTxOut {
  constructor(uTxOutId, uTxOutIndex, address, amount) {
    this.uTxOutId = uTxOutId;
    this.uTxOutIndex = uTxOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

const getTxId = tx => {
  const txInContent = tx.Ins
    .map(txIn => txIn.uTxOutId + txIn.uTxOutIndex)
    .reduce((a, b) => a + b, "");

  const txOutContent = tx.Outs
    .map(txOut => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

const findUTxOut = (txOutId, txOutIndex, uTxOutList) => {
  return uTxOutList.find(
    uTxOut => uTxOut.Id === txOutId && uTxOut.txOutIndex === txOutIndex
  );
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
  const txIn = tx.txIns[txInIndex];
  const dataToSign = tx.id;

  const referencedUTxOut = findUTxOut(txIn.txOutId, tx.txOutIndex, uTxOutList);
  if (referencedUTxOut === null) {
    return;
  }
  const referencedAddress = referencedUTxOut.address;
  if (getPublicKey(privateKey) !== referencedAddress) {
    return;
  }
  const key = ec.keyFromPrivate(privateKey, "hex");
  const signature = utils.toHexString(key.sign(dataToSign).toDER());
  return signature;
};

const getPublicKey = (privateKey) => {
  return ec
    .keyFromPrivate(privateKey, "hex")
    .getPublicKey()
    .encode("hex");
};

const updateUTxOuts = (newTxs, uTxOutList) => {
  const newUTxOuts = newTxs
    .map(tx => {
      tx.txOuts.map((txOut, index) => {
        new UTxOut(tx.id, index, txOut.address, txOut.amount);
      });
    })
    .reduce((a, b) => a.concat(b), []);

  const spentTxOuts = newTxs
    .map(tx => tx.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const resultingUTxOuts = uTxOutList
    .filter(uTxO => !findUTxOut(uTxO.uTxOutId, uTxO.uTxOutIndex, spentTxOuts))
    .concat(newUTxOuts);
};

const isTxInStructureValid = txIn => {
  if (txIn === null) {
    return false;
  } else if (typeof txIn.signature !== "string") {
    return false;
  } else if (typeof txIn.txOutId !== "string") {
    return false;
  } else if (typeof txIn.txOutIndex !== "number") {
    return false;
  } else {
    return true;
  }
};

const isAddressValid = address => {
  if (address.length !== 130) {
    return false;
  } else if (address.match("^[a-fA-F0-9]+$") === null) {
    return false;
  } else if (!address.startsWith("04")) {
    return false;
  } else {
    return true;
  }
};

const isTxOutStructureValid = txOut => {
  if (txOut === null) {
    return false;
  } else if (typeof txOut.address !== "string") {
    return false;
  } else if (!isAddressValid(txOut.address)) {
    return false;
  } else if (typeof txOut.amount !== "number") {
    return false;
  } else {
    return true;
  }
};

const isTxStructureValid = tx => {
  if (typeof tx.id !== "string") {
    console.log("the type of transaction id is not string!");
    return false;
  } else if (!(tx.txIns instanceof Array)) {
    console.log("the txIns is not an Array");
    return false;
  } else if (!tx.txIns.map(isTxInStructureValid).reduce((a,b) => a && b, true)) {
    console.log("The structure of a txIn is not valid");
    return false;
  } else if (!(tx.txOuts instanceof Array)) {
    console.log("The txOuts is not an Array");
    return false;
  } else if (!tx.txOuts.map(isTxOutStructureValid).reduce((a,b) => a && b, true)) {
    console.log("The structure of a txOut is not valid");
   return false;
  }
};

const getAmountInTxIn = (txIn, uTxOutList) =>
  findUTxOut(txIn.uTxOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTxIns = (txIn, tx, uTxOutList) => {
  const wantedTx = uTxOutList.find(uTxO => uTxO.id === txIn.id && uTxO.index === txIn.index);
  if (wantedTx === null) {
    return false;
  } else {
    const address = wantedTx.address;
    const key = ec.keyFromPublic(address, "hex");
    return key.verify(tx.id, txIn.signature);
  }
};

const validateTx = (tx, uTxOutList) => {
  if (getTxId(tx) !== tx.id) {
    return false;
  }

  const hasValidTxIns = tx.txIns.map(txIn => validateTxIns(txIn, tx, uTxOutList));

  if(!hasValidTxIns) {
    return false;
  }

  const amountInTxIns = tx.txIns
    .map(txIn => getAmountInTxIn(txIn, uTxOutList))
    .reduce((a, b) => a + b, 0);

  const amountInTxOuts = tx.txOuts
    .map(txOut => txOut.amount)
    .reduce((a, b) => a + b, 0);

  if (amountInTxIns !== amountInTxOuts) {
    return false;
  } else {
    return true;
  }
};

const validateCoinbaseTx = (tx, blockIndex) => {
  if (getTxId(tx) !== tx.id) {
    return false;
  } else if (tx.Ins.length !== 1) {
    return false;
  } else if (tx.Ins[0].txOutIndex !== blockIndex) {
    return false;
  } else if (tx.Outs.length !== 1) {
    return false;
  } else if (tx.Outs[0].amount !== COINBASE_AMOUNT) {
    return false;
  } else {
    return true;
  }
};

module.exports = {
  getPublicKey,
  getTxId,
  signTxIn,
  TxIn,
  TxOut
};
