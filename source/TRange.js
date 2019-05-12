// **** t値で示された範囲 ****
HuTime.TRange = function TRange (pBegin, rBegin, rEnd, pEnd) {  // コンストラクタ（数値以外は初期値を設定）
    pBegin = Number.parseFloat(pBegin);
    if (!isNaN(pBegin))
        this._pBegin = pBegin;
    rBegin = Number.parseFloat(rBegin);
    if (!isNaN(rBegin))
        this._rBegin = rBegin;
    rEnd = Number.parseFloat(rEnd);
    if (!isNaN(rEnd))
        this._rEnd = rEnd;
    pEnd = Number.parseFloat(pEnd);
    if (!isNaN(pEnd))
        this._pEnd = pEnd;

    if (this._pBegin > this._pEnd) {    // 可能期間の始点と終点が逆の場合は初期値に戻す
        this._pBegin = Number.NEGATIVE_INFINITY;
        this._rBegin = Number.POSITIVE_INFINITY;
        this._rEnd = Number.NEGATIVE_INFINITY;
        this._pEnd = Number.POSITIVE_INFINITY;
    }
    else {  // 可能期間の始点と終点の関係が正しい場合、確実期間の調整に進む
        // 確実期間の端点が可能期間をはみ出した場合は、可能期間に合わせる
        if (this._rBegin < this._pBegin)
            this._rBegin = this._pBegin;
        if (this._rBegin > this._pEnd)
            this._rBegin = this._pEnd;
        if (this._rEnd > this._pEnd)
            this._rEnd = this._pEnd;
        if (this._rEnd < this._pBegin)
            this._rEnd = this._pBegin;
    }

    this.updateCentralValue();
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    // 基本となる4値（初期値は無限小～無限大）
    _pBegin: Number.NEGATIVE_INFINITY,  // 可能期間始点
    _rBegin: Number.POSITIVE_INFINITY,  // 確実期間始点
    _rEnd: Number.NEGATIVE_INFINITY,    // 確実期間終点
    _pEnd: Number.POSITIVE_INFINITY,    // 可能期間終点
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
    _centralValue: Number.NaN,
    get centralValue() {
        return this._centralValue;
    },
    updateCentralValue: function() {      // 代表値の設定
        // 確実期間があり、かつ、両端とも無限大でない
        if (isFinite(this._rBegin) && isFinite(this._rEnd) && this._rBegin <= this._rEnd)
            this._centralValue = (this._rBegin + this._rEnd) / 2;

        // 可能期間の両端とも無限大でない（確実期間なし）
        else if (isFinite(this._pBegin) && isFinite(this._pEnd))
            this._centralValue = (this._pBegin + this._pEnd) / 2;

        // 始点範囲の始点（Pb）が無限小ではない場合（始点を優先）
        else if (isFinite(this._pBegin)) {
            if (isFinite(this._rBegin))     // 確実期間の始点（始点範囲の終点）が無限大ではない
                this._centralValue = this._rBegin;
            else
                this._centralValue = this._pBegin;
        }

        // 終点範囲の終点（Pe）が無限大ではない場合
        else if (isFinite(this._pBegin)) {
            if (isFinite(this._rEnd))       // 確実期間の終点（始点範囲の始点）が無限大ではない
                this._centralValue = this._rEnd;
            else
                this._centralValue = this._pEnd;
        }

        // 4値とも無限小または無限大
        else
            this._centralValue = Number.NaN;
    },

    // 状態表示（今後要修正）
    get isDetermined() {
        return this._pBegin === this._rBegin && this._pEnd === this._pEnd;
    },
    get isTotalPRangeOnly() {       // 全可能期間のみの場合 true
        return this._rBegin == null && this._rEnd == null;
    },
    get isNonRRange() {             // 確実期間がない場合 true
        return this._rBegin == null || this._rEnd == null || this._rBegin > this._rEnd;
    },

    // クローンの生成
    clone: function clone () {
        return new HuTime.TRange(this._pBegin, this._rBegin, this._rEnd, this._pEnd);
    },

    // 関係の検証
    examineRelation: function examineRelation (relation, tRange) {      // relationで指定した関係について検証
        return HuTime.TRange.examineRelation(relation, this, tRange);
    },
    _examineRelations: function _examineRelations(tRange) {         // すべての関係を検証（数値を返す）
        return HuTime.TRange._examineRelations(this, tRange);
    },
    examineRelations: function examineRelations(tRange) {           // すべての関係を検証（RelationSetオブジェクトを返す）
        return HuTime.TRange.examineRelations(this, tRange);
    },

    // **** JSON出力 ****
    _toJSONProperties: {
        _pBegin: "pBegin",
        _rBegin: "rBegin",
        _rEnd: "rEnd",
        _pEnd: "pEnd",
        _centralValue: "centralValue",
    },
    _parseJSONProperties: {
        pBegin: "_pBegin",
        rBegin: "_rBegin",
        rEnd: "_rEnd",
        pEnd: "_pEnd",
        centralValue: "_centralValue",
    },
    toJSON: function toJSON () {
        return HuTime.JSON.stringify(this);
    }
};

// 基本4値以外からのTRangeの生成
// 始点と終点を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromBeginEnd  = function createFromBeginEnd (begin, end) {
    let pBegin, rBegin, rEnd, pEnd;

    if (begin instanceof HuTime.TRange) {   // TRangeで指定された場合
        pBegin = begin._pBegin;
        rBegin = begin._pEnd;
    }
    else {
        pBegin = begin;
        rBegin = begin;
    }

    if (end instanceof HuTime.TRange) {
        rEnd = end._pBegin;
        pEnd = end._pEnd;
    }
    else {
        rEnd = end;
        pEnd = end;
    }

    return new HuTime.TRange(pBegin, rBegin, rEnd, pEnd);
};
// １つの点（または期間）を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromRange = function createFromRange (range) {
    if (range instanceof HuTime.TRange)    // TRangeで指定された場合
        return range.clone();
    return new HuTime.TRange(range, range, range, range);
};

// **** Allenの関係 ****
HuTime.TRange.Relation = {
    // 逆の関係が隣のビットに割り当てられている
    Equals: 1,
    Before: 2,
    After: 4,
    During: 8,
    Contains: 16,
    Overlaps: 32,
    OverlappedBy: 64,
    Meets: 128,
    MetBy: 256,
    Starts: 512,
    StartedBy: 1024,
    Finishes: 2048,
    FinishedBy: 4096
};
Object.freeze(HuTime.TRange.Relation);

// **** あいまいさの状態 ****
// 将来的に、空間等にも活用する可能性があるので、TRangeの下にしない
HuTime.UncertainState = {
    Impossible: 0,  // falseで評価される
    Possible: 1,
    Reliable: 2
};
Object.freeze(HuTime.UncertainState);

// 確実関係の検証（型のチェックは省略（一括処理の際に実施・以下同））
HuTime.TRange.isReliableEquals = function isReliableEquals (a, b) {
    return a._pBegin === a._rBegin && a._rBegin === b._pBegin && b._pBegin === b._rBegin
        && a._rEnd === a._pEnd && a._pEnd === b._rEnd && b._rEnd === b._pEnd;
};
HuTime.TRange.isReliableBefore = function isPossibleBefore (a, b) {
    return a._pEnd < b._pBegin;
};
HuTime.TRange.isReliableAfter = function isReliableAfter (a, b) {
    return b._pEnd < a._pBegin;
};
HuTime.TRange.isReliableDuring = function isPossibleDuring (a, b) {
    return a._pBegin > b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableContains = function isReliableContains (a, b) {
    return b._pBegin > a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableOverlaps = function isReliableOverlaps (a, b) {
    return a._rBegin < b._pBegin && a._rEnd > b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableOverlappedBy = function isReliableOverlappedBy (a, b) {
    return b._rBegin < a._pBegin && b._rEnd > a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableMeets = function isReliableMeets (a, b) {
    return a._rEnd === a._pEnd && a._pEnd === b._pBegin && b._pBegin === b._rBegin
        && a._rBegin < b._pBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableMetBy = function isReliableMetBy (a, b) {
    return b._rEnd === b._pEnd && b._pEnd === a._pBegin && a._pBegin === a._rBegin
        && b._rBegin < a._pBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableStarts = function isReliableStarts (a, b) {
    return a._pBegin === a._rBegin && a._rBegin === b._pBegin && b._pBegin === b._rBegin && a._pEnd < b._rEnd;
};
HuTime.TRange.isReliableStartedBy = function isReliableStartedBy (a, b) {
    return b._pBegin === b._rBegin && b._rBegin === a._pBegin && a._pBegin === a._rBegin && b._pEnd < a._rEnd;
};
HuTime.TRange.isReliableFinishes = function isReliableFinishes (a, b) {
    return a._pBegin > b._rBegin && a._rEnd === a._pEnd && a._pEnd === b._rEnd && b._rEnd === b._pEnd;
};
HuTime.TRange.isReliableFinishedBy = function isReliableFinishedBy (a, b) {
    return b._pBegin > a._rBegin && b._rEnd === b._pEnd && b._pEnd === a._rEnd && a._rEnd === a._pEnd;
};
HuTime.TRange.isReliableIn = function isReliableIn (a, b) {
    return a._pBegin >= b._rBegin && a._pEnd <= b._rEnd;
};

// 可能関係の検証
HuTime.TRange.isPossibleEquals = function isPossibleEquals (a, b) {
    return a._pBegin <= b._rBegin && a._rBegin >= b._pBegin && a._rEnd <= b._pEnd && a._pEnd >= b._rEnd;
};
HuTime.TRange.isPossibleBefore = function isPossibleBefore (a, b) {
    return a._rEnd < b._rBegin;
};
HuTime.TRange.isPossibleAfter = function isPossibleAfter (a, b) {
    return b._rEnd < a._rBegin;
};
HuTime.TRange.isPossibleDuring = function isPossibleDuring (a, b) {
    return a._rBegin > b._pBegin && a._rEnd < b._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleContains = function isPossibleDuring (a, b) {
    return b._rBegin > a._pBegin && b._rEnd < a._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleOverlaps = function isPossibleOverlaps (a, b) {
    return a._pBegin < b._rBegin && a._pEnd > b._pBegin && a._rEnd < b._pEnd
        && a._pBegin < a._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleOverlappedBy = function isPossibleOverlappedBy (a, b) {
    return b._pBegin < a._rBegin && b._pEnd > a._pBegin && b._rEnd < a._pEnd
        && b._pBegin < b._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleMeets = function isPossibleMeets (a, b) {
    return a._pBegin < b._rBegin && a._rEnd < b._pEnd && a._rEnd <= b._rBegin && a._pEnd >= b._pBegin
        && a._pBegin < a._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleMetBy = function isPossibleMetBy (a, b) {
    return b._pBegin < a._rBegin && b._rEnd < a._pEnd && b._rEnd <= a._rBegin && b._pEnd >= a._pBegin
        && b._pBegin < b._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleStarts = function isPossibleStarts (a, b) {
    return a._pBegin <= b._rBegin && a._rBegin >= b._pBegin && a._rEnd < b._pEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleStartedBy = function isPossibleStartedBy (a, b) {
    return b._pBegin <= a._rBegin && b._rBegin >= a._pBegin && b._rEnd < a._pEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleFinishes = function isPossibleFinishes (a, b) {
    return a._rBegin > b._pBegin && a._rEnd <= b._pEnd && a._pEnd >= b._rEnd && b._pBegin < b._pEnd;
};
HuTime.TRange.isPossibleFinishedBy = function isPossibleFinishedBy (a, b) {
    return b._rBegin > a._pBegin && b._rEnd <= a._pEnd && b._pEnd >= a._rEnd && a._pBegin < a._pEnd;
};
HuTime.TRange.isPossibleIn = function isPossibleIn (a, b) {
    return a._rBegin >= b._pBegin && a._rEnd <= b._pEnd;
};

// 関係検証関数の配列（連続処理用）
HuTime.TRange._isReliables = [ HuTime.TRange.isReliableEquals,
    HuTime.TRange.isReliableBefore, HuTime.TRange.isReliableAfter,
    HuTime.TRange.isReliableDuring, HuTime.TRange.isReliableContains,
    HuTime.TRange.isReliableOverlaps, HuTime.TRange.isReliableOverlappedBy,
    HuTime.TRange.isReliableMeets, HuTime.TRange.isReliableMetBy,
    HuTime.TRange.isReliableStarts, HuTime.TRange.isReliableStartedBy,
    HuTime.TRange.isReliableFinishes, HuTime.TRange.isReliableFinishedBy
];
HuTime.TRange._isPossibles = [ HuTime.TRange.isPossibleEquals,
    HuTime.TRange.isPossibleBefore, HuTime.TRange.isPossibleAfter,
    HuTime.TRange.isPossibleDuring, HuTime.TRange.isPossibleContains,
    HuTime.TRange.isPossibleOverlaps, HuTime.TRange.isPossibleOverlappedBy,
    HuTime.TRange.isPossibleMeets, HuTime.TRange.isPossibleMetBy,
    HuTime.TRange.isPossibleStarts, HuTime.TRange.isPossibleStartedBy,
    HuTime.TRange.isPossibleFinishes, HuTime.TRange.isPossibleFinishedBy
];

// 関係の検証
HuTime.TRange.examineRelation = function examineRelation (relation, a, b) {     // relationで指定した関係について検証
    if (HuTime.TRange.RelationSet._countPossible(relation) > 1)
        return null;    // 2つ以上の関係を指定
    let relIndex = Math.log2(relation);
    if (HuTime.TRange._isReliables[relIndex](a, b))
        return HuTime.UncertainState.Reliable;
    if (HuTime.TRange._isPossibles[relIndex](a, b))
        return HuTime.UncertainState.Possible;
    else
        return HuTime.UncertainState.Impossible;
};
HuTime.TRange._examineRelations = function _examineRelations (a, b) {     // すべての関係を検証（数値を返す）
    if (!(a instanceof HuTime.TRange) || !(b instanceof HuTime.TRange))
        return null;

    let relations = 0;  // 検証結果（取り得る関係を示す数値）
    let relValue = 1;
    for (let i = 0; i < 13; ++i) {
        if (HuTime.TRange._isPossibles[i](a, b))
            relations += relValue;
        relValue *= 2;
    }
    return relations;
};
HuTime.TRange.examineRelations = function examineRelations (a, b) {     // すべての関係を検証（RelationSetオブジェクトを返す）
    return new HuTime.TRange.RelationSet(HuTime.TRange._examineRelations(a, b));
};

// 条件として示された関係に基づく検証（recTRangeがrefTRangeとrefRelationであるかを検証）
HuTime.TRange.examineRelationMatch = function examineRelationMatch (recTRange, refTRange, refRelationSet) {
    if (refRelationSet instanceof HuTime.TRange.RelationSet)
        return HuTime.TRange.RelationSet._isPossible(
            refRelationSet.relationSet, HuTime.TRange._examineRelations(recTRange, refTRange));
    else
        return HuTime.TRange.RelationSet._isPossible(
            refRelationSet, HuTime.TRange._examineRelations(recTRange, refTRange));
};

// **** 関係の集合 ****
HuTime.TRange.RelationSet = function RelationSet (relationSet) {
    this.relationSet = relationSet;
};
HuTime.TRange.RelationSet.prototype = {
    constructor: HuTime.TRange.RelationSet,

    relationSet: 8191,  // 初期値はすべてPossible

    // 関係の集合から関係を抽出
    findReliable: function findReliable () {
        return HuTime.TRange.RelationSet._findReliable(this.relationSet);
    },
    findPossible: function findPossible () {
        return HuTime.TRange.RelationSet._findPossible(this.relationSet);
    },
    findImpossible: function findImpossible () {
        return HuTime.TRange.RelationSet._findImpossible(this.relationSet);
    },

    // 関係の集合に特定の関係が含まれるかを検証
    isReliable: function isReliable (relation) {
        return HuTime.TRange.RelationSet._isReliable(this.relationSet, relation);
    },
    isPossible: function isPossible (relation) {
        return HuTime.TRange.RelationSet._isPossible(this.relationSet, relation);
    },
    isImpossible: function isImpossible (relation) {
        return HuTime.TRange.RelationSet._isImpossible(this.relationSet, relation);
    }
};

// 関係の集合から取りうる関係の数をカウント
HuTime.TRange.RelationSet._countPossible = function relationCount (relationSet) {
    relationSet &= 8191;  // 不使用ビットをクリア
    relationSet = (relationSet & 0x5555) + (relationSet >>> 1 & 0x5555);
    relationSet = (relationSet & 0x3333) + (relationSet >>> 2 & 0x3333);
    relationSet = (relationSet & 0x0f0f) + (relationSet >>> 4 & 0x0f0f);
    relationSet = (relationSet & 0x00ff) + (relationSet >>> 8 & 0x00ff);
    return relationSet;
};

// 関係の集合から関係（関係名を示す文字列）を抽出
HuTime.TRange.RelationSet._findReliable = function _findReliable (relationSet) {    // 確実な関係を出力（確実でない場合はnull）
    if (HuTime.TRange.RelationSet._countPossible(relationSet) !== 1)
        return null;
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === HuTime.TRange.Relation[key])
            return key;
    });
};
HuTime.TRange.RelationSet._findPossible = function _findPossible (relationSet) {    // 可能な関係を配列として列挙
    let result = [];
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === HuTime.TRange.Relation[key])
            result.push(key);
    });
    return result;
};
HuTime.TRange.RelationSet._findImpossible = function _findImpossible (relationSet) {    // 不可能な関係を配列として列挙
    let result = [];
    Object.keys(HuTime.TRange.Relation).forEach(function (key) {
          if ((relationSet & HuTime.TRange.Relation[key]) === 0)
            result.push(key);
    });
    return result;
};

// 関係の集合に特定の関係が含まれるかを検証
// relationについて確実関係を検証（true | false を返す）
HuTime.TRange.RelationSet._isReliable =  function _isReliable (relationSet, relation) {
    if (HuTime.TRange.RelationSet._countPossible(relation) > 1)
        return false;   // 1つ以上の関係を指定
    if (HuTime.TRange.RelationSet._countPossible(relationSet) > 1)
        return false;   // 1つ以上の関係でPossible
    return (relationSet & relation) !== 0;
};
// relationについて可能関係を検証（reliable | possible | impossible を返す）
HuTime.TRange.RelationSet._isPossible = function _isPossible (relationSet, relation) {
    relationSet &= 8191;  // 不使用ビットをクリア
    if ((relationSet & relation) === 0)
        return HuTime.UncertainState.Impossible;
    if ((relationSet & relation) === relation)
        return HuTime.UncertainState.Reliable;
    else
        return HuTime.UncertainState.Possible;
};
// relationについて不可能関係を検証（reliable | possible | impossible を返す）
HuTime.TRange.RelationSet._isImpossible = function _isImpossible (relationSet, relation) {
    relationSet &= 8191;  // 不使用ビットをクリア
    if ((relationSet & relation) === 0)
        return HuTime.UncertainState.Reliable;
    if ((relationSet & relation) === relation)
        return HuTime.UncertainState.Impossible;
    else
        return HuTime.UncertainState.Possible;
};
