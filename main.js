var cipherLayer = require('./cipherlayer');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

console.log('starting cipherlayer proxy');
cipherLayer.start(config.public_port, config.private_port, function(err){
    if(err){
        console.log('error on launch: ' + err);
    } else {
        console.log('listening on port ' + config.public_port);
    }
});
