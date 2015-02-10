var request = require('request');
var async = require('async');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var ciphertoken = require('ciphertoken');
var crypto = require('crypto');

var config = require('../../config.json');
var redisMng = require('./redis');

var defaultSettings = config;
var _settings = {};

function sendEmailVerification(email, subject, emailBody, cbk){
    var notifServiceURL = _settings.services.notifications;
    var emailOptions = {
        to: email,
        subject: subject,
        html: emailBody
    };

    var options = {
        url: notifServiceURL + '/notification/email',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(emailOptions)
    };

    request(options, function(err, res, body) {
        if(res.statusCode === 500){
            err = body;
            return cbk(err);
        }
        cbk();
    });
}

function verifyEmail(email, bodyData, cbk){
    if( !_settings.useEmailVerification ) {
        return cbk(null, null);
    }

    if (!email) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty email'
        });
    }

    var transactionId = crypto.pseudoRandomBytes(12).toString('hex');

    var redisKey = config.redisKeys.direct_login_transaction.key;
    redisKey = redisKey.replace('{username}', bodyData.email);
    var redisExp = config.redisKeys.direct_login_transaction.expireInSec;

    redisMng.insertKeyValue(redisKey, transactionId, redisExp, function(err) {
        if(err){
            return cbk(err);
        }
        bodyData.transactionId = transactionId;

        //Get the same expiration as the redis Key
        var tokenSettings = {
            cipherKey: config.accessToken.cipherKey,
            firmKey: config.accessToken.signKey,
            tokenExpirationMinutes: redisExp
        };

        ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function(err, token){
            if(err){
                return cbk(err);
            }

            var link =  _settings.public_url + '/user/activate?verifyToken='+ token;
            var htmlLink = '<a href="' + link+ '">' + link + '</a>';
            var emailText = (_settings.emailVerification.text).replace('{link}', htmlLink);

            var subject = _settings.emailVerification.subject;

            //Send verify email
            sendEmailVerification(email, subject, emailText, function(err){
                if (err) {
                    return cbk(err);
                }
                return cbk(null, email);
            });

        });
    });
}

module.exports = function(settings) {
    _.extend(_settings, defaultSettings, settings);

    return {
        verifyEmail: verifyEmail
    };
};