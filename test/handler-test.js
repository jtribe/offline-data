var DataCache = require('src/index').default,
    helpers = require('./helpers'),
    _ = require('lodash'),
    match = require('sinon').match;

describe('Handler', function() {
  var Handler = require('src/index').Handler,
      cache, sinon, handler,
      mapAll = function(doc) {
        emit(doc._id);
      };

  before(function() {
    sinon = require('sinon').sandbox.create();
    cache = helpers.newDataCache();
    return helpers.add(cache.db, ['/one', '/two']);
  });

  beforeEach(function() {
    sinon.restore();
  });

  it('takes a map function', function() {
    handler = new Handler(function(doc) {
      if (doc.data == '/two') emit(doc.data);
    });
    return expect(handler.get(cache, {})).to.eventually
      .have.deep.property('rows[0].id').that.eql('/two');
  });
  it('accepts a RegExp as a map function', function() {
    handler = new Handler(new RegExp('^/one$'));
    return expect(handler.get(cache, {})).to.eventually
      .have.deep.property('rows[0].id').that.eql('/one');
  });
  function formatterTest(asObject) {
    return function() {
      var formatted = [1],
          stub = sinon.stub().returns(formatted);
      if (asObject) stub = {format: stub};
      handler = new Handler(mapAll, {
        formatter: stub
      });
      return handler.get(cache, {}).then(function(results) {
        expect(results).to.eql(formatted);
      });
    }
  }
  it('accepts a formatter function', formatterTest());
  it('accepts a formatter object', formatterTest());
  it('accepts a reduce function', function() {
    handler = new Handler(mapAll, {
      reduce: function() {
        return 'reduced'
      }
    });
    return expect(handler.get(cache, {})).to.eventually
      .have.deep.property('rows[0].value', 'reduced');
  });
  function filterTest(asObject) {
    return function() {
      var filtered = {rows: []},
          filter = sinon.stub().returns(filtered);
      handler = new Handler(mapAll, {
        filter: asObject ? {filter: filter} : filter
      });
      return handler.get(cache, {}).then(function(result) {
        expect(filter).to.have.been.calledWith(
          match({total_rows: 2})
        );
        expect(result).to.eql(filtered);
      });
    }
  }
  it('accepts a filter function', filterTest());
  it('accepts a filter object', filterTest(true));
  it('calls filter before formatter', function() {
    var opts = {
      filter: sinon.spy(function (result) {
        return {
          rows: result.rows.slice(0, 1)
        };
      }),
      formatter: sinon.spy()
    };
    handler = new Handler(mapAll, opts);
    return handler.get(cache, {}).then(function(result) {
      expect(opts.filter).to.have.been.calledWith(
        match({total_rows: 2})
      );
      expect(opts.formatter).to.have.been.calledWith(
        match({total_rows: 1})
      );
    });
  });
});
