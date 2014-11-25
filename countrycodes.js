var async = require('async');
var countries = JSON.parse(require('fs').readFileSync('countrycodes.json','utf8'));

function countryFromPhone(phone, cbk){
  async.each(countries, function(country, cbk){
    if(phone.indexOf('+'+country.Dial) > -1) {
      return cbk(country);
    }
    cbk();
  }, function(country){
    if(country){
      cbk(null, country);
    } else {
      cbk({err:'country_not_found',des:'given phone does not match any country dial code'})
    }
  });
}

module.exports = {
  All: countries,

  countryFromPhone: countryFromPhone
};