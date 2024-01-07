const express=require('express');
const routers=express.Router();
const tbhController=require('../controller/thController')
routers.post('/getData',tbhController.getData);
routers.post('/getCountyList',tbhController.getCountyList);
routers.post('/getPlansList',tbhController.getPlansList);
routers.get('/getPlanDetails',tbhController.getPlanDetails);
exports.routes=routers;
