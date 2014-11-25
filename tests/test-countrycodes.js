var assert = require('assert');
var async = require('async');
var countryCodes = require('../countrycodes.js');

describe('country codes', function(){
    it('country from phone', function(done){
        var phones =[
            {
                phone:'+14158860000',
                country:'US'
            },
            {
                phone:'+34000000000',
                country:'ES'
            },
            {
                phone:'+44000000000',
                country:'GB'
            }
        ];
        async.each(phones, function(item, cbk){
            countryCodes.countryFromPhone(item.phone, function(err, country){
                assert.equal(err,null);
                assert.equal(country['ISO3166-1-Alpha-2'],item.country);
                cbk();
            });
        }, done);
    });

    it('country not found', function(done){
        countryCodes.countryFromPhone('696000000', function(err, country){
            assert.notEqual(err, null);
            assert.equal(country, undefined);
            done();
        });
    });

    it('country from ISO3166', function(done){
        var countries =['US','ES','GB'];
        async.each(countries, function(item, cbk){
            countryCodes.countryFromIso(item, function(err, country){
                assert.equal(err, null);
                assert.equal(country['ISO3166-1-Alpha-2'],item);
                cbk();
            });
        },done);
    });
});
