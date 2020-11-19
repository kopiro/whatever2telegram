const path = require("path");
const puppeteer = require("puppeteer-extra");
const fs = require("fs");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const pkg = require("./package.json");

const { DATA_DIR } = require("../../constants");

const VISUAL_DATA_DIR = path.join(DATA_DIR, `visual`);

// add stealth plugin and use defaults (all evasion techniques)

puppeteer.use(StealthPlugin());

const VIEWPORT = { width: 1280, height: 1600 };

async function checkUpdates(screenshotPath, browser, name, url, selector, clickSelector) {
  const fullScreenshot = path.join(screenshotPath, `${name}-full.png`);
  const oldScreenshot = path.join(screenshotPath, `${name}-old.png`);
  const newScreenshot = path.join(screenshotPath, `${name}-new.png`);
  const diffScreenshot = path.join(screenshotPath, `${name}-diff.png`);

  const page = await browser.newPage();
  page.setViewport(VIEWPORT);

  console.debug(pkg.name, `Loading ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
  } catch (err) {
    console.error(pkg.name, `Failed to check ${name}: ${err.message}`);
    return null;
  }

  if (clickSelector) {
    try {
      await page.click(clickSelector);
    } catch (err) {
      console.warn(pkg.name, `Unable to click ${clickSelector} on ${name}: ${err.message}`);
    }
  }

  await page.screenshot({ path: fullScreenshot });

  if (selector) {
    try {
      const element = await page.$(selector);
      await element.screenshot({ path: newScreenshot });
    } catch (err) {
      fs.copyFileSync(fullScreenshot, newScreenshot);
    }
  } else {
    fs.copyFileSync(fullScreenshot, newScreenshot);
  }

  // include Date.now in the hash to make sure this element is always processed
  // (we don't rely on diff mechanism of the base software)
  const hash = `${url}/${Date.now()}`;

  try {
    if (fs.existsSync(oldScreenshot)) {
      const oldImg = PNG.sync.read(fs.readFileSync(oldScreenshot));
      const newImg = PNG.sync.read(fs.readFileSync(newScreenshot));

      if (oldImg.width === newImg.width && oldImg.height === newImg.height) {
        const diff = new PNG({ width: oldImg.width, height: oldImg.height });
        const pixelDiff = pixelmatch(oldImg.data, newImg.data, diff.data, oldImg.width, oldImg.height, {
          threshold: 0.1,
        });

        if (pixelDiff > 0) {
          const caption = `This section of the URL (${url}) changed since last time`;
          fs.writeFileSync(diffScreenshot, PNG.sync.write(diff));
          return {
            hash,
            caption,
            photo: fs.createReadStream(diffScreenshot),
          };
        }
      }

      console.debug(pkg.name, `The URL ${url} didn't changed`);
      return null;
    }

    const caption = `This is the first time checking the URL (${url}) and this is the inspected section`;
    return {
      hash,
      caption,
      photo: fs.createReadStream(newScreenshot),
    };
  } finally {
    fs.copyFileSync(newScreenshot, oldScreenshot);
    fs.unlinkSync(fullScreenshot);
  }
}

exports.fetch = async ({ screenshotDirName, sites }) => {
  const screenshotPath = path.join(VISUAL_DATA_DIR, screenshotDirName);
  fs.mkdirSync(screenshotPath, { recursive: true });

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const data = (
      await Promise.allSettled(
        sites.map(site =>
          checkUpdates(screenshotPath, browser, site.name, site.url, site.element_selector, site.click_selector),
        ),
      )
    ).map(e => e.value);
    return {
      elements: data,
    };
  } finally {
    console.debug(pkg.name, "Closing browser");
    browser.close();
  }
};
