/* global PouchDB */

class DataCache {

  constructor(dbName, upstream, opts) {
    this.opts = opts || {};
    /* debug */ this.opts.verbose = true;
    this.db = (typeof dbName === 'object')
        ? dbName
        : new PouchDB(dbName, this.opts.pouch);
    if (upstream) {
      this.replicateFrom(upstream);
    }
    this.handlers = [];
  }

  replicateFrom(upstream) {
    this.replication = PouchDB.replicate(upstream, this.db, this.replicationOpts());
    if (this.opts.verbose) {
      ['complete', 'uptodate', 'change'].forEach((eventName) =>
        this.on(eventName, (ev) => {
          console.log('DataCache', eventName, ev);
        })
      );
    }
    this.on('error', (err) => this.handleError(err))
  }

  on(event, fn) {
    this.replication.on(event, fn);
  }

  replicationOpts() {
    return {
      live: true,
      create_target: true
    };
  }

  get(uri, options) {
    options = options || {};
    options.uri = uri;
    options.data = options.data || {};

    if(this.isExcluded(uri)) return this.fallback(uri);

    var handler = this.handlerForUri(uri);
    if (handler) {
      return handler.get(this, options);
    }
    var promise = this._get(uri, options);
    if (this.opts.verbose) {
      promise.then(
        res => this.logResponse(options, res),
        err => {
          this.logError(options, err);
          throw err;
        });
    }
    return promise;
  }

  _get(uri, options) {
    return this.db.get(uri)
      .then(doc => doc.data)
      .catch(err => {
        if (err.status === 404) {
          if (this.fallback) {
            var promise = this.fallback(uri);
            if (promise) return promise;
          }
          var thisErr = new Error("Couldn't find cache entry for URI '" + uri + "'");
          thisErr.status = 404;
          thisErr.cause = err;
          throw thisErr;
        }
        throw err;
      });
  }

  fallbackTo(fn) {
    this.fallback = fn;
  }

  exclude(matches) {
    this.exclusions = matches;
  }

  isExcluded(uri) {
    var exclusions = this.exclusions || [];
    return exclusions.some(function(exclusion, index) {
      var matches = uri.match(exclusion);
      if(matches && matches.length){
        return true;
      }
    });
  }

  route(match, handler) {
    if (typeof handler === 'function') {
      handler = {get: handler};
    }
    this.handlers.push([match, handler]);
  }

  handlerForUri(uri) {
    for (var i = 0; i < this.handlers.length; i++) {
      var match = this.handlers[i][0],
          handler = this.handlers[i][1];
      if ((match.test && match.test(uri)) || (uri === match)) {
        return handler;
      }
    }
  }

  handleError(err) {
    console.error('DataCache error', err);
  }

  stopReplication() {
    if (!this.replication) return;
    this.replication.cancel();
    this.replication = null;
  }

  logResponse(options, res) {
    console.log('DataCache get', options.uri, res, options);
  }

  logError(options, err) {
    console.error('DataCache error', options.uri, err, options);
  }
}

export default DataCache;

export function matchKeyPrefix(prefix) {
  /* jshint evil: true */
  return new Function('doc',
    "if (doc._id.indexOf(" + stringEscape(prefix) + "') === 0) emit(doc._id);"
  );
}

export function matchKey(regExp) {
  /* jshint evil: true */
  return new Function('doc',
    "var regExp = new RegExp('" + regExpEscape(regExp) + "'); " +
    "if (regExp.test(doc._id)) emit(doc._id);"
  );
}

export function stringEscape(str) {
    return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

export function regExpEscape(strOrRegExp) {
  var str = strOrRegExp instanceof RegExp ? strOrRegExp.source : strOrRegExp;
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export class Handler {
  constructor(map, options) {
    options = options || {};
    this.map = map;
    this.formatter = options.formatter;
    this.reduce = options.reduce;
    this.filter = options.filter;

    if (this.map instanceof RegExp) this.map = matchKey(this.map);
    if (this.formatter && typeof this.formatter != 'function') {
      this.formatter = this.formatter.format.bind(this.formatter);
    }
    if (this.filter && typeof this.filter != 'function') {
      this.filter = this.filter.filter.bind(this.filter);
    }
  }
  queryFor(dataCache, options) {
    var params = options.data || {};
    return {
      include_docs: this.reduce ? false : true,
      limit: params.limit,
      skip: params.offset
    };
  }
  get(dataCache, options) {
    var fun = {
      map: this.map,
      reduce: this.reduce
    };
    var query = this.queryFor(dataCache, options);
    return dataCache.db.query(fun, query)
      .then(results => {
        if (this.filter) {
          results = this.filter(results, options);
          results.total_rows = results.rows.length;
        }
        if (this.formatter) results = this.formatter(results, options);
        return results;
      });
  }
}

export class Formatter {
  format(results, options) {}
}

export class Filter {
  filter(results, options) {
    var query = this.getQuery(options),
        keys = Object.keys(query),
        ignored = ['limit', 'offset'];
    if (keys.length == 0) return results;
    results.rows = results.rows.filter(row => {
      for (var i = 0; i < keys.length; i++) {
        if (ignored.indexOf(keys[i]) !== -1) continue;
        if (!this.matchesKey(row, keys[i], query)) return false;
      }
      return true;
    });
    return results;
  }
  getQuery(options) {
    return options.data;
  }
  matchesKey(row, key, query) {
    var test = query[key],
        val = this.get(key, row);
    if (test.test) return test.test(val);
    else return val == test;
  }
  get(key, row) {
    return row.doc.data[key];
  }
}
