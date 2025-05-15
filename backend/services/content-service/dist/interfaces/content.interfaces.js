/**
 * Content status enum
 */
export var ContentStatus;
(function (ContentStatus) {
    ContentStatus["DRAFT"] = "draft";
    ContentStatus["PUBLISHED"] = "published";
    ContentStatus["ARCHIVED"] = "archived";
    ContentStatus["PENDING_REVIEW"] = "pending_review";
    ContentStatus["REJECTED"] = "rejected";
})(ContentStatus || (ContentStatus = {}));
