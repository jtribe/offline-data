/* jshint node:true */
var makeModules = require('broccoli-dist-es6-module');
var exportTree = require('broccoli-export-tree');
var compileES6 = require('broccoli-jstransform');

var lib = compileES6('lib/');
var tree = makeModules(lib, {
  global: 'OfflineData',
  packageName: 'offline-data',
  main: 'index'
});
// uncomment the following to run `broccoli serve` during development
//tree = exportTree(tree, {destDir: 'dist'});

module.exports = tree;
