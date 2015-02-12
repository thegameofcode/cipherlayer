var debug = require('debug')('cipherlayer:routes:auth');
var clone = require('clone');
var request = require('request');
var userDao = require('../dao');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var cryptoMng = require('../managers/crypto')({ password : 'password' });
var emailMng = require('../managers/email');

function sendNewPassword(req, res, next){

    if(!req.params.email){
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'empty email'
        });
        return next(false);
    }

    userDao.getAllUserFields(req.params.email, function(err, foundUser){
        if (!foundUser) {
            res.send(404, {
                err: 'user_not_found',
                des: 'email does not exists'
            });
            return next(false);
        }else{

            var passwd = '';
            for(var i=0; i<6; i++){
                var randomNum = Math.floor(Math.random() * 9);
                passwd += randomNum.toString();
            }

            cryptoMng.encrypt(passwd, function(encryptedPassword){
                var fieldValue = [];

                if(Array.isArray(foundUser.password)){
                    fieldValue = [foundUser.password[0], encryptedPassword];
                }else{
                    fieldValue = [foundUser.password, encryptedPassword];
                }

                userDao.updateField(foundUser._id, 'password', fieldValue, function(err, result){
                    if(err){
                        res.send(500, {
                            err: 'auth_proxy_error',
                            des: 'internal error setting a new password'
                        });

                        return next(false);

                    }else{
                        emailMng().sendEmailForgotPassword(req.params.email, passwd, function(err, result){
                            if(err){
                                res.send(500, { err: 'internalError', des: 'Internal server error'});
                            }else{
                                res.send(204);
                            }
                            return next(false);
                        });
                    }
                });
            });
        }
    });
}

function addRoutes(service){
    service.get('/user/:email/password', sendNewPassword);
    debug('User recover routes added');
}

module.exports = addRoutes;
