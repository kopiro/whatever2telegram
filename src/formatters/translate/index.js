const { Translate } = require("@google-cloud/translate").v2;

const translate = new Translate();

exports.default = async (e, _options = {}) => {
  const options = { toLanguage: "en", ..._options };
  const [translatedText] = await translate.translate(e.message, { to: options.toLanguage });
  if (options.mode === "replace") {
    e.message = translatedText;
  } else if (options.mode === "append") {
    e.message = [e.message, translatedText].join("\n\n");
  } else if (options.mode === "prepend") {
    e.message = [translatedText, e.message].join("\n\n");
  }
  return e;
};
