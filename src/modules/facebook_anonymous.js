/*
Facebook module
*/
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36",
  cookie:
    "datr=FwoWXrk8Ix4NwRYNLnZj7M8t; sb=4BcWXmc6mBJbj7KqScWwj2of; m_pixel_ratio=1; wd=1124x1098; noscript=1; fr=1tSJ9NgxO8sdRlSy5..BeFgof.R6.AAA.0.0.BeFhq0.AWXAFGrb"
};

exports.fetch = async args => {
  const { pageId } = args;
  const page = await axios({
    url: `https://facebook.com/${pageId}/?_fb_noscript=1`,
    headers: {
      ...BASE_HEADERS
    }
  });
  const $page = cheerio.load(page.data);
  const $posts = $page(".userContentWrapper");

  return Array(1 || $posts.length)
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

  //   return Promise.all(
  //     posts.map(async post => {
  //       //   const postPage = await axios({
  //       //     url: postLink,
  //       //     headers: {
  //       //       ...BASE_HEADERS
  //       //     }
  //       //   });
  //       // const $postPage = cheerio.load(postPage.data);
  //       //   const message = $postPage('[data-testid="post_message"]').text();
  //       //   const photo = $postPage("img.scaledImageFitWidth.img").attr("src");

  //       return post;
  //     })
};
