MultiProxyServer
==========

In some case,a local server would be setup for developing,but sometime remote server APIs can't be called successfully due to 

1. CROS header is not set

2. http/https mismatch

3. remote server may ask for cookies to be set.(which is CROS too)


## what we do

A multi proxy server that can make several servers in each different domain act as a single server.

It forwards request for processing API calls to servers that don't send CORS headers or support HTTPS.

## install

```sh
npm install multi-proxy-server
```

## Notice

1. Dont support `https` yet
2. We suggest this is only be used in develop mode.Don't use as a production.

## how to set

### Edit `config.js`

exapmle:
```js
// Listen port
exports.port = process.env.PORT || 3000;
// Log request message into console
exports.enable_logging = true;
// The lenght of time we'll wait for a proxy server to respond before timing out.
exports.proxy_request_timeout_ms = 10000; 
// Forwarding settings
//Check if the url to be forward is match the pattern "check",if so forward it to "url".
exports.forwards = [
    {
        check  : /^\/tif/,
        url    : "https://somedomain.com/tif"
    },
    {
        check  : /^\/dev/,
        url    : "http://127.0.0.1:8888/dev"
    },{
        check  : /^\/app/,
        url    : "http://127.0.0.1:8080/dest/app"
    }
];
// If none of the "forwards" is matched,this become the forwarding address.
// http , https
exports.else_forward_url = "http://127.0.0.1:8080/dest";
```
This config setting will listen to `port 3000`.

When request url `http://127.0.0.1:3000/tif/api/getFoo` was send.`multi-proxy-server` will forward it to `https://somedomain.com/tif/api/getFoo`,which is defined in `config.js`, and add CROS headers.

### notice
The way we determin forwarding url.

1. The url_path of `http://127.0.0.1:3000/tif/api/getFoo` is `"/tif/api/getFoo"`
2. remove macthed pattern `^/tif` in url_path
3. the rest part is `"/api/getFoo"`
4. append rest path to `"forwards.url"`
5. it become `https://somedomain.com/tif/api/getFoo`


## thanks for
This proxy server is based on `thingproxy`,and many modification was made to fit and get new features.
