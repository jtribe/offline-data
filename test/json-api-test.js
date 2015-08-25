var helpers = require('./helpers');

describe('JsonApiHandler', function() {
  var JsonApiHandler = require('src/json-api').JsonApiHandler,
      cache, sinon, handler,
      type = {key: 'product', plural: 'products'};

  before(function() {
    sinon = require('sinon').sandbox.create();
    cache = helpers.newDataCache();
    helpers.add(cache.db, '/products/1', {product: {id: 1}});
    helpers.add(cache.db, '/products/2', {product: {id: 2}});
    helpers.add(cache.db, '/users/1', {bar: {id: 1}});
    helpers.add(cache.db, '/users/2', {bar: {id: 2}});
    handler = new JsonApiHandler(new RegExp('^/products/\\d'), type);
  });

  beforeEach(function() {
    opts = {data: {}};
    sinon.restore();
  });

  it('returns results in JSON API format', function() {
    return expect(handler.get(cache, opts)).to.eventually
      .eql({
        meta: {
          total: 2
        },
        products: [
          {id: 1},
          {id: 2}
        ]
      });
  });
  it('allows filtering responses that are in JSON API format', function() {
    opts.data = {id: 1};
    return expect(handler.get(cache, opts)).to.eventually
      .have.property('products').that.has.length(1);
  });
  it('returns information about the result set in the meta property', function() {
    opts.data = {limit: 1};
    return expect(handler.get(cache, opts)).to.eventually
      .have.property('meta').that.eql({
        limit: 1,
        total: 1
      });
  });
  it('handles side-loaded records', function() {
    cache = helpers.newDataCache();
    helpers.add(cache.db, '/products/1',
      {product: {id: 1}, foos: [{id: 1}, {id: 2}]}
    );
    helpers.add(cache.db, '/products/2',
      {product: {id: 2}, foos: [{id: 2}, {id: 3}]}
    );
    return handler.get(cache, opts).then(function(results) {
      expect(results).to.have.property('products').that.has.length(2);
      expect(results).to.have.property('foos').that.has.length(3);
    })
  });
  it('handles no results', function() {
    cache = helpers.newDataCache();
    return handler.get(cache, opts).then(function(results) {
      expect(results).to.have.property('products').that.has.length(0);
    })
  });
});
