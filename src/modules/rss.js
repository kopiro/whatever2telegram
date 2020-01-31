const Parser = require("rss-parser");

exports.fetch = async ({ url }) => {
  const parser = new Parser();
  const feed = await parser.parseURL(url);

  let data = feed.items;
  data = data.map(e => {
    return {
      hash: e.guid,
      message: [`<b>${e.title}</b>`, e.content].join("\n"),
      photo: e.enclosure && e.enclosure.url,
      url: e.link
    };
  });

  return {
    elements: data
  };
};
