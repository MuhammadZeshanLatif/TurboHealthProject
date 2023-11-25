const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const tbhRouter=require('./routes/tbhRouters');
const server = express();
server.use(cors());
server.use(bodyParser.json())
server.use('/',tbhRouter.routes);
server.listen(3000, console.log("Server start..."))