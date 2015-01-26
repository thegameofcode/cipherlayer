var userDao = require('../dao');

function setPlatformData(userId, platform, data, cbk){
    userDao.updateArrayItem(userId, 'platforms', 'platform', data, function(err, updates){
        if(err) {
            return cbk(err);
        }

        if(updates<1) {
            return cbk({err:'platform_not_updated', des:'updated command worked but no platform were updated'});
        }

        cbk(null);
    });
}

module.exports = {
    setPlatformData : setPlatformData
};