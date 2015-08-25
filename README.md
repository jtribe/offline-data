# offline-data

> ### A general-purpose, minimal solution for offline-first data access.

This module consists of two components for achieving offline capability, a DataCache for reads and an UpdateQueue for writes:

- DataCache is a cache for HTTP (GET) data, backed by a PouchDB database that's continuously synced from a remote master database, which contains all your data when you're offline.
- UpdateQueue is a persistent queue for HTTP (POST and PUT) requests that will handle queing requests to the server and sending them when a connection becomes available.

## DataCache

The DataCache is designed to act as a transparent proxy to your remote backend. The cache interface is similar to jQuery's ajax method, so it's often trivially easy to switch to loading data from the cache.

```js
import DataCache from 'offline-data';
var cache = new DataCache('dbname', 'http://my-replication-master/dbname');
cache.get('/api/products/1')
  .then(function(json) {
    console.log(json); // => {name: 'buy me'}
  });
```

You should populate a CouchDB (or [pouch-server]()) with the documents that you want to be available offline, and the DataCache will replicate these documents down to all of your clients. The documents in the cache should have the following structure:

```js
{
  _id: '/api/endpoint', // the ID is the URI
  data: {}              // the data property contains the body of the response
}
```

There's also an [ember-cli addon](http://github.com/franq/ember-offline-data) for use with Ember, and which also provides a Mixin for integrating with Ember Data.

### Methods

#### DataCache#constructor(dbName, upstream, opts)

Creates a new DataCache instance for accessing the data in the `upstream` database.

- `@param dbName {string|PouchDB}` Defines the name of the PouchDB database to be used to store the local data.
- `@param upstream {string|PouchDB}` The remote (CouchDB-ish) server that contains the data to be replicated into the local database.
- `@param [opts] {object}` An options hash
  - `.pouch` options for the call to the `PouchDB` constructor
  - `.verbose` Log all replication events to the console
  
#### DataCache#get(uri, options)

Performs a lookup in the cache for the specified URI.

- `@param uri {string}` The URI to return from the cache
- `@param options {object}` A hash of options, uses the same structure as the [jQuery#ajax `settings` parameter](http://api.jquery.com/jquery.ajax/). Request parameters should be provided in `options.data`.
- `@returns Promise` A Promise that yields the response. The promise will fail with `status: 404` if the URI is not found.

#### DataCache#fallbackTo(fn)

Allows a fallback function to be used to provide the content if it's not in the cache. For example, this can be used to fallback to an HTTP request on cache misses. `fn` may return a value or a Promise. 

```js
cache.fallbackTo(function(uri, options) {
  return jQuery.json(uri, options);
});
```

#### DataCache#route(uri, fn)

Allows you to use a function to handle a call to `get()` the specified `uri`. This is a core feature, for example:

- You can use a route handler to construct a listing, e.g. of products. This allows you to avoid having to cache (and replicate) big listings of data - just keep the individual items and construct the listing on the client.
- Providing search and filtering functionality on the client side

```js
cache.route('/api/products', function(dataCache, uri, options) {
  return Promise.resolve({the: 'response'});
});
```

You can provide a handler function, but you'll generally want to use a instance of the `Handler` class (see below).

- `@param uri {string|RegExp}` The URI to be handled, or a RegExp
- `@param fn {function|object}` A handler `function(DataCache, options)` (the `options` argument from the call to `get()`).  
  If an object is provided then its `get()` method will be called, with the same arguments.
- `@return {Promise}` A Promise that yields the response.

### Handler

### Filter

### Formatter

### Functions

#### matchKey(regExp)

Returns a map function that emits any documents whose keys match the provided regular expression.

#### matchKeyPrefix(prefix)

Returns a map function that emits any documents whose keys start with the specified prefix.

## Adapters

The `json-api` package provides a handler, formatter and filter suitable for using with  RESTful endpoints that use the [jsonapi.org](http://jsonapi.org) format (used by [Ember Data](https://github.com/emberjs/data)).

```js
import {JsonApiHandler} from 'offline-data/json-api';
// select all records which have a URI that matches /api/products/:id
var map = new RegExp('^/api/products/\\d+$');
// and return a JSON API-formatted listing from /api/products
cache.route('/api/products', new JsonApiHandler(map, 'product'));
```

## UpdateQueue

UpdateQueue is a persistent queue for HTTP update requests (POST and PUT) that will handle queing requests and sending them when a connection becomes available. Updates are guaranteed to be sent in the same order that they're created (FIFO).

```js
import UpdateQueue from 'offline-data/update-queue';
var queue = new UpdateQueue('dbname', jQuery.ajax);
queue.push({
  type: 'POST',
  url: '/api/order',
  data: {
    products: [1, 2, 3]
  }
}); // this POST request will be queued and send as soon as a connection is available
```

### Methods

#### UpdateQueue#constructor(dbName, senderFn, opts)

Creates a new UpdateQueue instance that will use the `senderFn` thunk to send requests.

- `@param dbName {string|PouchDB}` Defines the name of the PouchDB database to be used to store the local data.
- `@param senderFn {function}` A function that is responsible for sending the requests. Takes a single argument which is the value that was provided to `push()`
- `@param [opts] {object}` An options hash
  - `.pouch` options for the call to the `PouchDB` constructor
  - `.autoDrain` Controls whether calls to `push()` will automatically schedule updates to be sent (defaults to `true`) 

#### UpdateQueue#push(update)

Adds an update to the queue, to be sent as soon as a connection is available. Updates are guaranteed to be sent in the same order that they're created (FIFO). Will also schedule an attempt to send any pending updates to be sent.

- `@param update {object}` The data be provided to the `senderFn` when the update is sent.
- `@returns {Promise}` Resolves when the update has been successfully saved into persistent storage to be sent as soon as possible.

#### UpdateQueue#schedule(later)

Schedule updates to be sent after `later` milliseconds.

- `@param [later] {int}` Defaults to now
- `@return {Promise}` Resolves with the result of the call to `drain()`

#### drain()

Sends any pending updates in the order that they were created. Prevents more than one drain operation from happening in parallel.

- `@return {Promise}` Resolves when all pending updates have been sent.
