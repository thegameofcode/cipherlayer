'use strict';

const daoMng = require('../../managers/dao');
const config = require('../../../config.json');
const ObjectID = require('mongodb').ObjectID;
const crypto = require('../../managers/crypto');
var cryptoMng = crypto(config.password);

module.exports = function postAuthUser(req, res, next) {
	var user = {
		id: req.body.id,
		username: req.body.username,
		password: req.body.password
	};

	if (req.body.id) {
		user.id = req.body.id;
	} else {
		user.id = new ObjectID();
	}

	if (req.body.platforms) {
		user.platforms = req.body.platforms;
	}

	cryptoMng.encrypt(user.password, function (encryptedPwd) {
		user.password = encryptedPwd;

		daoMng.addUser()(user, function (err, createdUser) {
			if (err) {
				res.send(409, err);
			} else {
				var responseUser = {
					username: createdUser.username
				};
				res.send(201, responseUser);
			}
			return next(false);
		});
	});
};
