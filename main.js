var cipherLayer = require('./src/cipherlayer');
var fs = require('fs');
var config = require(process.cwd() + '/config.json');

console.log('starting cipherlayer proxy');
cipherLayer.start(config.public_port, config.private_port, function(err){
    if(err){
        console.error('error on launch: ' + err);
    } else {
        console.log('listening on port ' + config.public_port);
    }

    fs.watchFile('config.json', function(){
        console.log('config file updated. exiting');
        process.exit(1);
    });
});
