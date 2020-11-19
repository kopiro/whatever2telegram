const path = require("path");

exports.baseHTTPHeaders = {
  "accept-language": "en-US,en",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36",
};

exports.tagsAllowed = ["b", "i", "u"];
exports.newLine = "\n";
exports.seeMore = "...";

exports.DATA_DIR = path.join(__dirname, "..", "data");
