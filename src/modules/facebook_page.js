const { FB } = require("fb");

exports.fetch = ({ pageId, accessToken, limit = 1 }) =>
  new Promise((resolve, reject) => {
    FB.setAccessToken(accessToken);
    FB.api(
      `/${pageId}/feed?fields=full_picture,message,permalink_url&limit=${limit}`,
      res => {
        if (!res || res.error) {
          reject(res.error);
          return;
        }
        resolve({
          elements: res.data.map(e => {
            return {
              hash: e.id,
              message: e.message,
              photo: e.full_picture,
              url: e.permalink_url
            };
          })
        });
      }
    );
  });
