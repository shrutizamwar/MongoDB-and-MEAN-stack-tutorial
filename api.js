var express = require('express');
var status = require('http-status');
var bodyparser = require('body-parser');
var _ = require('underscore');

module.exports = function(wagner) {
  var api = express.Router();

  api.use(bodyparser.json());

  api.get('/product/text/:query', wagner.invoke(function(Product){
    return function(req,res){
      Product.
        find(
          { $text : {$search: req.params.query}},
          { score: {$meta:'textScore'}}).
        sort({score: {$meta: 'textScore'}}).
        limit(10).
        exec(handleMany.bind(null,'products',res));
      };
  }));

  api.post('/checkout', wagner.invoke(function(User, Stripe){
      return function(req,res){
        if(!req.user){
          return res.
            status(status.UNAUTHORIZED).
            json({error: 'Not Logged in'});
        }

        req.user.populate({path: 'data.cart.product', model: 'Product'}, function(error, user){
          var totalCostUSD = 0;
          _.each(user.data.cart, function(item){
            totalCostUSD += item.product.internal.approximatePriceUSD * item.quantity;
          });

          Stripe.charges.create(
            {
              amount: Math.ceil(totalCostUSD),
              currency: 'usd',
              source: req.body.stripeToken,
              description: 'Example charge'
            },

            function(err, charge){
              if(err && err.type == 'StripeCardError'){
                return res.
                  status(status.BAD_REQUEST).
                  json({error : err.toString()});
              }

              if(err){
                console.log(err);
                return res.
                  status(status.INTERNAL_SERVER_ERROR).
                  json({error: err.toString()});
              }

              req.user.data.cart = [];
              req.user.save(function(){
                return res.json({id: charge.id});
              });
            }
          )
        });
      };
  }));

  api.put('/me/cart', wagner.invoke(function(User) {
    return function(req, res) {
      try {
        var cart = req.body.data.cart;
      } catch (e) {
        return res.status(status.BAD_REQUEST).json({
          error: 'No cart specified'
        });
      }

      req.user.data.cart = cart;
      req.user.save(function(error, user) {
        if (error) {
          return res.status(status.INTERNAL_SERVER_ERROR).json({
            error: error.toString()
          });
        }
        return res.json({
          user: user
        });
      });
    };
  }));

  api.get('/me', (function(req, res) {
    if (!req.user) {
      return res.
      status(status.UNAUTHORIZED).
      json({
        error: 'Not Logged in'
      });
    }

    req.user.populate({
        path: 'data.cart.product',
        model: 'Product'
      },
      handleOne.bind(null, 'user', res));
  }));

  api.get('/category/id/:id', wagner.invoke(function(Category) {
    return function(req, res) {
      Category.findOne({
        _id: req.params.id
      }, function(error, category) {
        if (error) {
          return res.
          status(status.INTERNAL_SERVER_ERROR).
          json({
            error: error.toString()
          });
        }

        if (!category) {
          return res.
          status(status.NOT_FOUND).
          json({
            error: 'Not Found'
          });
        }

        res.json({
          category: category
        });
      });
    };
  }));


  /* find categories having parent as given id*/
  api.get('/category/parent/:id', wagner.invoke(function(Category) {
    return function(req, res) {
      Category.
      find({
        parent: req.params.id
      }).
      sort({
        _id: 1
      }).
      exec(function(error, categories) {
        if (error) {
          return res.
          status(status.INTERNAL_SERVER_ERROR).
          json({
            error: error.toString()
          });
        }

        res.json({
          categories: categories
        });
      });
    }
  }));

  api.get('/product/id/:id', wagner.invoke(function(Product) {
    return function(req, res) {
      Product.findOne({
          _id: req.params.id
        },
        handleOne.bind(null, 'product', res)
      );
    };
  }));

  api.get('/product/category/:id', wagner.invoke(function(Product) {
    return function(req, res) {
      var sort = {
        name: 1
      };
      if (req.query.price === "1") {
        sort = {
          'internal.approximatePriceUSD': 1
        }
      } else if (req.query.price == "-1") {
        sort = {
          'internal.approximatePriceUSD': -1
        };
      }

      Product.find({
        'category.ancestors': req.params.id
      }).
      sort(sort).
      exec(handleMany.bind(null, 'products', res));
    };
  }))

  return api;
};

function handleOne(property, res, error, result) {
  if (error) {
    return res.
    status(status.INTERNAL_SERVER_ERROR).
    json({
      error: error.toString()
    });
  }

  if (!result) {
    return res.
    status(status.NOT_FOUND).
    json({
      error: 'Not Found'
    });
  }

  var json = {};
  json[property] = result;
  res.json(json);
}

function handleMany(property, res, error, result) {
  if (error) {
    return res.
    status(status.INTERNAL_SERVER_ERROR).
    json({
      error: error.toString()
    });
  }

  var json = {};
  json[property] = result;
  res.json(json);
}
