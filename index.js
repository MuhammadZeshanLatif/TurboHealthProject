const express = require('express');
const tbhRouter=require('./routes/tbhRouters');
const server = express();
server.use('/',tbhRouter.routes);

server.listen(3000, console.log("Server start..."))
