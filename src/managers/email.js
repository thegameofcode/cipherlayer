var request = require('request');
var async = require('async');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var cryptoMng = require('./crypto')({ password : 'email' });
var config = require('../../config.json');

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

    cryptoMng.encrypt(JSON.stringify(bodyData), function(encryptedData){
        var link =  _settings.public_url + '/user/activate?verifyToken='+ encryptedData;
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
}

module.exports = function(settings) {
    _.extend(_settings, defaultSettings, settings);

    return {
        verifyEmail: verifyEmail
    };
};