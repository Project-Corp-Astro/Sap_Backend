/**
 * Content related type definitions
 */
export var ContentStatus;
(function (ContentStatus) {
    ContentStatus["DRAFT"] = "draft";
    ContentStatus["REVIEW"] = "review";
    ContentStatus["PUBLISHED"] = "published";
    ContentStatus["ARCHIVED"] = "archived";
    ContentStatus["REJECTED"] = "rejected";
})(ContentStatus || (ContentStatus = {}));
export var ContentType;
(function (ContentType) {
    ContentType["ARTICLE"] = "article";
    ContentType["PAGE"] = "page";
    ContentType["NEWS"] = "news";
    ContentType["ANNOUNCEMENT"] = "announcement";
    ContentType["DOCUMENTATION"] = "documentation";
    ContentType["POLICY"] = "policy";
})(ContentType || (ContentType = {}));
export var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["PENDING"] = "pending";
    WorkflowStatus["IN_PROGRESS"] = "in_progress";
    WorkflowStatus["APPROVED"] = "approved";
    WorkflowStatus["REJECTED"] = "rejected";
    WorkflowStatus["CANCELLED"] = "cancelled";
})(WorkflowStatus || (WorkflowStatus = {}));
