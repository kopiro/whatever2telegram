const { FB } = require("fb");

exports.fetch = ({ pageId, accessToken }) =>
  new Promise((resolve, reject) => {
    FB.setAccessToken(accessToken);
    FB.api(
      `/${pageId}/feed?fields=full_picture,message,permalink_url&limit=10`,
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
