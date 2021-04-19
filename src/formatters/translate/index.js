const { Translate } = require("@google-cloud/translate").v2;

const TAG = "formatters/translate";
const translate = new Translate();
const { newLine } = require("../../constants");

const getTranslatedURL = (url, toLanguage) => {
  return `https://translate.google.com/translate?hl=${toLanguage}&sl=auto&tl=${toLanguage}&u=${encodeURIComponent(
    url,
  )}`;
};

exports.default = async (e, _options = {}) => {
  const options = { toLanguage: "en", mode: "replace", appendTranslatedURL: true, ..._options };

  const [translatedText] = await translate.translate(e.message, { to: options.toLanguage });
  if (options.mode === "replace") {
    e.message = translatedText;
  } else if (options.mode === "append") {
    e.message = `${e.message}${newLine}${newLine}${translatedText}`;
  } else if (options.mode === "prepend") {
    e.message = `${translatedText}${newLine}${newLine}${e.message}`;
  } else {
    console.error(TAG, "invalid mode", options.mode);
  }

  if (e.url && options.appendTranslatedURL) {
    e.footer = `<a href="${getTranslatedURL(e.url, options.toLanguage)}">Translated page</a>`;
  }

  return e;
};
