var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

var SF_PROFILE = {
    "id": "https://login.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM",
    "asserted_user": true,
    "user_id": "005e0000001uNIyAAM",
    "organization_id": "00De00000004cdeEAA",
    "username": "name.lastname" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
    "nick_name": "nick",
    "display_name": "Name Lastname",
    "email": "name.lastname" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
    "email_verified": true,
    "first_name": "Name",
    "last_name": "Lastname",
    "timezone": "Europe/London",
    "photos": {
        "picture": "https://c.cs15.content.force.com/profilephoto/005/F",
        "thumbnail": "https://c.cs15.content.force.com/profilephoto/005/T"
    },
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
        "profile": "https://cs15.salesforce.com/005e0000001uNIyAAM",
        "users": "https://cs15.salesforce.com/services/data/v{version}/chatter/users"
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

module.exports = SF_PROFILE;
