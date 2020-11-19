import url from 'url';
import http from 'http';


const MESSAGES = [];
const MIN_DELAY = 1000;
const MAX_DELAY = 4000;
const { INTERNAL_PORT_SEC, EXTERNAL_PORT_SEC } = process.env;

const internalListener = (req, res) => {
    const DELAY = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;

    const { method: METHOD } = req;
    const { query } = url.parse(req.url, true);

    if (METHOD === "POST") {
        MESSAGES.push(query["message"]);
        setTimeout(() => {
            console.log(`received with ${DELAY} delay`);
            res.writeHead(200);
            res.end();
        }, DELAY);    
    } else {
        res.writeHead(400);
        res.end();
    }
}

const externalListener = (req, res) => {
    const { method: METHOD } = req;
    
    if (METHOD === "GET") {
        console.log(METHOD);
        res.writeHead(200);
        res.end(MESSAGES.join(", "));
    } else {
        console.error(METHOD);
        res.writeHead(400);
        res.end("Illegal request");
    }
}

http.createServer(internalListener).listen(INTERNAL_PORT_SEC);
http.createServer(externalListener).listen(EXTERNAL_PORT_SEC);
