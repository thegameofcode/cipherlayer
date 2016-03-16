'use strict';

module.exports = function (err, res, next) {
	if (!err.code) {
		res.send(500, err.des ? err : {des:err});
		return next(err);
	}

	const errCode = err.code;
	delete(err.code);
	res.send(errCode, err);
	return next(err);

};
