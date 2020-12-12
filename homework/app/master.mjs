import url from 'url';
import http from 'http';


const MESSAGES = [];
const { EXTERNAL_PORT_MASTER, INTERNAL_PORT_SEC, SECONDARY_COUNT, TIMEOUT } = process.env;


const spreadMessages = async (req, res) => {
    const { query } = url.parse(req.url, true);
    const { message, w } = query;
    
    const acksNeeded = w || +SECONDARY_COUNT + 1;
    let acksReceived = 0;

    MESSAGES.push(message);
    acksReceived += 1;

    const options = {
        port: INTERNAL_PORT_SEC,
        path: `/?message=${message}`,
        method: 'POST',
    };

    try {
        await new Promise((resolve, reject) => {
            if (acksReceived == acksNeeded) {
                resolve();
            }
    
            for (let i = 1; i <= SECONDARY_COUNT; i++) {
                const secondaryRequest = http.request(`http://secondary_${i}`, options, (internalResponse) => {
                    if (internalResponse.statusCode == 200) {
                        acksReceived += 1;
                    }
                    if (acksReceived == acksNeeded) {
                        resolve();
                    }
                });

                setTimeout(() => {
                    secondaryRequest.abort();
                    reject(new Error("Timeout"));
                }, TIMEOUT);

                secondaryRequest.on("error", (e) => {
                    console.log(e);
                });

                secondaryRequest.end();
            }
        })
    } catch (e) {
        console.log(e)
    } finally {
        if (acksReceived == acksNeeded) {
            res.writeHead(200);
            res.end(`Message "${message}" was delivered after ${acksNeeded} acks`);
        } else {
            res.writeHead(500);
            res.end(`Message "${message}" was not delivered`);
        }
    }
};


const requestListener = async (req, res) => {
    const { method: METHOD } = req;

    switch (METHOD) {
        case "POST":
            console.log("POST");            
            spreadMessages(req, res);
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

