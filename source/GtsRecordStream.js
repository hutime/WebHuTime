HuTime.ZipReader = function(source, rootFile) {
    HuTime.StreamReaderBase.apply(this, arguments);
    this.source = source;
    this.rootFile = rootFile;
    this.baseURI = "";
    if (!(source instanceof File) && !(source instanceof Blob) && (typeof source == "string" && source.startsWith('http'))) {
        this.baseURI = source.substring(0, source.lastIndexOf('/') + 1);
    }
};
HuTime.ZipReader.prototype = Object.create(HuTime.StreamReaderBase.prototype, {
    constructor: {
        value: HuTime.ZipReader,
        _baseURI: null,
        baseURI: {
            get: function() {
                return this._baseURI;
            },
            set: function(val) {
                this._baseURI = val;
            }
        }
    },

    _readRecordData: {
        value: function _readRecordData() {
            if (this.source instanceof File || this.source instanceof Blob) {
                this._readZip(this.source);
            } else if (typeof this.source == "string" && this.source.startsWith('http')) {
                JSZipUtils.getBinaryContent(this.source, function(err, data) {
                    if(err) {
                        throw err; // or handle err
                    }
                    this._readZip(data);
                }.bind(this));
            }
            return this._recordData;
        }
    },

    _readZip: {
        value: function _readZip(data) {
            (async () => {
                const decorder = function(fileNameBinary) {// 文字コードの判定
                    var detected = Encoding.detect(fileNameBinary);
                    var decoder = null;
                    if (detected === 'UTF8') {
                        decoder = new TextDecoder("UTF-8");
                    } else if ('SJIS') {
                        decoder = new TextDecoder("Shift_JIS");
                    } else {
                        console.log(detected);
                        decoder = new TextDecoder("UTF-8");
                    }
                    return decoder.decode(fileNameBinary);
                };
                const zip = await JSZip.loadAsync(data, {
                    decodeFileName: fileNameBinary => decorder(fileNameBinary)
                });
                var fileNames = [];
                const files = [];
                zip.folder('').forEach(function (relativePath, file){
                    fileNames.push(relativePath);
                });
                var i = 0;
                for (;i < fileNames.length; i++) {
                    const fileName = fileNames[i];
                    zip.file(fileName).async("blob").then(function (data) {
                        data.name = fileName;// Fileオブジェクトと同じようにファイル名を取得できるようにする。
                        files.push(data);
                        if (files.length == fileNames.length) {
                          var reader = new HuTime.GtsReader(this.rootFile, files);
                          reader.load();
                          reader.onloadendDom = function(readerx) {
                              this.layers = readerx.layers;
                              this.onloadendDom();
                          }.bind(this, reader);
                        }
                    }.bind(this));
                }
            })();
        }
    },

    load: {
        value: function load() {
            if (!(this._source instanceof File) && !(this._source instanceof Blob) && (typeof this._source == "string" && !this._source.startsWith('http'))) {
                this.loadState = "error";
                return;
            }
            HuTime.StreamReaderBase.prototype.load.call(this);
        }
    }
});

HuTime.XmlReader = function(source) {
    HuTime.StreamReaderBase.apply(this, arguments);
    this.baseURI = "";
    if (!(source instanceof File) && !(source instanceof Blob) && (typeof source == "string" && source.startsWith('http'))) {
        this.baseURI = source.substring(0, source.lastIndexOf('/') + 1);
    }
};
HuTime.XmlReader.prototype = Object.create(HuTime.StreamReaderBase.prototype, {
    constructor: {
        value: HuTime.XmlReader,
        _baseURI: null,
        baseURI: {
            get: function() {
                return this._baseURI;
            },
            set: function(val) {
                this._baseURI = val;
            }
        }
    },

    _readRecordData: {
        value: function _readRecordData() {
            var loadedData = this.stream.readAll();
            var parser = new DOMParser();
            var dom = parser.parseFromString(loadedData, 'text/xml');
            this._proccessDom(dom.documentElement);
            return this._recordData;
        }
    },
    _proccessChild: {
        value: function _proccessChild(node) {
            if (this._proccessNode(node)) {
                var nodes = node.childNodes;
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    var type = n.nodeType;
                    if (type === Node.ELEMENT_NODE) {
                        this._proccessChild(n);
                    }
                }
            }
            this._proccessNodeEnd(node);
        }
    },
    _proccessNode: {
        value: function _proccessNode(node) {
            return true;
        }
    },
    _proccessNodeEnd: {
        value: function _proccessNodeEnd(node) {}
    },
    _proccessDom: {
        value: function _proccessDom(rootNode) {}
    },
    _getAbsoluteURI: {
        value: function(path) {
            if (!path.startsWith('http') && this.baseURI.startsWith('http')) {
                path = this.baseURI + path;
            }
            return path;
        }
    },
    load: {
        value: function load() {
            if (!(this._source instanceof File) && !(this._source instanceof Blob) && (typeof this._source == "string" && !this._source.startsWith('http'))) {
                this.loadState = "error";
                return;
            }
            HuTime.StreamReaderBase.prototype.load.call(this);
        }
    }
});

HuTime.MultipleXmlReader = function(source, files) {
    HuTime.XmlReader.apply(this, arguments);
    this.files = files;
    if (!(source instanceof File) && !(source instanceof Blob) && (typeof this._source == "string" && !this._source.startsWith('http'))) {
        var file = this._getFile(source);
        if (file != null) {
            this.source = file;
        } else {
            console.error('FILE NOT FOUND: ' + source);
        }
    }
};
HuTime.MultipleXmlReader.prototype = Object.create(HuTime.XmlReader.prototype, {
    constructor: {
        value: HuTime.MultipleXmlReader,
        _files: null,
        files: {
            get: function() {
                return this._files;
            },
            set: function(val) {
                this._files = val;
            }
        }
    },

    _getFile: {
        value: function _getFile(name) {
            for (var i = 0; i < this.files.length; i++) {
                var file = this.files[i];
                if (file.name === name) {
                    return file;
                }
            }
            return null;
        }
    }
});

HuTime.GtsReader = function(source, files) {
    files = this._toArrayAndSort(files);
    HuTime.MultipleXmlReader.apply(this, arguments);
    this._setGtsSource(source);
    this.layers = [];
    this.counter = 0;// GTMファイルの処理開始で+1, 処理完了で-1, 0になったときにGtsReaderのonloadendDom()をコールする
};
HuTime.GtsReader.prototype = Object.create(HuTime.MultipleXmlReader.prototype, {
    constructor: {
        value: HuTime.GtsReader
    },

    _setGtsSource: {
        value: function _setGtsSource(source) {
            if (!source) {// sourceが指定されていない場合、既定の規則でGTSファイルを取得する
                var defaultGtsFiles = ['index.gts','default.gts','root.gts'];
                for (var i = 0; i < defaultGtsFiles.length; i++) {
                    var file = this._getFile(defaultGtsFiles[i]);
                    if (file != null) {
                        this.source = file;
                        break;
                    }
                }
                if (!this.source) {
                    for (var i = 0; i < this.files.length; i++) {
                        if (this.files[i].name.endsWith('.gts')) {
                            this.source = this.files[i];
                            break;
                        }
                    }
                }
            }
        }
    },

    _toArrayAndSort: {
        value: function _toArrayAndSort(files) {
            if (files instanceof Object) {
                files = Object.values(files);
            }
            files = files.sort(function(a, b){
                const nameA = a.name.toUpperCase();
                const nameB = b.name.toUpperCase();
                let comparison = 0;
                if (nameA > nameB) {
                    comparison = 1;
                } else if (nameA < nameB) {
                    comparison = -1;
                }
                return comparison;
            });
            return files;
        }
    },

    _proccessDom: {
        value: function _proccessDom(rootNode) {
            var ns = HuTime.GtNamespace.HGIS;
            var elements = rootNode.children;
            for (var i = 0; i < elements.length; i++) {
                if (elements[i].namespaceURI === ns && elements[i].localName === 'layer') {
                    var layer = elements[i];
                    var elems = layer.getElementsByTagNameNS(ns,'resourceFileName');
                    if (0 === elems.length) {
                        continue;
                    }
                    var resourceFileName = this._getAbsoluteURI(elems[0].textContent.trim());
                    elems = layer.getElementsByTagNameNS(ns,'layerType');
                    var layerType = '';
                    if (0 < elems.length) {
                        layerType = elems[0].textContent.trim();
                    }
                    this.counter++;
                    var reader = new HuTime.GtmReader(resourceFileName, this.files);
                    reader.layerType = layerType;
                    if (layerType === HuTime.GtLayerType.BarChartLayer) {
                        reader.recordset = new HuTime.ChartRecordset(reader, null, null, 'number');
                    } else if (layerType === HuTime.GtLayerType.LineChartLayer) {
                        reader.recordset = new HuTime.ChartRecordset(reader, null, null, 'number');
                    } else if (layerType === HuTime.GtLayerType.PlotChartLayer) {
                        reader.recordset = new HuTime.ChartRecordset(reader, null, null, 'number');
                    } else if (layerType === HuTime.GtLayerType.DefaultLayer) {
                        reader.recordset = new HuTime.TLineRecordset(reader, null, null, 'title');
                    } else if (layerType === HuTime.GtLayerType.MaskLayer) {
                        reader.recordset = new HuTime.TLineRecordset(reader, null, null, 'title');
                    } else if (layerType === HuTime.GtLayerType.TimeChartLayer2) {
                        reader.recordset = new HuTime.TLineRecordset(reader, null, null, 'title');
                    } else if (layerType === HuTime.GtLayerType.TimeChartLayer) {
                        // HuTime.ManualScaleDatasetで処理する
                        reader.recordset = {};// Objectを作成してscaleStyle, scaleDatasetを格納する
                        reader.load();// Recordsetのインスタンスではないのでload()を実行する
                    } else {
                        reader.recordset = new HuTime.TLineRecordset(reader, null, null, 'title');
                    }

                    reader.onloadendDom = function(readerx, layerElem) {
                        // GTM読み込み後にGTSのスタイルを読み込んでGTMで読み込んだスタイルを上書きする
                        readerx.readStyle(layerElem);

                        // GTM読み込み後Layerを作成する
                        var layer = null;
                        if (readerx.layerType === HuTime.GtLayerType.BarChartLayer) {
                            readerx.recordset.showLine = false;// プロット間のラインを描画しないようにする
                            layer = new HuTime.BarChartLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.LineChartLayer) {
                            layer = new HuTime.LineChartLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.PlotChartLayer) {
                            layer = new HuTime.PlotChartLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.DefaultLayer) {
                            layer = new HuTime.TLineLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.MaskLayer) {
                            layer = new HuTime.TLineLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.TimeChartLayer2) {
                            layer = new HuTime.TLineLayer(readerx.recordset);
                        } else if (readerx.layerType === HuTime.GtLayerType.TimeChartLayer) {
                            // HuTime.ManualScaleDatasetで処理する
                            layer = new HuTime.TickScaleLayer(null, null, null, readerx.recordset.scaleStyle, readerx.recordset.scaleDataset);
                        } else {
                            layer = new HuTime.TLineLayer(readerx.recordset);
                        }

                        if (readerx.highlightColor) layer.highlightColor = readerx.highlightColor;
                        if (readerx.layerHight) layer.vBreadth = readerx.layerHight-0.0;
                        this.layers.push(layer);

                        this.counter--;
                        if (this.counter === 0) {
                            this.onloadendDom();
                        }
                    }.bind(this, reader, layer);
                } else if (elements[i].namespaceURI === ns && elements[i].localName === 'project') {
                    var layer = elements[i];
                    var elems = layer.getElementsByTagNameNS(ns,'resourceFileName');
                    if (0 === elems.length) {
                        continue;
                    }
                    var resourceFileName = this._getAbsoluteURI(elems[0].textContent.trim());
                    this.counter++;
                    var reader = new HuTime.GtsReader(resourceFileName, this.files);
                    reader.layers = this.layers;
                    reader.load();
                    reader.onloadendDom = function() {
                        this.counter--;
                        if (this.counter === 0) {
                            this.onloadendDom();
                        }
                    }.bind(this);
                }

            }
        }
    }
});

HuTime.GtmReader = function(source, files) {
    HuTime.MultipleXmlReader.apply(this, arguments);
    this.recordset = null;
    this.layerType = null;
    this.highlightColor = null;
    this.layerHight = null;
    this.backgroundColor = null;
};
HuTime.GtmReader.prototype = Object.create(HuTime.MultipleXmlReader.prototype, {
    constructor: {
        value: HuTime.GtmReader
    },

    _proccessDom: {
        value: function _proccessDom(rootNode) {
            // console.log('GTM loaded');
            if (!this.recordset) {// GTM単体で実行された場合にrecordsetをここで生成する
                var ns = HuTime.GtNamespace.HGIS;
                var elems = rootNode.getElementsByTagNameNS(ns,'layerType');
                var layerType = '';
                if (0 < elems.length) {
                    layerType = elems[0].textContent.trim();
                }
                this.layerType = layerType;
                if (layerType === HuTime.GtLayerType.BarChartLayer) {
                    this.recordset = new HuTime.ChartRecordset(this, null, null, 'number');
                } else if (layerType === HuTime.GtLayerType.LineChartLayer) {
                    this.recordset = new HuTime.ChartRecordset(this, null, null, 'number');
                } else if (layerType === HuTime.GtLayerType.PlotChartLayer) {
                    this.recordset = new HuTime.ChartRecordset(this, null, null, 'number');
                } else if (layerType === HuTime.GtLayerType.DefaultLayer) {
                    this.recordset = new HuTime.TLineRecordset(this, null, null, 'title');
                } else if (layerType === HuTime.GtLayerType.MaskLayer) {
                    this.recordset = new HuTime.TLineRecordset(this, null, null, 'title');
                } else if (layerType === HuTime.GtLayerType.TimeChartLayer2) {
                    this.recordset = new HuTime.TLineRecordset(this, null, null, 'title');
                } else if (layerType === HuTime.GtLayerType.TimeChartLayer) {
                    // HuTime.ManualScaleDatasetで処理する
                    this.recordset = {};// Objectを作成してscaleStyle, scaleDatasetを格納する
                    this.load();// Recordsetのインスタンスではないのでload()を実行する
                } else {
                    this.recordset = new HuTime.TLineRecordset(this, null, null, 'title');
                }
                this._recordData = [];// recordDataの初期化。実施しないとData.jsでnull参照でエラーとなる。
                return;// GtmReaderのload()が再実行されるのでここでリターンして以降の読み込み処理を中止する
            }


            this.readStyle(rootNode);// GTMのスタイルを処理し、GTMの処理が完了した後にGTSのスタイルを処理してGTMのものを上書きする
            this.readGtData(rootNode);
            this.readMetadata(rootNode);
        }
    },

    readMetadata: {
        value: function readMetadata(node) {
            if (!this.recordset.gtmParams) {
                this.recordset.gtmParams = {};
            }
            var ns = HuTime.GtNamespace.HGIS;
            var elements = node.getElementsByTagNameNS(ns,'hgisMetadata');
            if (0 < elements.length) {
                var children = elements[0].children;
                for (var i = 0; i < children.length; i++) {
                    var namespaceURI = children[i].namespaceURI;
                    var textContent = children[i].textContent.trim();
                    var localName = children[i].localName;
                    if (namespaceURI === ns && textContent.length != 0) {
                        if (localName === 'title' || localName === 'identifier'
                              || localName === 'creater' || localName === 'shortTitle'
                              || localName === 'subject' || localName === 'description'
                              || localName === 'contributor' || localName === 'publisher'
                              || localName === 'type' || localName === 'format'
                              || localName === 'language' || localName === 'source'
                              || localName === 'rights' || localName === 'relation'
                              || localName === 'date') {
                            this.recordset.gtmParams[localName] = textContent;
                        } else if (localName === 'alternativeTitle') {
                            if (!this.recordset.gtmParams[localName]) this.recordset.gtmParams[localName] = [];
                            this.recordset.gtmParams[localName].push(textContent);
                        }
                    }
                }
            }
        }
    },

    readGtData: {
        value: function readGtData(node) {
            var ns = HuTime.GtNamespace.GT;
            var elements = node.getElementsByTagNameNS(ns,'filename');
            if (0 < elements.length) {
                var resourceFileName = this._getAbsoluteURI(elements[0].textContent.trim());
                var reader = new HuTime.GtDataReader(resourceFileName, this.files);
                this._recordData = reader._recordData;
                if (this.layerType !== HuTime.GtLayerType.TimeChartLayer) {
                    this.recordset.recordSettings = reader.recordSettings;
                }
                reader.load();
                reader.onloadendDom = function() {
                    if (this.layerType === HuTime.GtLayerType.TimeChartLayer) {
                        // _recordDataをHuTime.ManualScaleDatasetに変換してthis.recordsetにscaleDatasetとして格納する
                        this.recordset.scaleDataset = new HuTime.ManualScaleDataset();
                        for (var i = 0; i < this._recordData.length; i++) {
                            var data = this._recordData[i];
                            var idxFrom = data.name.indexOf('from');
                            var idxTitle = data.name.indexOf('title');
                            if (idxFrom == -1 || idxTitle == -1) continue;
                            // console.log(data.value[idxTitle]);
                            this.recordset.scaleDataset.appendScaleData(HuTime.isoToJd(data.value[idxFrom]), null, data.value[idxTitle]);
                        }
                    } else {
                        this.onloadend();//_recordDataを処理するために呼び出す。
                    }
                    this.onloadendDom();
                }.bind(this);
            }
        }
    },

    readStyle: {
        value: function readStyle(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var elements = node.getElementsByTagNameNS(ns,'time');
            for (var i = 0; i < elements.length; i++) {
                var layer = elements[i];
                var elems = layer.getElementsByTagNameNS(ns,'layerType');
                if (0 < elems.length) {
                    var layerType = elems[0].textContent.trim();
                    if (this.layerType !== '' && this.layerType !== layerType) {
                        continue;
                    }
                    if (layerType === HuTime.GtLayerType.BarChartLayer) {
                        this.readBarChartLayerStyle(layer);
                    } else if (layerType === HuTime.GtLayerType.LineChartLayer) {
                        this.readLineChartLayerStyle(layer);
                    } else if (layerType === HuTime.GtLayerType.PlotChartLayer) {
                        this.readPlotChartLayerStyle(layer);
                    } else if (layerType === HuTime.GtLayerType.DefaultLayer) {
                        this.readDefaultLayerStyle(layer);
                    } else if (layerType === HuTime.GtLayerType.MaskLayer) {
                        this.readMaskLayerStyle(layer);
                    } else if (layerType === HuTime.GtLayerType.TimeChartLayer2) {
                        this.readTimeChartLayer2Style(layer);
                    } else if (layerType === HuTime.GtLayerType.TimeChartLayer) {
                        this.readTimeChartLayerStyle(layer);
                    } else {
                        this.readDefaultLayerStyle(layer);
                    }
                }
            }
        }
    },

    getRGBColorValue: {
        value: function getRGBColorValue(val) {
            var vals = val.split(',');
            if (vals.length == 4) {
                vals[3] = vals[3].trim() / 255;
                return 'rgba(' + vals.join(',') + ')';
            } else if (vals.length == 3) {
                return 'rgb(' + vals.join(',') + ')';
            }
            return '';
        }
    },

    readSelectedColor: {
        value: function readSelectedColor(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var selectedColors = node.getElementsByTagNameNS(ns,'selectedColor');
            for (var i = 0; i < selectedColors.length; i++) {
                if (!selectedColors[i].getAttribute('group')) {
                    this.highlightColor = this.getRGBColorValue(selectedColors[i].textContent);
                }
            }
        }
    },

    readLayerHight: {
        value: function readLayerHight(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var layerHights = node.getElementsByTagNameNS(ns,'layerHight');
            if (0 < layerHights.length) {
                this.layerHight = layerHights[0].textContent.trim();
            }
        }
    },

    readBackgroundColor: {
        value: function readBackgroundColor(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var backgroundColors = node.getElementsByTagNameNS(ns,'backgroundColor');
            if (0 < backgroundColors.length) {
                this.backgroundColor = this.getRGBColorValue(backgroundColors[0].textContent);
            }
        }
    },

    readLine: {
        value: function readLine(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var lines = node.getElementsByTagNameNS(ns,'line');
            for (var i = 0; i < lines.length; i++) {
                if (!lines[i].getAttribute('group')) {
                    if (!this.recordset.lineStyle) {
                        this.recordset.lineStyle = new HuTime.FigureStyle();
                    }

                    var nodes = lines[i].childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && n.localName === 'lineColor') {
                                this.recordset.lineStyle.fillColor = this.getRGBColorValue(n.textContent);
                                this.recordset.lineStyle.lineColor = this.recordset.lineStyle.fillColor;
                            } else if (n.namespaceURI === ns && n.localName === 'thin') {
                                this.recordset.lineStyle.lineWidth = new Number(n.textContent);
                            }
                        }
                    }
                }
            }
        }
    },

    readSymbol: {
        value: function readSymbol(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var symbols = node.childNodes;
            for (var i = 0; i < symbols.length; i++) {
                if (symbols[i].nodeType !== Node.ELEMENT_NODE || symbols[i].namespaceURI !== ns || symbols[i].localName !== 'symbol' || symbols[i].getAttribute('group')) {
                    continue;
                }
                if (!this.recordset.plotStyle) {
                    this.recordset.plotStyle = new HuTime.FigureStyle();
                }
                var nodes = symbols[i].childNodes;
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    var type = n.nodeType;
                    if (type === Node.ELEMENT_NODE) {
                        if (n.namespaceURI === ns && n.localName === 'fillColor') {
                            this.recordset.plotStyle.fillColor = this.getRGBColorValue(n.textContent);
                        } else if (n.namespaceURI === ns && n.localName === 'thin') {
                            this.recordset.plotStyle.lineWidth = new Number(n.textContent);
                        } else if (n.namespaceURI === ns && n.localName === 'lineColor') {
                            this.recordset.plotStyle.lineColor = this.getRGBColorValue(n.textContent);
                        } else if (n.namespaceURI === ns && n.localName === 'symbol') {
                            var symbol = n.textContent.trim();
                            if (symbol === 'circle') {
                                this.recordset.plotSymbol = HuTime.PlotSymbol.Circle;
                            } else if (symbol === 'triangle') {
                                this.recordset.plotSymbol = HuTime.PlotSymbol.Triangle;
                            } else if (symbol === 'rectangle') {
                                this.recordset.plotSymbol = HuTime.PlotSymbol.Square;
                            } else {
                                this.recordset.plotSymbol = HuTime.PlotSymbol.Circle;
                            }
                        } else if (n.namespaceURI === ns && n.localName === 'size') {
                            this.recordset.plotWidth = new Number(n.textContent);
                        }
                    }
                }
                return;
            }
        }
    },

    readPolygon: {
        value: function readPolygon(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var polygons = node.getElementsByTagNameNS(ns,'polygon');
            for (var i = 0; i < polygons.length; i++) {
                if (!polygons[i].getAttribute('group')) {
                    var polygon = new HuTime.FigureStyle();
                    var nodes = polygons[i].childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && n.localName === 'fillColor') {
                                polygon.fillColor = this.getRGBColorValue(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'thin') {
                                polygon.lineWidth = new Number(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'lineColor') {
                                polygon.lineColor = this.getRGBColorValue(n.textContent);
                            }
                        }
                    }

                    if (this.layerType === HuTime.GtLayerType.BarChartLayer) {
                      this.recordset.plotStyle = polygon;
                    } else {
                      this.recordset.rangeStyle = polygon;
                    }
                }
            }
        }
    },

    readFont: {
        value: function readFont(node) {
            var labelStyle = new HuTime.StringStyle();
            var ns = HuTime.GtNamespace.HGIS;
            var fonts = node.getElementsByTagNameNS(ns,'font');
            for (var i = 0; i < fonts.length; i++) {
                if (!fonts[i].getAttribute('group')) {
                    // if (!this.recordset.labelStyle) {// TODO: デフォルトのStringStyleに値を上書きできない？？？？？
                        // this.recordset.labelStyle = new HuTime.StringStyle();
                    // }
                    var nodes = fonts[0].childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && (n.localName === 'font-family' || n.localName === 'font-name')) {
                                labelStyle.fontFamily = n.textContent.trim();
                            } else if (n.namespaceURI === ns && n.localName === 'font-size') {
                                labelStyle.fontSize = new Number(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'font-color') {
                                labelStyle.fillColor = this.getRGBColorValue(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'font-style') {
                                var fontStyle = n.textContent.trim();
                                if (fontStyle === 'plain') {
                                    labelStyle.fontStyle = 'normal';
                                } else if (fontStyle === 'bold') {
                                    labelStyle.fontWeight = 'bold';
                                } else if (fontStyle === 'italic') {
                                    labelStyle.fontStyle = 'italic';
                                } else if (fontStyle === 'bold|italic') {
                                    labelStyle.fontWeight = 'bold';
                                    labelStyle.fontStyle = 'italic';
                                } else {
                                    labelStyle.fontStyle = 'normal';
                                }
                            }
                        }
                    }
                }
            }
            return labelStyle;
        }
    },

    readScaleMain: {
        value: function readScaleMain(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var polygons = node.getElementsByTagNameNS(ns,'scaleMain');
            for (var i = 0; i < polygons.length; i++) {
                if (!polygons[i].getAttribute('group')) {
                    var polygon = new HuTime.FigureStyle();
                    var nodes = polygons[i].childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && n.localName === 'fillColor') {
                                polygon.fillColor = this.getRGBColorValue(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'thin') {
                                polygon.lineWidth = new Number(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'lineColor') {
                                polygon.lineColor = this.getRGBColorValue(n.textContent);
                            }
                        }
                    }

                    this.recordset.scaleStyle.tickStyle = polygon;
                    this.recordset.scaleStyle.tickSize = 20;
                }
            }
        }
    },

    readScaleSub: {
        value: function readScaleSub(node) {
            var ns = HuTime.GtNamespace.HGIS;
            var polygons = node.getElementsByTagNameNS(ns,'scaleSub');
            for (var i = 0; i < polygons.length; i++) {
                if (!polygons[i].getAttribute('group')) {
                    var polygon = new HuTime.FigureStyle();
                    var nodes = polygons[i].childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && n.localName === 'fillColor') {
                                polygon.fillColor = this.getRGBColorValue(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'thin') {
                                polygon.lineWidth = new Number(n.textContent);
                            } else if (n.namespaceURI === ns && n.localName === 'lineColor') {
                                polygon.lineColor = this.getRGBColorValue(n.textContent);
                            }
                        }
                    }

                    this.recordset.scaleStyle.tickStyle = polygon;
                    this.recordset.scaleStyle.tickSize = 10;
                }
            }
        }
    },

    readBarChartLayerStyle: {
        value: function readBarChartLayerStyle(node) {
            this.readPolygon(node);
            this.readSelectedColor(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readLineChartLayerStyle: {
        value: function readLineChartLayerStyle(node) {
            this.readLine(node);
            this.readSymbol(node);
            this.readSelectedColor(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readPlotChartLayerStyle: {
        value: function readPlotChartLayerStyle(node) {
            this.readSymbol(node);
            this.readSelectedColor(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readDefaultLayerStyle: {
        value: function readDefaultLayerStyle(node) {
            this.readPolygon(node);
            this.recordset.labelStyle = this.readFont(node);
            this.readSelectedColor(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readMaskLayerStyle: {
        value: function readMaskLayerStyle(node) {
            this.readPolygon(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readTimeChartLayer2Style: {
        value: function readTimeChartLayer2Style(node) {
            this.readPolygon(node);
            this.recordset.labelStyle = this.readFont(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    },

    readTimeChartLayerStyle: {
        value: function readTimeChartLayerStyle(node) {
            // 処理した結果をthis.recordsetにscaleStyleとして格納する
            this.recordset.scaleStyle = new HuTime.TickScaleStyle();
            this.recordset.scaleStyle.labelStyle = this.readFont(node);
            this.recordset.scaleStyle.labelOffset = 15;
            this.readScaleSub(node);
            this.readScaleMain(node);
            this.readLayerHight(node);
            this.readBackgroundColor(node);
        }
    }
});

HuTime.GtDataReader = function(source, files) {
    HuTime.MultipleXmlReader.apply(this, arguments);
    this._itemNames = [];
    this._recordData = [];
    this.recordSettings = new HuTime.RecordSettings();
    this.recordSettings.tSetting = new HuTime.RecordTCalendarSetting ('from', 'to', null);
};
HuTime.GtDataReader.prototype = Object.create(HuTime.MultipleXmlReader.prototype, {
    constructor: {
        value: HuTime.GtDataReader
    },

    _proccessDom: {
        value: function _proccessDom(rootNode) {
            //console.log('GtData loaded');
            this._proccessChild(rootNode);
            this.onloadendDom();
        }
    },

    _proccessPoint: {
        value: function _proccessPoint(node) {
            var point = {};
            var nodes = node.childNodes;
            var ns = HuTime.GtNamespace.GT_DATA;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                var type = n.nodeType;
                if (type === Node.ELEMENT_NODE) {
                    if (n.namespaceURI === ns && n.localName === 'zone') {
                        point.zone = n.textContent.trim();
                    } else if (n.namespaceURI === ns && n.localName === 'x') {
                        point.x = n.textContent.trim();
                    } else if (n.namespaceURI === ns && n.localName === 'y') {
                        point.y = n.textContent.trim();
                    }
                }
            }
            return point;
        }
    },

    _proccessPoints: {
        value: function _proccessPoints(node) {
            var ps = [];
            var points = node.childNodes;
            for (var j = 0; j < points.length; j++) {
                var p = points[i];
                var type = p.nodeType;
                if (type === Node.ELEMENT_NODE) {
                    if (p.namespaceURI === ns && p.localName === 'point') {
                        ps.push(this._proccessPoint(p));
                    }
                }
            }
            return ps;
        }
    },

    _proccessNode: {
        value: function _proccessNode(node) {
            var ns = HuTime.GtNamespace.GT_DATA;
            if (node.namespaceURI === ns) {
                if (node.localName === 'record') {
                    this.data = {};
                    this.data.name = [];
                    this.data.value = [];
                    var attrVal = node.getAttribute('group');
                    if (attrVal) {
                      this.data.name.push('group');
                      this.data.value.push(attrVal);
                    }
                    return true;
                } else if (node.localName === 'location') {
                    this.location = [];
                    var nodes = node.childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var type = n.nodeType;
                        if (type === Node.ELEMENT_NODE) {
                            if (n.namespaceURI === ns && n.localName === 'point') {
                                this.data.name.push('location_point');
                                var ps = [];
                                ps.push(this._proccessPoint(n));
                                this.data.value.push(ps);
                            } else if (n.namespaceURI === ns && n.localName === 'line') {
                                this.data.name.push('location_line');
                                this.data.value.push(_proccessPoints(n));
                            } else if (n.namespaceURI === ns && n.localName === 'plane') {
                                this.data.name.push('location_plane');
                                this.data.value.push(_proccessPoints(n));
                            }
                        }
                    }
                    return false;
                } else if (node.localName === 'from') {
                    this.data.name.push('from');
                    this.data.value.push(node.textContent.trim());
                    return false;
                } else if (node.localName === 'to') {
                    this.data.name.push('to');
                    this.data.value.push(node.textContent.trim());
                    return false;
                } else if (node.localName === 'item') {
                    var itemName = node.getAttribute('name');
                    if (this._itemNames.indexOf(itemName) === -1) {
                        this._itemNames.push(itemName);
                        this.recordSettings.appendDataSetting(new HuTime.RecordDataSetting(itemName, null, null));
                    }
                    this.data.name.push(itemName);
                    var val = node.textContent.trim();
                    if (itemName === 'number') {
                        this.data.value.push(val - 0.0);
                    } else {
                        this.data.value.push(val);
                    }

                    return false;
                }
            }
            return true;
        }
    },

    _proccessNodeEnd: {
        value: function _proccessNodeEnd(node) {
            if (node.namespaceURI === HuTime.GtNamespace.GT_DATA) {
                if (node.localName === 'record') {
                    var idxFrom = this.data.name.indexOf('from');
                    if (idxFrom === -1 || !this.data.value[idxFrom]) return;// from値がない場合はレコードを登録しない
                    var idxTo = this.data.name.indexOf('to');
                    if (idxTo === -1 || !this.data.value[idxTo]) {// to値がない場合はfrom値を代入する
                        this.data.name.push('to');
                        this.data.value.push(this.data.value[idxFrom]);
                    }

                    this._recordData.push(this.data);
                }
            }
        }
    }
});

HuTime.GtLayerType = {
    BarChartLayer: 'BarChartLayer',
    LineChartLayer: 'LineChartLayer',
    PlotChartLayer: 'PlotChartLayer',
    DefaultLayer: 'DefaultLayer',
    MaskLayer: 'MaskLayer',
    TimeChartLayer2: 'TimeChartLayer2',
    TimeChartLayer: 'TimeChartLayer'
};

HuTime.GtNamespace = {
    GT_DATA: 'http://www.nihu.jp/ns/spacetime/2006/11',
    HGIS: 'http://www.h-gis.org/hgis',
    GT: 'http://www.h-gis.org/gt'
};
