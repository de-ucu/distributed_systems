Running the project:
`docker-compose up --build`

Endpoints:
 - `GET localhost:1234` - retrieve all messages from master node
 - `POST localhost:1234/?message=your_message_here` - log `your_message_here` message
 - `GET localhost:1236` - retrieve all messages from secondary_1 node
 - `GET localhost:1237` - retrieve all messages from secondary_2 node
