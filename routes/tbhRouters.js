const express=require('express');
const routers=express.Router();
const tbhController=require('../controller/thController')
routers.post('/demo',tbhController.getData);
exports.routes=routers;
