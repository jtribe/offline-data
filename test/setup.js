var chai = require('chai'),
    Promise = require('bluebird'),
    sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
require('sinon-as-promised')(Promise);

global.should = chai.should();
global.expect = chai.expect;
global.PouchDB = require('pouchdb');
global.Promise = require('bluebird');

Promise.onPossiblyUnhandledRejection(function(err) {
  if (err.message != 'expected') {
    throw err;
  }
});
