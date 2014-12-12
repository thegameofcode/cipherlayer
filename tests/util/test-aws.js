var awsMng = require('../../util/aws');
var assert = require('assert');
var async = require('async');
var fs = require('fs')
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

describe('AWS', function() {
    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
        done();
    });

    var validBucket = config.aws.buckets.avatars;

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

    it('upload invalid bucket', function (done) {
        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            awsMng.uploadFile('hola', uploadImage.name, file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload invalid filename', function (done) {
        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            awsMng.uploadFile(validBucket, '', file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload invalid file (0 bytes)', function (done) {
        fs.readFile(emptyImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            awsMng.uploadFile(validBucket, emptyImage.name, file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload valid image', function (done) {
        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            awsMng.uploadFile(validBucket, uploadImage.name, file, function (err, file) {
                assert.equal(err, null);
                assert.notEqual(file, null);
                done();
            });
        });
    });

    it('upload valid zip', function (done) {
        fs.readFile(uploadZip.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            awsMng.uploadFile(validBucket, uploadZip.name, file, function (err, file) {
                assert.equal(err, null);
                assert.notEqual(file, null);
                done();
            });
        });
    });

    it('get URL', function (done) {
        awsMng.getFileURL(validBucket, uploadImage.name, function(err, fileURL){
            assert.equal(err, null);
            assert.notEqual(fileURL, null);
            done();
        });
    });
});