import url from 'url';
import http from 'http';

const MESSAGES = [];
const { EXTERNAL_PORT_MASTER, INTERNAL_PORT_SEC, SECONDARY_COUNT } = process.env;

const sendMessage = (message, host) => {
    const options = {
        hostname: host,
        port: INTERNAL_PORT_SEC,
        path: `/?message=${message}`,
        method: 'POST',
    };

    return new Promise((resolve) => {
        const req = http.request(options, resolve);
        req.end();    
    });
};

const spreadMessages = (message, hostsCount) => {
    const responsePromises = [];
    for (let i = 1; i <= hostsCount; i++) {
        responsePromises.push(sendMessage(message, `secondary_${i}`));
    }
    return Promise.all(responsePromises);
};

const requestListener = async (req, res) => {
    const { method: METHOD } = req;
    const { query } = url.parse(req.url, true);

    switch (METHOD) {
        case "POST":
            console.log("POST, message received");
            await spreadMessages(query["message"], SECONDARY_COUNT);
            MESSAGES.push(query["message"]);
            res.writeHead(200);
            res.end();
            console.log(`message spread accross ${SECONDARY_COUNT} nodes`);
            break;
        case "GET":
            console.log("GET");
            res.writeHead(200);
            res.end(MESSAGES.join(", "));
            break;
    }
};
  
const server = http.createServer(requestListener);
server.listen(EXTERNAL_PORT_MASTER);

