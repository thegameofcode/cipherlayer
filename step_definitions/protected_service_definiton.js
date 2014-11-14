var world = require('../support/world');
var nock = require('nock');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^protected service replies to a (.*) request to (.*) with status (.*) and a body (.*)$/, function (METHOD, PATH, STATUS, PAYLOAD, callback){
        var scope = nock('http://localhost:'+config.private_port, {
            reqheaders: {
                'x-user-id': world.getUser().username
            }
        });

        switch(METHOD){
            case 'GET':
                scope = scope.get(PATH);
                break;
            case 'POST':
                scope = scope.post(PATH);
                break;
            default:
                return callback.fail('method '+ METHOD +' is not defined in step_definition');
        }

        scope.reply(STATUS, JSON.parse(PAYLOAD));
        callback();
    });
};
