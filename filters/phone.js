var phoneMng = require('../manager/phone');

function verifiedPhone (req,res,next) {
    var passthroughUrl =[];
    passthroughUrl.push('(\/api\/profile)');

    var match = false;
    passthroughUrl.some(function (patternUrl) {
        var rePattern = new RegExp(patternUrl);
        if( (req.url).match(rePattern) ){
            match = true;
            return false;
        }
    });

    if(!match) {
        return next();
    }

    var phones = req.user.phones;
    var phoneNotVerified;
    phones.some(function (phone) {
        if (!phone.isVerified) {
            phoneNotVerified = phone.phone;
            return false;
        }
    });

    if (phoneNotVerified) {
        phoneMng.createPIN(phoneNotVerified, function(err, createdPin){
            if(err){
                res.send(500, err);
            } else {
                if(createdPin) {
                    var err = {
                        err: 'phone_not_verified',
                        des: 'User phone number must be verified in order to use the API',
                        data: phoneNotVerified
                    }
                    res.send(403, err);
                } else {
                    var err = {
                        err: 'cannot_create/send_verification_pin',
                        des: 'There was a problem creating or sending the phone verification pin'
                    }
                    res.send(500, err);
                }
            }
            next(false);
        });
    } else {
        next();
    }
};

module.exports = {
    verifiedPhone: verifiedPhone
};
