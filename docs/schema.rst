==========
The schema
==========

To make redux-db know how to tie your records together and how to normalize given data, you must define a schema.
The schema is defined using a simple nested JSON object. Each property in the schema object defines a table name.
Each table name must again define a new object for it's keys.

:: 

    {
        "TableName": {
            "FieldName": { ... fieldProperties }
        }
    }

The table name is up to you, but the field names must match your data model.

.. note::
    It is not really required, but the table name should be written using pascal casing. This helps you seperate Table class instances later on.


Primary keys
------------

If a table represents a single entity you should define a primary key::

    {
        "Table" : {
            "id": { type: "PK" }
        }
    }


Foreign keys
------------

You connect your tables using foreign keys. Foreign keys are noted using the "references" property.

:: 

    {
        "Table1" : {
            "ref": { references: "Table2", relationName: "refs" }
        },
        "Table2": {
            id: { type: "PK" }
        }
    }

The "relationName" property is required if you wish to access the relationship on the Records of "Table2".


Self referencing tables
-----------------------

It's perfectly fine to add a self referencing table field:: 

    "Table": {
        parent: { references: "Table", relationName: "children" }
    }


One to one relationships
------------------------

To specify a one to one relationship, you can set the "unique" flag on the field definition.
This will enforce the unique constraint for updates and inserts.

::

    "Table": {
        parent: { references: "Table", relationName: "child", unique: true }
    }

Cascading deletes
-----------------

You may define the "cascade" flag on a field definition. This will automatically delete the referencing records when the foreign table record is deleted.

::

    "Table": {
        // when the related record of "Table" is deleted, all it's children is also deleted.
        parent: { references: "Table", relationName: "children", cascade: true }
    }

Other field types
-----------------

Aside for the "PK" type, you may also define fields of type "MODIFIED".

The "MODIFIED" type defines a field that will be used to compare the state record with a updated record.
The default comparison is to do a shallow equallity check.

Custom normalization
--------------------
During data normalization you may have the need to transform the data.
redux-db provides a basic normalization hook for each table.

::

    ReduxDB.createDatabase( schema, {
        onNormalize: {
            "Table1": ( item, context ) => {
                const { id, name, ...rest } = item;

                // We split the given data and emits to "Table2" for normalization.
                context.emit( "Table2", rest );

                // returns the data for "Table1"
                return { id, name };
            }
        }
    });

Schema reference
----------------
All supported definitions

::

    {
        "Table" : {
            "Field": {
                type: "PK" | "MODIFIED" | "ATTR",

                // Defines a custom property name for the field. Defaults to the field name.
                propName?: string;

                // Defines the foreign table this field references.
                references?: string;

                // Defines the relationship name, which'll be the property name on the foreign table.
                relationName?: string;

                // If set, causes the record to be deleted if the foreign table row is deleted.
                cascade?: boolean;

                // If set, declares that this relation is a one 2 one relationship.
                unique?: boolean;

                // Defines a custom value factory for each record.
                value?: (record: any, context?: ComputeContext) => any;
            }
        }
    }