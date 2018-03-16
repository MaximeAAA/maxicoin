const WebSockets = require("ws"),
    BlockChain = require("./blockchain");

const {
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  getBlockchain
} = BlockChain;

const sockets = [];

// Messages Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

// Messages Creators
const getLastest = () => {
    return {
        type: GET_LATEST,
        data: null
    };
};

const getAll = () => {
    return {
        type: GET_ALL,
        data: null
    };
};

const blockchainResponse = (data) => {
    return {
        type: BLOCKCHAIN_RESPONSE,
        data
    };
};

const getSockets = () => sockets;

const startP2PServer = server => {
    const wsServer = new WebSockets.Server({server});
    wsServer.on("connection", ws => {
        initSocketConnection(ws);
    });
    console.log("Maxicoin P2P Server is running!");
};

const initSocketConnection = ws => {
    sockets.push(ws);
    handleSocketMessages(ws);
    handleSocketError(ws);
    sendMessage(ws, getLastest());
};

const parseData = data => {
    try {
        return JSON.parse(data);
    } catch(e) {
        console.log(e);
        return null;
    }
};

const handleSocketMessages = ws => {
    ws.on("message", data => {
        const message = parseData(data);
        if(message === null){
            return;
        }

        console.log(message);
        switch (message.type) {
            case GET_LATEST:
                sendMessage(ws, responseLatest());
                break;

            case GET_ALL:
                sendMessage(ws, responseAll());
                break;
                
            case BLOCKCHAIN_RESPONSE:
                const receivedBlocks = message.data;
                if(receivedBlocks === null){
                    break;
                }

                handleBlockchainResponse(receivedBlocks);
                break;
        }
    });
};

const handleBlockchainResponse = receivedBlocks => {
    if(receivedBlocks === 0){
        console.log("Received blocks have a length of 0.");
        return;
    }

    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if(!isBlockStructureValid(latestBlockReceived)){
        console.log("The block structure of this block received is invaild.");
        return;
    }

    const newestBlock = getNewestBlock();
    if(latestBlockReceived.index > newestBlock.index){
        if(newestBlock.hash === latestBlockReceived.previousHash){
            if(addBlockToChain(latestBlockReceived)) {
                broadcastNewBlock();
            }
        } else if(receivedBlocks.length === 1){
            // to do, get all the blocks, we are behind
            sendMessageToAll(getAll());
        } else {
            replaceChain(receivedBlocks);
        }
    }

};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageToAll = message => sockets.forEach(ws => sendMessage(ws, message));

const responseLatest = () => blockchainResponse([getNewestBlock()]);

const responseAll = () => blockchainResponse(getBlockchain());

const broadcastNewBlock = () => sendMessageToAll(responseLatest());

const handleSocketError = ws => {
    const closeSocketConnection = ws => {
        ws.close();
        sockets.splice(sockets.indexOf(ws), 1);
    }
    ws.on("close", () => closeSocketConnection(ws));
    ws.on("error", () => closeSocketConnection(ws));
};

const connectToPeers = newPeer => {
    const ws = new WebSockets(newPeer);
    ws.on("open", () => {
        initSocketConnection(ws);
    });
};

module.exports = {
    startP2PServer,
    connectToPeers,
    broadcastNewBlock
};