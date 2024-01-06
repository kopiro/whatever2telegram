/* eslint-disable no-param-reassign */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Tgfancy = require("tgfancy");
const config = require("../config/config");
const { newLine, DATA_DIR } = require("./constants");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "config", "gcloud.json");

function reportError(bot, ...args) {
  console.error(...args);
  if (config.errorChatId) {
    bot.sendMessage(config.errorChatId, `\`\`\`\n${JSON.stringify(args)}\n\`\`\``);
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

  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(filePath)) || {};
  } catch (err) {
    data = {};
  }

  data.processedIdMap = data.processedIdMap || {};
  data.erroredIdMap = data.erroredIdMap || {};

  return data;
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
  if (config.env === "dev" || process.env.NODE_ENV === "development") {
    console.log("Replacing chatIds with dev chatIds");
    chatIds = [config.errorChatId];
  }

  const { photo, url, message, caption, footer } = element;
  console.debug(`Element to process: `, element);

  return Promise.all(
    chatIds.map(async chatId => {
      const finalOpt = { parse_mode: "html", disable_web_page_preview: false };

      const finalMessage = [message, url, footer ? `<i>${footer}</i>` : null]
        .map(e => (e ? e.trim() : e))
        .filter(e => e)
        .join(newLine + newLine);

      if (finalMessage) {
        const result = await bot.sendMessage(chatId, finalMessage, finalOpt);
        console.log("Message sent", finalMessage, finalOpt, result);
      } else {
        console.warn("No message to send");
      }

      if (photo) {
        console.log(`Sending photo to ${chatId}`, photo);
        bot.sendPhoto(chatId, photo, {
          disable_notification: !!finalMessage,
          caption: caption || "",
        });
      }
    }),
  );
}

async function processElement(element, moduleData, moduleConfig, bot) {
  const { chatIds, formatters = [] } = moduleConfig;

  const elementHash = getElementHash(element);
  const alreadyProcessed = moduleData.processedIdMap[elementHash];
  const previousProcessingError = moduleData.erroredIdMap[elementHash] || {};

  const elementDescription = `${moduleConfig.description} (${elementHash})`;

  if (alreadyProcessed) {
    console.debug(`${elementDescription} has already been processed at t = ${alreadyProcessed}`);
    return null;
  }

  if (previousProcessingError && previousProcessingError.tries > 3) {
    console.debug(`${elementDescription} has already errored 3 times, skipping it`);
    return null;
  }

  try {
    console.log(`${elementDescription} is executing -> `, element);

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
      throw new Error(`Invalid formatter type "${formatter}" for ${elementDescription}`);
    }, element);

    await notifyChange(bot, chatIds, finalElement);
    console.debug(`${elementDescription} succedeed`);

    moduleData.processedIdMap[elementHash] = Date.now();
    return true;
  } catch (err) {
    console.debug(`${elementDescription} errored: "${err.message}"`);
    moduleData.erroredIdMap[elementHash] = { error: err.message, tries: (previousProcessingError.tries || 0) + 1 };
    reportError(bot, "processElement", { element, err });
    return false;
  } finally {
    writeDataForModule(moduleConfig, moduleData);
  }
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
      const moduleExec = require(`./modules/${moduleConfig.name}/${moduleConfig.name}.js`);

      console.debug(`Executing script <${moduleConfig.description}>`);
      const moduleFetchedData = await moduleExec.fetch(moduleConfig.args, moduleData.cache, callback);

      if (moduleFetchedData) {
        const { data, cache } = moduleFetchedData;
        const elements = moduleConfig.mapper ? moduleConfig.mapper(data) : data;

        for (const element of elements) {
          await processElement(element, moduleData, moduleConfig, bot);
        }
        moduleData.cache = cache || {};
        moduleData.lastError = null;
      }
    } catch (err) {
      moduleData.lastError = err;
      reportError(bot, "moduleExec", { moduleConfig, err });
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

  modules.forEach((moduleConfig, index) => {
    if (moduleConfig.disabled) {
      return;
    }

    const { fetchInterval = 60 } = moduleConfig;
    const moduleExec = getModuleExecWrapper(bot, moduleConfig);

    // Start with a slight delay in the beginning
    setTimeout(moduleExec, index * 1000);
    setInterval(moduleExec, fetchInterval * 1000);
  });
}

process.setMaxListeners(0);
main();
