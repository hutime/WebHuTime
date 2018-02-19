
// **** ファイルの取得方法に応じた読み込み処理を提供 ****
HuTime.StreamBase = function() {
};
HuTime.StreamBase.prototype = {
    constructor: HuTime.StreamBase,

    _source: null,  // 読み込み元
    get source() {
        return this.source;
    },
    set source(val) {
        this._source = val;
        this.loadState = "ready";
    },

    load: function load() {                 // ストリームの読み込み開始
        this.loadState = "loading"
    },
    onloadend: function onloadend() {},     // 読み込み終了後の処理
    loadState: "init",                      // 読み込み状態（init, ready, loading, loadend, error）

    readAll: function readAll() {           // 全ての読み込みデータを返す（基底クラスなのでnullを返す）
        return null;
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _source: function (objForJSON) {
            var element = document.createElement("a");
            element.href = this._source;
            objForJSON.source = element.href;     // フルパスを入力
        }
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// ローカルファイルからの読み込み
HuTime.FileStream = function FileStream (source) {
    this.source = source;
    this._reader = new FileReader();
    this._reader.onloadend = function (e) {  // FileReaderの読み込み終了イベントに処理を設定
        this.loadState = "loadend";
        this.onloadend.apply(this)
    }.bind(this);
};
HuTime.FileStream.prototype = Object.create(HuTime.StreamBase.prototype, {
    constructor: {
        value: HuTime.FileStream
    },

    // FileStream固有のプロパティ等
    _reader: {          // FileReader
        writable: true,
        value: null
    },
    source: {
        get: function() {
            return this._source;
        },
        set: function(val) {
            if (!(val instanceof File)) {
                this._source = null;
                this.loadState = "error";
                return;
            }
            this._source = val;
            this.loadState = "ready";
        }
    },

    // 基底クラスのオーバライド
    load: {
        value: function load() {
            if (!(this._source instanceof File)) {
                this.loadState = "error";
                return;
            }
            this.loadState = "loading";
            this._reader.readAsText(this._source);
        }
    },
    readAll: {
        value: function readAll() {
            if (this._reader.result && this.loadState == "loadend")
                return this._reader.result;
            else
                return null;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._parseJSONProperties, {
        })
    }
});

// Web上からの読み込み
HuTime.HttpStream = function HttpStream (source) {
    this.source = source;
    this._request = new XMLHttpRequest();
    this._request.onreadystatechange = function (e) {       // XMLHttpRequestの読み込み終了イベントに処理を設定
        if (this._request.readyState != 4)
            return;
        if (this._request.status != "200") {
            this.loadState = "error";
            return;
        }
        this.loadState = "loadend";
        this.onloadend.apply(this);
    }.bind(this);
};
HuTime.HttpStream.prototype = Object.create(HuTime.StreamBase.prototype, {
    constructor: {
        value: HuTime.HttpStream
    },

    // HttpStream固有のプロパティ等
    _request: {          // XMLHttpRequest
        writable: true,
        value: null
    },
    source: {
        get: function() {
            return this._source;
        },
        set: function(val) {
            if (!val) {
                this._source = null;
                this.loadState = "error";
                return;
            }
            this._source = val;
            this.loadState = "ready";
        }
    },
    _responseText: {
        writable: true,
        value: null
    },

    // 基底クラスのオーバライド
    load: {
        value: function load() {
            if (!this._source) {
                this.loadState = "error";
                return;
            }
            this._request.abort();
            this._responseText = null;
            this.loadState = "loading";
            this._request.open("get", this._source, true);
            this._request.send(null);
        }
    },
    readAll: {
        value: function readAll() {
            if (this._request.readyState != 4 || this.loadState != "loadend")   // readyState: 4 = DONE
                return null;
            return this._request.responseText;
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamBase.prototype._parseJSONProperties, {
        })
    }
});

// **** ファイルのタイプに応じた読み取り処理により、読み込んだデータを配列に展開 ****
HuTime.StreamReaderBase = function StreamReaderBase (source) {
    this.source = source;
};
HuTime.StreamReaderBase.prototype = {
    constructor: HuTime.StreamReaderBase,

    _stream: null,              // レコードセットを取得するストリーム
    get stream() {
        return this._stream;
    },
    set stream(val) {
        if (!(val instanceof HuTime.StreamBase))
            return;
        this._stream = val;
        this._stream.onloadend = function () {
            this._readRecordData.apply(this);
            this.onloadend.apply(this);   // 自身に設定された読み取り終了後の処理を、ストリーム読み取り後の処理として設定
        }.bind(this);
    },

    _source: null,              // レコードセットの取得元
    get source() {
        return this._source;
    },
    set source(val) {       // 取得元に応じて、適切なstreamオブジェクトを設定
        if (typeof val == "string" && val != "")  // URLとして入力された場合
            this.stream = new HuTime.HttpStream(val);
        else if (val instanceof File)                // Fileオブジェクトが入力された場合
            this.stream = new HuTime.FileStream(val);
        else if (val instanceof HuTime.StreamBase)   // streamオブジェクトが直接入力された場合
            this.stream = val;
        else
            return;
        this._source = val;
    },

    _recordData: null,          // ストリームから読み込んだデータ
    get recordData() {
        return this._recordData;
    },
    _itemNames: null,           // 項目名（列名）の配列
    get itemNames() {
        return this._itemNames;
    },
    load: function load () {     // 読み込み
        this._stream.load();
    },
    get loadState () {
        return this._stream.loadState;
    },

    onloadend: function onloadend(){},  // レコードセット読み取り終了後の処理
    _readRecordData: function() {},     // レコードセットの読み取り

    // **** JSON出力 ****
    _toJSONProperties: {
        _stream: "stream",
        _source: function (objForJSON) {
            var element = document.createElement("a");
            element.href = this._source;
            objForJSON.source = element.href;     // フルパスを入力
        }
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// テキストファイル
HuTime.TextReader = function TextReader (source, isTitleRow, delimiter) {
    // isTitleRow: trueならば1行目はタイトル行, delimiter: 区切り文字
    HuTime.StreamReaderBase.apply(this, arguments);
    this.isTitleRow = isTitleRow;
    this.delimiter = delimiter;
};
HuTime.TextReader.prototype = Object.create(HuTime.StreamReaderBase.prototype, {
    constructor: {
        value: HuTime.TextReader
    },

    _isTitleRow: {            // タイトル行の設定（trueならば1行目はタイトル行）
        writable: true,
        value: true
    },
    isTitleRow: {
        get: function() {
            return this._isTitleRow;
        },
        set: function(val) {
            if ((typeof val) == "boolean")
                this._isTitleRow = val;
        }
    },
    _delimiter: {           // 区切り記号
        writable: true,
        value: ","
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        },
        set: function(val) {
            if ((typeof val) == "string")
                this._delimiter = val;
        }
    },

    _readRecordData: {
        value: function _readRecordData() {
            var isTitleRow = this._isTitleRow;  // 現在処理中の行がタイトル行かどうか
            var pos = 0;        // 現在の読み込み位置
            var posNext;        // 次の読み込み位置（読み込むデータの終端の次）
            var posIndexOf;     // IndexOfの結果を収容

            this._recordData = [];
            this._itemNames = [];
            var recordId = 0;
            var item = "";
            var maxItemCount = 0;
            var itemCount = 0;

            var value;
            var loadedData = this.stream.readAll();
            var length = loadedData.length;
            var isEnclosed = false;
            var NLCode = HuTime.checkNewLineCode(loadedData);   // 改行コード

            recordId = 0;
            while (pos < length) {
                if (!isTitleRow)     // データ行の処理
                    this._recordData.push({
                        name: this._itemNames,  // 表形式なので、参照を渡すだけ（全てのレコードで共通になる）
                        value: []
                    });
                itemCount = 0;
                while (pos < length) {
                    // 冒頭の空白の処理（引用符が用いられない場合は、データに含まれる）
                    while (loadedData[pos] == " " && pos < length) {
                        item += loadedData[pos];
                        ++pos;
                    }
                    // 引用符の中の処理
                    if (loadedData[pos] == "\"") {
                        item = "";      // 空白が入っている場合もあるので一度クリア
                        isEnclosed = true;
                        ++pos;
                        while (pos < length) {
                            posNext = loadedData.indexOf("\"", pos);
                            if (posNext < 0) {
                                item += loadedData.slice(pos, length);     // 終端の引用符が見つからない場合
                                break;
                            }
                            item += loadedData.slice(pos, posNext);
                            pos = posNext + 1;
                            if (pos >= length || loadedData[pos] != "\"")
                                break;
                            item += "\"";   // 引用符内の引用符（""）
                            ++pos;
                        }
                    }

                    //　データ項目末端の探索
                    posNext = loadedData.indexOf(this._delimiter, pos);        // データ項目区切り
                    if (posNext < 0)
                        posNext = length;   // 区切りが見つからない場合は最後ファイル末尾を設定

                    posIndexOf = loadedData.indexOf(NLCode, pos);      // レコード区切り
                    if (posIndexOf >= 0 && posIndexOf < posNext)
                        posNext = posIndexOf;

                    // 引用符に囲まれていない値の取得
                    if (!isEnclosed) {
                        item += loadedData.slice(pos, posNext);
                        if (!isNaN(item))       // 数値として認識できる場合
                            item = parseFloat(item);
                    }

                    // 値を結果に出力し、各種編集を初期値に戻す
                    if (isTitleRow)
                        this._itemNames.push(item);     // タイトル行の処理
                    else
                        this._recordData[recordId].value.push(item);    // データ行の処理
                    isEnclosed = false;
                    item = "";

                    if (loadedData[posNext] != this._delimiter)
                        break;      // データ項目区切りでない場合は、レコード末端（次のレコードへ）
                    pos = posNext + this._delimiter.length;
                }

                if (isTitleRow)
                    isTitleRow = false;  // falseに設定し、以降の処理をデータ行として処理
                else {      // データ項目数をチェックして、レコードIDをインクリメント
                    if (maxItemCount < this._recordData[recordId].value.length)
                        maxItemCount = this._recordData[recordId].value.length;
                    ++recordId;
                }

                pos = loadedData.indexOf(NLCode, pos);    // レコード区切り
                pos += NLCode.length;
            }

            // 項目名の不足分を列番号で補完
            for (var i = this._itemNames.length; i < maxItemCount; ++i) {
                this._itemNames.push(i);
            }
            return this._recordData;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.StreamReaderBase.prototype._toJSONProperties, {
            _isTitleRow: { value: "isTitleRow" },
            _delimiter: { value: "delimiter" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.StreamReaderBase.prototype._parseJSONProperties, {
        })
    }
});

// csvファイル（TextReaderの区切り記号を','に固定）
HuTime.CsvReader = function CsvReader (source, isTitleRow) {
    HuTime.TextReader.apply(this, arguments);
};
HuTime.CsvReader.prototype = Object.create(HuTime.TextReader.prototype, {
    constructor: {
        value: HuTime.CsvReader
    },

    _delimiter: {
        writable: true,
        value: ","
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._parseJSONProperties, {
        })
    }
});

// tsvファイル（TextReaderの区切り記号を'\t'に固定）
HuTime.TsvReader = function TsvReader (source, isTitleRow) {
    HuTime.TextReader.apply(this, arguments);
};
HuTime.TsvReader.prototype = Object.create(HuTime.TextReader.prototype, {
    constructor: {
        value: HuTime.TsvReader
    },

    _delimiter: {
        writable: true,
        value: "\t"
    },
    delimiter: {
        get: function() {
            return this._delimiter;
        }
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.TextReader.prototype._parseJSONProperties, {
        })
    }
});

// **** Recordオブジェクト内のデータと読み込みデータの項目（列）との対応や生成方法を指定 ****
HuTime.RecordSettingBase = function RecordSettingBase (itemName, getValue) {
    if (getValue instanceof Function)
        this.getValue = getValue;
    else
        this.getValue = this.getValueDefault;
};
HuTime.RecordSettingBase.prototype = {
    constructor: HuTime.RecordSettingBase,

    itemName: null,                     // 入力側の列名、または列番号
    getValue: function getValue() {},   // 値の取得
    getValueDefault: function(streamRecord) {},
    getValueBase: function(streamRecord, itemName) {
        if (!streamRecord || !itemName)
            return null;
        var itemIndex;  // 項目番号
        if (isFinite(itemName))        // 該当する配列要素の特定
            itemIndex = itemName;      // 直接項目番号が指定された場合（0からの列番号）
        else
            itemIndex = streamRecord.name.indexOf(itemName);       // 項目名が指定された場合

        if (itemIndex < 0 || itemIndex >= streamRecord.value.length)
            return null;    // 不正な項目名指定

        return streamRecord.value[itemIndex];
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        itemName: "itemName"
    },
    _parseJSONProperties: {
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// RecordDataの取得設定
HuTime.RecordDataSetting = function RecordDataSetting (itemName, recordDataName, getValue) {
    HuTime.RecordSettingBase.apply(this, [itemName, getValue]);
    this.itemName = itemName;
    if (recordDataName)
        this.recordDataName = recordDataName;
    else
        this.recordDataName = this.itemName;
};
HuTime.RecordDataSetting.prototype = Object.create(HuTime.RecordSettingBase.prototype, {
    constructor: {
        value: HuTime.RecordDataSetting
    },
    itemName: {             // 入力側の列名、または列番号
        writable: true,
        value: null
    },
    recordDataName: {       // 出力されるデータ項目名
        writable: true,
        value: null
    },
    getValueDefault: {
        value: function (streamRecord) {
            return HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemName]);
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._toJSONProperties, {
            recordDataName: { value: "recordDataName" }
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定
HuTime.RecordTSetting = function RecordTSetting (itemNameBegin, itemNameEnd, getValue) {
    HuTime.RecordSettingBase.apply(this, [itemNameBegin, getValue]);
    this.itemNameBegin = itemNameBegin;
    if (itemNameEnd)
        this.itemNameEnd = itemNameEnd;
    else
        this.itemNameEnd = this.itemNameBegin;  // 1つしか指定されていない場合
};
HuTime.RecordTSetting.prototype = Object.create(HuTime.RecordSettingBase.prototype, {
    constructor: {
        value: HuTime.RecordTSetting
    },
    itemNameBegin: {
        writable: true,
        value: null
    },
    itemNameEnd: {
        writable: true,
        value: null
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var begin = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameBegin]);
            var end = HuTime.RecordSettingBase.prototype.getValueBase.apply(
                this, [streamRecord, this.itemNameEnd]);
            if (begin == null || end == null)
                return null;
            return new HuTime.TRange.createFromBeginEnd(begin, end);
        }
    },

    _toJSONProperties: {
        value: {
            itemNameBegin: "itemNameBegin",
            itemNameEnd: "itemNameEnd"
        }
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordSettingBase.prototype._parseJSONProperties, {
        })
    }
});

// t値の取得設定（暦データ）
HuTime.RecordTCalendarSetting = function RecordTCalendarSetting (itemNameBegin, itemNameEnd, getValue) {
    HuTime.RecordTSetting.apply(this, arguments);
};
HuTime.RecordTCalendarSetting.prototype = Object.create(HuTime.RecordTSetting.prototype, {
    constructor: {
        value: HuTime.RecordTCalendarSetting
    },
    getValueDefault: {     // TRangeとして出力
        value: function getValue(streamRecord) {
            var beginRange = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameBegin]));
            var endRange = HuTime.isoToJdRange(
                HuTime.RecordSettingBase.prototype.getValueBase.apply(
                    this, [streamRecord, this.itemNameEnd]));

            if (isNaN(beginRange[0]) || isNaN(endRange[1]))
                return null;
            return new HuTime.TRange.createFromBeginEnd(beginRange[0], endRange[1]);

            //return new HuTime.TRange.createFromBeginEnd(
            //    new HuTime.TRange.createFromBeginEnd(beginRange[0], beginRange[1]),
            //    new HuTime.TRange.createFromBeginEnd(endRange[0], endRange[1]));
        }
    },

    _toJSONProperties: {
        value: Object.create(HuTime.RecordTSetting.prototype._toJSONProperties, {
        })
    },
    _parseJSONProperties: {
        value: Object.create(HuTime.RecordTSetting.prototype._parseJSONProperties, {
        })
    }
});

// 設定を収容するコンテナ
HuTime.RecordSettings = function RecordSettings () {
    this._dataSettings = [];
};
HuTime.RecordSettings.prototype = {
    constructor: HuTime.RecordSettings,

    _tSetting: null,            // t値に関する設定
    get tSetting() {
        return this._tSetting;
    },
    set tSetting(val) {
        if (!(val instanceof HuTime.RecordTSetting))
            return;
        this._tSetting = val;
    },
    _dataSettings: null,        // RecordDataに関する設定の配列
    get dataSettings() {
        return this._dataSettings;
    },
    appendDataSetting: function appendSetting(setting) {
        this._dataSettings.push(setting);
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _tSetting: "tSetting",
        _dataSettings: "dataSettings"
    },
    _parseJSONProperties: {
        dataSettings: "_dataSettings"
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};
