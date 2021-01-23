# whatever2telegram

Allows forwarding whatever you want to a Telegram handle (chat, group or channel).

Every module is built in a way that its job is just to fetch data, without caring of sending the actual messages, excluding previous data or data formatting.

The list of elements are configured in the `./data/config.js` file

Top-level options are:

- `env`: environment string
- `sentryDsn`: DNS used for Sentry error reporting
- `telegram`:
  - `token`: token of your bot
  - `polling`: enable polling to fetch data
- `doNotDisturb`:
  - `min`: hour of the day (24h) before which modules are not called
  - `max`: hour of the day (24h) after which modules are not called

Example configuration:

```js
module.exports = {
  env: "prod",
  sentryDsn: "",
  telegram: {
    token: "",
  },
  doNotDisturb: {
    min: 7,
    max: 23,
  },
  modules: [
    {
      description: "MyRSS",
      chatIds: ["@MyRSS"],
      name: "rss",
      args: {
        url: "https://yourwebsite.com/rss",
      },
      fetchInterval: 60 * 10,
    },
    {
      description: "MyJSON",
      chatIds: ["@MyJSON"],
      name: "json",
      args: {
        attributes: [
          "event_name",
          "display_time_start",
          "display_time_end",
          "event_description",
          "event_image",
          "link",
          "registration_open",
        ],
        filter: e => !/^(NYC|LDN)/.test(e.event_name),
      },
      formatters: [
        e => {
          const message = `<b>${e.event_name}</b>
from <i>${new Date(e.display_time_start).toGMTString()}</i>
to <i>${new Date(e.display_time_end).toGMTString()}</i>

${decodeURIComponent(e.event_description.output.html)}`;
          return {
            message,
            photo: e.event_image,
            url: `https://mywebsite.com/${e.link}`,
          };
        },
      ],
      fetchInterval: 60,
    },
  ],
};
```

### Modules

A module is an encapsulated piece of logic to grab data from a source.

Available options to every module:

- `chatIds`: array of Telegram chat ids
- `fetchInterval`: how often (in seconds) data should be fetched
- `name`: name of the module
- `args`: arguments to pass to the modules
- `description`: unique identifier for this configuration
- `filter`: filter function that could filter data before being sent
- `attributes`: filter function for attributes, too minimize payload and diffs
- `formatters`: list of _formatters_ to apply in sequence

#### `facebook_page`

Facebook page posts.

- `pageId`: Facebook page-id
- `accessToken`: Extended access token

#### `json`

URL endpoint with JSON data formatting.

- `url`: URL to fetch

#### `rss`

URL endpoint with RSS data formatting.

- `url`: URL to fetch

#### `visual`

URL endpoint and checks a visual diff of a specific DOM element

- `url`: URL to fetch
- `element_selector?`: DOM selector that will be visuall diffed
- `click_selector?`: DOM selector to click before taking screenshot

## Formatters

A formatter is a function that receives your output before being sent to be able to manipulate it.

You can define a formatter with:

- a string (the name of formatter)
- an object like `{ "name": "__NAME__", "options": {} }`
- a custom JS function

Available formatters:

### `translate`

Translate the input message.

- `mode`: `replace`, `append` or `prepend`
- `toLanguage`: language to translate to, default: `en`
