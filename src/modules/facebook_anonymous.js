/*
Facebook module
*/
const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const path = require("path");
const { baseHTTPHeaders } = require("../constants");
const config = require("../../data/config");

const DESKTOP_DOMAIN = "https://www.facebook.com";
const MOBILE_DOMAIN = "https://m.facebook.com";

const moduleBaseHTTPHeaders = {
  ...baseHTTPHeaders
};

const passSecurityCheck = ({ pageId }, $page, bot) => {
  return new Promise(async resolve => {
    const SCREENSHOT_FILE_PATH = path.join("/tmp", `${pageId}.jpg`);

    if (!/security/i.test(await $page.title())) {
      resolve();
      return;
    }

    await $page.goto(`${MOBILE_DOMAIN}/${pageId}`, {
      waitUntil: "networkidle2"
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
          msg.text
        );
        await $page.$eval("form", el => {
          el.submit();
        });
        await $page.waitForNavigation({ waitUntil: "networkidle2" });
        await $page.goto(`${DESKTOP_DOMAIN}/${pageId}`, {
          waitUntil: "networkidle2"
        });
        resolve();
      }
    });

    sentObject = await bot.sendPhoto(config.debugChatId, SCREENSHOT_FILE_PATH);
  });
};

exports.fetchWithChrome = async (args, cache = {}, bot) => {
  const { pageId } = args;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"]
  });
  const $page = await browser.newPage();

  if (cache.cookies) {
    await $page.setCookie(...cache.cookies);
  }

  await $page.goto(`https://www.facebook.com/${pageId}`, {
    waitUntil: "networkidle2"
  });

  await passSecurityCheck(args, $page, bot);

  const $post = await $page.waitForSelector(".userContentWrapper", {
    timeout: 2000
  });

  const cookies = await $page.cookies();

  const message = await $post.$eval(
    '[data-testid="post_message"] p',
    el => el.innerText
  );
  const photo = await $post.$eval("img.scaledImageFitWidth", el => el.src);
  const seeMoreHref = await $post.$eval(".see_more_link", el => el.href);

  let url;
  if (seeMoreHref) {
    console.log("seeMoreHref", seeMoreHref);
    const urlInstance = new URL(seeMoreHref);
    const id = urlInstance.searchParams.get("story_fbid");
    const pageIdNum = urlInstance.searchParams.get("id");
    url = `https://www.facebook.com/${pageIdNum}/posts/${id}`;
  }

  return {
    elements: [{ message, url, photo }],
    cache: {
      cookies
    }
  };
};

exports.fetch = exports.fetchWithChrome;

exports.fetchWithCURL = async ({ pageId }) => {
  const page = await axios({
    url: `${DESKTOP_DOMAIN}/${pageId}/?_fb_noscript=1`,
    headers: {
      ...moduleBaseHTTPHeaders
    }
  });
  const $page = cheerio.load(page.data);
  const $posts = $page(".userContentWrapper");

  const posts = Array(1 || $posts.length)
    .fill()
    .map((_, i) => {
      const $postPage = cheerio.load($posts[i]);

      const seeMoreHref = $postPage(".see_more_link").attr("href");

      let url;
      if (seeMoreHref) {
        const seeMoreLink = `https://facebook.com${seeMoreHref}`;
        const urlInstance = new URL(seeMoreLink);
        const id = urlInstance.searchParams.get("story_fbid");
        const pageIdNum = urlInstance.searchParams.get("id");
        url = `https://www.facebook.com/${pageIdNum}/posts/${id}`;
      }

      const message = $postPage('[data-testid="post_message"]').text();
      const photo = $postPage("img.scaledImageFitWidth.img").attr("src");

      return {
        message,
        photo,
        url
      };
    });

  return {
    elements: posts
  };
};
