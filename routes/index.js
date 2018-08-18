var express = require('express');
var Decimal = require('decimal');
var router = express.Router();
var csrf = require('csurf');

var Product = require('../models/product');
var Order = require('../models/order');
var Cart = require('../models/cart');

/* GET home page. */
router.get('/', function(req, res, next) {
  var successMsg = res.locals.success || [];
  
  Product.find(function(err, docs) {
    if(err) {
      return res.status(500).send({
        message: `Error getting the data! ${err}`
      })
    }
    
    if(!docs) {
      return res.status(404).send({
        message: `Elements not found`
      })  
    }
    
    res.status(200).send(docs) 
  });  
});

router.get('/add-to-cart/:id', function(req, res, next) {
  var productId = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});
  
  Product.findById(productId, function(err, product) {
    if (err) {
      return res.redirect('/');
    }
    cart.add(product, product.id);
    req.session.cart = cart;
    res.redirect('/');
  })
});

router.get('/reduce/:id', function(req, res, next) {
  var productId = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});
  
  cart.reduceByOne(productId);
  req.session.cart = cart;
  res.redirect('/shopping-cart');
});

router.get('/remove/:id', function(req, res, next) {
  var productId = req.params.id;
  var cart = new Cart(req.session.cart ? req.session.cart : {});
  
  cart.removeItem(productId);
  req.session.cart = cart;
  res.redirect('/shopping-cart');
});

router.get('/shopping-cart', function(req, res, next) {
  if (!req.session.cart) {
    return res.render('shop/shopping-cart', {products: null})
  }
  
  var cart = new Cart(req.session.cart);
  res.render('shop/shopping-cart', {
    products: cart.generateArray(),
    totalPrice: cart.totalPrice
  })
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
  if (!req.session.cart) {
    return res.render('shop/shopping-cart');
  }
  var errMsg = req.flash('error') || [];
  var cart = new Cart(req.session.cart);
  res.render('shop/checkout', {
    total: cart.totalPrice,
    errMsg: errMsg,
    error: errMsg.length > 0
  });
});

router.post('/checkout', isLoggedIn, function(req, res, next) {
  if (!req.session.cart) {
    return res.render('shop/shopping-cart');
  }
  var cart = new Cart(req.session.cart);
  var stripe = require("stripe")(process.env.STRIPE_KEY);

  stripe.charges.create({
    amount: Decimal(cart.totalPrice).mul(100).toNumber(),
    currency: "usd",
    source: req.body.stripeToken, // obtained with Stripe.js
    description: "Test Charge"
  }, function(err, charge) {
    // asynchronously called
    if (err) {
      req.flash('error', err.message);
      return res.redirect('/checkout')
    }
    var order = new Order({
      user: req.user,
      cart: cart,
      address: req.body.address,
      name: req.body.name,
      paymentId: charge.id
    });
    order.save(function(err, result) {
      // Pendiente Validacion de error
      req.flash('success', 'Successfully bought');
      req.session.cart = null;
      return res.redirect('/');
    });
  });
});

module.exports = router;

function isLoggedIn(req, res, next) {
  if(req.isAuthenticated()) {
    return next();
  }
  
  req.session.oldUrl = req.url;
  res.redirect('/user/signin');
}