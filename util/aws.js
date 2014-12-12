var AWS = require('aws-sdk');
var fs = require('fs');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

AWS.config.update({accessKeyId: config.aws.accessKeyId , secretAccessKey: config.aws.secretAccessKey, region: config.aws.region });

var s3 = new AWS.S3();

function createBucket(bucket, cbk){
    if(!bucket && bucket === ''){
        return cbk({err:'bucket_not_defined'});
    } else {
        var bucketParams = {Bucket: bucket};
        s3.waitFor('bucketExists', bucketParams, function(err, bucket) {
            if (err) {
                s3.createBucket(bucketParams, function(err, bucket) {
                    if (err) {
                        return cbk(err);
                    } else {
                        cbk(null, bucket);
                    }
                });
            } else {
                cbk({err:'bucket_exists'});
            }
        });
    }
}

function uploadFile( bucket, fileName, binaryFile, cbk){
    if(!bucket || bucket === '') {
        return cbk({err:'invalid_bucket'});
    } else if(!fileName || fileName === ''){
        return cbk({err:'invalid_file_name'});
    } else if(!binaryFile || binaryFile.length === 0) {
        return cbk({err:'invalid_file_data'});
    } else {
        var data = {Key: fileName, Body: binaryFile, Bucket: bucket};
        s3.putObject(data, function(err, data){
            if (err) {
                return cbk(err);
            } else {
                cbk(null, data);
            }
        });
    }
}

function getFileURL( bucket, fileName, cbk){
    if(!bucket || bucket === '') {
        return cbk({err:'invalid_bucket'});
    } else if(!fileName || fileName === ''){
        return cbk({err:'invalid_file_name'});
    } else {
        var urlParams = {Bucket: bucket, Key: fileName};
        s3.getSignedUrl('getObject', urlParams, function (err, url) {
            if (err) {
                return cbk(err);
            } else {
                cbk(null, url);
            }
        });
    }
}

//TODO: to find objects in a bucket
//var params = {Bucket: 'myBucket'};
//s3.listObjects(params, function(err, data){
//    var bucketContents = data.Contents;
//    for (var i = 0; i < bucketContents.length; i++){
//        var urlParams = {Bucket: 'myBucket', Key: bucketContents[i].Key};
//        s3.getSignedUrl('getObject',urlParams, function(err, url){
//            console.log('the url of the image is', url);
//        });
//    }
//});


module.exports = {
    uploadFile: uploadFile,
    getFileURL: getFileURL
};