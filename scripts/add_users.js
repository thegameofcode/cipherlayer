var async = require('async'),
    fs = require('fs'),
    nock = require('nock'),
    userMng = require('../src/managers/user'),
    config = require('../config.json'),
    userDao = require('../src/managers/dao.js');
/*
 * Objects for `async.eachSeries`
 */

// Function to apply to each fixture
var addFixture = function(fixture, callback) {

    var data = fixture;

    // Define user object to be passed to userMng
    var pin = null;
    var profileBody = {
        id: data._id.$oid || data._id,
        email: data.email,
        password: data.password || (process.env.DEFAULT_PASS ? process.env.DEFAULT_PASS : "qwerty")
    };

    if(!profileBody.id || !profileBody.email || !profileBody.password) {
        console.log("Missing mandatory parameter(s)");
        return callback();
    }
    // Nock the createUser URL
    nock('http://' + config.private_host + ':' + config.private_port + config.passThroughEndpoint.path, { reqheaders: {
        'Content-Type': 'application/json; charset=utf-8'
    }})
        .post(config.passThroughEndpoint.path)
        .reply(201,profileBody);

    // Save user data to database
    userMng().createUser(profileBody, pin, function(err) {
        if(err) {

            if (err.err === 'auth_proxy_user_error') {
                console.log(profileBody.email + " " + err.des);
                return callback();
            }
            return callback(err);
        }
        console.log(profileBody.email + " added");
        return callback();
    });

};

/*
 * Main part of the script:
 *  - Exports the function, or
 *  - Executes the function if running from CLI
 */
var runLoadFixtures = module.exports = function(fixtureFile, callback) {

            console.log("running Load Fixtures");


            async.eachSeries(fixtureFile, addFixture, callback);

};

if (!module.parent) { // Run as CLI command exec
    async.series([

        // Start cipherLayer components (mongodb, redis...)
        function connect(done) {
            userDao.connect(done);
        },

        function drop(done) {
            if(!process.env.DROP_DB) return done();
            console.log("Dropping database");
            userDao.deleteAllUsers(done);
        },

        function load(done) {
            fixtureFile = require(__dirname + '/' + '../tests/fixtures/' + 'User.json');
            runLoadFixtures(fixtureFile,done);
        },

        function disconnect(done) {
            userDao.disconnect(done);
        }

    ], function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        console.info('Fixtures loaded');
        process.exit();
    });

}
