
// JSON関係
HuTime.JSON = {
    // シリアライズとデシリアライズ
    stringify: function stringify (obj) {
        if (typeof obj === "undefined")     // undefined
            return undefined;
        if (obj == null)                    // null
            return null;
        if (typeof obj === "function")      // function
            return obj.toString();

        var objForJSON; // 出力結果の収容用（JSONに変換するための整形済みオブジェクト）
        var propObj;    // 再帰によるHuTime.JSON.stringigyの結果収容用
        var prop;       // 処理対象のプロパティ名
        if (obj instanceof Array) {         // Array
            objForJSON = [];
            for (var i = 0; i < obj.length; ++i) {
                propObj = HuTime.JSON.stringify(obj[i]);
                if (typeof propObj !== "undefined")
                    objForJSON.push(propObj);
            }
            return objForJSON;
        }
        if (typeof obj === "object") {      // object（Arrayを含む）
            objForJSON = {};
            if ("_toJSONProperties" in obj) {   // JSONへの変換テーブルあり -> HuTime関係のオブジェクト
                objForJSON["constructor"] = obj.constructor.name;     // デシリアライズ用にconstructorの名前を保存
                for (prop in obj) {
                    switch (prop) {     // 各クラスに共通の読み飛ばすプロパティ
                        case "constructor":
                        case "_toJSONProperties":
                        case "_parseJSONProperties":
                        case "toJSON":
                            continue;
                    }

                    if (prop in obj._toJSONProperties) {     // JSONへの変換定義がある場合
                        if (obj._toJSONProperties[prop] == null)          // 出力指定がnullの場合は出力しない
                            continue;
                        if (typeof obj._toJSONProperties[prop] === "string") {    // 出力名が指定されている場合
                            if (obj[prop] == obj.__proto__[prop])   // 既定値と同じ場合は出力しない
                                continue;

                            propObj = HuTime.JSON.stringify(obj[prop]);
                            if (typeof propObj !== "undefined")
                                objForJSON[obj._toJSONProperties[prop]] = propObj;
                        }
                        else if (typeof obj._toJSONProperties[prop] === "function") {     // 出力関数が指定されている場合
                            obj._toJSONProperties[prop].apply(obj, [objForJSON]);
                        }
                    }
                    else {  // JSONへの変換定義が無い場合
                        if (prop in obj.__proto__)
                            continue;     // プロトタイプで定義されているのにJSONへの変換定義なし －＞ 出力しない
                        objForJSON[prop] = obj[prop];     // プロトタイプで定義されていない　－＞ ユーザ定義のプロパティ
                    }
                }
            }
            else {          // HuTime関係以外のオブジェクト
                for (prop in obj) {
                    objForJSON[prop] = HuTime.JSON.stringify(obj[prop]);
                }
            }
            return objForJSON;
        }
        return obj;     // 数値、文字列など
    },
    parse: function parse (json) {
        var objRaw;         // パースしただけの生のオブジェクト
        var obj;            // 結果（出力するオブジェクト）
        var prop;           // 処理対象のプロパティ名
        if (typeof json === "string") {
            try {           // jsonをいったん標準的な方法でparseseする
                var p = JSON.parse(json);
                objRaw = p;
            }
            catch (e) {     // JSONとしてパースできない（JSONでない生の値 -> そのまま）
                objRaw = json;
            }
        }
        else {
            objRaw = json;
        }

        if (typeof objRaw === "undefined")
            return undefined;
        if (objRaw == null)                   // null
            return null;
        if (objRaw instanceof Array) {        // Array
            obj = [];
            for (var i = 0; i < objRaw.length; ++i) {
                obj.push(HuTime.JSON.parse(objRaw[i]));
            }
            return obj;
        }
        if (typeof objRaw === "object") {     // オブジェクト一般
            // オブジェクトの生成
            if (typeof objRaw.constructor === "string") {     // HuTime関係のオブジェクト
                var constructor = eval("HuTime." + objRaw.constructor);
                if (constructor == undefined)
                    obj = {};   // コンストラクタの取得失敗
                else
                    obj = new constructor();
            }
            else {      // HuTime関係以外のオブジェクト
                obj = {};
            }

            // 各プロパティのデシリアライズ
            if ("_parseJSONProperties" in obj) {    // 出力指定がある場合（HuTime関係のオブジェクト）
                for (prop in objRaw) {
                    switch (prop) {             // 各クラスに共通の読み飛ばすプロパティ
                        case "constructor":
                            continue;
                    }

                    if (prop in obj._parseJSONProperties) {     // 出力指定がある場合
                        if (obj._parseJSONProperties[prop] == null)   // 出力指定がnullの場合は出力しない
                            continue;
                        if (typeof obj._parseJSONProperties[prop] === "string") {     // 出力方法が文字列指定
                            obj[obj._parseJSONProperties[prop]] = HuTime.JSON.parse(objRaw[prop]);
                        }
                        else if (typeof obj._parseJSONProperties[prop] === "function") {  // 出力方法が関数指定
                            obj._parseJSONProperties[prop].apply(obj, [objRaw]);
                        }
                    }
                    else {      // 出力指定が無い場合は、プロパティ名をそのまま利用
                        obj[prop] = HuTime.JSON.parse(objRaw[prop]);
                    }
                }
            }
            else {      // 出力指定が無い場合（HuTime関係以外のオブジェクト）
                for (var prop in objRaw) {
                    obj[prop] = HuTime.JSON.parse(objRaw[prop]);
                }
            }

            return obj;
        }
        if (typeof objRaw === "string" && objRaw.substr(0, 8) == "function")    // function
            return eval("(" + objRaw + ")");
        return objRaw;        // その他（数値、文字列など）
    },

    // シリアライズデータの保存と取得
    save: function save (obj) {
        var content =  JSON.stringify(obj);
        var blob = new Blob([ content ], { "type" : "application/json" });
        var elm = document.createElement("a");  // a要素を作って、一時的にbody要素直下に置く
        document.body.appendChild(elm);
        elm.href = window.URL.createObjectURL(blob);
        elm.download="data.json";
        elm.click();
        document.body.removeChild(elm);
    },
    load: function load (source, handler) {     // ソースと取得後の処理関数を設定
        var reader = new HuTime.JSON.Reader(source);
        if (typeof handler === "function")
            reader.onloadend = handler;
        reader.load();
        return reader;
    }
};

// JSONデータを読み込むためのリーダ
HuTime.JSON.Reader = function Reader (source) {
    this.source = source;
};
HuTime.JSON.Reader.prototype = {
    constructor: HuTime.JSON.Reader,

    _stream: null,      // レコードセットを取得するストリーム
    get stream () {
        return this._stream;
    },
    set stream (val) {
        if (!(val instanceof HuTime.StreamBase))
            return;
        this._stream = val;
        this._stream.onloadend = function () {
            this._parsedObject = HuTime.JSON.parse(this._stream.readAll());
            this._isParsed = true;
            this.onloadend.apply(this);
        }.bind(this);
    },

    _source: null,      // レコードセットの取得元
    get source () {
        return this._source;
    },
    set source (val) {      // 取得もとに応じて、適切なstreamオブジェクトを設定
        if (typeof  val === "string" && val != "")
            this.stream = new HuTime.HttpStream(val);
        else if (val instanceof File)       // Fileオブジェクトが入力された場合
            this.stream = new HuTime.FileStream(val);
        else if (val instanceof HuTime.StreamBase)  // streamオブジェクトが直接入力された場合
            this.stream = val;
        else
            return;
        this._source = val;
    },

    _isParsed: false,   // JSONデータのパース終了フラグ
    _parsedObject: null,
    get parsedObject () {
        if (this._isParsed)
            return this._parsedObject;
        else
            return undefined;
    },

    load: function load () {
        this._isParsed = false;     // パース終了フラグをクリア
        this._stream.load();
    },
    get loadState () {
        return this._stream.loadState;
    },
    onloadend: function onloadend () {}
};
