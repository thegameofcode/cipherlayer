'use strict';

const AWS = require('aws-sdk');
const https = require('https');
const config = require('../../config.json');

let s3;

function initAWS(cbk) {
	if (!config.aws) {
		return cbk();
	}

	AWS.config.update({
		accessKeyId: config.aws.accessKeyId,
		secretAccessKey: config.aws.secretAccessKey,
		region: config.aws.region
	});
	s3 = new AWS.S3();
	return cbk(true);
}

function uploadFile(bucket, fileName, binaryFile, cbk) {
	initAWS(function (started) {
		if (!started) {
			return cbk({err: 'cannot_initialize_AWS_service'});
		}
		if (!bucket || bucket === '') {
			return cbk({err: 'invalid_bucket'});
		} else if (!fileName || fileName === '') {
			return cbk({err: 'invalid_file_name'});
		} else if (!binaryFile || binaryFile.length === 0) {
			return cbk({err: 'invalid_file_data'});
		}

		const data = {Key: fileName, Body: binaryFile, Bucket: bucket, ACL: 'public-read'};
		s3.putObject(data, function (err, res) {
			if (err) {
				return cbk(err);
			}
			return cbk(null, res);
		});
	});
}

function getFileURL(bucket, fileName, cbk) {
	initAWS(function (started) {
		if (!started) {
			return cbk({err: 'cannot_initialize_AWS_service'});
		}

		if (!bucket || bucket === '') {
			return cbk({err: 'invalid_bucket'});
		} else if (!fileName || fileName === '') {
			return cbk({err: 'invalid_file_name'});
		}

		const urlParams = {Bucket: bucket, Key: fileName};
		s3.getSignedUrl('getObject', urlParams, function (err, url) {
			let signedUrl = url;
			if (err) {
				return cbk(err);
			}
			if (url.indexOf('?') > -1) {
				signedUrl = url.substr(0, url.indexOf('?'));
			}
			return cbk(null, signedUrl);
		});
	});
}

function uploadAvatarToAWS(httpsAvatarUrl, avatarName, cbk) {

	const validBucket = config.aws.buckets.avatars;

	https.get(httpsAvatarUrl, function (res) {
		if (res.statusCode !== 200) {
			return cbk({err: 'avatar_inaccessible'});
		}
		const data = [];
		let dataLen = 0;

		res.on('data', function (chunk) {
			data.push(chunk);
			dataLen += chunk.length;
		});

		res.on('end', function () {
			const buf = new Buffer(dataLen);


			// TODO: replace for with map()
			for (let i = 0, len = data.length, pos = 0; i < len; i++) {
				data[i].copy(buf, pos);
				pos += data[i].length;
			}

			//Save in S3
			uploadFile(validBucket, avatarName, buf, function (err) {
				if (err) {
					return cbk({err: 'avatar_not_uploaded'});
				}

				getFileURL(validBucket, avatarName, function (err, fileURL) {
					if (err) {
						return cbk({err: 'avatar_address_inaccessible'});
					}
					return cbk(null, fileURL);
				});
			});
		});
	});
}

module.exports = {
	uploadFile,
	getFileURL,
	uploadAvatarToAWS
};
