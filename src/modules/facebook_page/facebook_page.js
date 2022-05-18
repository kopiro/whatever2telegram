const { FB } = require("fb");

exports.fetch = ({ pageId, accessToken, limit = 1 }) =>
  new Promise((resolve, reject) => {
    FB.setAccessToken(accessToken);
    FB.api(`/${pageId}/feed?fields=full_picture,message,permalink_url&limit=${limit}`, res => {
      if (!res || res.error) {
        reject(res.error);
        return;
      }
      resolve({
        data: res.data.map(e => {
          return {
            hash: e.id,
            // Include the URL in the message to disable previews, as Facebook will show the Login page for metatags anyway
            message: `${e.message}\n${e.permalink_url}`,
            photo: e.full_picture,
          };
        }),
      });
    });
  });
