var assert = require('assert');

var sfPlatform = require('../../src/platforms/salesforce.js');
var config = require('../../config.json');
var SF_PROFILE = require('../resources/sfProfileTemplate.js');

var sfAccessToken = {
	id: "https://login.salesforce.com/id/00Dx0000000BV7z/005x00000012Q9P",
	issued_at: "1278448384422",
	instance_url: "https://na1.salesforce.com",
	signature: "SSSbLO/gBhmmyNUvN18ODBDFYHzakxOMgqYtu+hDPsc=",
	access_token: "00Dx0000000BV7z!AR8AQP0jITN80ESEsj5EbaZTFG0RNBaT1cyWk7TrqoDjoNIWQ2ME_sTZzBjfmOE6zMHq6y8PIW4eWze9JksNEkWUl.Cju7m4"
};

describe('inject expiresAtTimestamp whit refresh token', function () {

	it('expiresAtTimestamp must be provided along with sf refresh token', function (done) {

		sfPlatform.prepareSession(sfAccessToken, 'refreshToken123456', SF_PROFILE, function (err, data) {
			assert.equal(err, null);

			var roundedExpiresAt = (data.expiry / 10000).toFixed();
			var roundedExpectedTimestamp = ((new Date().getTime() + config.salesforce.expiration * 60 * 1000) / 10000).toFixed();
			assert.equal(roundedExpiresAt, roundedExpectedTimestamp);
			done();
		});
	});
});
