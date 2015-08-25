class UpdateQueue {
  constructor(dbName, senderFn, opts) {
    this.opts = opts || {};
    this.senderFn = senderFn;
    this.db = typeof dbName == 'object' ? dbName :
      new PouchDB(dbName, this.opts.pouch);
    if (this.opts.autoDrain === undefined) this.opts.autoDrain = true;
  }
  push(update) {
    var doc;
    return this.getSortIndex()
      .then(sort => {
        doc = {sort, update};
        return this.db.post(doc)
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to add update to queue: PouchDB returned not ok");
        if (this.opts.autoDrain) this.schedule();
        return doc;
      });
  }
  schedule(later = 0) {
    return new Promise((resolve, reject) => {
      if (!later) resolve(this.drain());
      setTimeout(() => resolve(this.drain()), later);
    });
  }
  drain() {
    if (this.draining) return this.schedule(1000);
    this.draining = true;
    // get an ordered set of updates
    return this.getUpdates().then(
      // create a chain of promises to send them in the correct order
      results => results.rows.reduce(
        (prev, current) => prev.then(this.send.bind(this, current.value)),
        Promise.resolve()
      ))
      .then(val => { // no finally in ES6 Promises :(
        this.draining = false;
        return val;
      }, err => {
        this.draining = false;
        throw err;
      });
  }
  getSortIndex() {
    if (this.lastSortIndex) {
      return Promise.resolve(++this.lastSortIndex);
    }
    else if (!this.lastSortIndexPromise) {
      return this.lastSortIndexPromise = this.db.query({
          map: doc => emit(doc.sort),
          reduce: (keys, values, rereduce) => {
            var numeric = values.filter(val => !isNaN(parseInt(val)));
            if (numeric.length == 0) return 0;
            return Math.max.apply(null, numeric);
          }
        })
        .then(result => {
          this.lastSortIndex = result.rows.length ? result.rows[0].value : 0;
          return ++this.lastSortIndex;
        });
    }
    else {
      return this.lastSortIndexPromise.then(() => ++this.lastSortIndex);
    }
  }
  length() {
    return this.db.query({map: emitUpdates, reduce: '_count'})
      .then(result => result.rows.length ? result.rows[0].value : 0);
  }
  getUpdates() {
    return Promise.resolve(
      this.db.query(emitUpdates)
    );
  }
  send(doc) {
    return this.senderFn(doc.update)
      .then(res => this.db.remove(doc).then(() => res)
        .catch(err => {
          var myErr = new Error("Failed to remove item after it was successfully sent");
          myErr.cause = err;
          throw myErr;
        })
    );
  }
}

export default UpdateQueue;

function emitUpdates(doc) {
  if (doc.sort && doc.update) emit(doc.sort, doc);
}
