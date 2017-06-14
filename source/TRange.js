// Time Interval Algebra
HuTime.TRangeAlgebra = {
    // 期間間の関係
    Relation: {
        // 上位・下位8ビットが逆の関係になるように対応付け（equalsを除く）
        Before: 2,
        After: 512,
        During: 4,
        Contains: 1024,
        Overlaps: 8,
        OverlappedBy: 2048,
        Meets: 16,
        MetBy: 4096,
        Starts: 32,
        StartedBy: 8192,
        Finishes: 64,
        FinishedBy: 16384,
        Equals: 1,

        MASK: 33152     // 1000000110000000 (128 + 256 + 32768)
    },

    // 期間長の大小関係
    Comp: {
        Shorter: 2,
        Longer: 512,
        Same: 1,

        MASK: 65020     // 1111110111111100
    },

    // 端点の指定
    Edge: {
        Begin: 1,
        End: 2
    },

    // ** 期間間の関係 **
    // 期間間の確実関係の検証（relationは単独の関係のみ）
    isReliableRelation: function isReliableRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange))
            return null;

        // a, bのセット（逆関係の場合は入れ替え）
        var a, b;
        if (relation <= 256) {
            a = s;
            b = t;
        }
        else {
            relation >>>= 8;
            a = t;
            b = s;
        }

        // 確実範囲の設定（nullの場合は可能範囲を超えないという条件から求める）
        var aRb, aRe, bRb, bRe;

        // 評価
        switch (relation) {
            case HuTime.TRangeAlgebra.Relation.Before:
                if (a._pEnd == null || b._pBegin == null)
                    return null;
                return a._pEnd < b._pBegin;
            case HuTime.TRangeAlgebra.Relation.During:
                if (a._pBegin == null || a._pEnd == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                return a._pBegin > bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Overlaps:
                if (b._pBegin == null || a._pEnd == null
                    || (aRe = a._rEnd == null ? a._pBegin : a._rEnd) == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return aRb < b._pBegin && aRe > bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Meets:
                if (a._pEnd == null || b._pBegin == null
                    || (aRe = a._rEnd == null ? a._pBegin : a._rEnd) == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return aRe == a._pEnd && a._pEnd == b._pBegin && b._pBegin == bRb && aRb < b._pBegin && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Starts:
                if (a._pBegin == null || a._pEnd == null || b._pBegin == null
                    || (bRb = b._rBegin == null ? b._pEnd : b._rBegin) == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                return a._pBegin == aRb && aRb == b._pBegin && b._pBegin == bRb && a._pEnd < bRe;
            case HuTime.TRangeAlgebra.Relation.Finishes:
                if (a._pBegin == null || a._pEnd == null || b._pEnd == null
                    || (bRe = b._rEnd == null ? b._pBegin : b._rEnd) == null)
                    return null;
                aRe = a._rEnd == null ? a._pBegin : a._rEnd;
                bRb = b._rBegin == null ? b._pEnd : b._rBegin;
                return a._pBegin > bRb && aRe == a._pEnd && a._pEnd == bRe && bRe == b._pEnd;
            case HuTime.TRangeAlgebra.Relation.Equals:
                if (a._pBegin == null || a._pEnd == null || b._pBegin == null || b._pEnd == null)
                    return null;
                aRb = a._rBegin == null ? a._pEnd : a._rBegin;
                aRe = a._rEnd == null ? a._pBegin : a._rEnd;
                bRb = b._rBegin == null ? b._pEnd : b._rBegin;
                bRe = b._rEnd == null ? b._pBegin : b._rEnd;
                return a._pBegin == aRb && aRb == b._pBegin && b._pBegin == bRb &&
                    aRe == a._pEnd && a._pEnd == bRe && bRe == b._pEnd;
            default:
                return null;   // relationに複数の値や負の値を指定した場合
        }
    },

    // 期間間の可能関係の検証（relationは複数の関係を設定可）
    isPossibleRelation: function isPossibleRelation (s, t, relation) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) ||
            relation <= 0 || relation >= 65536|| (relation & HuTime.TRangeAlgebra.Relation.MASK) != 0)
            return null;

        // 確実範囲の設定（nullの場合は可能範囲を超えないという条件から求める）
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var tRb = t._rBegin == null ? t._pEnd : t._rBegin;
        var tRe = t._rEnd == null ? t._pBegin : t._rEnd;

        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0) {
            if (sRe ==null || tRb == null)
                return null;
            if (sRe >= tRb)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0) {
            if (tRe == null || sRb == null)
                return null;
            if (tRe >= sRb)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0) {
            if(t._pBegin == null|| t._pEnd == null || sRb == null || sRe == null)
                return null;
            if(sRb <= t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0) {
            if (s._pBegin == null || s._pEnd == null || tRb == null || tRe == null)
                return null;
            if (tRb <= s._pBegin || tRe >= s._pEnd)
               return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pBegin == null || t._pEnd == null)
                return null;
            if (s._pBegin >= tRb || s._pEnd <= t._pBegin || sRe >= t._pEnd)
               return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pBegin == null || t._pEnd == null)
                return null;
            if (t._pBegin >= s._rBegin || t._pEnd <= s._pBegin || t._rEnd >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0) {
            if (s._pEnd == null || t._pBegin == null || t._pEnd == null || sRe == null)
                return null;
            if (sRe > t._rBegin || s._pEnd < t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pEnd == null || tRe == null)
                return null;
            if (tRe > sRb || t._pEnd < s._pBegin || t._rEnd >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0) {
            if (s._pBegin == null || t._pBegin == null || t._pEnd == null || sRb == null)
                return null;
            if (s._pBegin > tRb || sRb < t._pBegin || sRe >= t._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null ||  t._pBegin == null || tRb == null)
                return null;
            if (t._pBegin > sRb || tRb < s._pBegin || tRe >= s._pEnd)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0) {
            if (s._pEnd == null || t._pBegin == null || t._pEnd == null || sRe == null)
                return null;
            if (sRb <= t._pBegin || sRe > t._pEnd || s._pEnd < tRe)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0) {
            if (s._pBegin == null || s._pEnd == null || t._pEnd == null || tRe == null)
                return null;
            if (tRb <= s._pBegin || tRe > s._pEnd || t._pEnd < sRe)
                return false;
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0) {
            if (s._pBegin == null || s._pEnd == null|| t._pBegin == null || t._pEnd == null)
                return null;
            if (s._pBegin > tRb || sRb < t._pBegin || sRe > t._pEnd || s._pEnd < tRe)
                return false;
        }
        return true;
    },

    // 期間間の関係の取得（１つならreliable, 2つ以上ならpossible）
    getRelation: function getRelation (s, t) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange))
            return 0;

        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var tRb = t._rBegin == null ? t._pEnd : t._rBegin;
        var tRe = t._rEnd == null ? t._pBegin : t._rEnd;
        var relation = 0;
        if (sRe != null && tRb != null
            && sRe < tRb)
            relation += HuTime.TRangeAlgebra.Relation.Before;
        if (tRe != null && sRb != null
            && tRe < sRb)
            relation += HuTime.TRangeAlgebra.Relation.After;
        if (sRb != null && t._pBegin != null && sRe != null && t._pEnd != null
            && sRb > t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.During;
        if (tRb != null && s._pBegin != null && tRe != null && s._pEnd != null
            && tRb > s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Contains;
        if (s._pBegin != null && s._pEnd != null && t._pBegin != null && t._pEnd != null
            && s._pBegin < tRb && s._pEnd > t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Overlaps;
        if (t._pBegin != null && t._pEnd != null && s._pBegin && s._pEnd != null
            && t._pBegin < sRb && t._pEnd > s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.OverlappedBy;
        if (sRe != null && s._pEnd != null && t._pBegin != null && t._pEnd != null
            && sRe <= tRb && s._pEnd >= t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Meets;
        if (tRe != null && t._pEnd != null && s._pBegin != null && s._pEnd != null
            && tRe <= sRb && t._pEnd >= s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.MetBy;
        if (s._pBegin != null && sRb != null && t._pBegin != null && t._pEnd != null
            && s._pBegin <= tRb && sRb >= t._pBegin && sRe < t._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.Starts;
        if (t._pBegin != null && tRb != null && s._pBegin != null && s._pEnd != null
            && t._pBegin <= sRb && tRb >= s._pBegin && tRe < s._pEnd)
            relation += HuTime.TRangeAlgebra.Relation.StartedBy;
        if (t._pBegin != null && sRe != null && t._pEnd != null && s._pEnd != null
            && sRb > t._pBegin && sRe <= t._pEnd && s._pEnd >= tRe)
            relation += HuTime.TRangeAlgebra.Relation.Finishes;
        if (s._pBegin != null && tRe != null && s._pEnd != null && t._pEnd != null
            && tRb > s._pBegin && tRe <= s._pEnd && t._pEnd >= sRe)
            relation += HuTime.TRangeAlgebra.Relation.FinishedBy;
        if (s._pBegin != null && t._pBegin != null && t._pEnd != null && s._pEnd != null
            && s._pBegin <= tRb && sRb >= t._pBegin && sRe <= t._pEnd && s._pEnd >= tRe)
            relation += HuTime.TRangeAlgebra.Relation.Equals;

        return relation;
    },

    // 期間間の関係に基づく更新（tとrelationに基づいて更新されたs）
    getTRangeRefinedByRelation: function getTRangeRefinedByRelation (s, t, relation) {
        if (!HuTime.TRangeAlgebra.isPossibleRelation(s, t, relation))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var a = new HuTime.TRange();   // 結果
        var refine;
        if ((relation & HuTime.TRangeAlgebra.Relation.Before) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.After) != 0) {
            if (t._rEnd != null) {
                refine = s._pBegin == null ? t._rEnd : Math.max(s._pBegin, t._rEnd);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.During) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Contains) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Overlaps) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._pBegin != null) {
                refine = s._rEnd == null ? t._pBegin : Math.max(s._rEnd, t._pBegin);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.OverlappedBy) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._rBegin == null ? t._pEnd : Math.min(s._rBegin, t._pEnd);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Meets) != 0) {
            if (t._rBegin != null) {
                refine = s._pEnd == null ? t._rBegin : Math.min(s._pEnd, t._rBegin);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
            if (t._pBegin != null) {
                refine = s._rEnd == null ? t._pBegin : Math.max(s._rEnd, t._pBegin);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.MetBy) != 0) {
            if (t._rEnd != null) {
                refine = s._pBegin == null ? t._rEnd : Math.max(s._pBegin, t._rEnd);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Starts) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.StartedBy) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Finishes) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.FinishedBy) != 0) {
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((relation & HuTime.TRangeAlgebra.Relation.Equals) != 0) {
            if (t._pBegin != null) {
                refine = s._pBegin == null ? t._pBegin : Math.max(s._pBegin, t._pBegin);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (t._rBegin != null) {
                refine = s._rBegin == null ? t._rBegin : Math.min(s._rBegin, t._rBegin);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, refine);
            }
            if (t._rEnd != null) {
                refine = s._rEnd == null ? t._rEnd : Math.max(s._rEnd, t._rEnd);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (t._pEnd != null) {
                refine = s._pEnd == null ? t._pEnd : Math.min(s._pEnd, t._pEnd);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }

        if (a._rBegin == null || a._rBegin > a._pEnd)
            a._rBegin = a._pEnd;
        if (a._rEnd == null || a._rEnd < a._pBegin)
            a._rEnd = a._pBegin;
        a.setCentralValue();
        return a;
    },

    // ** 期間長 **
    // 期間長の確実関係の検証
    isReliableDuration: function isReliableDuration (s, duration, comp) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return null;
        var sRb, sRe;

        switch (comp) {
            case HuTime.TRangeAlgebra.Comp.Shorter:
                if (s._pEnd == null || s._pBegin == null)
                    return null;
                return s._pEnd - s._pBegin < duration._lower;
            case HuTime.TRangeAlgebra.Comp.Same:
                if (s._pEnd == null || s._pBegin == null
                    || (sRe = s._rEnd == null ? s._pBegin : s._rEnd) == null
                    || (sRb = s._rBegin == null ? s._pEnd : s._rBegin)== null)
                    return null;
                return Math.max(sRe - sRb, 0) == s._pEnd - s._pBegin &&
                    s._pEnd - s._pBegin == duration._lower && duration._lower == duration._upper;
            case HuTime.TRangeAlgebra.Comp.Longer:
                if ((sRe = s._rEnd == null ? s._pBegin : s._rEnd) == null
                    || (sRb = s._rBegin == null ? s._pEnd : s._rBegin)== null)
                    return null;
                return Math.max(sRe - sRb, 0) > duration._upper;
            default:
                return null;    // compに複数の値や負の値を指定した場合
        }
    },

    // 期間長の可能関係の検証
    isPossibleDuration: function isPossibleDuration (s, duration, comp) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration) ||
            comp <= 0 || comp >= 65536 || (comp & HuTime.TRangeAlgebra.Comp.MASK) != 0)
            return null;

        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var min = sRe == null || sRb == null ? null : Math.max(s._rEnd - s._rBegin, 0);
        var max = s._pEnd == null || s._pBegin == null ? null : s._pEnd - s._pBegin;

        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0) {
            if (min == null)
                return null;
            if(min >= duration._upper)
                return false;
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Same) != 0) {
            if (max == null || min == null)
                return null;
            if (max < duration._lower || min > duration._lower)
                return false;
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0) {
            if (max == null)
                return null;
            if (max <= duration._lower)
                return false;
        }
        return true;
    },

    // 期間長の関係の取得（１つならreliable, 2つ以上ならpossible）
    getDurationComp: function getDurationComp (s, duration) {
        if (!(s instanceof HuTime.TRange) || !(duration instanceof HuTime.TDuration))
            return null;

        var sRe = s._rEnd == null ? s._pBegin : s._rEnd;
        var sRb = s._rBegin == null ? s._pEnd : s._rBegin;
        var min = sRe == null || sRb == null ? null : Math.max(sRe - sRb, 0);
        var max = s._pEnd == null || s._pBegin == null ? null : s._pEnd - s._pBegin;
        var comp = 0;

        if (min != null && min < duration._upper)
            comp += HuTime.TRangeAlgebra.Comp.Shorter;
        if (min != null && max != null && min <= duration._upper && max >= duration._lower)
            comp += HuTime.TRangeAlgebra.Comp.Same;
        if (max != null && max > duration._lower)
            comp += HuTime.TRangeAlgebra.Comp.Longer;
        return comp;
    },

    // 期間長の関係に基づく更新（durationとcompに基づいて更新されたs）
    getTRangeRefinedByDuration: function getTRangeRefinedByDuration (s, duration, comp) {
        if (!HuTime.TRangeAlgebra.isPossibleDuration(s, duration, comp))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var a = new HuTime.TRange();
        var refine;


        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0) {
            if (s._rEnd != null) {
            refine = s._pBegin == null ? s._rEnd - duration._upper : Math.max(s._pBegin, s._rEnd - duration._upper);
            a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (s._rBegin != null) {
                refine = s._pEnd == null ? s._rBegin + duration._upper : Math.min(s._pEnd, s._rBegin + duration._upper);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Same) != 0) {
            if (s._rEnd != null) {
                refine = s._pBegin == null ? s._rEnd - duration._upper : Math.max(s._pBegin, s._rEnd - duration._upper);
                a._pBegin = a._pBegin == null ? refine : Math.min(a._pBegin, refine);
            }
            if (s._pEnd != null) {
                refine = s._rBegin == null ? s._pEnd - duration._lower : Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, null);
            }
            if (s._pBegin != null) {
                refine = s._rEnd == null ? s._pBegin + duration._lower : Math.max(s._rEnd, s._pBegin + duration._lower);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
            if (s._rBegin != null) {
                refine = s._pEnd == null ? s._rBegin + duration._upper : Math.min(s._pEnd, s._rBegin + duration._upper);
                a._pEnd = a._pEnd == null ? refine : Math.max(a._pEnd, refine);
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0) {
            if (s._pEnd != null) {
                refine = s._rBegin == null ? s._pEnd - duration._lower : Math.min(s._rBegin, s._pEnd - duration._lower);
                a._rBegin = a._rBegin == null ? refine : Math.max(a._rBegin, null);
            }
            if (s._pBegin != null) {
                refine = s._rEnd == null ? s._pBegin + duration._lower : Math.max(s._rEnd, s._pBegin + duration._lower);
                a._rEnd = a._rEnd == null ? refine : Math.min(a._rEnd, refine);
            }
        }


        a.setCentralValue();
        return a;
    },

    // ** 端点間隔 **
    // 端点間隔の確実関係の検証
    isReliableInterval: function isReliableInterval (s, t, sEdge, tEdge, interval, comp) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration))
            return null;

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return null;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        switch (comp) {
            case HuTime.TRangeAlgebra.Comp.Shorter:
                return Math.max(ae - bb, be - ab) < interval._lower;
            case HuTime.TRangeAlgebra.Comp.Same:
                return Math.max(ae - bb, be - ab, 0) == Math.max(ae - bb, be - ab) &&
                    Math.max(ae - bb, be - ab) == interval._lower && interval._lower == interval._upper;
            case HuTime.TRangeAlgebra.Comp.Longer:
                return Math.max(ab - be, bb - ae, 0) > interval._upper;
            default:
                return null;
        }
    },

    // 端点間隔の可能関係の検証
    isPossibleInterval: function isPossibleInterval (s, t, sEdge, tEdge, interval, comp) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration) ||
            comp <= 0 || comp >= 65536 || (comp & HuTime.TRangeAlgebra.Comp.MASK) != 0)
            return null;

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return null;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);

        if (comp & HuTime.TRangeAlgebra.Comp.Shorter != 0
            && min >= interval._upper)
            return false;
        if (comp & HuTime.TRangeAlgebra.Comp.Same != 0
            && min > interval._upper || max < interval._lower)
            return false;
        if (comp & HuTime.TRangeAlgebra.Comp.Longer != 0
            && max >= interval._lower)
            return false;
        return true;
    },

    // 端点間隔の関係の取得（１つならreliable, 2つ以上ならpossible）
    getIntervalComp: function getIntervalComp (s, t, sEdge, tEdge, interval) {
        if (!(s instanceof HuTime.TRange) || !(t instanceof HuTime.TRange) || !(interval instanceof HuTime.TDuration))
            return null;

        var ab, ae, bb, be;
        var comp = 0;

        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return false;

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return null;

        if (ab == null || ae == null || bb == null || be == null)
            return null;

        var min = Math.max(ab - be, bb - ae, 0);
        var max = Math.max(ae - bb, be - ab);
        var a = null;

        if ((min < interval._upper))
            comp += HuTime.TRangeAlgebra.Comp.Shorter;
        if ((min <= interval._upper && max >= interval._lower))
            comp += HuTime.TRangeAlgebra.Comp.Same;
        if ((max > interval._lower))
            comp += HuTime.TRangeAlgebra.Comp.Longer;
        return comp;
    },

    // 端点間隔の関係に基づく更新（t, intervalとcompに基づいて更新されたs）
    getTRangeRefinedByInterval: function getTRangeRefinedByInterval (s, t, sEdge, tEdge, interval, comp) {
        if (!HuTime.TRangeAlgebra.isPossibleInterval(s, t, sEdge, tEdge, interval, comp))
            return s.clone();   // 基になる関係が可能でなければ、更新なし

        var ab, ae, bb, be;
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            ab = s._pBegin;
            ae = s._rBegin;
        }
        else if (sEdge == HuTime.TRangeAlgebra.Edge.End) {
            ab = s._rEnd;
            ae = s._pEnd;
        }
        else
            return s.clone();

        if (tEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            bb = t._pBegin;
            be = t._rBegin;
        }
        else if (tEdge == HuTime.TRangeAlgebra.Edge.End) {
            bb = t._rEnd;
            be = t._pEnd;
        }
        else
            return s.clone();

        var aab = null;
        var aae = null;
        var refine;
        if ((comp & HuTime.TRangeAlgebra.Comp.Shorter) != 0) {
            if (bb != null) {
            refine = ab == null ? bb - interval._upper : Math.max(ab, bb - interval._upper);
            aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (be != null) {
                refine = ae == null ? be + interval._upper : Math.min(ae, be + interval._upper);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Same) != 0 && bb != null && be != null) {
            if (ab > be - interval._lower) {
                refine = ab ==null ? bb + interval._lower : Math.max(ab, bb + interval._lower);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            else {
                refine = ab == null ? bb - interval._upper : Math.max(ab, bb - interval._upper);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (ae < bb + interval._lower) {
                refine = ae == null ? be - interval._lower : Math.min(ae, be - interval._lower);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
            else {
                refine = ae == null ? be + interval._upper : Math.min(ae, be + interval._upper);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }
        if ((comp & HuTime.TRangeAlgebra.Comp.Longer) != 0 && bb != null && be != null) {
            if (ab > be - interval._lower) {
                refine = ab ==null ? bb + interval._lower : Math.max(ab, bb + interval._lower);
                aab = aab == null ? refine : Math.min(aab, refine);
            }
            if (ae < bb + interval._lower) {
                refine = ae == null ? be - interval._lower : Math.min(ae, be - interval._lower);
                aae = aae == null ? refine : Math.max(aae, refine);
            }
        }

        var a = new HuTime.TRange();
        if (sEdge == HuTime.TRangeAlgebra.Edge.Begin) {
            a._pBegin = aab;
            a._rBegin = aae;
            a._rEnd = Math.max(s._rEnd, aab);
            a._pEnd = s._pEnd;
        }
        else {
            a._pBegin = s._pBegin;
            a._rBegin = Math.min(s._rBegin, aae);
            a._rEnd = aab;
            a._pEnd = aae;
        }
        return a;
    }
};
Object.freeze(HuTime.TRangeAlgebra.Relation);
Object.freeze(HuTime.TRangeAlgebra.Comp);
Object.freeze(HuTime.TRangeAlgebra.Edge);

// t値による範囲の長さ
HuTime.TDuration = function(lower, upper) {
    if (isNaN(lower) || lower == null || lower < 0)
        this._lower = 0;
    else
        this._lower = lower;

    if (isNaN(upper) || upper == null || upper < 0)
        this._upper = this._lower;  // 1つしか指定されていない場合も含む
    else {
        this._upper = upper;
        if (this._lower > this._upper) {
            var d = this._lower;
            this._lower = this._upper;
            this._upper = d;
        }
    }
};
HuTime.TDuration.prototype = {
    constructor: HuTime.TDuration,

    _lower: 0,
    _upper: Number.POSITIVE_INFINITY,
    get lower() {
        return this._lower;
    },
    get upper() {
        return this._upper;
    }
};

// t値で示された範囲
HuTime.TRange = function() {
};
HuTime.TRange.prototype = {
    constructor: HuTime.TRange,

    // 基本となる4値
    _pBegin: null,  // 可能始点
    _rBegin: null,  // 確実始点
    _rEnd: null,    // 確実終点
    _pEnd: null,    // 可能終点
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

    // 状態表示
    get isTotalPRangeOnly() {       // 全可能期間のみの場合 true
        return this._rBegin == null && this._rEnd == null;
    },
    get isNonRRange() {             // 確実期間がない場合 true
        return this._rBegin == null || this._rEnd == null || this._rBegin > this._rEnd;
    },

    setCentralValue: function() {      // 代表値の設定
        // 確定範囲がある場合（両端とも無限大でない）
        if (isFinite(this._rBegin) && isFinite(this._rEnd) && this._rBegin <= this._rEnd)
            this._centralValue = (this._rBegin + this._rEnd) / 2;

        // 前期可能範囲がある場合（確定範囲なし）
        else if (isFinite(this._pBegin) && isFinite(this._rBegin))
            this._centralValue = this._rBegin;

        // 後期可能範囲がある場合（確定範囲、前期可能範囲なし）
        else if (isFinite(this._rEnd) && isFinite(this._pEnd))
            this._centralValue = this._rEnd;

        // 全可能範囲のみ、かつ、両端とも無限大でない場合
        else if (isFinite(this._pBegin) && isFinite(this._pEnd))
            this._centralValue = (this._pBegin + this._pEnd) / 2;

        else
            this._centralValue = null;
    },

    // 自身に関するTime Interval Algebra
    isReliableRelation: function isReliableRelation (t, relation) {     // 期間間の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableRelation(this, t, relation);
    },
    isPossibleRelation: function isPossibleRelation (t, relation) {     // 期間間の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleRelation(this, t, relation);
    },
    getRelation: function getRelation (t) {                             // 期間間の関係の取得
        return HuTime.TRangeAlgebra.getRelation(this, t);
    },
    refineByRelation: function getTRangeRefinedByRelation (t, relation) {       // 期間間の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByRelation(this, t, relation);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
        this.setCentralValue();
    },

    isReliableDuration: function isReliableDuration (duration, comp) {  // 期間長の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableDuration(this, duration, comp);
    },
    isPossibleDuration: function isPossibleDuration (duration, comp) {  // 期間長の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleDuration(this, duration, comp);
    },
    getDurationComp: function getDurationComp (duration) {              // 期間長の関係の取得
        return HuTime.TRangeAlgebra.getDurationComp(this, duration);
    },
    refineByDuration: function getTRangeRefinedByDuration (duration, comp) {    // 期間長の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByDuration(this, duration, comp);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
        this.setCentralValue();
    },

    isReliableInterval: function isReliableInterval (t, sEdge, tEdge, interval, comp) {  // 端点間隔の確実関係の検証
        return HuTime.TRangeAlgebra.isReliableInterval(this, t, sEdge, tEdge, interval, comp);
    },
    isPossibleInterval: function isPossibleInterval (t, sEdge, tEdge, interval, comp) {  // 端点間隔の可能関係の検証
        return HuTime.TRangeAlgebra.isPossibleInterval(this, t, sEdge, tEdge, interval, comp);
    },
    getIntervalComp: function getIntervalComp (t, sEdge, tEdge, interval) {  // 端点間隔の関係の取得
        return HuTime.TRangeAlgebra.getIntervalComp(this, t, sEdge, tEdge, interval);
    },
    refineByInterval: function refineByInterval (t, sEdge, tEdge, interval, comp) {     // 端点間隔の関係に基づく更新
        var a = HuTime.TRangeAlgebra.getTRangeRefinedByInterval(this, t, sEdge, tEdge, interval, comp);
        this._pBegin = a._pBegin;
        this._rBegin = a._rBegin;
        this._rEnd = a._rEnd;
        this._pEnd = a._pEnd;
        this.setCentralValue();
    },

    // クローンの生成
    clone: function clone () {
        var a = new HuTime.TRange();
        a._pBegin = this._pBegin;
        a._rBegin = this._rBegin;
        a._rEnd = this._rEnd;
        a._pEnd = this._pEnd;
        a._centralValue = this._centralValue;
        return a;
    }
};

// 始点と終点を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromBeginEnd = function (begin, end) {
    var tRange = new HuTime.TRange();

    if (begin instanceof HuTime.TRange) {   // TRangeで指定された場合
        tRange._pBegin = begin._pBegin;
        tRange._rBegin = begin._pEnd;
    }
    else if(!isNaN(begin) && begin != null) {
        tRange._pBegin = begin;
        tRange._rBegin = begin;
    }
    if (end instanceof HuTime.TRange) {
        tRange._rEnd = end._pBegin;
        tRange._pEnd = end._pEnd;
    }
    else if (!isNaN(end) && end != null) {
        tRange._rEnd = end;
        tRange._pEnd = end;
    }

    tRange.setCentralValue();
    return tRange;
};

// １つの点（期間）を指定してTRangeを生成（t値またはTRangeを指定）
HuTime.TRange.createFromDuring = function (during) {
    var tRange = new HuTime.TRange();

    if (during instanceof HuTime.TRange) {   // TRangeで指定された場合
        tRange._pBegin =during._pBegin;
        tRange._rBegin =during._pEnd;
        tRange._rEnd =during._pBegin;
        tRange._pEnd = during._pEnd;
    }
    else if(!isNaN(begin) && begin != null) {
        tRange._pBegin = during;
        tRange._rBegin = during;
        tRange._rEnd = during;
        tRange._pEnd = during;
    }
    tRange.setCentralValue();
    return tRange;
};

