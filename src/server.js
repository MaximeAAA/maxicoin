const express = require("express"),
    bodyParser = require("body-parser"),
    morgan = require("morgan"),
    Blockchain = require("./blockchain"),
    P2P = require("./p2p"),
    Wallet = require("./wallet")

const { getBlockchain, createNewBlock, getAccountBalance, sendTx } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet } = Wallet;

// typing on your console "export HTTP_PORT=4000"
const PORT = process.env.HTTP_PORT || 3000;

const app = express();
app.use(bodyParser.json());
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

app.get("/me/balance", (req, res) => {
    const balance = getAccountBalance();
    res.send({balance});
});

app.route("/transactions")
    .get((req, res) => {

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

const server = app.listen(PORT, () => console.log(`Maxicoin Server is running on port ${PORT}`));

initWallet();
startP2PServer(server);