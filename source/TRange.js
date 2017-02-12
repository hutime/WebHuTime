
// 範囲間の関係を示すデータ
HuTime.TIntervalRelation = function(sub, rel, obj) {
    if (sub instanceof HuTime.TRange)
        this.tSubject = sub;
    this.relation = rel;
    if (obj instanceof HuTime.TRange)
        this.tObject = obj;
};
HuTime.TIntervalRelation.prototype = {
    constructor: HuTime.TIntervalRelation,

    tSubject: null,     // RDFの主語に相当
    relation: null,     // 関係
    tObject: null       // RDFの目的語に相当
};

// t値で示された範囲
HuTime.TRange = function() {
    this.references = [];
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    references: null,   // 参照（範囲を決めるためのTRange）の配列
    appendReference: function(ref) {        // 参照を追加
        // tSubjectが自分でない場合はひっくり返す
        // その上で、tSubjectが自分でも空でもない場合は、読み飛ばす
        if (ref instanceof HuTime.TIntervalRelation)
            this.references.push(ref);
    },
    removeReference: function(ref) {        // 参照を削除
        for (var i = 0; i < this.references.length; ++i) {
            if (this.references[i] === ref) {
                this.references.splice(i, 1);
                return;
            }
        }
    },

    // 基本となる4値
    _pBegin: Number.NEGATIVE_INFINITY,  // 可能始点
    _rBegin: Number.NaN,                // 確実始点
    _rEnd: Number.NaN,                  // 確実終点
    _pEnd: Number.POSITIVE_INFINITY,    // 可能終点
    get pBegin() {
        return this._pBegin;
    },
    get rBegin() {
        return this._rBegin;
    },
    get rEnd() {
        return this._rEnd;
    },
    get pEnd() {
        return this._pEnd;
    },

    // 代表値
    _centralValue: {
        writable: true,
        value: Number.NaN
    },
    centralValue: {
        get: function() {
            return this._centralValue;
        }
    },

    // 状態表示
    _isTotalPRangeOnly: true,   // 全可能期間のみの場合 true
    get isTotalPRangeOnly() {
        return this._isTotalPRangeOnly;
    },
    _isNonRRange: true,         // 確実期間がない場合 true
    get isNonRRangeOnly() {
        return this._isNonRRange;
    },

    updateTRange: function() {      // 参照に基づいて、範囲の情報を更新する
        for (var i = 0; i < this.references.length; ++i) {
            switch (this.references[i].relation) {
                case "overlappedBy":    // 始点に相当
                    if (this.references[i].tObject._pBegin) {
                        if (isNaN(this._pBegin))
                            this._pBegin = this.references[i].tObject._pBegin;
                        else if (this.references[i].tObject._pBegin > this._pBegin)     // 条件が絞り込まれるケース
                            this._pBegin = this.references[i].tObject._pBegin;
                    }
                    if (this.references[i].tObject._pEnd) {
                        if (isNaN(this._rBegin))
                            this._rBegin = this.references[i].tObject._pEnd;
                        else if (this.references[i].tObject._pEnd < this._rBegin &&     // 条件が絞り込まれるケース
                            this.references[i].tObject._pEnd > this._pBegin)
                            this._rBegin = this.references[i].tObject._pEnd;
                    }
                    break;

                case "overlaps" :       // 終点に相当
                    if (this.references[i].tObject._pBegin) {
                        if (isNaN(this._rEnd))
                            this._rEnd = this.references[i].tObject._pBegin;
                        else if (this.references[i].tObject._pBegin > this._rEnd &&     // 条件が絞り込まれるケース
                            this.references[i].tObject._pBegin < this._pEnd)
                            this._rEnd = this.references[i].tObject._pBegin;
                    }
                    if (this.references[i].tObject._pEnd) {
                        if (isNaN(this._pEnd))
                            this._pEnd = this.references[i].tObject._pEnd;
                        else if (this.references[i].tObject._pEnd < this._pEnd)   // 条件が絞り込まれるケース
                            this._pEnd = this.references[i].tObject._pEnd;
                    }
                    break;
            }

            // 4値の整合性のチェック
            if (this._rBegin > this._rEnd) {
                this._rBegin = Number.NaN;
                this._rEnd = Number.NaN;
            }
            if (this._pBegin > this._pEnd) {
                this._pBegin = Number.NaN;
                this._pEnd = Number.NaN;
            }
        }
        this._updateRanges();   // 各範囲の更新

        // 代表値の設定
        // 確定範囲がある場合（両端とも無限大でない）
        if (!isNaN(this._rRangeDuration) && isFinite(this._rRangeBegin) && isFinite(this._rRangeEnd))
            this._centralValue = (this._rRangeBegin + this._rRangeEnd) / 2;

        // 前期可能範囲がある場合（確定範囲なし）
        else if (!isNaN(this._antePRangeDuration) && isFinite(this._antePRangeEnd))
            this._centralValue = this._antePRangeEnd;

        // 後期可能範囲がある場合（確定範囲、前期可能範囲なし）
        else if (!isNaN(this._postPRangeDuration) && isFinite(this._postPRangeBegin))
            this._centralValue = this._postPRangeBegin;

        // 全可能範囲のみ、かつ、両端とも無限大でない場合
        else if (!isNaN(this._pRangeDuration) &&
            isFinite(this._pBegin) && isFinite(this._pRangeEnd))
            this._centralValue = (this._pRangeBegin + this._pRangeEnd) / 2;

        else
            this._centralValue = Number.NaN
    },

    _updateRanges: function () {    // 各範囲の更新
        // 全可能期間（前後可能期間および確実期間を含む）
        if (!isNaN(this._pBegin) && !isNaN(this._pEnd))     // 始点
            this._pRangeBegin = this._pBegin;
        else
            this._pRangeBegin = Number.NaN;
        if (!isNaN(this._pBegin) && !isNaN(this._pEnd))     // 終点
            this._pRangeEnd = this._pEnd;
        else
            this._pRangeEnd =  Number.NaN;
        if (!isNaN(this._pBegin) && !isNaN(this._pEnd))     // 範囲長
            this._pRangeDuration = this._pEnd - this._pBegin;
        else
            this._pRangeDuration =  Number.NaN;

        // 確実期間
        if (!isNaN(this._rBegin) && !isNaN(this._rEnd))     // 始点
            this._rRangeBegin = this._rBegin;
        else
            this._rRangeBegin = Number.NaN;
        if (!isNaN(this._rBegin) && !isNaN(this._rEnd))     // 終点
            this._rRangeEnd = this._rEnd;
        else
            this._rRangeEnd = Number.NaN;

        if (!isNaN(this._rBegin) && !isNaN(this._rEnd))     // 範囲長
            this._rRangeDuration = this._rEnd - this._rBegin;
        else
            this._rRangeDuration = Number.NaN;

        // 前期可能期間
        if ((!isNaN(this._pBegin)) && (!isNaN(this._rBegin) || !isNaN(this._rEnd))) {
            this._antePRangeBegin = this._pBegin;       // 始点
            if (!isNaN(this._rBegin))      // 終点
                this._antePRangeEnd = this._rBegin;
            else
                this._antePRangeEnd = this._rEnd;
            this._antePRangeDuration = this._antePRangeEnd - this._antePRangeBegin;     // 範囲長
        }
        else {
            this._antePRangeBegin = Number.NaN;
            this._antePRangeEnd = Number.NaN;
            this._antePRangeDuration = Number.NaN;
        }

        // 後期可能期間
        if (!isNaN(this._pEnd) && (!isNaN(this._rEnd) || !isNaN(this._rBegin))) {
            this._postPRangeEnd = this._pEnd;           // 終点
            if (!isNaN(this._rEnd))          // 始点
                this._postPRangeBegin = this._rEnd;
            else
                this._postPRangeBegin = this._rBegin;
            this._postPRangeDuration = this._postPRangeEnd - this._postPRangeBegin;     // 範囲長
        }
        else {
            this._postPRangeEnd = Number.NaN;
            this._postPRangeBegin = Number.NaN;
            this._postPRangeDuration = Number.NaN;
        }

        // 状態表示
        this._isTotalPRangeOnly =   // 全可能期間のみの場合 true
            isNaN(this._rBegin) && isNaN(this._rEnd);
        this._isNonRRange =         // 確実期間がない場合 true
            isNaN(this._rBegin) || isNaN(this._rEnd);
    },

    // 全可能期間（前後可能期間および確実期間を含む）
    _pRangeBegin: Number.NaN,
    _pRangeEnd: Number.NaN,
    _pRangeDuration: Number.NaN,
    get pRangeBegin() {
        return this._pRangeBegin;
    },
    get pRangeEnd() {
        return this._pRangeEnd;
    },
    get pRangeDuration() {
        return this._pRangeDuration;
    },

    // 確実期間
    _rRangeBegin: Number.NaN,
    _rRangeEnd: Number.NaN,
    _rRangeDuration: Number.NaN,
    get rRangeBegin() {
        return this._rRangeBegin;
    },
    get rRangeEnd() {
        return this._rRangeEnd;
    },
    get rRangeDuration() {
        return this._rRangeDuration;
    },

    // 前期可能期間
    _antePRangeBegin: Number.NaN,
    _antePRangeEnd: Number.NaN,
    _antePRangeDuration: Number.NaN,
    get antePRangeBegin() {
        return this._antePRangeBegin;
    },
    get antePRangeEnd() {
        return this._antePRangeEnd;
    },
    get antePRangeDuration() {
        return this._antePRangeDuration;
    },

    // 後期可能期間
    _postPRangeBegin: Number.NaN,
    _postPRangeEnd: Number.NaN,
    _postPRangeDuration: Number.NaN,
    get postPRangeEnd() {
        return this._postPRangeBegin;
    },
    get postPRangeBegin() {
        return this._postPRangeEnd;
    },
    get postPRangeDuration() {
        return this._postPRangeDuration;
    }
};

// 始点と終点をしてTRangeを生成
HuTime.TRange.createFromBeginEnd = function (begin, end) {
    var tRange = new HuTime.TRange();
    var beginTRange = null;
    var endTRange = null;

    // 始点
    if (begin instanceof HuTime.TRange)     // TRangeで指定された場合
        beginTRange = begin;
    else if (!isNaN(begin) && begin != null)    // リテラルで指定された場合（無限大があるので、isNaNで判定）
        beginTRange = new HuTime.TRangeLiteral(begin);
    if (beginTRange)
        tRange.appendReference(new HuTime.TIntervalRelation(tRange, "overlappedBy", beginTRange));

    // 終点
    if (end instanceof HuTime.TRange)
        endTRange = end;
    else if (!isNaN(end) && end != null)
        endTRange = new HuTime.TRangeLiteral(end);
    if (endTRange)
        tRange.appendReference(new HuTime.TIntervalRelation(tRange, "overlaps", endTRange));

    tRange.updateTRange();
    return tRange;
};

// リテラル値のTRange（リテラル値をTRangeと同様に扱うためのもの）
HuTime.TRangeLiteral = function TRangeLiteral(t) {
    HuTime.TRange.apply(this);
    this._pBegin = t;
    this._rBegin = t;
    this._rEnd = t;
    this._pEnd = t;
    this._updateRanges();
};
HuTime.TRangeLiteral.prototype = Object.create(HuTime.TRange.prototype, {
    constructor: {
        value: HuTime.TRangeLiteral
    },

    // 参照関係の処理を無効化
    appendReference: {
        value: function(ref) {
        }
    },
    removeReference: {
        value: function(ref) {
        }
    },
    updateTRange: {
        value: function (ref) {
        }
    }
});

