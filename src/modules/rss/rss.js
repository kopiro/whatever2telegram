const Parser = require("rss-parser");

exports.fetch = async ({ url }) => {
  const parser = new Parser();
  const feed = await parser.parseURL(url);

  const data = feed.items.map(e => {
    return {
      hash: e.guid || e.link || JSON.stringify(e),
      message: [`<b>${e.title.trim()}</b>`, e.content.trim()].join("\n"),
      url: e.link,
    };
  });

  return {
    data,
  };
};
