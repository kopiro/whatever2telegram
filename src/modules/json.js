const axios = require("axios");
const { baseHTTPHeaders } = require("../constants");

exports.fetch = async ({ url, headers, attributes, filter }, cache = {}) => {
  const finalHeaders = {
    ...baseHTTPHeaders,
    ...headers,
    ...(cache.etag ? { "if-none-match": cache.etag } : {})
  };
  const response = await axios({
    url,
    responseType: "json",
    headers: finalHeaders,
    validateStatus: status => status < 400
  });
  let { data } = response;
  if (typeof data !== "object") data = [];
  if (filter) {
    data = data.filter(filter);
  }
  if (attributes) {
    data = data.map(e =>
      attributes.reduce((carry, attr) => {
        return { ...carry, ...{ [attr]: e[attr] } };
      }, {})
    );
  }

  return {
    elements: data,
    cache: {
      // etag: response.headers.etag
    }
  };
};
