var UpdateQueue = require('src/update-queue').default,
    helpers = require('./helpers'),
    Promise = require('bluebird');

describe('UpdateQueue', function() {
  var uq, opts,
    sinon = require('sinon').sandbox.create(),
    mockAjax = sinon.stub().resolves();

  beforeEach(function() {
    sinon.restore();
    opts = {
      autoDrain: false,
      pouch: {db: require('memdown')}
    };
    uq = new UpdateQueue(helpers.dbName(), mockAjax, opts);
  });

  it('pushes requests onto the queue', function() {
    return uq.push('foo').then(function(doc) {
      expect(doc.update).to.equal('foo');
      return expect(uq.length()).to.eventually.equal(1);
    });
  });

  it('adds an ordered sort index to records', function() {
    return helpers.createUpdates(uq, 3)
      .then(function(updates) {
        updates.map(function(doc) {
          expect(doc.sort).to.equal(doc.update.id);
        });
        return helpers.createUpdates(uq, 3);
      })
      .then(function(updates) {
        updates.forEach(function(doc) {
          expect(doc.sort).to.equal(doc.update.id + 3);
        });
      });
  });

  it('#getSortIndex', function() {
    return uq.db.post({sort: 10})
      .then(function() {
        expect(uq.getSortIndex()).to.eventually.equal(11);
        expect(uq.getSortIndex()).to.eventually.equal(12);
      });
  });

  it('ensures that records are ordered using the sort index', function() {
    var updates;
    return helpers.createUpdates(uq, 3)
      .then(function(docs) {
        updates = docs;
        return uq.getUpdates();
      })
      .then(function(results) {
        results.rows.forEach(function(doc, index) {
          expect(doc.value.sort).to.equal(index + 1);
        })
      })
  });

  it('automatically schedules sending', function() {
    opts.autoDrain = true;
    uq = new UpdateQueue(helpers.dbName(), mockAjax, opts);
    sinon.stub(uq, 'schedule');
    return uq.push({}).then(function() {
      expect(uq.schedule).to.have.beenCalled;
    });
  });

  it('#schedule', function() {
    sinon.stub(uq, 'drain');
    return uq.schedule().then(function() {
      expect(uq.drain).to.have.beenCalled;
    });
  });

  it('#schedule later', function() {
    sinon.stub(uq, 'drain');
    var later = 100,
        started = Date.now();
    return uq.schedule(later).then(function() {
      expect(uq.drain).to.have.beenCalled;
      expect(Date.now() - started).to.be.at.least(later);
    });
  });

  it('#drain', function() {
    var numUpdates = 3, updates;
    return helpers.createUpdates(uq, numUpdates)
      .then(function(docs) {
        updates = docs;
        return uq.drain();
      })
      .then(function() {
        updates.forEach(function(doc, i) {
          expect(mockAjax.getCall(i).args[0]).to.eql(doc.update);
        });
      });
  });

});
