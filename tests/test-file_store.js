var fileStoreMng = require('../managers/file_store');
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
        var msg = 'You must configure your AWS service in the config file, '
                + '\r\notherwise you must skip this group of tests';

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
        if(!configAWSParam) return done();

        this.timeout(5000);

        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            fileStoreMng.uploadFile('hola', uploadImage.name, file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload invalid filename', function (done) {
        if(!configAWSParam) return done();

        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            fileStoreMng.uploadFile(validBucket, '', file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload invalid file (0 bytes)', function (done) {
        if(!configAWSParam) return done();

        fs.readFile(emptyImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            fileStoreMng.uploadFile(validBucket, emptyImage.name, file, function (err, file) {
                assert.notEqual(err, null);
                done();
            });
        });
    });

    it('upload valid image', function (done) {
        if(!configAWSParam) return done();

        this.timeout(10000);

        fs.readFile(uploadImage.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            fileStoreMng.uploadFile(validBucket, uploadImage.name, file, function (err, file) {
                assert.equal(err, null);
                assert.notEqual(file, null);
                done();
            });
        });
    });

    it('upload valid zip', function (done) {
        if(!configAWSParam) return done();

        fs.readFile(uploadZip.path, function (err, data) {
            assert.equal(err,null);
            var file = new Buffer(data, 'binary');
            fileStoreMng.uploadFile(validBucket, uploadZip.name, file, function (err, file) {
                assert.equal(err, null);
                assert.notEqual(file, null);
                done();
            });
        });
    });

    it('get URL', function (done) {
        if(!configAWSParam) return done();

        fileStoreMng.getFileURL(validBucket, uploadImage.name, function(err, fileURL){
            assert.equal(err, null);
            assert.notEqual(fileURL, null);
            done();
        });
    });


});