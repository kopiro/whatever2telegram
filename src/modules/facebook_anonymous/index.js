const puppeteer = require("puppeteer");
const path = require("path");
const config = require("../../../config/config");

const DESKTOP_DOMAIN = "https://www.facebook.com";
const MOBILE_DOMAIN = "https://m.facebook.com";

const passSecurityCheck = ({ pageId }, $page, bot) => {
  return new Promise(async resolve => {
    const SCREENSHOT_FILE_PATH = path.join("/tmp", `${pageId}.jpg`);

    if (!/security/i.test(await $page.title())) {
      resolve();
      return;
    }

    await $page.goto(`${MOBILE_DOMAIN}/${pageId}`, {
      waitUntil: "networkidle2",
    });

    console.log("Security check required");
    await $page.screenshot({ path: SCREENSHOT_FILE_PATH });

    let sentObject;
    bot.whenMessage(async msg => {
      if (msg.reply_to_message.message_id === sentObject.message_id) {
        await $page.$eval(
          ".captcha_input input",
          (el, _text) => {
            // eslint-disable-next-line no-param-reassign
            el.value = _text;
          },
          msg.text,
        );
        await $page.$eval("form", el => {
          el.submit();
        });
        await $page.waitForNavigation({ waitUntil: "networkidle2" });
        await $page.goto(`${DESKTOP_DOMAIN}/${pageId}`, {
          waitUntil: "networkidle2",
        });
        resolve();
      }
    });

    sentObject = await bot.sendPhoto(config.debugChatId, SCREENSHOT_FILE_PATH);
  });
};

exports.fetch = async (args, cache = {}, bot) => {
  let browser;

  try {
    const { pageId } = args;

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    const $page = await browser.newPage();

    if (cache.cookies) {
      await $page.setCookie(...cache.cookies);
    }

    await $page.goto(`https://www.facebook.com/${pageId}`, {
      waitUntil: "networkidle2",
    });

    await passSecurityCheck(args, $page, bot);

    const $post = await $page.waitForSelector(".userContentWrapper", {
      timeout: 2000,
    });

    const cookies = await $page.cookies();

    const message = await $post.$eval('[data-testid="post_message"] p', el => el.innerText);
    const photo = await $post.$eval("img.scaledImageFitWidth", el => el.src);

    let url;
    try {
      const seeMoreHref = await $post.$eval(`[data-testid="post_message"] a`, el => el.href);

      if (seeMoreHref) {
        const urlInstance = new URL(seeMoreHref);
        const id = urlInstance.searchParams.get("story_fbid");
        const pageIdNum = urlInstance.searchParams.get("id");
        url = `https://www.facebook.com/${pageIdNum}/posts/${id}`;
      }
    } catch (err) {}

    return {
      elements: [{ message, url, photo }],
      cache: {
        cookies,
      },
    };
  } finally {
    await browser.close();
  }
};
