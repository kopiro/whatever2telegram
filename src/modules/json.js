const axios = require("axios");
const { baseHTTPHeaders } = require("../constants");

const moduleBaseHTTPHeaders = {
  ...baseHTTPHeaders,
  cookie:
    "datr=FwoWXrk8Ix4NwRYNLnZj7M8t; sb=4BcWXmc6mBJbj7KqScWwj2of; m_pixel_ratio=1; wd=1124x1098; noscript=1; fr=1tSJ9NgxO8sdRlSy5..BeFgof.R6.AAA.0.0.BeFhq0.AWXAFGrb"
};

exports.fetch = async ({ url, headers }, cache = {}, formatter = e => e) => {
  const finalHeaders = {
    ...moduleBaseHTTPHeaders,
    "content-type": "application/json",
    ...headers,
    ...(!cache.etag ? { "if-none-match": cache.etag } : {})
  };
  const response = await axios({
    url,
    responseType: "json",
    headers: finalHeaders
  });

  return {
    cache: {
      etag: response.headers.etag
    },
    elements: response.data.map(formatter)
  };
};
