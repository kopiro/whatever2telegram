/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const striptags = require("striptags");
const Tgfancy = require("tgfancy");
const config = require("../config/config");
const { tagsAllowed, newLine, DATA_DIR } = require("./constants");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "config", "gcloud.json");

function reportError(bot, ...err) {
  console.error(...err);
  if (config.errorChatId) {
    bot.sendMessage(config.errorChatId, String(err) || JSON.stringify(err));
  }
}

function geModuleDataFilePath(moduleConfig) {
  const filePath = moduleConfig.description;
  return path.join(DATA_DIR, `${filePath}.json`);
}

function writeDataForModule(moduleConfig, data) {
  const filePath = geModuleDataFilePath(moduleConfig);
  return fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readDataForModule(moduleConfig) {
  const filePath = geModuleDataFilePath(moduleConfig);

  try {
    const data = JSON.parse(fs.readFileSync(filePath));
    if (!data) throw new Error();
    return data;
  } catch (err) {
    return {
      processedIdMap: {},
    };
  }
}

function getElementHash(element) {
  return (
    element.hash ||
    crypto
      .createHash("md5")
      .update(JSON.stringify(element))
      .digest("hex")
  );
}

function notifyChange(bot, chatIds, element) {
  const { photo, url, message, caption, footer } = element;

  return Promise.all(
    chatIds.map(async chatId => {
      console.debug(`Sending message to ${chatId}`, element);

      let finalMessage;
      const safeMessage = striptags(element.message, tagsAllowed);
      const finalOpt = { parse_mode: "html", disable_web_page_preview: false };

      if (message && url) {
        finalMessage = `${safeMessage}${newLine}${url}`;
      } else if (message && !url) {
        finalOpt.disable_web_page_preview = true;
        finalMessage = safeMessage;
      } else if (!message && url) {
        finalMessage = url;
      }

      if (footer) {
        finalMessage = `${finalMessage}${newLine}${newLine}<i>${footer}</i>`;
      }

      if (finalMessage) {
        console.log("Sending finalMessage", finalMessage, finalOpt);
        bot.sendMessage(chatId, finalMessage, finalOpt);
      }

      if (photo) {
        bot.sendPhoto(chatId, photo, {
          disable_notification: !!finalMessage,
          caption: caption || "",
        });
      }
    }),
  );
}

async function processElement(element, moduleData, moduleConfig, bot) {
  const { chatIds, formatters = [], attributes = null, filter = e => e } = moduleConfig;

  // Filtering elements
  if (filter) {
    if (!filter(element)) {
      return false;
    }
  }

  // Filtering attributes
  if (attributes) {
    // eslint-disable-next-line no-param-reassign
    element = attributes.reduce((carry, attr) => {
      return { ...carry, ...{ [attr]: element[attr] } };
    }, {});
  }

  console.log(`Executing ${moduleConfig.description}`, element, moduleData.cache);

  const elementHash = getElementHash(element);
  if (moduleData.processedIdMap[elementHash]) {
    console.debug(`Already processed ${elementHash} for ${moduleConfig.description}`);
    return null;
  }

  const finalElement = await formatters.reduce(async (carry, formatter) => {
    if (typeof formatter === "string") {
      const formatterExec = require(`./formatters/${formatter}`);
      return formatterExec.default(carry);
    }
    if (typeof formatter === "object") {
      const formatterExec = require(`./formatters/${formatter.name}`);
      return formatterExec.default(carry, formatter.options);
    }
    if (typeof formatter === "function") {
      return formatter(carry);
    }
    reportError(bot, "Invalid formatter type", formatter);
    return carry;
  }, element);

  await notifyChange(bot, chatIds, finalElement);

  // eslint-disable-next-line no-param-reassign
  moduleData.processedIdMap[elementHash] = Date.now();
  writeDataForModule(moduleConfig, moduleData);

  return true;
}

function getModuleExecWrapper(bot, moduleConfig) {
  return async () => {
    if (config.doNotDisturb) {
      const { min, max } = config.doNotDisturb;
      const now = new Date();
      const hour = now.getUTCHours();
      if (hour < min || hour > max) {
        console.log(`Do not disturb is enabled (H${hour})`);
        return;
      }
    }

    const moduleData = readDataForModule(moduleConfig);
    const callback = element => processElement(element, moduleData, moduleConfig, bot);

    try {
      const moduleExec = require(`./modules/${moduleConfig.name}`);

      console.debug(`Executing script <${moduleConfig.description}>`);
      const moduleFetchedData = await moduleExec.fetch(moduleConfig.args, moduleData.cache, callback);

      if (moduleFetchedData) {
        const { elements, cache } = moduleFetchedData;
        for (const element of elements) {
          try {
            await processElement(element, moduleData, moduleConfig, bot);
          } catch (err) {
            reportError(bot, "processElement", err);
          }
        }
        moduleData.cache = cache || {};
        moduleData.lastError = null;
      }
    } catch (err) {
      const fullErrMsg = `${moduleConfig.description}: ${err.message}`;
      moduleData.lastError = err.message;
      reportError(bot, "moduleExec", fullErrMsg);
    } finally {
      moduleData.lastRunAt = Date.now();
      writeDataForModule(moduleConfig, moduleData);
    }
  };
}

function main() {
  const { telegram, modules } = config;

  const bot = new Tgfancy(telegram.token, {
    polling: telegram.polling,
    filepath: false,
    tgfancy: {
      chatIdResolution: false,
    },
  });

  const botListeners = [];

  bot.whenMessage = fn => {
    botListeners.push(fn);
  };

  bot.on("message", msg => {
    console.log("New message", msg);
    botListeners.forEach(fn => fn(msg));
  });

  modules.forEach(moduleConfig => {
    if (moduleConfig.disabled) {
      return;
    }

    const { fetchInterval = 60 } = moduleConfig;
    const moduleExec = getModuleExecWrapper(bot, moduleConfig);

    moduleExec();
    setInterval(moduleExec, fetchInterval * 1000);
  });
}

process.setMaxListeners(0);
main();
