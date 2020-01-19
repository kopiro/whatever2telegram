# whatever2telegram

Allows forwarding whatever you want to a Telegram handle.

### Modules

Available options:

- `chatIds`: array of Telegram chat ids
- `fetchInterval`: how often (in seconds) data should be fetched
- `name`: name of the module
- `args`: arguments to pass to the modules
- `description`: unique identifier for this configuration

#### `facebook_page`

Facebook page posts.

- `pageId`: Facebook page-id
- `accessToken`: Extended access token

#### `json`

URL endpoint with JSON data formatting.

- `url`: URL to fetch
- `filter`: Filter function
- `attributes`: Map different attributes name

#### `rss`

URL endpoint with RSS data formatting.

- `url`: URL to fetch.
