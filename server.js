var http = require('http');
var https = require('https');
var config = require("./config");
var url = require("url");
var request = require("request");

http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;

var publicAddressFinder = require("public-address");
var publicIP;

// Get our public IP address
publicAddressFinder(function (err, data) {
    if (!err && data) {
        publicIP = data.address;
    }
});
function server_log(req,msg){
    if (config.enable_logging) {
        console.log("%s %s %s : %s", (new Date()).toJSON(), req.clientIP, req.method, req.url , msg);
    }
}

function addCORSHeaders(req, res) {
    if (req.method.toUpperCase() === "OPTIONS") {
        if (req.headers["access-control-request-headers"]) {
            res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"]);
        }

        if (req.headers["access-control-request-method"]) {
            res.setHeader("Access-Control-Allow-Methods", req.headers["access-control-request-method"]);
        }
    }

    if (req.headers["origin"]) {
        res.setHeader("Access-Control-Allow-Origin", req.headers["origin"]);
    }
    else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
}

function writeResponse(res, httpCode, body) {
    res.statusCode = httpCode;
    res.end(body);
}

function sendInvalidURLResponse(res) {
    return writeResponse(res, 404, "url must be in the form of /{some_url_here}");
}

// function sendTooBigResponse(res) {
//     return writeResponse(res, 413, "the content in the request or response cannot exceed " + config.max_request_length + " characters.");
// }

function getClientAddress(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
}

function processRequest(req, res) {
    addCORSHeaders(req, res);
    

    // Return options pre-flight requests right away
    if (req.method.toUpperCase() === "OPTIONS") {
        return writeResponse(res, 204);
    }

    var remoteURL = null;
    try {
        var matched = false;
        for (var i = 0 ;i < config.forwards.length;i++){
            var forwardConfig = config.forwards[i];
            if(forwardConfig.check.test(req.url)){
                server_log(req,"match forwards config ["+i+"]")
                
                matched = true;
                remoteURL = url.parse(decodeURI(forwardConfig.url + req.url.replace(forwardConfig.check,"")));
                server_log(req,forwardConfig.check+ "->" + decodeURI(forwardConfig.url + req.url.replace(forwardConfig.check,"")));
                break;
            }
        }
        if(matched == false){
            server_log(req,"forwards else config")
            remoteURL = url.parse(decodeURI(config.else_forward_url + req.url));
        }
    }catch (e) {
        return sendInvalidURLResponse(res);
    }

    // We don't support relative links
    if (!remoteURL.host) {
        return writeResponse(res, 404, "relative URLS are not supported");
    }
    // We only support http and https
    if (remoteURL.protocol != "http:" && remoteURL.protocol !== "https:") {
        return writeResponse(res, 400, "only http and https are supported");
    }

    if (publicIP) {
        // Add an X-Forwarded-For header
        if (req.headers["x-forwarded-for"]) {
            req.headers["x-forwarded-for"] += ", " + publicIP;
        }
        else {
            req.headers["x-forwarded-for"] = req.clientIP + ", " + publicIP;
        }
    }

    // Make sure the host header is to the URL we're requesting, not thingproxy
    if (req.headers["host"]) {
        req.headers["host"] = remoteURL.host;
    }

    var proxyRequest = request({
        url: remoteURL,
        headers: req.headers,
        method: req.method,
        timeout: config.proxy_request_timeout_ms,
        strictSSL: false
    });

    proxyRequest.on('error', function (err) {
        //@ts-ignore
        if (err.code === "ENOTFOUND") {
            return writeResponse(res, 502, "Host for " + url.format(remoteURL) + " cannot be found.")
        }
        else {
            server_log(req,"Proxy request Error:" + url.format(remoteURL));
            return writeResponse(res, 500);
        }

    });
    proxyRequest.on("end",function(err){
        // Log our request
        server_log(req,"Proxy request end");
    });

    var requestSize = 0;
    var proxyResponseSize = 0;

    req.pipe(proxyRequest).on('data', function (data) {
        requestSize += data.length;
    }).on('error', function(err){
        writeResponse(res, 500, "Stream Error");
    }).on("end",function(err){
        // Log our request
        server_log(req,"response end");
    });

    proxyRequest.pipe(res).on('data', function (data) {
        proxyResponseSize += data.length;
    }).on('error', function(err){
        writeResponse(res, 500, "Stream Error");
    });

}

http.createServer(function (req, res) {

    // Process AWS health checks
    if (req.url === "/health") {
        return writeResponse(res, 200);
    }
    var clientIP = getClientAddress(req);
    //@ts-ignore
    req.clientIP = clientIP;

    // Log our request
    server_log(req,"request");

    processRequest(req, res);
}).listen(config.port);

console.log("ls.requester process started (PID " + process.pid + ")");

