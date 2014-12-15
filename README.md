cipherlayer
===========

Security layer based on [OAuth 2.0](http://oauth.net/2/) protocol.
Customers are given tokens to access protected client and these token have all the information about the session.
That way no session information is stored in browsers or applications.


## Installation & tests

You'll need to have mongo & redis installed previously.
Install dependencies with

`npm install`

Make a copy of config_sample.json and name it config.json. The values marked with double {} such as {{SALESFORCE_CLIENT_ID}} must be replaced with the corresponding values.

Start a redis-server and a mongod in background and run tests with

`npm run test`

If everything is ok you can start contributing :)
