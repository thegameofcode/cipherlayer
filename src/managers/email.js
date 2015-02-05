var request = require('request');
var async = require('async');

var fs = require('fs');
var path = require('path');
var config = require('../../config.json');

function sendEmailVerification(email, emailBody, cbk){
    var notifServiceURL = config.services.notifications;
    var emailOptions = {
        to: email,
        subject: 'MyContacts email verification ',
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

module.exports = {
    sendEmailVerification : sendEmailVerification
};