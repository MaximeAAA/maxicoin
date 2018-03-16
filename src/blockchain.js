const CryptoJS = require("crypto-js"),
    _ = require("lodash"),
    hexToBinary = require("hex-to-binary"),
    Mempool = require("./mempool"),
    Wallet = require("./wallet"),
    Transactions = require("./transactions");

const { getBalance, getPublicFromWallet, getPrivateFromWallet, createTx } = Wallet;
const { createCoinbaseTx, processTxs } = Transactions;
const { addToMempool, getMempool, updateMempool } = Mempool;
    
const BLOCK_GENERATION_INTERVAL = 10; // every 10 blocks how many minutes I want my block generate in seconds
const DIFFICULTY_ADJUSMENT_INTERVAL = 10; //Bitcoin is 2016; how often calculate the block, incease or decrease by 10

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
  "4D760E29D232387316E73BA1D90CAA1053829865FDB566AEF47A571B47802DE3",
  null,
  1520909134,
  "This is the genesis!!",
  0,
  0
);

let blockchain = [genesisBlock];

let uTxOuts = [];

// 블록배열중 가장 마지막 블록
const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => Math.round(new Date().getTime() / 1000);

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) => {
    //console.log(index, previousHash, timestamp, data);
    return CryptoJS.SHA256(
                index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
           ).toString();
}

// 블록배열 리턴
const getBlockchain = () => blockchain;

const createNewBlock = () => {
    const coinbaseTx = createCoinbaseTx(getPublicFromWallet(), getNewestBlock().index + 1);

    const blockData = [coinbaseTx].concat(getMempool());
    return createNewRawBlock(blockData);
}

const createNewRawBlock = data => {
    const previousBlock = getNewestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const difficulty = findDifficulty();

    const newBlock = findBlock(newBlockIndex, previousBlock.hash, newTimestamp, data, difficulty);

    addBlockToChain(newBlock);
    require("./p2p").broadcastNewBlock();

    return newBlock;
};

const findDifficulty = () => {
    const newestBlock = getNewestBlock();
    if(newestBlock.index % DIFFICULTY_ADJUSMENT_INTERVAL === 0 && newestBlock.index !== 0){
        // calculate new difficulty, newestBlock is 0 = genesis block
        return calculateNewDifficulty(newestBlock, getBlockchain());
    } else {
        return newestBlock.difficulty;
    }
};

const calculateNewDifficulty = (newestBlock, blockchain) => {
    const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSMENT_INTERVAL;

    const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
    if(timeTaken < timeExpected / 2){
        return lastCalculatedBlock.difficulty + 1;
    } else if(timeTaken > timeExpected * 2){
        return lastCalculatedBlock.difficulty - 1;
    } else {
        return lastCalculatedBlock.difficulty;
    }
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while(true){
        console.log(`Current nonce: ${nonce}`);
        const hash = createHash(index, previousHash, timestamp, data, difficulty, nonce);
        // check amount of zeros(hash matches difficulty)
        if(hashMatchesDifficulty(hash, difficulty)){
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredZeros = "0".repeat(difficulty);
    console.log(`diffulty : ${difficulty}, with hash: ${hashInBinary}`);
    return hashInBinary.startsWith(requiredZeros);
};


// 입력받은 block으로 hash 구하기
const getBlocksHash = (block) => 
    createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const isTimestampValid = (newBlock, oldBlock) => {
    return (
        oldBlock.timestamp - 60 < newBlock.timestamp && 
        newBlock.timestamp - 60 < getTimestamp()
    );
};

// 블록 검증
const isBlockValid = (candidateBlock, latestBlock) => {
    // 블록의 타입구조 검증
    if(!isBlockStructureValid(candidateBlock)){
        console.log("The candidate block structure is invaild.");
        return false;

    // index number 검증
    } else if(latestBlock.index + 1 !== candidateBlock.index){
        console.log("The candidate block doesn't have a valid index.");
        return false;

    // hash 검증(직전블록과 대상블록간)
    } else if(latestBlock.hash !== candidateBlock.previousHash){
        console.log("The previousHash of the candidate block is not the hash of the latest block.");
        return false;

    // hash 검증(대상블록에 저장된 hash와 대상블록의 데이터로 hash를 구한값을 비교)
    } else if(getBlocksHash(candidateBlock) !== candidateBlock.hash){
        console.log("The hash of this block is invaild.");
        return false;
    } else if(!isTimestampValid(candidateBlock, latestBlock)){
        console.log("The timestamp of this block is dogdy.");
        return false;
    }
    return true;
}

// block의 타입 체크
const isBlockStructureValid = (block) => {
    return (
        typeof block.index === "number" && 
        typeof block.hash === "string" && 
        typeof block.previousHash === "string" && 
        typeof block.timestamp === "number" && 
        typeof block.data === "object"
    );
}

// 체인 검증
const isChainValid = (condidateChain) => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    // genesis 블록 검증
    if(!isGenesisValid(condidateChain[0])){
        console.log("The candidate chain's genesisBlock is not same as our genesisBlock.");
        return false;
    }

    // 대상체인내 genesis블록 이후부터 순차 검증
    for(let i=1; i<condidateChain.length; i++){
        if(!isBlockValid(candidateChain[i], candidateChain[i - 1])){
            return false;
        }
    }
}

const sumDifficulty = anyBlockChain => 
    anyBlockChain
        .map(block => block.difficulty)
        .map(difficulty => Math.pow(2, difficulty)).reduce((a, b) => a + b);

// 새로운체인을 검증하여 올바른체인 + 복잡도검증 통과하면 blockchain변수를 덮어쓰기
const replaceChain = candidateChain => {
    if(isChainValid(candidateChain) && 
       sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
    ) {
        blockchain = candidateChain;
        return true;
    } else {
        return false;
    }
}

// 블록배열에 새로운 블록 추가, 대상블록과 가장 최근 블록을 검증 후 추가
const addBlockToChain = candidateBlock => {
    if(isBlockValid(candidateBlock, getNewestBlock() )){
        const processedTxs = processTxs(candidateBlock.data, uTxOuts, candidateBlock.index);
        if(processedTxs === null){
            console.log("Couldn't process txs");
            return false;
        } else {
            getBlockchain().push(candidateBlock);
            uTxOuts = processedTxs;
            updateMempool(uTxOuts);
            return true;
        }
        return true;
    } else {
        return false;
    }
}

const getUTxOutList = () => _.cloneDeep(uTxOuts);

const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);

const sendTx = (address, amount) => {
    const tx = createTx(
        address, 
        amount, 
        getPrivateFromWallet(), 
        getUTxOutList(), 
        getMempool()
    );
    addToMempool(tx, getUTxOutList());
    return tx;
};

module.exports = {
    getNewestBlock,
    getBlockchain,
    createNewBlock,
    isBlockStructureValid,
    addBlockToChain,
    replaceChain,
    getAccountBalance,
    sendTx
};