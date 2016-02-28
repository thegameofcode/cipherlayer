'use strict';

const cipherlayer = require('../src/cipherlayer');
const config = require('../config.json');

beforeEach(function (done) {
	cipherlayer.start(config.public_port, config.internal_port, done);
});

afterEach(cipherlayer.stop);
