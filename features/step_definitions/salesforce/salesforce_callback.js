var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var nock = require('nock');
var url = require('url');

module.exports = function(){
    this.When(/^the client app receives the SalesForce callback response$/, function (callback) {

        var sfAuthUrl = url.parse(config.salesforce.authUrl);
        var sfAuthHost = sfAuthUrl.protocol + '//' + sfAuthUrl.host;
        var sfTokenUrl = url.parse(config.salesforce.tokenUrl);

        nock(sfAuthHost)
            .filteringPath(function(path){
                if(path.indexOf('/services/oauth2/authorize') > -1){
                    return '/services/oauth2/authorize';
                } else {
                    return path;
                }
            })
            .get(sfAuthUrl.path)
            .reply(302, {accessToken:'sf1234'})
            .post(sfTokenUrl.path)
            .reply(200,{
                access_token:'a1b2c3d4e5f6',
                refresh_token:'f6e5d4c3d2a1',
                instance_url:'https://cs15.salesforce.com',
                id:'https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM'
            });

        var sfProfile = {
            "id": "https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM",
            "asserted_user": true,
            "user_id": "005e0000001uNIyAAM",
            "organization_id": "00De00000004cdeEAA",
            "username": "name.lastname@email.com",
            "nick_name": "nick",
            "display_name": "Name Lastname",
            "email": "name.lastname@email.com",
            "email_verified": true,
            "first_name": "Name",
            "last_name": "Lastname",
            "timezone": "Europe/London",
            "addr_street": null,
            "addr_city": null,
            "addr_state": null,
            "addr_country": null,
            "addr_zip": null,
            "mobile_phone": "+34000000000",
            "mobile_phone_verified": true,
            "status": {
                "created_date": null,
                "body": null
            },
            "urls": {
                "enterprise": "https://cs15.salesforce.com/services/Soap/c/{version}/00De00000004cde",
                "metadata": "https://cs15.salesforce.com/services/Soap/m/{version}/00De00000004cde",
                "partner": "https://cs15.salesforce.com/services/Soap/u/{version}/00De00000004cde",
                "rest": "https://cs15.salesforce.com/services/data/v{version}/",
                "sobjects": "https://cs15.salesforce.com/services/data/v{version}/sobjects/",
                "search": "https://cs15.salesforce.com/services/data/v{version}/search/",
                "query": "https://cs15.salesforce.com/services/data/v{version}/query/",
                "recent": "https://cs15.salesforce.com/services/data/v{version}/recent/",
                "profile": "https://cs15.salesforce.com/005e0000001uNIyAAM",
                "feeds": "https://cs15.salesforce.com/services/data/v{version}/chatter/feeds",
                "groups": "https://cs15.salesforce.com/services/data/v{version}/chatter/groups",
                "users": "https://cs15.salesforce.com/services/data/v{version}/chatter/users",
                "feed_items": "https://cs15.salesforce.com/services/data/v{version}/chatter/feed-items",
                "custom_domain": "https://sso-vge--tata.cs15.my.salesforce.com"
            },
            "active": true,
            "user_type": "STANDARD",
            "language": "en_US",
            "locale": "en_GB",
            "utcOffset": 0,
            "last_modified_date": "2014-10-02T15:20:43.000+0000",
            "is_app_installed": true,
            "_photo": null
        };

        nock('https://cs15.salesforce.com')
            .get('/id/00De00000004cdeEAA/005e0000001uNIyAAM')
            .reply(200, sfProfile);

        nock('https://cs15.salesforce.com')
            .get('/services/data/v26.0/chatter/users/005e0000001uNIyAAM')
            .reply(200,sfProfile);

        var followRedirects = world.getUser().username !== undefined;

        var options = {
            url: 'http://localhost:'+config.public_port+'/auth/sf/callback' + ( followRedirects ? '?code=a1b2c3d4e5f6' : ''),
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'GET',
            followAllRedirects: followRedirects
        };

        options.headers[config.version.header] = "test/1";

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            world.getResponse().body = JSON.parse(body);
            callback();
        });

    });
};
