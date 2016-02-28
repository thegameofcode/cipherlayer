'use strict';

var cipherlayer = require('../src/cipherlayer.js');
var config = require('../config.json');

beforeEach(function (done) {
	cipherlayer.start(config.public_port, config.internal_port, done);
});

afterEach(function (done) {
	cipherlayer.stop(done);
});
