/**
 * Media type enum
 */
export var MediaType;
(function (MediaType) {
    MediaType["IMAGE"] = "image";
    MediaType["VIDEO"] = "video";
    MediaType["AUDIO"] = "audio";
    MediaType["DOCUMENT"] = "document";
})(MediaType || (MediaType = {}));
/**
 * Video provider enum
 */
export var VideoProvider;
(function (VideoProvider) {
    VideoProvider["YOUTUBE"] = "youtube";
    VideoProvider["VIMEO"] = "vimeo";
    VideoProvider["INTERNAL"] = "internal";
    VideoProvider["OTHER"] = "other";
})(VideoProvider || (VideoProvider = {}));
