var cipherlayer = require('../cipherlayer.js');
var assert = require('assert');
var net = require('net');

var PORT = 3000;

describe('server control ', function(){
    
    it(':: start & stops', function(done){
        cipherlayer.start(PORT, function() {
            var client = net.connect({port:PORT}, function(){
                client.end();

                cipherlayer.stop(function () {
                    var free = true;
                    var tester = net.createServer();
                    tester.once('error', function(err){
                        if(err.code === 'EADDRINUSE'){
                            free = false;
                        }
                    });

                    tester.once('listening', function(){
                        tester.close();
                        if(free) done();
                    });

                    tester.listen(PORT);
                });
            });
        });
    })
});