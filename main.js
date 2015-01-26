var debug = require('debug')('cipherlayer:main');
var cipherLayer = require('./src/cipherlayer');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

debug('starting cipherlayer proxy');
cipherLayer.start(config.public_port, config.private_port, function(err){
    if(err){
        debug('error on launch: ' + err);
    } else {
        console.log('listening on port ' + config.public_port);
        debug('listening on port ' + config.public_port);
    }

    fs.watchFile('config.json', function(curr, prev){
        debug('config file updated. exiting');
        process.exit(1);
    });
});
