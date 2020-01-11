/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable no-restricted-syntax */
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const crypto = require("crypto");
const striptags = require("striptags");
const sequential = require("promise-sequential");
const { tagsAllowed, newLine, seeMore } = require("./constants");

const DATA_DIR = path.join(__dirname, "..", "data");
const config = require("../data/config");

function getHashForModule(moduleConfig) {
  return crypto
    .createHash("md5")
    .update(moduleConfig.name + JSON.stringify(moduleConfig.args))
    .digest("hex");
}

function getDataFileForModule(moduleConfig) {
  const filePath = getHashForModule(moduleConfig);
  return path.join(DATA_DIR, `${filePath}.json`);
}

function writeDataForModule(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readDataForModule(moduleConfig, filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath));
    if (!data) throw new Error();
    return data;
  } catch (err) {
    return {
      processedIdMap: {}
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

function notifyObject(bot, chatIds, element) {
  const { photo, url } = element;
  const message = striptags(element.message, tagsAllowed);

  return Promise.all(
    chatIds.map(chatId => {
      console.debug(`Sending message to ${chatId}`, { message, photo, url });

      if (photo) {
        const maxMessageLength =
          1020 - newLine.length - seeMore.length - url.length;
        const fullMessage = [
          message.length > maxMessageLength
            ? [message.substr(0, maxMessageLength), seeMore].join("")
            : message,
          url
        ]
          .filter(e => e)
          .join(newLine);

        return bot.sendPhoto(chatId, photo, {
          caption: fullMessage,
          parse_mode: "html"
        });
      }

      const fullMessage = [message, url].filter(e => e).join(newLine);
      return bot.sendMessage(chatId, striptags(fullMessage, tagsAllowed), {
        parse_mode: "html"
      });
    })
  );
}

function getModuleExecWrapper(bot, moduleConfig) {
  const { name = "noop", args = {}, chatIds } = moduleConfig;
  const filePath = getDataFileForModule(moduleConfig);
  const formatter = moduleConfig.formatter || (e => e);

  return async () => {
    const moduleData = readDataForModule(moduleConfig, filePath);
    moduleData.moduleConfig = moduleConfig;

    try {
      const moduleExec = require(`./modules/${name}`);
      const { elements = [], cache = {} } = await moduleExec.fetch(args, {});
      const formattedElements = typeof elements === "object" ? elements : [];

      console.log(
        `Executed: ${moduleConfig.description} - got ${formattedElements.length}`,
        cache
      );

      await sequential(
        formattedElements.map(element => async () => {
          const elementHash = getElementHash(element);
          if (moduleData.processedIdMap[elementHash]) {
            // console.debug(
            //   `Already processed ${elementHash} for ${moduleConfig.description}`
            // );
            return;
          }

          try {
            await notifyObject(bot, chatIds, formatter(element));
            moduleData.processedIdMap[elementHash] = Date.now();
          } catch (err) {
            console.error(
              `Error in sending chat: ${moduleConfig.description}`,
              err.message
            );
          }
        })
      );

      moduleData.cache = cache;
      moduleData.lastError = null;
    } catch (err) {
      console.error(`Error: ${moduleConfig.description}`, err.message);
      moduleData.lastError = err.message;
    } finally {
      moduleData.lastRunAt = Date.now();
      writeDataForModule(filePath, moduleData);
    }
  };
}

function main() {
  const { telegram, modules } = config;

  const bot = new TelegramBot(telegram.token, {
    polling: telegram.polling
  });

  bot.on("message", msg => console.log("New message", msg));

  modules.forEach(moduleConfig => {
    const { fetchInterval = 60 } = moduleConfig;
    const moduleExec = getModuleExecWrapper(bot, moduleConfig);

    moduleExec();
    setInterval(moduleExec, fetchInterval * 1000);
  });
}

main();
