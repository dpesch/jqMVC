/**
 * SqliteStorageAdapter - manages modell data in a sqlite database.
 * @author dom <d.pesch@11com7.de>
 * @since 2012-09-30
 */
var SqliteStorageAdapter = (function()
{
  var
    _protectedColumns = ['id', 'dt_create', 'dt_change']
    ;


  var SqliteStorageAdapter = function(){ };

  $.extend(SqliteStorageAdapter,
  {
    // ===================================================================================================================
    // save()
    // ===================================================================================================================
    /**
     * <p>Saves the object in database.</p>
     * <p>New objects (id == 0) will be inserted, existing (id > 0) will be updated.
     * This method gets the column names via $.db.getColumns() and fetch - only - this keys
     * from obj.
     * </p>
     *
     * <h2> __sleep() method</h2>
     * <p>Support a __sleep() method in modell object, which will be called to get the
     * <code>
     *  var Modell = new $.mvc.model.extend("modell",
     *  {
     *    // ...
     *
     *    // this method will be called automatically before getting the save values
     *    __sleep = function()
     *    {
     *      var objCopy = $.extend({}, this);
     *
     *      // do something "magic"
     *
     *      return objCopy;
     *    }
     *  }
     * </code>
     * </p>
     *
     * @param {Object} obj
     * @param {function} [callback]
     * @requires $.db
     * @throws Error  
     */
    save : function(obj, callback)
    {
      var db,
        tableName = _getTableName(obj),
        sql = "",
        values,
        columns,
        id = Math.max(0, obj.id || 0),
        isNew = (0 === id)
        ;

      try
      {
        db = $.db.open();

        _checkTableName(tableName);
        columns = _getWriteColumns(tableName);

        sql = (isNew ? "INSERT INTO " : "UPDATE ") + tableName +
          " (" + columns.join(", ") + ")" +
          " VALUES (" + "?".repeat(columns.length, ", ") + ")" +
          (!isNew ? " WHERE id=?" : "")
        ;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        values = $.values((obj.__sleep && $.isFunction(obj.__sleep)) ? obj.__sleep.call(obj) : obj, columns);
        if (!isNew)  { values.push(id); }

        db.transaction(
          // QUERY
          function(tx) {
            tx.executeSql(sql, values, function(tx, results)
            {
              if (isNew)
              {
                obj.id = results.insertId;
              }
            });
          },
          // ERROR
          function(err) {
            $.db.throwSqlError(err, sql);
          },
          // SUCCESS
          function()
          {
            if (callback && $.isFunction(callback)) callback(obj);
          });
      }
      catch(err)
      {
        $.db.throwSqlError(err, sql || "-- unknown --");
      }
    },




  // ===================================================================================================================
  // get
  // ===================================================================================================================
  get : function(id, callback)
  {
    console.log("get", arguments);
    return;

    var
      db,
      tableName = _getTableName(obj),
      sql = "",
      columns
      ;


    try
    {
      db = $.db.open();

      _checkTableName(tableName);
      columns = _getWriteColumns(tableName);

      sql = "SELECT " + columns.join(", ") + " FROM " + tableName +
        "WHERE id=?";

      console.log(sql);

    }
    catch(err)
    {
      $.db.throwSqlError(err, sql || "-- unknown --");
    }
  }


  // END of class
  });

  // ===================================================================================================================
  // helper
  // ===================================================================================================================
  function _checkTableName(nameOrObj)
  {
    var tableName = ($.isObject(nameOrObj)) ? _getTableName(nameOrObj) : nameOrObj;
    if (!$.db.tableExists(tableName))
    {
      throw new Error("table '" + tableName + "' not defined in $.db");
    }
  }


  /**
   * @param obj $.mvc.model object
   * @return String table name from obj.tableName || obj.modelName
   */
  function _getTableName(obj)
  {
    //noinspection JSUnresolvedVariable
    return (obj.tableName) ? obj.tableName : obj.modelName;
  }


  function _getWriteColumns(columnsOrTableName)
  {
    /** @type {Array} columns */
    var columns = ($.isArray(columnsOrTableName)) ? columnsOrTableName : $.db.getColumns(columnsOrTableName);
    return columns.filter(function(el) { return (_protectedColumns.indexOf(el) === -1); } );
  }



  // ===================================================================================================================
  // "global" methods (export via prototype or $.)
  // ===================================================================================================================
  if (!String.prototype.repeat)
  {
    /**
     * @param {Number} count repeat count times
     * @param {String} [delimiter] delimiter between repeated strings
     * @return {String}
     */
    String.prototype.repeat = function (count, delimiter)
    {
      var
        repeat = this + (delimiter || ''),
        back = new Array(isNaN(count) ? 1 : ++count).join(repeat);

      return !delimiter ? back : back.substr(0, back.length - delimiter.length);
    };
  }

  if (!$.values)
  {
    /**
     * Return some or all values from obj as (real) array.
     * @param {Object} obj
     * @param {Array}keys
     * @return {Array}
     */
    $.values = function(obj, keys)
    {
      var ret = [];
      keys = keys || Object.keys(obj);

      if (obj !== null && $.isArray(keys))
      {
        keys.map(function(el) { if (obj.hasOwnProperty(el))  { ret.push(obj[el]); } });
      }

      return ret;
    }
  }


  return SqliteStorageAdapter;
})();
