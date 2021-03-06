//noinspection JSCheckFunctionSignatures
/**
 * DbQuery - This class allows to create different queries with simple array structures.
 *
 * Copyright 2012 11com7, Bornheim, Germany
 * @author Dominik Pesch <d.pesch@11com7.de>
 * @since 2012-11-01
 */
(/**
 * @param {af} $
 * @param {Window} window
 * @param {undefined} [undefined]
 */
function($, window, undefined) {
    'use strict';

    /**
     * $.SqlClause - wraps sql clause strings with parameter values in an object and could be passed to $.DbQuery().
     * @param {String} sqlClause
     * @param {Array} [sqlValues] sql values for '?' parameter in the sqlClause
     * @class SqlClause
     * @alias af.SqlClause
     */
    $.SqlClause = function(sqlClause, sqlValues) {
        /**
         * @type {string}
         * @private
         */
        this._sqlClause = "";

        /**
         * @type {Array}
         * @private
         */
        this._sqlValues = [];

        this.set(sqlClause || "");
        this.values(sqlValues || []);
    };

    $.SqlClause.prototype =
        {
            /**
             * @alias af.SqlClause.constructor
             */
            constructor: $.SqlClause,

            /**
             * Returns the sql clause as string.
             * @return {String} sql clause
             * @alias af.SqlClause.toString
             */
            toString: function() {
                return this._sqlClause;
            },

            /**
             * Sets the sql claus string.
             * @param {String} sqlClause
             * @alias af.SqlClause.set
             */
            set: function(sqlClause) {
                if (typeof sqlClause !== "string") {
                    throw new Error("SqlClause accepts only strings");
                }

                this._sqlClause = sqlClause;
            },

            /**
             * @inheritDoc
             * @alias af.SqlClause.get
             */
            get: function() {
                return this.toString();
            },

            /**
             * @return {Boolean} TRUE if this SqlClause object has one or more sql values.
             * @alias af.SqlClause.hasValues
             */
            hasValues: function() {
                return (this._sqlValues.length > 0);
            },

            /**
             * accessor for internal values: no parameter = get values; with array as parameter = set values.
             * @param {Array} [newValues] set values if parameter is an array
             * @return {Array}
             * @alias af.SqlClause.values
             */
            values: function(newValues) {
                if ($.isArray(newValues)) {
                    this._sqlValues = newValues;
                }

                return this._sqlValues;
            }
        };


    /**
     * DbQuery - this class helps to create sql select statements with arrays.
     *
     * Search-Quer-Objekt<pre>
     *  {
     *    filter : {Array},             // Filter/Query
     *    columns : {Array|null},       // (Array) existing Columns or $.SqlClause-Objects; (null) all columns
     *    limit : {Number|Array|null},  // default: 0; (optional)
     *    operator : {String},          // Default-Operator (optional, default: AND); ['AND', 'OR', 'XOR', 'NOT']
     *    order : {String|Array}        // Query-Order (optional)
     *  }</pre>
     *
     * Queries are build with a filter/search array:<pre>
     * Simple:
     *  ['a', '=', 1]           => "WHERE a=?"; [1]
     *  ['b', 'between', "5,6"] => "WHERE b BETWEEN (?,?)"; [5, 6]
     *  ['b', 'between', [5,6]] => "WHERE b BETWEEN (?,?)"; [5, 6]
     *
     * With logic operators
     *  [['a', '=', 1], ['b', '!=', 1]]       => "WHERE (a = ?) AND (b != ?)"; [1, 1]
     *  [['a', '=', 1], ['b', '!=', 1, "OR"]] => "WHERE (a = ?) OR (b != ?)"; [1, 1]
     *  or with logicOperator = "OR"
     *  [['a', '=', 1], ['b', '!=', 1]]       => "WHERE (a = ?) OR (b != ?)"; [1, 1]
     *
     * With parenthesis
     * [['('], ['a', '=', 1], ['b', '!=', 1], [')'], ['c', 'IN', [6,7,8,9], "OR"]]
     * => WHERE ((a = ?) AND (b != ?)) OR (c IN (?, ?, ?, ?)); [1, 1, 6, 7, 8, 9]
     *
     * With $.SqlClause objects
     * ['z', 'IN', new $.SqlClause('SELECT id FROM foo WHERE a=? and b=?', [5, 6])]
     * => WHERE (z IN SELECT id FROM foo WHERE a=? and b=?); [5, 6]
     *
     * And a little bit more complex
     * [['y','not in',"5,6,7,8,9"], ['z', 'IN', new $.SqlClause('SELECT id FROM foo WHERE a=? and b=?', [42, 1337])]]
     * => (y NOT IN (?, ?, ?, ?, ?)) AND (z IN SELECT id FROM foo WHERE a=? and b=?); ["5", "6", "7", "8", "9", 42, 1337]
     * </pre>
     *
     * @param {String} tableName
     * @param {Object} [options]
     * @class DbQuery
     * @alias af.DbQuery
     */
    $.DbQuery = function(tableName, options) {
        /**
         * @type {String}
         */
        this._table = '';
        this.setTableName(tableName);

        /**
         * sqlite library object.
         * @type {af.DatabaseAdapter}
         */
        this._$db = (options && options.db) ? options.db : $.db;

        /**
         * JavaScript database object for W3C web sql database interface.
         * @type {Database}
         */
        this._connection = this._$db.getConnection();

        /**
         * callback function which will be called for every search filter element.
         * It has to return the complete filter entry[x].
         * @type {function|undefined}
         */
        this._callbackFilterElement = undefined;

        /**
         * the last sql query, will be created by _buildSqlFromFilterArray().
         * @type {String}
         */
        this._sql = '';

        /**
         * Array with a value for every ? which will be set in the sql query.
         * @type {Array}
         */
        this._sqlValues = [];
    };


    $.DbQuery.prototype = {
        /**
         * @alias af.DbQuery.constructor
         */
        constructor: $.DbQuery,

        /**
         * @const
         * @alias af.DbQuery.SQL_OPERATORS
         */
        SQL_OPERATORS: flipToObject([
                                        '<', '>', '=', '>=', '<=', '<>', '!=',
                                        'BETWEEN', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE',
                                        'REGEXP', 'RLIKE', 'NOT REGEXP',
                                        'ISNULL', 'NOT ISNULL',
                                        'EXISTS', 'NOT EXISTS', 'ALL', 'ANY'
                                    ]),

        /**
         * @const
         * @alias af.DbQuery.SQL_OPERATORS_ARRAY
         */
        SQL_OPERATORS_ARRAY: flipToObject(['BETWEEN', 'NOT BETWEEN', 'IN', 'NOT IN']),

        /**
         * @const
         * @alias af.DbQuery.SQL_OPERATORS_LOGIC
         */
        SQL_OPERATORS_LOGIC: flipToObject(['AND', 'OR', 'XOR', 'NOT']),


        // ================================================================================================================
        // SEARCH
        // ================================================================================================================
        /**
         * Builds and runs a sql query from search array and method parameter.
         * @param {Object} search
         * @param {Array} search.filter  filter array (empty array returns all entries)
         * @param {Array|null} [search.columns=null]  (array) with existing columns, or $.SqlClause-Objects |
         *                                            (null) for all columns
         * @param {Number|Array|null} [search.limit=0]
         * @param {String} [search.operator='AND']
         * @param {String|Array} [search.order='']
         * @param {function(SQLTransaction, SQLResultSet)} successCallback
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.search
         */
        search: function(search, successCallback, errorCallback) {
            if ($.isArray(search)) {
                //noinspection JSValidateTypes
                search = {filter: search};
            }

            if (!$.isObject(search) || !search.filter) {
                throw new Error("Need search object:{filter, [columns], [limit], [operator], [order]}");
            }

            //noinspection JSUnresolvedVariable
            var
                columns = search.columns || null,
                limit = search.limit || 0,
                operator = search.operator || undefined,
                order = search.order || '';

            this.prepareSearch(search);
            this.execute(successCallback, errorCallback);
        },


        /**
         * Builds and returns a sql query from search array and method parameter.
         * @param {Object} search
         * @param {Array} search.filter  filter array (empty array returns all entries)
         * @param {Array|null} search.columns  (array) with existing columns, or $.SqlClause-Objects |
         *                                    (null) for all columns
         * @param {Number|Array|null} [search.limit=0]
         * @param {String} [search.operator='AND']
         * @param {String|Array} [search.order='']
         * @return {String}
         * @alias af.DbQuery.prepareSearch
         */
        prepareSearch: function(search) {
            if (!search || !search.columns) {
                search.columns = null;
            }

            var
                returnColumns = this._searchPrepareReturnColumns(search.columns),
                sqlWhere
            ;

            if (!returnColumns) {
                throw new Error("no return columns");
            }

            sqlWhere = this._buildSqlFromFilterArray(search);

            this._sql = "SELECT " +
                this._buildSqlColumns(returnColumns) +
                " FROM " + this._table +
                (sqlWhere ? " WHERE " + sqlWhere : "");

            if (search.order) {
                this._sql += this._buildSqlOrderBy(search.order);
            }

            //noinspection JSUnresolvedVariable
            if (search.limit) {
                //noinspection JSUnresolvedVariable
                this._sql += this._buildSqlLimit(search.limit);
            }

            return this._sql;
        },


        // ================================================================================================================
        // COUNT
        // ================================================================================================================
        /**
         * Counts some or all entries.
         * @param {Object} [search]  search object
         * @param {Array} [search.filter] filter array (empty array counts all entries)
         * @param {String} [search.operator='AND']
         * @param {function(value)} successCallback
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.count
         */
        count: function(search, successCallback, errorCallback) {
            if (!$.isObject(search) || !search.filter) {
                search = {filter: []};
            }

            this.prepareCount(search);
            this.executeOneValue(successCallback, errorCallback);
        },

        /**
         * Builds and returns a COUNT sql query.
         * @param {Object} search  search object
         * @param {Array} search.filter filter array (empty array returns all entries)
         * @param {String} [search.operator='AND']
         * @return {String}
         * @alias af.DbQuery.prepareCount
         */
        prepareCount: function(search) {
            var sqlWhere = this._buildSqlFromFilterArray(search);
            this._sql = "SELECT COUNT(*) FROM " + this._table;
            this._sql += (sqlWhere) ? " WHERE " + sqlWhere : "";

            return this._sql;
        },


        // ================================================================================================================
        // DELETE
        // ================================================================================================================
        /**
         * Deletes one or many rows from a table.
         * @param {Object} search  search object
         * @param {Array} search.filter filter array (empty array returns all entries)
         * @param {Number|Array|null} [search.limit]
         * @param {String} [search.operator='AND']
         * @param {function(SQLTransaction, SQLResultSet)} successCallback
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.deleteSearch
         */
        deleteSearch: function(search, successCallback, errorCallback) {
            this.prepareDeleteSearch(search);
            this.execute(successCallback, errorCallback);
        },

        /**
         * Builds and return a DELETE sql query.
         * @param {Object} search  search object
         * @param {Array} search.filter filter array (empty array returns all entries)
         * @param {Number|Array|null} [search.limit]
         * @param {String} [search.operator='AND']
         * @return {String}
         * @alias af.DbQuery.prepareDeleteSearch
         */
        prepareDeleteSearch: function(search) {
            var sqlWhere = this._buildSqlFromFilterArray(search);

            this._sql = "DELETE FROM " + this._table;
            this._sql += (sqlWhere) ? " WHERE " + sqlWhere : "";

            if (search.hasOwnProperty('limit')) {
                //noinspection JSUnresolvedVariable
                this._sql += this._buildSqlLimit(search.limit);
            }

            return this._sql;
        },


        // ================================================================================================================
        // EXECUTE
        // ================================================================================================================
        /**
         * This function executes the actual SQL command.
         * They had to be build with one of the buildXyz()-methods.
         * @param {function(SQLTransaction, SQLResultSet)} [successCallback]
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.execute
         */
        execute: function(successCallback, errorCallback) {
            var self = this;

            this._connection.transaction(
                function(tx) {
                    self.executeInTransaction(tx, successCallback, errorCallback);
                }
            );
        },

        /**
         * This function executes the actual SQL command.
         * They had to be build with one of the buildXyz()-methods.
         * @param {function(value)} [successCallback]
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.executeOneValue
         */
        executeOneValue: function(successCallback, errorCallback) {
            var self = this;

            this._connection.transaction(
                function(tx) {
                    self.executeInTransaction(
                        tx,
                        function(tx, results) {
                            var value = null;
                            if (results.rows.length) {
                                // get first key
                                value = results.rows.item(0);
                                value = value[Object.keys(value)[0]];
                            }

                            if ($.isFunction(successCallback)) {
                                successCallback(value);
                            }
                        },
                        errorCallback
                    )
                }
            );
        },

        /**
         * Execute the sql query in an opened transaction.
         * @param {SQLTransaction} tx
         * @param {function(SQLTransaction, SQLResultSet)} [successCallback]
         * @param {function(SQLTransaction, SQLError)} [errorCallback]
         * @alias af.DbQuery.executeInTransaction
         */
        executeInTransaction: function(tx, successCallback, errorCallback) {
            //noinspection JSValidateTypes
            this._$db.executeSql(tx, this.getSql(), this.getValues(), successCallback, errorCallback);
        },


        // ================================================================================================================
        // accessors
        // ================================================================================================================
        /**
         * Set a database object (used by execute()).
         * @param {af.DatabaseAdapter} db
         * @alias af.DbQuery.setDb
         */
        setDb: function(db) {
            this._$db = db;
            this._connection = db.getConnection();
        },

        /**
         * Sets / changes the table (or view) name.
         * @return {String}
         * @alias af.DbQuery.setTableName
         */
        setTableName: function(tableName) {
            if (!tableName || '' === tableName || 'string' !== typeof tableName) {
                throw new Error('parameter tableName is missing or empty');
            }

            this._table = tableName;
        },

        /**
         * Returns the table (or view) name.
         * @return {String}
         * @alias af.DbQuery.getTableName
         */
        getTableName: function() {
            return this._table;
        },

        /**
         * Returns the actual SQL query string (will be created by prepare[Search|Count|DeleteSearch|�]).
         * @return {String}
         * @alias af.DbQuery.getSql
         */
        getSql: function() {
            return this._sql;
        },

        /**
         * Returns the values for the actual SQL query (if there are no elements, it returns an empty array).
         * @return {Array}
         * @alias af.DbQuery.getValues
         */
        getValues: function() {
            return this._sqlValues;
        },

        /**
         * Returns the sql query as SqlClause object.
         * @return {$.SqlClause}
         * @alias af.DbQuery.getSqlClause
         */
        getSqlClause: function() {
            return new $.SqlClause(this.getSql(), this.getValues());
        },

        /**
         * Returns the return columns for a search object.
         * @param {Object} search
         * @returns {Array}
         * @alias af.DbQuery.getSearchColumns
         */
        getSearchColumns: function(search) {
            var searchColumns = (search && search.hasOwnProperty("columns")) ? search.columns : null;
            return this._searchPrepareReturnColumns(searchColumns);
        },

        // ================================================================================================================
        // build sql helper
        // ================================================================================================================
        /**
         * (internal) build an sql string from a column array with column names (string) or $.SqlClause objects.
         * For $.SqlClause objects the string representation will be used.
         * @param {Array|Object} columns (numArray) columns OR
         *                               (Object) search.columns
         * @return {String}
         * @private
         */
        _buildSqlColumns: function(columns) {
            var returnColumns = [];

            if ($.isObject(columns) && !!columns.columns) {
                columns = columns.columns;
            }

            columns.forEach(function(column) {
                returnColumns.push((column instanceof $.SqlClause) ? column.get() : column);
            });

            return returnColumns.join(", ");
        },


        /**
         * (internal) creates a sql string from a filter array.
         * @param {Object} search  search object
         * @param {Array} search.filter  search/filter array
         * @param {String} [search.operator] default operator between filter array elements, default value: AND
         * @private
         */
        _buildSqlFromFilterArray: function(search) {
            this._sqlValues = [];

            if (!$.isArray(search.filter)) {
                throw new Error("missing or wrong parameter search. got " + (typeof search) + " need Array");
            }
            if (!search.filter.length) {
                return "";
            } // empty search == empty WHERE
            var filter = search.filter;

            //noinspection JSUnresolvedVariable
            var operator = (search.operator && search.operator.length) ? search.operator.toUpperCase() : "AND";
            if (!this.SQL_OPERATORS_LOGIC[operator]) {
                throw new Error("unknown search.operator '" + operator + " (" + (typeof operator) + "). accepts only: " + this.SQL_OPERATORS_LOGIC.join(', '));
            }

            if (!$.isArray(filter[0])) {
                filter = [filter];
            }

            var
                sql = "",
                openBracket = true   // if true, the logicOperator will be suppressed
            ;

            // search[t] has to be:
            // - string clause: ['column', 'operator', 'value' | {SqlClause}, ['logicOperator']]
            // - brackets:      ['(' | ')', ['logicOperator']] | '(' | ')'
            // - SqlClause:     [{SqlClause}, ['logicOperator']] | {SqlClause}
            for (var t = 0; t < filter.length; t++) {
                var
                    entry = filter[t] = filter[t].slice(0),// <-- create copy of filter entry, because it will be heavily changed
                    entryType = $.typeOf(entry);


                if (!entry) {
                    throw new Error("missing search.filter[" + t + "] (" + (typeof entry) + ")");
                }


                if ("Array" !== entryType) {
                    if (entry === "(" || entry === ")" || entry instanceof $.SqlClause) {
                        entry = [entry];
                    } else {
                        throw new Error("search.filter[" + t + "] (" + (typeof entry) + ") isn't an array");
                    }
                } else {
                    if (!entry[0]) {
                        throw new Error("search.filter[" + t + "][0] fieldname (or bracket or SqlClause) doesn't exists");
                    }
                }


                // handle brackets
                if (entry[0] === "(" || entry[0] === ")") {
                    if (entry[0] === "(" && !openBracket) {
                        sql += " " + this._getLogicOperator(entry[1], operator);
                        openBracket = true;
                    } else if (entry[0] === ")") {
                        openBracket = false;
                    }

                    sql += entry[0];
                    continue;
                }

                if ("String" === entryType) {
                    entry[0] = this._prepareColumnName(entry[0]);
                }

                // call filter callback
                if (this._callbackFilterElement && $.isFunction(this._callbackFilterElement)) {
                    entry = this._callbackFilterElement.call(this, entry);
                    if (entry === false) {
                        continue;
                    }
                }


                // handle string clauses
                if (isString(entry[0])) {
                    if (entry[1]) {
                        entry[1] = this._prepareSearchOperator(entry, 1, 2, t);
                    }


                    if (typeof entry[2] !== "undefined") {
                        entry[2] = this._prepareSearchValue(entry, 1, 2, t);
                    }

                    entry[3] = this._getLogicOperator(entry[3], operator);
                    if (!this.SQL_OPERATORS_LOGIC.hasOwnProperty(entry[3])) {
                        throw new Error("search.filter[" + t + "][3] unsupported logic operator '" + entry[3] + "'. has to be '" + this.SQL_OPERATORS_LOGIC.join("', '") + "'");
                    }
                }

                if (!openBracket) {
                    sql += " " + entry[3] + " ";
                }

                openBracket = false;

                if (isString(entry[0])) {
                    entry.length = 3;
                    sql += "(" + entry.join(" ") + ")";
                } else if (entry[0] instanceof $.SqlClause) {
                    sql += "(" + entry[0].get() + ")";
                    if (entry[0].hasValues()) {
                        this._sqlValues.push.apply(this._sqlValues, entry[0].values());
                    }
                } else {
                    throw new Error("search.filter[" + t + "][0] unsupported field type (" + (typeof entry[0]) + ")");
                }
            }

            return sql;
        },


        /**
         * (internal) Returns a sql string with a valid limit clause or an empty string.
         * @param {String|Number|Array|null} limit (String|Number) limit (e.g '10', 0, -1, ...);
         *                                         (array) [limit, offset] (e.g. [0, 10])
         * @return {String}
         * @private
         */
        _buildSqlLimit: function(limit) {
            if (!limit) {
                return '';
            }

            var sqlLimit = '';

            if ($.isArray(limit) && 0 in limit && 1 in limit && limit[1] > 0) {
                sqlLimit += 'LIMIT ' + parseInt(limit[0], 10) + ', ' + parseInt(limit[1], 10);
            } else if (isNumeric(limit)) {
                sqlLimit += 'LIMIT ' + parseInt(limit, 10);
            }

            return sqlLimit;
        },


        /**
         * (internal) Returns an empty or sql ORDER BY string.
         * @param {String|Array} orderBy
         * @return {String}
         * @private
         */
        _buildSqlOrderBy: function(orderBy) {
            if (!orderBy) {
                return '';
            }

            var sqlOrderBy = [], allowedDir = {ASC: true, DESC: true};

            if ($.isArray(orderBy)) {
                for (var t = 0; t < orderBy.length; t++) {
                    if (isString(orderBy[t])) {
                        sqlOrderBy.push(orderBy[t]);
                    } else if ($.isArray(orderBy[t]) && 0 in orderBy[t]) {
                        if (!orderBy[t][1] || !orderBy[t][1].toUpperCase() in allowedDir) {
                            orderBy[t][1] = "ASC";
                        } else {
                            orderBy[t][1] = orderBy[t][1].toUpperCase();
                        }

                        sqlOrderBy.push(orderBy[t].join(" "));
                    } else {
                        // ignore!
                    }
                }
            } else if (isString(orderBy)) {
                sqlOrderBy[0] = orderBy;
            }

            return (sqlOrderBy.length) ? " ORDER BY " + sqlOrderBy.join(", ") : "";
        },


        /**
         * (internal) Checks if op1 is a valid operator and converts it to upper case; otherwise the default operator (defaultOp or AND) will be returned.
         * @param {String} op1
         * @param {String} [defaultOp]
         * @return {String}
         * @private
         */
        _getLogicOperator: function(op1, defaultOp) {
            defaultOp = defaultOp || "AND";
            return (op1 && this.SQL_OPERATORS_LOGIC[op1.toUpperCase()]) ? op1.toUpperCase() : defaultOp.toUpperCase();
        },


        /**
         * (internal) Trims and convert the column to lower case letters.
         * @param column
         * @return {String}
         * @private
         */
        _prepareColumnName: function(column) {
            if (!column || typeof column !== "string") {
                throw new Error("invalid or empty column name: '" + column + "' (" + (typeof column) + "). has to be non empty string!");
            }

            return column.trim().toLowerCase();
        },


        // ================================================================================================================
        // prepare helper
        // ================================================================================================================
        /**
         * (internal) Returns an array with existing column names or sqlClause objects.
         * @param {Array|null} [columnList]  array with fieldnames or SqlClaus objects
         * @return {Array}
         * @private
         * @throws Error for non existing column names or unknown types
         */
        _searchPrepareReturnColumns: function(columnList) {
            var returnColumns = [], columns = this._$db.getColumns(this._table);

            if (!$.isArray(columnList) || columnList.length < 1) {
                return columns;
            } else if ($.isArray(columnList)) {
                for (var t = 0; t < columnList.length; t++) {
                    if (isString(columnList[t])) {
                        if (columns.indexOf(columnList[t]) === -1) {
                            throw new Error("unknown column in columns[" + t + "]: '" + columnList[t] + "'");
                        }

                        returnColumns.push(columnList[t]);
                    } else if ($.isObject(columnList[t])) {
                        returnColumns.push(columnList[t]);
                    } else {
                        throw new Error("unaccepted column type columns[" + t + "] (" + (typeof columnList[t]) + ")");
                    }
                }

                return returnColumns;
            }
        },

        /**
         * (internal) helper for _buildSqlFromFilterArray() to prepare the operator.
         *
         * @param {Array} entry the actual search row entry (will be changed if operator is ISNULL or NOT ISNULL)
         * @param {Number} opIndex index number of the operator in entry
         * @param {Number} valueIndex index number of the value field in entry
         * @param {Number} searchIndex the actual search row (used for exception informations)
         * @private
         */
        _prepareSearchOperator: function(entry, opIndex, valueIndex, searchIndex) {
            if (!entry[opIndex] || undefined === entry[opIndex]) {
                throw new Error("missing or empty operator in search[" + searchIndex + "][" + opIndex + "]");
            }

            if (typeof entry[opIndex] !== "string") {
                throw new Error("wrong operator type (" + (typeof entry[opIndex]) + ") in search[" + searchIndex + "][" + opIndex + "]");
            }

            var operator = entry[opIndex].trim().toUpperCase();

            if (!this.SQL_OPERATORS.hasOwnProperty(operator) &&
                !this.SQL_OPERATORS_ARRAY.hasOwnProperty(operator)
            ) {
                throw new Error("unknown operator '" + operator + "' in search[" + searchIndex + "][" + opIndex + "]");
            }

            // special treatment for ISNULL or NOT ISNULL
            if (operator.indexOf("ISNULL") > -1) {
                entry[0] = new $.SqlClause(operator + "(" + entry[0] + ")");
                entry[valueIndex] = undefined;
                entry[3] = this._getLogicOperator(entry[valueIndex], '');

                operator = '';
            }

            return operator;
        },


        /**
         * (internal) helper for _buildSqlFromFilterArray() to prepare the operator.
         * @param {Array} entry the actual search row entry
         * @param {Number} valueIndex the index number for the value field in entry
         * @param {Number} opIndex index number of the operator in entry
         * @param {Number} searchIndex the actual search row (used for exception informations)
         * @private
         */
        _prepareSearchValue: function(entry, opIndex, valueIndex, searchIndex) {
            if (!entry.hasOwnProperty("" + valueIndex) || undefined === entry[valueIndex]) {
                throw new Error("missing or empty value in search[" + searchIndex + "][" + valueIndex + "]; entry: ['" + entry.join("','") + "']");
            }

            var
                value = entry[valueIndex],
                operator = entry[opIndex],
                valueType = $.typeOf(value),
                placeholder = this._getColumnPlaceholder(this._table, entry[0])
            ;


            // special treatment for array operator with string values (which should be converted to arrays)
            if (this.SQL_OPERATORS_ARRAY.hasOwnProperty(operator) && isString(value)) {
                value = value.split(/\s*,\s*/);
            }

            if ("Array" === valueType) {
                if (!this.SQL_OPERATORS_ARRAY.hasOwnProperty(operator)) {
                    throw new Error("unsupported array for skalar sql operator in search[" + searchIndex + "][" + valueIndex + "]: [" + value.join(", ") + "] (" + (typeof value) + ")");
                }

                if (operator === "BETWEEN") {
                    if (value.length !== 2) {
                        throw new Error("unsupported array length for BETWEEN operator in search[" + searchIndex + "][" + valueIndex + "]: [" + value.join(", ") + "] (" + (typeof value) + ")");
                    }

                    this._pushValue(value[0]);
                    this._pushValue(value[1]);
                    value = placeholder + " AND " + placeholder;
                }
                // array operators like IN, NOT IN
                else {
                    var tmp = "(";
                    for (var tt in value) {
                        if (value.hasOwnProperty(tt)) {
                            tmp += (tt != 0 ? ', ' : '') + placeholder;
                            this._pushValue(value[tt]);
                        }
                    }
                    value = tmp + ")";
                }
            } else if (value instanceof $.SqlClause) {
                if (value.hasValues()) {
                    this._sqlValues.push.apply(this._sqlValues, value.values());
                }
                value = value.get();
            } else {
                if (this._pushValue(value) === false) {
                    throw new Error("unsupported value in search[" + searchIndex + "][" + valueIndex + "]: '" + value + "' (" + (typeof value) + ")");
                }

                value = placeholder;
            }

            return value;
        },


        /**
         * (internal) converts and pushes the value into the internal value array (_sqlValues).
         * @param {String|Number|Boolean|null|Date|Array} value
         * @returns {boolean} TRUE for known/supported values; otherwise FALSE for unknown
         */
        _pushValue: function(value) {
            var dbVal, valueType = $.typeOf(value);

            if (isString(value) || isNumeric(value)) {
                dbVal = value;
            } else if ("Boolean" === valueType) {
                // convert bool to INT because sqlite don't know boolean values
                dbVal = value + 0;
            } else if ("null" === valueType) {
                dbVal = "NULL";
            } else if ("Date" === valueType) {
                dbVal = value.toISOString();
            } else if ("Array" === valueType) {
                dbVal = "'" + value.join("', '") + "'";
            }
            // UNKNOWN TYPE!
            else {
                return false;
            }

            this._sqlValues.push(dbVal);
            return true;
        },


        /**
         * (internal) tries to get a correct placeholder for known table/column pairs and '?' otherwise.
         * @param table
         * @param column
         * @returns {String}
         */
        _getColumnPlaceholder: function(table, column) {
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            return (this._$db.columnExists(table, column)) ? this._$db.getColumnPlaceholder(table, column) : '?';
        }

    };


    //noinspection SpellCheckingInspection
    /**
     * Return TRUE if test is a numeric value.
     * @author Christian C. Salvadó
     * @see http://stackoverflow.com/a/1830844
     * @param {*} test
     * @return {Boolean}
     * @function
     */
    function isNumeric(test)
    {
        return !isNaN(parseFloat(test)) && isFinite(test);
    }


    /**
     * Returns TRUE if test is a string.
     * @param {*} test
     * @return {Boolean}
     * @function
     */
    function isString(test)
    {
        return typeof test === "string";
    }

    /**
     * Flips an array to an object by swapping the array values to object keys.
     * @example ['a', 'b', 'c'] => {a:0, b:1, c:2}
     * @param {Array} array
     * @return {Object}
     * @function
     */
    function flipToObject(array)
    {
        var obj = {};
        if (!$.isArray(array)) {
            return obj;
        }

        for (var t in array) {
            if (array.hasOwnProperty(t)) {
                obj[array[t]] = t;
            }
        }

        return obj;
    }

})(af, window);
