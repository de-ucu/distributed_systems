import url from 'url';
import http from 'http';
import querystring from 'querystring';


const {
    EXTERNAL_PORT_MASTER, INTERNAL_PORT_SEC,
    SECONDARY_COUNT, TIMEOUT, MAX_RETRY_TIMEOUT,
    RETRY_TIMEOUT,
} = process.env;


class Master {
    constructor(config) {
        this.port = +config.port;
        this.timeout = +config.timeout;
        this.retryTimeout = +config.retryTimeout;
        this.maxRetryTimeout = +config.maxRetryTimeout;
        this.secondariesCount = +config.secondaries.count;
        this.secondariesPort = +config.secondaries.port;
        this.secondaries = this.constructor.getSecondariesNames(this.secondariesCount);
        this.health = this.secondaries.reduce((acc, curr) => {
            acc[curr] = {
                up: true,
                retries: 0,
            };
            return acc;
        }, {});
        this.messages = [];
        this.init();
    }

    static getSecondariesNames(count) {
        const names = [];
        for (let i = 1; i <= count; i++) {
            names.push(`http://secondary_${i}`);
        }
        return names;
    }

    static wait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    healthOverlord() {
        const { health } = this;
        const options = {
            port: this.secondariesPort,
            path: '/health',
            method: 'POST',
            timeout: this.timeout,
        };
        setInterval(() => {
            for (const secondary of this.secondaries) {
                const request = http.request(secondary, options, (response) => {
                    const success = response.statusCode == 200;

                    if (!success) {
                        console.log(`${secondary} is sick. Number of unsuccessful retries is ${health[secondary].retries + 1}`)
                    } else if (success && !health[secondary].up) {
                        console.log(`${secondary} is healthy again.`)
                    }

                    health[secondary].up = success;
                    health[secondary].retries = success ? 0 : health[secondary].retries + 1;
                });
                request.on("error", () => {
                    health[secondary].up = false;
                    health[secondary].retries += 1;
                    console.log(`${secondary} is sick. Number of unsuccessful retries is ${health[secondary].retries}`)
                    request.abort();
                });
                request.end();
            }
        }, this.retryTimeout);
    }


    async sendMessage(url, options, callback) {
        const { health } = this;
        let delivered = false;

        while (!delivered) {
            delivered = await new Promise((resolve) => {
                const request = http.request(url, options, (response) => {
                    resolve(response.statusCode == 200);
                });
                request.on("error", (e) => {
                    request.abort();
                    resolve(false);
                });
                request.end();
            });

            await this.constructor.wait(this.retryTimeout + Math.min(this.maxRetryTimeout, this.retryTimeout*health[url].retries));
        }
        callback(delivered);
    }

    async spreadMessages (req, res) {
        const { query } = url.parse(req.url, true);
        const { m, w } = query;

        const acksNeeded =  w || +this.secondariesCount + 1;
        let acksReceived = 0;

        const message = querystring.stringify({
            body: m,
            timestamp: this.messages.length + 1,
        });

        this.messages.push(m);
        acksReceived += 1;

        const options = {
            port: this.secondariesPort,
            path: `/message?${message}`,
            timeout: this.timeout,
            method: 'POST',
        };

        try {
            await new Promise((resolve, reject) => {
                if (acksReceived == acksNeeded) {
                    resolve();
                }

                for (const secondary of this.secondaries) {
                    this.sendMessage(secondary, options, (delivered) => {
                        if (delivered) {
                            acksReceived += 1;
                        }
                        if (acksReceived == acksNeeded) {
                            resolve();
                        }
                    });
                }
            })
        } catch (e) {
            console.log(e)
        } finally {
            if (acksReceived == acksNeeded) {
                res.writeHead(200);
                res.end(`Message "${m}" was delivered after ${acksNeeded} acks`);
            } else {
                res.writeHead(500);
                res.end(`Message "${m}" was not delivered`);
            }
        }
    };

    async router(req, res) {
        const { method: METHOD } = req;

        switch (METHOD) {
            case "POST":
                console.log("POST");
                this.spreadMessages(req, res);
                break;
            case "GET":
                console.log("GET");
                res.writeHead(200);
                res.end(this.messages.map(m => m.body).join(", "));
                break;
        }
    }

    init() {
        const server = http.createServer(this.router.bind(this));
        server.listen(this.port);
        this.healthOverlord();
    }
}



try {
    new Master({
        port: EXTERNAL_PORT_MASTER,
        timeout: TIMEOUT,
        retryTimeout: RETRY_TIMEOUT,
        maxRetryTimeout: MAX_RETRY_TIMEOUT,
        secondaries: {
            count: SECONDARY_COUNT,
            port: INTERNAL_PORT_SEC,
        },
    });
} catch (e) {
    console.log(e)
}
