Running the project:
`docker-compose up --build`

Endpoints:
 - `GET localhost:1234` - retrieve all messages from master node
 - `POST localhost:1234/?m=your_message_here&w=3` - log `your_message_here` message with write concern `w`
 - `GET localhost:1236` - retrieve all messages from secondary_1 node
 - `GET localhost:1237` - retrieve all messages from secondary_2 node
