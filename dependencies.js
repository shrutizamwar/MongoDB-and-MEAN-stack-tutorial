var fs = require('fs');
var Stripe = require('stripe');
var fx = require('./helper/fx');

module.exports = function(wagner){

  wagner.factory('Stripe', function(Config) {
    return Stripe(Config.stripeKey);
  });

  wagner.factory('fx', fx);

  wagner.factory('Config', function() {
    return JSON.parse(fs.readFileSync('./config.json').toString());
  });
}
