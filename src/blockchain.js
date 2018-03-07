const CryptoJS = require("crypto-js");

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
  "4D760E29D232387316E73BA1D90CAA1053829865FDB566AEF47A571B47802DE3",
  null,
  1520389260165,
  "This is the genesis!!"
);

let blockchain = [genesisBlock];

const getLastBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => new Date().getTime() / 1000;

const createHash = (index, previousHash, timestamp, data) => 
    CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data)).toString();

const getBlockchain = () => blockchain;

const createNewBlock = data => {
    const previousBlock = getLastBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const newHash = createHash(newBlockIndex, previousBlock.hash, newTimestamp, data);

    const newBlock = new Block(newBlockIndex, newHash, previousBlock.hash, newTimestamp, data);

    return newBlock;
};

const getBlocksHash = (block) => createHash(block.index, block.previousBlock, block.timestamp, block.data);

const isNewBlockValid = (candidateBlock, latestBlock) => {
    if(!isNewStructureValid(candidateBlock)){
        console.log("The candidate block structure is invaild.");
        return false;
    } else if(latestBlock.index + 1 !== candidateBlock.index){
        console.log("The candidate block doesn't have a valid index.");
        return false;
    } else if(latestBlock.hash !== candidateBlock.previousHash){
        console.log("The previousHash of the candidate block is not the hash of the latest block.");
        return false;
    } else if(getBlocksHash(candidateBlock) !== candidateBlock.hash){
        console.log("The hash of this block is invaild");
        return false;
    }
    return true;
}

const isNewStructureValid = (block) => {
    return (
        typeof block.index === "number" && 
        typeof block.hash === "string" && 
        typeof block.previousHash === "string" && 
        typeof block.timestamp === "number" && 
        typeof block.data === "string"
    );
}

const isChainValid = (condidateChain) => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    if(!isGenesisValid(condidateChain[0])){
        console.log("The candidate chain's genesisBlock is not same as our genesisBlock.");
        return false;
    }
    for(let i=1; i<condidateChain.length; i++){
        if(!isNewBlockValid(candidateChain[i], candidateChain[i - 1])){
            return false;
        }
    }
}

const replaceChain = candidateChain => {
    if(isChainValid(candidateChain) && candidateChain.length > getBlockchain().length) {
        blockchain = candidateChain;
        return true;
    } else {
        return false;
    }
}

const addBlockToChain = candidateBlock => {
    if(isNewBlockValid(candidateBlock, getLastBlock() )){
        getBlockchain().push(candidateBlock);
        return true;
    } else {
        return false;
    }
}