var DataCache = require('src/index').default,
    Bluebird = require('bluebird'),
    memdown = require('memdown');

exports.newDataCache = function(upstream) {
  return new DataCache(exports.dbName(), upstream, {
    pouch: {db: memdown}
  });
};

exports.dbName = function() {
  return "" + Date.now();
};

exports.createUpdates = function(queue, num) {
  var promises = [], accum = [];
  for (var i = 0; i < num; i++) {
    promises.push(queue.push({id: i + 1}));
  }
  return Bluebird.reduce(promises, function(accum, current, index) {
    accum.push(current);
    return accum;
  }, []);
};

exports.add = function(db, uri, data) {
  // PouchDB is synchronous when used with a memdown adapter
  if (uri instanceof Array) {
    return Bluebird.all(uri.map(function(one) {
      return exports.add(db, one, data);
    }));
  }
  return db.post({_id: uri, data: data || uri});
};
