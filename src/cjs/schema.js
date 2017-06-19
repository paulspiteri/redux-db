"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var utils = require("./utils");
var PK = "PK", FK = "FK", NONE = "NONE";
var TableSchema = (function () {
    function TableSchema(name, schema) {
        var _this = this;
        this.relations = [];
        this.name = name;
        this.fields = Object.keys(schema).map(function (fieldName) { return new FieldSchema(_this, fieldName, schema[fieldName]); });
        this._primaryKeyFields = this.fields.filter(function (f) { return f.constraint === PK; });
        this._foreignKeyFields = this.fields.filter(function (f) { return f.constraint === FK; });
        this._stampFields = this.fields.filter(function (f) { return f.type === "MODIFIED"; });
    }
    TableSchema.prototype.connect = function (schemas) {
        var _this = this;
        schemas.forEach(function (schema) {
            _this.relations = _this.relations.concat(schema.fields.filter(function (f) { return f.references === _this.name; }));
        });
    };
    TableSchema.prototype.normalize = function (data, output) {
        var _this = this;
        if (output === void 0) { output = {}; }
        if (typeof (data) !== "object" && !Array.isArray(data))
            throw new Error("Failed to normalize data. Given argument is not a plain object nor an array.");
        if (output[this.name])
            throw new Error("Failed to normalize data. Circular reference detected.");
        output[this.name] = { ids: [], byId: {}, indexes: {} };
        output[this.name].ids = utils.ensureArray(data).map(function (obj) {
            var pk = _this.getPrimaryKey(obj);
            var fks = _this.getForeignKeys(obj);
            var tbl = output[_this.name];
            tbl.byId[pk] = obj;
            fks.forEach(function (fk) {
                if (!tbl.indexes[fk.name])
                    tbl.indexes[fk.name] = {};
                if (!tbl.indexes[fk.name][fk.value])
                    tbl.indexes[fk.name][fk.value] = [];
                tbl.indexes[fk.name][fk.value].push(pk);
            });
            var relations = {};
            _this.relations.forEach(function (rel) {
                if (rel.relationName && data[rel.relationName]) {
                    var normalizedRels = _this.inferRelations(data[rel.relationName], rel, pk);
                    rel.table.normalize(normalizedRels, output);
                    delete data[rel.relationName];
                }
            });
            return pk;
        });
        return output;
    };
    TableSchema.prototype.inferRelations = function (data, rel, ownerId) {
        if (!rel.relationName)
            return data;
        var otherFks = rel.table.fields.filter(function (f) { return f.constraint === FK && f !== rel; });
        return utils.ensureArray(data).map(function (obj) {
            if (typeof obj === "number" || typeof obj === "string") {
                if (otherFks.length === 1) {
                    obj = (_a = {}, _a[otherFks[0].name] = obj, _a);
                }
                else {
                    obj = { id: obj };
                }
            }
            return tslib_1.__assign({}, obj, (_b = {}, _b[rel.name] = ownerId, _b));
            var _a, _b;
        });
    };
    TableSchema.prototype.getPrimaryKey = function (record) {
        var lookup = (this._primaryKeyFields.length ? this._primaryKeyFields : this._foreignKeyFields);
        var pk = lookup.reduce(function (p, n) {
            var k = n.getValue(record);
            return p && k ? (p + "_" + k) : k;
        }, null);
        if (pk !== null && pk !== undefined && typeof (pk) !== "string")
            pk = pk.toString();
        if (!pk || pk.length === 0)
            throw new Error("Failed to get primary key for record of type \"" + this.name + "\".");
        return pk;
    };
    TableSchema.prototype.getForeignKeys = function (record) {
        return this._foreignKeyFields.map(function (fk) { return ({ name: fk.name, value: record[fk.name] }); });
    };
    TableSchema.prototype.isModified = function (x, y) {
        if (this._stampFields.length > 0)
            return this._stampFields.reduce(function (p, n) { return p + (n.getValue(x) === n.getValue(y) ? 1 : 0); }, 0) !== this._stampFields.length;
        else
            return true;
    };
    return TableSchema;
}());
exports.TableSchema = TableSchema;
var FieldSchema = (function () {
    function FieldSchema(table, name, schema) {
        this.table = table;
        this.name = name;
        this.propName = schema.propName || name;
        this.type = schema.type || "ATTR";
        this.constraint = schema.constraint || "NONE";
        this.references = schema.references;
        this.relationName = schema.relationName;
        this._valueFn = schema.value ? schema.value.bind(this) : null;
    }
    FieldSchema.prototype.getValue = function (data, record) {
        return this._valueFn ? this._valueFn(data, {
            schema: this,
            record: record
        }) : data[this.name];
    };
    FieldSchema.prototype.getRecordValue = function (record) {
        return this.getValue(record.value, record);
    };
    return FieldSchema;
}());
exports.FieldSchema = FieldSchema;
