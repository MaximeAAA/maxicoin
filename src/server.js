const express = require("express"),
    bodyParser = require("body-parser"),
    morgan = require("morgan"),
    Blockchain = require("./blockchain"),
    P2P = require("./p2p"),
    cors = require("cors"),
    _ = require("lodash"),
    Mempool = require("./mempool"),
    Wallet = require("./wallet");

const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet, getPublicFromWallet, getBalance } = Wallet;
const { getMempool } = Mempool;

// typing on your console "export HTTP_PORT=4000"
const PORT = process.env.HTTP_PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("combined"));

app.route("/blocks")
    .get((req, res) => {
        res.send(getBlockchain());
    })
    .post((req, res) => {
        //const { body: { data } } = req;
        //const newBlock = createNewBlock(data);
        const newBlock = createNewBlock();
        res.send(newBlock);
    });

app.post("/peers", (req, res) => {
    const { body: { peer } } = req;
    connectToPeers(peer);
    res.send();
});

// 잔고조회
app.get("/me/balance", (req, res) => {
    const balance = getAccountBalance();
    res.send({balance});
});

app.get("/me/address", (req, res) => {
    res.send(getPublicFromWallet());
});

app.get("/blocks/:hash", (req, res) => {
    const { params: { hash } } = req;
    const block = _.find(getBlockchain(), {hash});
    if(block === undefined){
        res.status(400).send("Block is not found");
    } else {
        res.send(block);
    }
});

app.get("/transactions/:id", (req, res) => {
    const tx = _(getBlockchain()).map(blocks => blocks.id).flatten().find( {id: req.params.id} );
    if(tx === undefined){
        res.status(400).send("Transaction is not found");
    }
    res.send(tx);
});

app.get("/test", (req, res) => {
    const objects = [{ a: 1 }, { b: 2 }];
    var deep = _.cloneDeep(objects);
    res.send(typeof deep);
});

app.route("/transactions")
    .get((req, res) => {
        res.send(getMempool());
    })
    .post((req, res) => {
        try {
            const { body: { address, amount} } = req;
            if(address === undefined || amount === undefined){
                throw Error("Please specify address and an amount ");
            } else {
                const resp = sendTx(address, amount);
                res.send(resp);
            }
        } catch(e) {
            res.status(400).send(e.message);
        }
    });

app.get("/address/:address", (req, res) => {
    const { params: { address} } = req;
    const balance = getBalance(address, getUTxOutList());
    res.send(balance);
});

const server = app.listen(PORT, () => console.log(`Maxicoin Server is running on port ${PORT}`));

initWallet();
startP2PServer(server);
