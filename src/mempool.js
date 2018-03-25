const _ = require("lodash"),
  Transactions = require("./transactions");

const { validateTx } = Transactions;

// mempool array : confirm을 요청하는 트랜잭션을 저장
let mempool = [];

// mempool변수가 아닌 클론된 object return
const getMempool = () => _.cloneDeep(mempool);

// mempool에 있는 tx ins을 납작하게 리턴
const getTxInsInPool = mempool => {
  return _(mempool)
    .map(tx => tx.txIns)
    .flatten()
    .value();
};

// mempool에 대상 트랜잭션 검증
const isTxValidForPool = (tx, mempool) => {
  const txInsInPool = getTxInsInPool(mempool);

  // mempool내 tx in이 있는지 검색
  const isTxInAlreadyInPool = (txIns, txIn) => {
    return _.find(txIns, txInInPool => {
      return (
        txIn.txOutIndex === txInInPool.txOutIndex &&
        txIn.txOutId === txInInPool.txOutId
      );
    });
  };

  // 트랜잭션내 tx in이 mempool에 이미 등록여부 확인
  for (const txIn of tx.txIns) {
    if (isTxInAlreadyInPool(txInsInPool, txIn)) {
      return false;
    }
  }
  return true;
};


const hasTxIn = (txIn, uTxOutList) => {
  const foundTxIn = uTxOutList.find(
    uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  );

  return foundTxIn !== undefined;
};

const updateMempool = uTxOutList => {
  const invalidTxs = [];

  for (const tx of mempool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, uTxOutList)) {
        invalidTxs.push(tx);
        break;
      }
    }
  }

  if (invalidTxs.length > 0) {
    mempool = _.without(mempool, ...invalidTxs);
  }
};

// mempool에 트랜잭션과 추가
const addToMempool = (tx, uTxOutList) => {
  // 트랜잭션 검증
  if (!validateTx(tx, uTxOutList)) {
    throw Error("This tx is invalid. Will not add it to pool");
  } else if (!isTxValidForPool(tx, mempool)) {
    throw Error("This tx is not valid for the pool. Will not add it.");
  }

  // mempool에 추가
  mempool.push(tx);
  console.log(getMempool());
};

module.exports = {
  addToMempool,
  getMempool,
  updateMempool
};
