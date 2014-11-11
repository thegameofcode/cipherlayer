var cipherLayer = require('./cipherlayer');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('config.json','utf8'));

console.log('starting cipherlayer proxy');
cipherLayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
cipherLayer.start(config.listen_port, function(err){
    if(err){
        console.log('error on launch: ' + err);
    } else {
        console.log('listening on port ' + config.listen_port);
    }
});
