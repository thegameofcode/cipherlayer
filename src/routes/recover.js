var debug = require('debug')('cipherlayer:routes:auth');
var clone = require('clone');
var request = require('request');
var userDao = require('../dao');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));


function recoverUserPassWord(req, res, next){

    if(!req.params.email){
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'empty country code'
        });
        return next(false);
    }

    userDao.getAllUserFields(req.params.email, function(err, foundUser){
        if (!foundUser) {
            res.send(403, {
                err: 'auth_proxy_error',
                des: 'user not found'
            });
            return next(false);
        }else{

            var passwd = '';
            for(var i=0; i<6; i++){
                var randomNum = Math.floor(Math.random() * 9);
                passwd += randomNum.toString();
            }

            var fieldValue = [];

            if(Array.isArray(foundUser.password)){
                fieldValue = [foundUser.password[0], passwd];
            }else{
                fieldValue = [foundUser.password, passwd];
            }


            userDao.updateField(foundUser._id, 'password', fieldValue, function(err, result){
                if(err){
                    res.send(403, {
                        err: 'auth_proxy_error',
                        des: 'user already exists'
                    });
                    return next(false);

                }else{

                    var html = config.recoverMessage.body.replace("__PASSWD__", passwd);

                    var body = {
                        to: req.params.email,
                        subject: config.recoverMessage.subject ,
                        html: html
                    };

                    var options = {
                        url: config.services.notifications + '/notification/email',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        method: 'POST',
                        body: JSON.stringify(body)
                    };

                    request(options, function(err, private_res, body){
                        if(err){
                            res.send(500, { err: 'internalError', des: 'Internal server error'});
                        }else{
                            res.send(204);
                        }
                        return next(false);

                    });

                }
            });
        }
    });
}

function addRoutes(service){
    service.get('/user/:email/password', recoverUserPassWord);
    debug('User recover routes added');
}

module.exports = addRoutes;
