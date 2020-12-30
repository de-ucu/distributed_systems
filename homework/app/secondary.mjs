import url from 'url';
import http from 'http';


const MIN_DELAY = 1000;
const MAX_DELAY = 20000;
const { INTERNAL_PORT_SEC, EXTERNAL_PORT_SEC } = process.env;


class Secondary {
    constructor(config) {
        this.internalPort = config.internalPort;
        this.externalPort = config.externalPort;
        this.minDelay = config.minDelay;
        this.maxDelay = config.maxDelay;
        this.buffer = [];
        this.messages = [];
        this.init();
    }

    static sortMessages(array) {
        return array.sort((a, b) => a.timestamp - b.timestamp);
    }

    checkIfMessageIsNext(message = null) {
        const { buffer, messages } = this;
        const lastMessageTimestamp = messages.length ? messages[messages.length - 1].timestamp : 0;
        const messageToCheck = message ? message : this.constructor.sortMessages(buffer)[0];

        return messageToCheck.timestamp - lastMessageTimestamp == 1;
    }

    bufferOverlord() {
        const { buffer, messages } = this;
        setInterval(() => {
            if (buffer.length && this.checkIfMessageIsNext()) {
                const message = buffer.shift()
                messages.push(message);
                console.log(`Message "${message.body}" with timestamp=${message.timestamp} was delivered from buffer.`);
            }
        }, 1000);
    }

    messageIsPresent(message, messages) {
        for (const item of messages) {
            if (item.timestamp == message.timestamp) {
                return true;
            }
        }
        return false;
    }

    handleMessage(message, res) {
        const { buffer, messages } = this;
        const { body, timestamp } = message;
        const DELAY = Math.floor(Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;

        setTimeout(() => {
            let logMessage = `Message "${body}" with timestamp=${timestamp} was received `;

            if (this.messageIsPresent(message, this.messages)) {
                logMessage += "(DUP!)."
            } else if (!this.checkIfMessageIsNext(message) && !this.messageIsPresent(message, this.buffer)) {
                buffer.push(message);
                this.constructor.sortMessages(buffer);
                logMessage += "and put into buffer."
            } else {
                messages.push(message);
                logMessage += `with delay=${DELAY} and delivered.`
            }

            console.log(logMessage);
            res.writeHead(200);
            res.end();
        }, DELAY);
    }

    async internalRouter(req, res) {
        const { method: METHOD } = req;
        const { query, pathname } = url.parse(req.url, true);

        if (METHOD === 'POST' && pathname == '/message') {
            this.handleMessage(query, res);
        } else {
            const statusCode = (pathname == '/health') ? 200 : 400;
            res.writeHead(statusCode);
            res.end();
        }
    }

    async externalRouter(req, res) {
        const { method: METHOD } = req;

        if (METHOD === "GET") {
            console.log(METHOD);
            res.writeHead(200);
            res.end(this.messages.map(m => m.body).join(", "));
        } else {
            console.error(METHOD);
            res.writeHead(400);
            res.end("Illegal request");
        }
    }

    init() {
        http.createServer(this.internalRouter.bind(this)).listen(this.internalPort);
        http.createServer(this.externalRouter.bind(this)).listen(this.externalPort);
        this.bufferOverlord();
    }
}



try {
    new Secondary({
        internalPort: INTERNAL_PORT_SEC,
        externalPort: EXTERNAL_PORT_SEC,
        minDelay: MIN_DELAY,
        maxDelay: MAX_DELAY,
    });
} catch (e) {
    console.log(e)
}

