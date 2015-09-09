var cipherlayer = require('../src/cipherlayer.js');
var assert = require('assert');
var net = require('net');
var config = require('../config.json');

describe('server control ', function(){
    it('start', function(done){
        cipherlayer.start(config.public_port, config.private_port, function(err) {
            assert.equal(err,null);
            var client = net.connect({port:config.public_port}, function(){
                client.destroy();
                done();
            });
        });
    });

    it('stop', function(done){
        cipherlayer.stop(function () {
            var free = true;
            var tester = net.createServer();
            tester.once('error', function(err){
                if(err.code === 'EADDRINUSE'){
                    free = false;
                }
            });

            tester.once('listening', function(){
                tester.close(function(){
                    if(free) done();
                });
            });

            tester.listen(config.public_port);
        });
    });
});
