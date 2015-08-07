var AWS = require('aws-sdk');
var fs = require('fs');
var https = require('https');
var config = require(process.cwd() + '/config.json');

var s3;

function initAWS(cbk){
    if(!config.aws){
        return cbk(false);
    }

    AWS.config.update({accessKeyId: config.aws.accessKeyId , secretAccessKey: config.aws.secretAccessKey, region: config.aws.region });
    s3 = new AWS.S3();
    cbk(true);
}

function uploadFile( bucket, fileName, binaryFile, cbk) {
    initAWS(function (started) {
        if (!started) {
            return cbk({err: 'cannot_initialize_AWS_service'});
        } else {
            if (!bucket || bucket === '') {
                return cbk({err: 'invalid_bucket'});
            } else if (!fileName || fileName === '') {
                return cbk({err: 'invalid_file_name'});
            } else if (!binaryFile || binaryFile.length === 0) {
                return cbk({err: 'invalid_file_data'});
            } else {
                var data = {Key: fileName, Body: binaryFile, Bucket: bucket, ACL: 'public-read'};
                s3.putObject(data, function (err, data) {
                    if (err) {
                        return cbk(err);
                    } else {
                        cbk(null, data);
                    }
                });
            }
        }
    });
}

function getFileURL( bucket, fileName, cbk){
    initAWS( function (started){
        if(!started) {
            return cbk({err: 'cannot_initialize_AWS_service'});
        } else {

            if (!bucket || bucket === '') {
                return cbk({err: 'invalid_bucket'});
            } else if (!fileName || fileName === '') {
                return cbk({err: 'invalid_file_name'});
            } else {
                var urlParams = {Bucket: bucket, Key: fileName};
                s3.getSignedUrl('getObject', urlParams, function (err, url) {
                    if (err) {
                        return cbk(err);
                    } else {
                        if(url.indexOf('?')> -1){
                            url = url.substr(0,url.indexOf('?'));
                        }
                        cbk(null, url);
                    }
                });
            }
        }
    });
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

//TODO: CREATE BUCKET
//function createBucket(bucket, cbk){
//    if(!bucket && bucket === ''){
//        return cbk({err:'bucket_not_defined'});
//    } else {
//        var bucketParams = {Bucket: bucket};
//        s3.waitFor('bucketExists', bucketParams, function(err, bucket) {
//            if (err) {
//                s3.createBucket(bucketParams, function(err, bucket) {
//                    if (err) {
//                        return cbk(err);
//                    } else {
//                        cbk(null, bucket);
//                    }
//                });
//            } else {
//                cbk({err:'bucket_exists'});
//            }
//        });
//    }
//}

function uploadAvatarToAWS(httpsAvatarUrl, avatarName, cbk){

    var validBucket = config.aws.buckets.avatars;

    https.get(httpsAvatarUrl, function (res) {
        if (res.statusCode !== 200) {
            return cbk({err: 'avatar_inaccessible'});
        }
        var data = [], dataLen = 0;

        res.on("data", function (chunk) {
            data.push(chunk);
            dataLen += chunk.length;
        });

        res.on("end", function () {
            var buf = new Buffer(dataLen);
            for (var i=0,len=data.length,pos=0; i<len; i++) {
                data[i].copy(buf, pos);
                pos += data[i].length;
            }

            //Save in S3
            uploadFile(validBucket, avatarName, buf, function (err, file) {
                if(err){
                    //TODO line on debug with the error
                    return cbk({err: 'avatar_not_uploaded'});
                } else {
                    getFileURL(validBucket, avatarName, function(err, fileURL){
                        if(err){
                            //TODO line on debug with the error
                            return cbk({err: 'avatar_address_inaccessible'});
                        } else {
                            return cbk(null,fileURL);
                        }
                    });
                }
            });
        });
    });
}

module.exports = {
    uploadFile: uploadFile,
    getFileURL: getFileURL,
    uploadAvatarToAWS: uploadAvatarToAWS
};