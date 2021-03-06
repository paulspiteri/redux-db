var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
import { NormalizeContext } from "./schema";
import * as utils from "./utils";
var TableModel = /** @class */ (function () {
    function TableModel(session, state, schema) {
        if (state === void 0) { state = { ids: [], byId: {}, indexes: {} }; }
        this.dirty = false;
        this.session = utils.ensureParam("session", session);
        this.state = utils.ensureParam("state", state);
        this.schema = utils.ensureParam("schema", schema);
        if (!this.state.name)
            this.state.name = schema.name;
    }
    TableModel.prototype.all = function () {
        var _this = this;
        return this.state.ids.map(function (id) { return ModelFactory.default.newRecord(id, _this); });
    };
    Object.defineProperty(TableModel.prototype, "length", {
        get: function () {
            return this.state.ids.length;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TableModel.prototype, "values", {
        get: function () {
            return this.all().map(function (r) { return r.value; });
        },
        enumerable: true,
        configurable: true
    });
    TableModel.prototype.filter = function (predicate) {
        return this.all().filter(predicate);
    };
    TableModel.prototype.index = function (name, fk) {
        if (this.state.indexes[name] && this.state.indexes[name].values[fk])
            return this.state.indexes[name].values[fk];
        else
            return [];
    };
    TableModel.prototype.get = function (id) {
        if (typeof id === "number")
            id = id.toString();
        if (!this.exists(id))
            throw new Error("No \"" + this.schema.name + "\" record with id: " + id + " exists.");
        return ModelFactory.default.newRecord(id, this);
    };
    TableModel.prototype.getOrDefault = function (id) {
        return this.exists(id) ? this.get(id) : null;
    };
    TableModel.prototype.getByFk = function (fieldName, value) {
        var field = this.schema.fields.filter(function (f) { return f.isForeignKey && f.name === fieldName; })[0];
        if (!field)
            throw new Error("No foreign key named: " + fieldName + " in the schema: \"" + this.schema.name + "\".");
        return new RecordSet(this, field, { id: value.toString() });
    };
    TableModel.prototype.value = function (id) {
        if (typeof id === "number")
            id = id.toString();
        return this.state.byId[id];
    };
    TableModel.prototype.exists = function (id) {
        if (typeof id === "number")
            id = id.toString();
        return this.state.byId[id] !== undefined;
    };
    TableModel.prototype.insert = function (data) {
        return this.insertMany(data)[0];
    };
    TableModel.prototype.insertMany = function (data) {
        return this._normalizedAction(data, this.insertNormalized);
    };
    TableModel.prototype.update = function (data) {
        return this.updateMany(data)[0];
    };
    TableModel.prototype.updateMany = function (data) {
        return this._normalizedAction(data, this.updateNormalized);
    };
    TableModel.prototype.upsert = function (data) {
        return this._normalizedAction(data, this.upsertNormalized)[0];
    };
    TableModel.prototype.delete = function (id) {
        if (typeof id === "number")
            id = id.toString();
        if (!this.exists(id))
            return false;
        this._deleteCascade(id);
        var byId = __assign({}, this.state.byId), ids = this.state.ids.slice(), indexes = __assign({}, this.state.indexes), record = byId[id];
        delete byId[id];
        var idx = ids.indexOf(id);
        if (idx >= 0)
            ids.splice(idx, 1);
        if (record)
            this._cleanIndexes(id, record, indexes);
        this.dirty = true;
        this.state = __assign({}, this.state, { byId: byId, ids: ids, indexes: indexes });
        return true;
    };
    TableModel.prototype.insertNormalized = function (table) {
        var _this = this;
        this.dirty = true;
        this.state = __assign({}, this.state, { ids: utils.arrayMerge(this.state.ids, table.ids), byId: __assign({}, this.state.byId, table.byId) });
        this._updateIndexes(table);
        return table.ids.map(function (id) { return ModelFactory.default.newRecord(id, _this); });
    };
    TableModel.prototype.updateNormalized = function (table) {
        var _this = this;
        var state = __assign({}, this.state), dirty = false;
        var records = Object.keys(table.byId).map(function (id) {
            if (!_this.state.byId[id])
                throw new Error("Failed to apply update. No \"" + _this.schema.name + "\" record with id: " + id + " exists.");
            var oldRecord = state.byId[id];
            var newRecord = __assign({}, oldRecord, table.byId[id]);
            var isModified = _this.schema.isModified(oldRecord, newRecord);
            if (isModified) {
                state.byId[id] = newRecord;
                dirty = true;
            }
            return ModelFactory.default.newRecord(id, _this);
        });
        if (dirty) {
            this.dirty = true;
            this.state = state;
            this._updateIndexes(table);
        }
        return records;
    };
    TableModel.prototype.upsertNormalized = function (norm) {
        var _this = this;
        var toUpdate = { ids: [], byId: {}, indexes: {} };
        var toInsert = { ids: [], byId: {}, indexes: {} };
        norm.ids.forEach(function (id) {
            if (_this.exists(id)) {
                toUpdate.ids.push(id);
                toUpdate.byId[id] = norm.byId[id];
            }
            else {
                toInsert.ids.push(id);
                toInsert.byId[id] = norm.byId[id];
            }
        });
        var refs = (toUpdate.ids.length ? this.updateNormalized(toUpdate) : []).concat((toInsert.ids.length ? this.insertNormalized(toInsert) : []));
        this._updateIndexes(norm);
        return refs;
    };
    TableModel.prototype._normalizedAction = function (data, action) {
        var norm = new NormalizeContext(this.schema);
        this.schema.normalize(data, norm);
        var table = norm.output[this.schema.name];
        var records = table ? action.call(this, table) : [];
        this.session.upsert(norm);
        return records;
    };
    TableModel.prototype._updateIndexes = function (table) {
        var _this = this;
        Object.keys(table.indexes).forEach(function (key) {
            var idx = _this.state.indexes[key] || (_this.state.indexes[key] = { unique: table.indexes[key].unique, values: {} });
            Object.keys(table.indexes[key].values).forEach(function (fk) {
                var idxBucket = idx.values[fk] || (idx.values[fk] = []);
                var modifiedBucket = utils.arrayMerge(idxBucket, table.indexes[key].values[fk]);
                if (idx.unique && modifiedBucket.length > 1)
                    throw new Error("The insert/update operation violates the unique foreign key \"" + _this.schema.name + "." + key + "\".");
                idx.values[fk] = modifiedBucket;
            });
        });
    };
    TableModel.prototype._cleanIndexes = function (id, record, indexes) {
        var fks = this.schema.getForeignKeys(record);
        fks.forEach(function (fk) {
            var fkIdx = -1;
            if (fk.value && indexes[fk.name] && indexes[fk.name].values[fk.value])
                fkIdx = indexes[fk.name].values[fk.value].indexOf(id);
            if (fkIdx >= 0) {
                var idxBucket = indexes[fk.name].values[fk.value].slice();
                idxBucket.splice(fkIdx, 1);
                indexes[fk.name].values[fk.value] = idxBucket;
            }
            else if (indexes[fk.name]) {
                delete indexes[fk.name].values[id];
                if (Object.keys(indexes[fk.name].values).length === 0)
                    delete indexes[fk.name];
            }
        });
    };
    TableModel.prototype._deleteCascade = function (id) {
        var cascade = this.schema.relations.filter(function (rel) { return rel.relationName && rel.cascade; });
        if (cascade.length) {
            var model_1 = this.get(id);
            model_1 && cascade.forEach(function (schema) {
                model_1[schema.relationName].delete();
            });
        }
    };
    return TableModel;
}());
export { TableModel };
var RecordModel = /** @class */ (function () {
    function RecordModel(id, table) {
        this.id = utils.ensureParam("id", id);
        this.table = utils.ensureParam("table", table);
    }
    Object.defineProperty(RecordModel.prototype, "value", {
        get: function () {
            return this.table.value(this.id);
        },
        enumerable: true,
        configurable: true
    });
    RecordModel.prototype.delete = function () {
        this.table.delete(this.id);
    };
    RecordModel.prototype.update = function (data) {
        this.table.update(data);
        return this;
    };
    return RecordModel;
}());
export { RecordModel };
var RecordField = /** @class */ (function () {
    function RecordField(schema, record) {
        this.schema = utils.ensureParam("schema", schema);
        this.record = utils.ensureParam("record", record);
        this.name = utils.ensureParamString("schema.name", schema.name);
    }
    Object.defineProperty(RecordField.prototype, "value", {
        get: function () {
            return this.schema.getRecordValue(this.record);
        },
        enumerable: true,
        configurable: true
    });
    return RecordField;
}());
export { RecordField };
var RecordSet = /** @class */ (function () {
    function RecordSet(table, schema, owner) {
        this.table = utils.ensureParam("table", table);
        this.schema = utils.ensureParam("schema", schema);
        this.owner = utils.ensureParam("owner", owner);
    }
    Object.defineProperty(RecordSet.prototype, "value", {
        get: function () {
            return this.map(function (r) { return r.value; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RecordSet.prototype, "ids", {
        get: function () {
            return this.table.index(this.schema.name, this.owner.id);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RecordSet.prototype, "length", {
        get: function () {
            return this.ids.length;
        },
        enumerable: true,
        configurable: true
    });
    RecordSet.prototype.all = function () {
        var _this = this;
        return this.ids.map(function (id) { return ModelFactory.default.newRecord(id, _this.table); });
    };
    RecordSet.prototype.map = function (callback) {
        return this.all().map(callback);
    };
    RecordSet.prototype.add = function (data) {
        this.table.insert(this._normalize(data));
    };
    RecordSet.prototype.remove = function (data) {
        var _this = this;
        this._normalize(data).forEach(function (obj) {
            var pk = _this.table.schema.getPrimaryKey(obj);
            _this.table.delete(pk);
        });
    };
    RecordSet.prototype.update = function (data) {
        this.table.update(this._normalize(data));
        return this;
    };
    RecordSet.prototype.delete = function () {
        var _this = this;
        this.ids.forEach(function (id) { return _this.table.delete(id); });
    };
    RecordSet.prototype._normalize = function (data) {
        return this.table.schema.inferRelations(data, this.schema, this.owner.id);
    };
    return RecordSet;
}());
export { RecordSet };
var ModelFactory = /** @class */ (function () {
    function ModelFactory() {
        this._recordClass = {};
    }
    ModelFactory.prototype.newRecord = function (id, table) {
        return new (this._recordClass[table.schema.name] || (this._recordClass[table.schema.name] = this._createRecordModelClass(table.schema)))(id, table);
    };
    ModelFactory.prototype.newRecordField = function (schema, record) {
        if (!schema.isForeignKey)
            return new RecordField(schema, record);
        var refTable = schema.references && record.table.session.tables[schema.references];
        if (!refTable)
            throw new Error("The foreign key: \"" + schema.name + "\" references an unregistered table: \"" + schema.references + "\" in the current session.");
        return refTable.getOrDefault(schema.getRecordValue(record));
    };
    ModelFactory.prototype.newRecordSet = function (schema, record) {
        var refTable = record.table.session.tables[schema.table.name];
        if (!refTable)
            throw new Error("The table: \"" + schema.table.name + "\" does not exist in the current session.");
        return new RecordSet(refTable, schema, record);
    };
    ModelFactory.prototype.newRecordRelation = function (schema, record) {
        var refTable = record.table.session.tables[schema.table.name];
        if (!refTable)
            throw new Error("The table: \"" + schema.table.name + "\" does not exist in the current session.");
        var id = refTable.index(schema.name, record.id)[0];
        if (id === undefined)
            return null;
        else
            return ModelFactory.default.newRecord(id, refTable);
    };
    ModelFactory.prototype._createRecordModelClass = function (schema) {
        var Record = /** @class */ (function (_super) {
            __extends(Record, _super);
            function Record(id, table) {
                var _this = _super.call(this, id, table) || this;
                _this._fields = {};
                return _this;
            }
            return Record;
        }(RecordModel));
        var defineProperty = function (name, field, factory, cache) {
            if (cache === void 0) { cache = true; }
            if (name === "id")
                throw new Error("The property \"" + field.table.name + ".id\" is a reserved name. Please specify another name using the \"propName\" definition.");
            Object.defineProperty(Record.prototype, name, {
                get: function () {
                    return cache ? (this._fields[name] || (this._fields[name] = factory(field, this))) : factory(field, this);
                }
            });
        };
        schema.fields.forEach(function (f) { return (f.isForeignKey || !f.isPrimaryKey) && defineProperty(f.propName, f, ModelFactory.default.newRecordField); });
        schema.relations.forEach(function (f) { return f.relationName && defineProperty(f.relationName, f, f.unique ? ModelFactory.default.newRecordRelation : ModelFactory.default.newRecordSet, !f.unique); });
        return Record;
    };
    ModelFactory.default = new ModelFactory();
    return ModelFactory;
}());
