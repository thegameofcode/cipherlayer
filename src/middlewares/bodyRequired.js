'use strict';

module.exports = function requireBody(req, res, next) {
	var err;
	if (!req.body) {
		err = {
			err: 'invalid_body',
			des: 'The call to this url must have body.'
		};
		res.send(400, err);
		return next(false);
	}

	return next();
};
