/* eslint-disable no-continue */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable no-restricted-syntax */
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const crypto = require("crypto");
const striptags = require("striptags");

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

function getModuleExecWrapper(bot, moduleConfig) {
  const { name = "noop", args = {}, chatIds } = moduleConfig;
  const filePath = getDataFileForModule(moduleConfig);

  return async () => {
    console.log(`Executing`, moduleConfig);

    const moduleData = readDataForModule(moduleConfig, filePath);
    moduleData.moduleConfig = moduleConfig;

    try {
      const moduleExec = require(`./modules/${name}`);
      const { cache, elements } = await moduleExec.fetch(
        args,
        moduleData.cache,
        moduleConfig.formatter
      );

      moduleData.cache = cache;

      for (const element of elements) {
        const elementHash = getElementHash(element);
        // if (moduleData.processedIdMap[elementHash]) {
        //   continue;
        // }

        try {
          const { message, photo, url } = element;

          chatIds.forEach(chatId => {
            if (photo) {
              const maxMessageLength = 1024 - 24 - url.length;
              const fullMessage = [
                message.length > maxMessageLength
                  ? `${message.substr(0, maxMessageLength)}...`
                  : message,
                url
              ]
                .filter(e => e)
                .join("\n\n");
              bot.sendPhoto(chatId, photo, {
                caption: striptags(fullMessage),
                parse_mode: "html"
              });
            } else {
              const fullMessage = [message, url].filter(e => e).join("\n\n");
              bot.sendMessage(chatId, striptags(fullMessage), {
                parse_mode: "html"
              });
            }
          });

          moduleData.processedIdMap[elementHash] = Date.now();
        } catch (err) {
          console.error(moduleConfig, err);
        }
      }
      moduleData.lastError = null;
    } catch (err) {
      console.error(moduleConfig, err);
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
