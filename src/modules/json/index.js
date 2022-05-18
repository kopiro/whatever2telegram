const axios = require("axios");
const { baseHTTPHeaders } = require("../../constants");

exports.fetch = async ({ url, headers = {}, mapper = (e) => (e) }, cache = {}) => {
  const finalHeaders = {
    ...baseHTTPHeaders,
    ...headers,
    ...(cache.etag ? { "if-none-match": cache.etag } : {}),
  };
  const response = await axios({
    url,
    responseType: "json",
    headers: finalHeaders,
    validateStatus: status => status < 400,
  });

  return {
    elements: mapper(response.data),
  };
};
