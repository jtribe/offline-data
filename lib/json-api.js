import {Handler, Filter} from 'offline-data';

class JsonApiType {
  constructor(key, plural) {
    this.key = key;
    if (!plural) {
      if (typeof key.pluralize === 'function') plural = key.pluralize();
      else plural = key + 's'; // :(
    }
    this.plural = plural;
  }
}

class JsonApiHandler extends Handler {
  constructor(map, type, options) {
    options = options || {};
    if (typeof type == 'string') type = new JsonApiType(type);
    options.formatter = options.formatter || new JsonApiFormatter(type);
    options.filter = options.filter || new JsonApiFilter(type);
    super(map, options);
  }
}
export {JsonApiHandler};

export class JsonApiFormatter {
  constructor(type) {
    this.type = type;
  }
  format(results, options) {
    var meta = {
      total: results.total_rows
    };
    if (results.offset) meta.offset = results.offset;
    if (options.data.limit) meta.limit = options.data.limit;
    var response = {
      meta: meta
    };
    var accum = {};
    for (var i = 0; i < results.rows.length; i++) {
      this.extractRecords(results.rows[i].doc, response, accum);
    }
    // ensure that the response contains at least an empty array
    if (!response[this.type.plural]) response[this.type.plural] = [];
    return response;
  }
  extractRecords(doc, response, accum) {
    for (var typeKey in doc.data) {
      if (typeKey === 'meta') continue;
      var records = doc.data[typeKey];
      if (typeKey === this.type.key) typeKey = this.type.plural;
      if (!response[typeKey]) {
        response[typeKey] = [];
        accum[typeKey] = [];
      }
      if (records instanceof Array) {
        for (var i = 0; i < records.length; i++) {
          addRecord(records[i]);
        }
      }
      else {
        addRecord(records);
      }
    }
    function addRecord(record) {
      var id = record.id,
          ids = accum[typeKey];
      if (ids.indexOf(id) !== -1) return;
      response[typeKey].push(record);
      ids.push(id);
    }
  }
}

class JsonApiFilter extends Filter {
  constructor(type) {
    this.type = type;
  }
  get(prop, result) {
    return result.doc.data[this.type.key][prop];
  }
}

export {
  JsonApiFormatter,
  JsonApiFilter
};
