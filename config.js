exports.port = process.env.PORT || 3000;
exports.enable_logging = true;
exports.proxy_request_timeout_ms = 10000; // The lenght of time we'll wait for a proxy server to respond before timing out.

exports.forwards = [
    {
        check  : /\/tif/,
        url    : "https://somedomain.com/tif/"
    },
    {
        check  : /^\/dev/,
        url    : "http://127.0.0.1:8888/dev"
    },{
        check  : /^\/app/,
        url    : "http://127.0.0.1:8080/dest/app"
    }
];
// http , https
exports.else_forward_url = "http://127.0.0.1:8080/dest";
