"use strict";
/**
 * Content related type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowStatus = exports.ContentType = exports.ContentStatus = void 0;
var ContentStatus;
(function (ContentStatus) {
    ContentStatus["DRAFT"] = "draft";
    ContentStatus["REVIEW"] = "review";
    ContentStatus["PUBLISHED"] = "published";
    ContentStatus["ARCHIVED"] = "archived";
    ContentStatus["REJECTED"] = "rejected";
    ContentStatus["REVISION"] = "revision";
})(ContentStatus = exports.ContentStatus || (exports.ContentStatus = {}));
var ContentType;
(function (ContentType) {
    ContentType["ARTICLE"] = "article";
    ContentType["PAGE"] = "page";
    ContentType["NEWS"] = "news";
    ContentType["ANNOUNCEMENT"] = "announcement";
    ContentType["DOCUMENTATION"] = "documentation";
    ContentType["POLICY"] = "policy";
})(ContentType = exports.ContentType || (exports.ContentType = {}));
var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["PENDING"] = "pending";
    WorkflowStatus["IN_PROGRESS"] = "in_progress";
    WorkflowStatus["APPROVED"] = "approved";
    WorkflowStatus["REJECTED"] = "rejected";
    WorkflowStatus["CANCELLED"] = "cancelled";
})(WorkflowStatus = exports.WorkflowStatus || (exports.WorkflowStatus = {}));
