var cipherlayer = require('../cipherlayer');

module.exports = function(){
    this.Before(function(done){
        cipherlayer.start(3000, done);
    });

    this.After(function(done){
        cipherlayer.stop(done);
    });
};