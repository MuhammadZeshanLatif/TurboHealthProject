const express=require('express');
const routers=express.Router();
const tbhController=require('../controller/thController')
routers.post('/getData',tbhController.getData);
routers.post('/countryCode',tbhController.getCountry);
exports.routes=routers;
