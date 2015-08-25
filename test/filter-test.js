var _ = require('lodash');

describe('Filter', function() {
  var Filter = require('src/index').Filter,
      cache, sinon, filter, results, query,
      opts = {};

  before(function() {
    sinon = require('sinon').sandbox.create();
    filter = new Filter();
  });

  beforeEach(function() {
    sinon.restore();
    results = {
      rows: [
        {doc: {data: {_id: '/one'}}},
        {doc: {data: {_id: '/two'}}}
      ]
    };
    query = {data: {_id: '/one'}};
  });

  it('filters results', function() {
    expect(filter.filter(results, query)).to.have.property('rows')
      .that.has.length(1);
  });
  it('provides #getQuery() as an extension point', function() {
    sinon.stub(filter, 'getQuery').returns({_id: '/one'})
    expect(filter.filter(results, query)).to.have.property('rows')
      .that.has.length(1);
  });
  it('provides #matchesKey() as an extension point', function() {
    sinon.stub(filter, 'matchesKey').returns(true)
    expect(filter.filter(results, query)).to.have.property('rows')
      .that.has.length(2);
  });
  it('provides #get() as an extension point', function() {
    results = {
      rows: [
        {_id: '/one'},
        {_id: '/two'}
      ]
    };
    sinon.stub(filter, 'get', function get(key, row) {
      return row._id;
    });
    expect(filter.filter(results, query)).to.have.property('rows')
      .that.has.length(1);
  });
});
