const express=require('express');
const routers=express.Router();
const tbhController=require('../controller/thController')
routers.get('/zipcode/:id/category/:id2',tbhController.getData);
exports.routes=routers;