/* eslint-disable no-continue */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable no-restricted-syntax */
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `config.json`)));

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

    const previousData = readDataForModule(moduleConfig, filePath);
    previousData.moduleConfig = moduleConfig;

    try {
      const moduleExec = require(`./modules/${name}`);

      const nextElements = await moduleExec.fetch(args);

      for (const element of nextElements) {
        const elementHash = getElementHash(element);
        if (previousData.processedIdMap[elementHash]) {
          continue;
        }

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
                caption: fullMessage
              });
            } else {
              const fullMessage = [message, url].filter(e => e).join("\n\n");
              bot.sendMessage(chatId, fullMessage);
            }
          });

          previousData.processedIdMap[elementHash] = Date.now();
        } catch (err) {
          console.error(err);
        }
      }
      previousData.lastError = null;
    } catch (err) {
      console.error(err);
      previousData.lastError = err.message;
    } finally {
      previousData.lastRunAt = Date.now();
      writeDataForModule(filePath, previousData);
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
