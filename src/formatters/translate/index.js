const { Translate } = require("@google-cloud/translate").v2;

const translate = new Translate();

exports.default = async (e, options = {}) => {
  const [translatedText] = await translate.translate(e.message, { to: "en", ...options });
  e.message = [e.message, translatedText].join("\n\n");
  return e;
};
