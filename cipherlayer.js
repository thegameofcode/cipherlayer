var restify = require('restify');

var server = null;

function start(port, cbk){
    server = restify.createServer({
        name: 'test-server'
    });

    server.listen(port, function () {
        cbk();
    });
}

function stop(cbk){
    server.close(function(){
        cbk();
    });
}

module.exports = {
    start : start,
    stop : stop
};