var fileStoreMng = require('../src/managers/file_store');
var assert = require('assert');
var fs = require('fs');
var config = require('../config.json');

describe('AWS', function () {

	this.timeout(10000);

	var configAWSParam = false;
	var validBucket;

	var uploadImage = {
		name: 'test.jpg',
		path: __dirname + '/test_files/1234.jpg'
	};

	var emptyImage = {
		name: 'test.jpg',
		path: __dirname + '/test_files/empty.jpg'
	};

	var uploadZip = {
		name: 'test.zip',
		path: __dirname + '/test_files/empty proj.zip'
	};

	it('Get AWS configuration', function (done) {
		var msg = 'You must configure your AWS service in the config file, ' +
			'\r\notherwise you must skip this group of tests';

		assert.notEqual(config.aws, null, msg);
		assert.notEqual(config.aws, 'undefined', msg);

		assert.notEqual(config.aws.accessKeyId, null, msg);
		assert.notEqual(config.aws.accessKeyId, 'undefined', msg);

		assert.notEqual(config.aws.secretAccessKey, null, msg);
		assert.notEqual(config.aws.secretAccessKey, 'undefined', msg);

		assert.notEqual(config.aws.region, null, msg);
		assert.notEqual(config.aws.region, 'undefined', msg);

		assert.notEqual(config.aws.buckets, null, msg);
		assert.notEqual(config.aws.buckets, 'undefined', msg);

		assert.notEqual(config.aws.buckets.avatars, null, msg);
		assert.notEqual(config.aws.buckets.avatars, 'undefined', msg);

		validBucket = config.aws.buckets.avatars;

		configAWSParam = true;
		done();
	});

	it('upload invalid bucket', function (done) {
		if (!configAWSParam) return done();

		fs.readFile(uploadImage.path, function (err, data) {
			assert.equal(err, null);
			var file = new Buffer(data, 'binary');
			fileStoreMng.uploadFile('hola', uploadImage.name, file, function (err) {
				assert.notEqual(err, null);
				done();
			});
		});
	});

	it('upload invalid filename', function (done) {
		if (!configAWSParam) return done();

		fs.readFile(uploadImage.path, function (err, data) {
			assert.equal(err, null);
			var file = new Buffer(data, 'binary');
			fileStoreMng.uploadFile(validBucket, '', file, function (err) {
				assert.notEqual(err, null);
				done();
			});
		});
	});

	it('upload invalid file (0 bytes)', function (done) {
		if (!configAWSParam) return done();

		fs.readFile(emptyImage.path, function (err, data) {
			assert.equal(err, null);
			var file = new Buffer(data, 'binary');
			fileStoreMng.uploadFile(validBucket, emptyImage.name, file, function (err) {
				assert.notEqual(err, null);
				done();
			});
		});
	});

	it.skip('upload valid image', function (done) {
		if (!configAWSParam) return done();

		fs.readFile(uploadImage.path, function (err, data) {
			assert.equal(err, null);
			var file = new Buffer(data, 'binary');
			fileStoreMng.uploadFile(validBucket, uploadImage.name, file, function (err, file) {
				assert.equal(err, null);
				assert.notEqual(file, null);
				done();
			});
		});
	});

	it.skip('upload valid zip', function (done) {
		if (!configAWSParam) return done();

		fs.readFile(uploadZip.path, function (err, data) {
			assert.equal(err, null);
			var file = new Buffer(data, 'binary');
			fileStoreMng.uploadFile(validBucket, uploadZip.name, file, function (err, file) {
				assert.equal(err, null);
				assert.notEqual(file, null);
				done();
			});
		});
	});

	it('get URL', function (done) {
		if (!configAWSParam) return done();

		fileStoreMng.getFileURL(validBucket, uploadImage.name, function (err, fileURL) {
			assert.equal(err, null);
			assert.notEqual(fileURL, null);
			done();
		});
	});
});
