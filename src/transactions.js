const CryptoJS = require("crypto-js"),
    utils = require("./utils"),
    _ = require("lodash"),
    elliptic = require("elliptic");

const ec = new elliptic.ec("secp256k1");

const COINBASE_AMOUNT = 50;

class TxOut {
    constructor(address, amount){
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
    // txOutId
    // txOutIndex
    // Signature
}

class Transaction {
    // ID
    // txIns[]
    // txOuts[]
}

// unspent transaction
class UTxOut {
    constructor(txOutId, txOutIndex, address, amount){
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

const getTxId = tx => {
    const txInContent = tx.txIns
        .map(txIn => txIn.uTxOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, "");

    const txOutContent = tx.txOuts
        .map(txOut => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, "");

    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

const findUTxOut = (txOutId, txOutIndex, uTxOutsList) => {
    return uTxOutsList.find(
        uTxO => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex
    );
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
    const txIn = tx.txIns[txInIndex];
    const dataToSign = tx.id;

    // Find Tx
    const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList);
    if(referencedUTxOut === null || referencedUTxOut == undefined) {
        throw Error("Couldn't find the reference uTxOut, not signing");
        return;
    }

    const referencedAddress = referencedUTxOut.address;
    if(getPublicKey(privateKey) !== referencedAddress) {
        return false;
    }

    // Sign the transaction input
    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = utils.toHexString(key.sign(dataToSign).toDER());
    return signature;
};

const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, "hex").getPublic().encode("hex");
};

const updateUTxOuts = (newTxs, uTxOutList) => {
    const newUTxOuts = newTxs.map(tx => (
        tx.txOuts.map(
            (txOut, index) => new UTxOut(tx.id, index, txOut.address, txOut.amount)
        )
    ))
    .reduce((a, b) => a.concat(b), []);

    const spentTxOuts = newTxs
        .map(tx => tx.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

    const resultingUTxOuts = uTxOutList.filter(
        uTx0 => !findUTxOut(uTx0.txOutId, uTx0.txOutIndex, spentTxOuts)
    )
    .concat(newUTxOuts);

    return resultingUTxOuts;
};

const isTxInStructureValid = (txIn) => {
    if(txIn === null) {
        console.log("The transaction input looks null.");
        return false;
    } else if(typeof txIn.signature !== "string") {
        console.log("The transaction input doesn't have a valid signature.");
        return false;
    } else if(typeof txIn.txOutId !== "string") {
        console.log("The transaction input doesn't have a valid transaction output id.");
        return false;
    } else if(typeof txIn.txOutIndex !== "number") {
        console.log("The transaction input doesn't have a valid transaction output index.");
        return false;
    } else {
        return true;
    }
};

const isAddressValid = (address) => {
    if(address.length !== 130) {
        console.log("The address length is not the expected one");
        return false;
    } else if(address.match("^[a-fA-F0-9]+$") === null) {
        console.log("The address doesn't match the hex patter");
        return false;
    } else if(!address.startsWith("04")) {
        console.log("The address doesn't start with 04");
        return false;
    } else {
        return true;
    }
};

const isTxOutStructureValid = (txOut) => {
    if(txOut === null) {
        console.log("The txOut is not exist");
        return false;
    } else if(typeof txOut.address !== "string") {
        console.log("The txOut doesn't have a valid string as address");
        return false;
    } else if(!isAddressValid(txOut.address)) {
        console.log("The txOut doesn't have a valid address");
        return false;
    } else if(typeof txOut.amount !== "number") {
        console.log("The txOut doesn't have a valid amount");
        return false;
    } else {
        return true;
    }
};

const isTxStructureValid = tx => {
    if(typeof tx.id !== "string") {
        console.log("Tx ID is invalid.");
        return false;
    } else if(!(tx.txIns instanceof Array) ) {
        console.log("The txIns are not an array.");
        return false;
    } else if(!tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)) {
        console.log("The stucture of one of the txIn is invalid.");
        return false;
    } else if(!(tx.txOuts instanceof Array) ) {
        console.log("The txOuts are not an array.");
        return false;
    } else if(!tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)) {
        console.log("The stucture of one of the txOut is invalid.");
        return false;
    } else {
        return true;
    }
};

const validateTxIn = (txIn, tx, uTxOutList) => {
    const wantedTxOut = uTxOutList.find(uTxO => 
        uTxO.txOutId == txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
    );

    if(wantedTxOut === null){
        return false;
    } else {
        const address = wantedTxOut.address;
        const key = ec.keyFromPublic(address, "hex");
        return key.verify(tx.id, txIn.signature);
    }
};

const getAmountInTxIn = (txIn, uTxOutList) => findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTx = (tx, uTxOutList) => {
    
    if(!isTxStructureValid(tx)){
        return false;
    }
    
    if(getTxId(tx) !== tx.id){
        return false;
    }
    
    const hasValidTxIns = tx.txIns.map(txIn => validateTxIn(txIn, tx, uTxOutList));
    
    if(!hasValidTxIns) {
        return;
    }

    const amountInTxIns = tx.txIns
        .map(txIn => getAmountInTxIn(txIn, uTxOutList))
        .reduce((a, b) => a + b, 0);

    const amountInTxOuts = tx.txOuts
        .map(txOut => txOut.amount)
        .reduce((a, b) => a + b, 0);

    if(amountInTxIns !== amountInTxOuts){
        return false;
    } else {
        return true;
    }
};

const validateCoinbaseTx = (tx, blockIndex) => {
    if(getTxId(tx) !== tx.id) {
        return false;
    } else if(tx.txIns.length !== 1) {
        return false;
    } else if(tx.txIns[0].txOutIndex !== blockIndex) {
        return false;
    } else if(tx.txOuts.length !== 1) {
        return false;
    } else if(tx.txOuts[0].amount !== COINBASE_AMOUNT) {
        return false;
    } else {
        return true;
    }
};

const createCoinbaseTx = (address, blockIndex) => {
    const tx = new Transaction();
    const txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;
    tx.txIns = [txIn];
    tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    tx.id = getTxId(tx);
    return tx;
};

const hasDuplicates = (txIns) => {
    const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);

    return _(groups).map(value => {
        if(value > 1){
            console.log("Found a duplicated txIn");
            return true;
        } else {
            return false;
        }
    }).includes(true);
};

const validateBlockTxs = (txs, uTxOutList, blockIndex) => {
    const coinbaseTx = txs[0];
    if(!validateCoinbaseTx(coinbaseTx, blockIndex)){
        console.log("Coinbase Tx is invalid");
    }

    const txIns = _(txs).map(tx => tx.txIns).flatten().value();

    if(hasDuplicates(txIns)){
        console.log("Found duplicated txIns");
        return false;
    }

    const nonCoinbaseTxs = txs.slice(1);

    return nonCoinbaseTxs
        .map(tx => validateTx(tx, uTxOutList))
        .reduce((a, b) => a + b, true);
};

const processTxs = (txs, uTxOutList, blockIndex) => {
    if(!validateBlockTxs(txs, uTxOutList, blockIndex)) {
        return null;
    }
    return updateUTxOuts(txs, uTxOutList);
};

module.exports = {
    getPublicKey,
    getTxId,
    signTxIn,
    TxIn,
    TxOut,
    Transaction,
    createCoinbaseTx,
    processTxs,
    validateTx
};