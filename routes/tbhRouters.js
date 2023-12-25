const express=require('express');
const routers=express.Router();
const tbhController=require('../controller/thController')
routers.post('/getData',tbhController.getData);
routers.post('/getPlanDetails',tbhController.getCountry);
routers.post('/getPlansList',tbhController.getCountry);
routers.post('/getPlanDetails',tbhController.getCountry);
exports.routes=routers;
