var DataCache = require('src/index').default,
    helpers = require('./helpers'),
    Promise = require('bluebird');

describe('DataCache', function() {
  var cache, sinon = require('sinon').sandbox.create();

  beforeEach(function() {
    cache = helpers.newDataCache();
    sinon.restore();
  });

  it('connects', function() {
    expect(cache).to.have.property('db');
    expect(cache.db).to.be.an('object');
    expect(cache.replication).to.be.undefined;
  });
  it('replicates', function() {
    var upstream = 'http://upstream';
    sinon.stub(PouchDB, 'replicate').returns({
      on: function() {}
    });
    cache = helpers.newDataCache(upstream);
    cache.handleError = function() {};
    expect(cache.replication).to.be.an('object');
    expect(PouchDB.replicate).to.have.been.calledWith(upstream, cache.db);
  });
  it('provides access to replication events', function() {
    cache = helpers.newDataCache('http://upstream');
    cache.handleError = function() {};
    sinon.spy(cache.replication, 'on');
    cache.on('test', function() {});
    expect(cache.replication.on).to.have.beenCalled;
  });

  var uri = '/test/uri';
  describe('#get', function() {
    it('returns the document from the cache', function() {
      return helpers.add(cache.db, uri).then(function() {
        return expect(cache.get(uri)).to.eventually.equal(uri);
      });
    });
    it('raises an error if the URI is not found', function() {
      return cache.get('/not-found').catch(function(err) {
        expect(err).to.have.property('status').that.equals(404);
      });
    });
  });

  describe('#fallbackTo', function() {
    it('allows a fallback to be specified', function() {
      var stub = sinon.stub().returns(Promise.resolve({data: uri}));
      cache.fallbackTo(stub);
      return cache.get('/not-found').then(function(doc) {
        expect(doc).to.not.equal(uri);
        expect(stub).to.have.beenCalled;
      });
    });
    it('returns errors from the fallback', function() {
      var stub = sinon.stub().returns(Promise.reject('expected'));
      cache.fallbackTo(stub);
      return expect(cache.get('/not-found')).to.be.rejected;
    });
  });

  describe('#exclude', function() {
    it('should set the exclusions list', function() {
      var exclusionList = ['/fake/url'];
      cache.exclude(exclusionList);
      expect(cache.exclusions).to.equal(exclusionList);
    });
  });

  describe('#isExcluded', function() {
    it('should return true if the specified uri matches one in exclusions list', function() {
      var exclusionList = ['/fake/url'];
      cache.exclude(exclusionList);
      expect(cache.isExcluded('/fake/url')).to.be.true;
    });
    it('should return false if the specified uri does NOT match one in exclusions list', function() {
      var exclusionList = ['/fake/url'];
      cache.exclude(exclusionList);
      expect(cache.exclusions).to.equal(exclusionList);
      expect(cache.isExcluded('/faker/urls')).to.be.false;
    });
  });

  describe('#route', function() {
    it('allows a handler to be provided for a URI', function() {
      var uri = '/test';
      var handler = sinon.stub().returns(Promise.resolve());
      cache.route(uri, handler);
      cache.get(uri);
      handler.should.have.been.calledWith(cache);
    });
    it('calls #get if a handler is an object', function() {
      var uri = '/test',
          handler = {get: function() {}},
          stub = sinon.stub(handler, 'get');
      stub.returns(Promise.resolve());
      cache.route(uri, handler);
      cache.get(uri);
      stub.should.have.been.calledWith(cache);
    });
    it('allows different handlers to be used for different URIs', function() {
      var uris = ['/test', '/test2'];
      var handlers = [sinon.stub(), sinon.stub()];
      handlers[0].returns(Promise.resolve({data: uri}));
      handlers[1].returns(Promise.resolve({data: uri}));
      cache.route(uris[0], handlers[0]);
      cache.route(uris[1], handlers[1]);
      cache.get(uris[0]);
      handlers[0].should.have.been.calledWith(cache);
      handlers[1].should.not.have.beenCalled;
      cache.get(uris[1]);
      handlers[1].should.have.been.calledWith(cache);
    });
    it('allows route URIs to be a Regex', function() {
      var handler = sinon.stub().returns(Promise.resolve());
      cache.route(new RegExp('/test\\d'), handler);
      cache.get('/not-matched').catch(function() {});
      handler.should.not.have.beenCalled;

      var uri = '/test1';
      cache.get(uri);
      handler.should.have.been.calledWith(cache);

      uri = '/test2';
      cache.get(uri);
      handler.should.have.been.calledWith(cache);

      cache.get('/not-matched').catch(function() {});
      handler.should.not.have.beenCalled;
    });
    it('passes options through to the route handler', function() {
      var uri = '/test', opts = {data: {foo: 'bar'}};
      var handler = sinon.stub().returns(Promise.resolve());
      cache.route(uri, handler);
      cache.get(uri, opts);
      handler.should.have.been.calledWith(cache, opts);
    });
  });
});
