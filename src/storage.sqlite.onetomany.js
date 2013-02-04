"use strict";

/**
 * SqliteStorageAdapter - manages model data in a SQLite database.
 * @author dom <d.pesch@11com7.de>
 * @since 2012-09-30
 */
var SqliteOneToManyStorageAdapter = (function($)
{
  var
    _protectedColumns = ['id', 'dt_create', 'dt_change']
    ;


  //noinspection FunctionWithInconsistentReturnsJS
  var SqliteOneToManyStorageAdapter = function(){
    // scope-safe constructor
    if (this instanceof SqliteOneToManyStorageAdapter)
    {
      this.dbQuery = null;
      this._t1Class = null;
      this._t2Class = null;
      this._tmTable = "";
      this._tmT1Column = "";
      this._tmT2Column = "";
      this._saveT2No = -1;
      this._tx = null;
    }
    else
    {
      return new SqliteOneToManyStorageAdapter();
    }
  };

  SqliteOneToManyStorageAdapter.prototype = new SqliteStorageAdapter();
  SqliteOneToManyStorageAdapter.prototype.constructor = SqliteOneToManyStorageAdapter;


  SqliteOneToManyStorageAdapter.prototype.save = function(obj, callback)
  {

  };

  // TODO: overwrite methods

  
  return SqliteOneToManyStorageAdapter;
})(jq);
