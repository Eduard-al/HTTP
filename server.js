const fs = require("fs");
const http = require("http");

const { STATUS_CODES } = require("http");
const mokuser = {
    id: 123,
    name: "testuser",
    password: "qwerty",
};
const testDirname = "./files/";

const requestListener = (request, response) => {
    const filenamesSeparator = ", ";
    const { url, method } = request;
    const cookies = parseCookies(request.headers.cookie);

    if (method === "GET") {
        if (url === "/get") {
            try {
                const payload = fs.readdirSync(testDirname).join(filenamesSeparator);
                return sendResponse(response, 200, payload);
            } catch {
                return sendResponse(response, 500);
            }
        }
        if (url === "/redirect") {
            response.setHeader("Location", "/redirected");
            return sendResponse(response, 301);
        }
        if (url === "/redirected") {
            return sendResponse(response, 200);
        }
        return sendResponse(response, 404);
    }

    if (method === "DELETE") {
        if (url === "/delete") {
            request.noDataRecievedOnPost = true;
            request.setEncoding("utf8");
            request.on("data", (postData) => {
                const { url } = request;
                request.noDataRecievedOnPost = false;
                if (url === "/delete") {
                    if (isAuthorized(cookies)) {
                        const { filename } = JSON.parse(postData);
                        require("fs").unlink(testDirname + filename, (err) => {
                            if (err) {
                                return sendResponse(response, 500);
                            }
                            return sendResponse(response, 200);
                        });
                    } else {
                        return sendResponse(response, 401);
                    }
                }
            });
            request.on("end", () => {
                if (request.noDataRecievedOnPost) {
                    return sendResponse(response, 500);
                }
            });
        } else {
            return sendResponse(response, 404);
        }
    }

    if (method === "POST") {
        if (url === "/post" || url === "/auth") {
            request.noDataRecievedOnPost = true;
            request.setEncoding("utf8");
            request.on("data", (postData) => {
                const { url } = request;
                request.noDataRecievedOnPost = false;
                if (url === "/auth") {
                    const { username, password } = JSON.parse(postData);
                    if (username === mokuser.name && password === mokuser.password) {
                        response.setHeader("Set-Cookie", [
                            `userId=${mokuser.id}`,
                            `authorized=true`,
                            `expires=${new Date(
                                new Date().getTime() + 60 * 60 * 24 * 2
                            ).toUTCString()}`,
                        ]);
                        return sendResponse(response, 200);
                    } else {
                        return sendResponse(
                            response,
                            401,
                            "Invalid credentials"
                        );
                    }
                }
                if (url === "/post") {
                    if (isAuthorized(cookies)) {
                        const { filename, content } = JSON.parse(postData);
                        require("fs").writeFile(testDirname + filename, content, () =>
                            sendResponse(response, 200)
                        );
                    } else {
                        return sendResponse(response, 401);
                    }
                }
            });
            request.on("end", () => {
                if (request.noDataRecievedOnPost) {
                    return sendResponse(response, 500);
                }
            });
        } else {
            return sendResponse(response, 404);
        }
    }
};

function isAuthorized(cookies) {
    return cookies.authorized === "true" && +cookies.userId === mokuser.id;
}

function parseCookies(cookies = "") {
    return cookies.split(";").reduce((obj, str) => {
        const [key, value] = str.split("=");
        obj[key] = value;
        return obj;
    }, {});
}

function sendResponse(response, response_code, payload) {
    payload = payload || STATUS_CODES[response_code];
    response.writeHead(response_code).end(payload);
}

function init(port, host, requestListener) {
    http.createServer(requestListener).listen(port, host, () => {
        console.log(`Server is running on http://${host}:${port}`);
        runTests(port, host);
    });
}

function runTests(port, host) {
    const options = { port, host };
    const validAuthCookie = [
        `userId=${mokuser.id}`,
        `authorized=true`,
        `expires=${new Date(
            new Date().getTime() + 60 * 60 * 24 * 2
        ).toUTCString()}`,
    ].join(";");
    const inValidAuthCookie = [
        `userId=${mokuser.id}`,
        `authorized=false`,
        `expires=${new Date(
            new Date().getTime() + 60 * 60 * 24 * 2
        ).toUTCString()}`,
    ].join(";");
    const validCredentials = JSON.stringify({
        username: "testuser",
        password: "qwerty",
    });
    const inValidCredentials = JSON.stringify({
        username: "testuser",
        password: "qwert1",
    });
    let payload = inValidCredentials;
    makeTestRequest(
        {
            ...options,
            method: "POST",
            path: "/auth",
        },
        payload
    );
    payload = validCredentials;
    makeTestRequest({ ...options, method: "POST", path: "/auth" }, payload);
    makeTestRequest({ ...options, method: "GET", path: "/" });
    payload = JSON.stringify({
        filename: "post+get+failed.txt",
        content: "post+get+failed-content.txt",
    });
    makeTestRequest(
        {
            ...options,
            method: "POST",
            path: "/get",
            headers: {
                Cookie: validAuthCookie,
            },
        },
        payload
    );
    payload = JSON.stringify({
        filename: "post+post+success.txt",
        content: "post+post+success-content.txt",
    });
    makeTestRequest(
        {
            ...options,
            method: "POST",
            path: "/post",
            headers: {
                Cookie: validAuthCookie,
            },
        },
        payload
    );
    payload = JSON.stringify({
        filename: "post+post+failed.txt",
        content: "post+post+failed-content.txt",
    });
    makeTestRequest(
        {
            ...options,
            method: "POST",
            path: "/post",
            headers: {
                Cookie: inValidAuthCookie,
            },
        },
        payload
    );
    makeTestRequest({ ...options, method: "DELETE", path: "/delete" });
    makeTestRequest({ ...options, method: "GET", path: "/delete" });
    makeTestRequest({ ...options, method: "DELETE", path: "/redirect" });
    makeTestRequest({ ...options, method: "GET", path: "/get" });
    payload = JSON.stringify({
        filename: "post+post+success.txt",
    });
    makeTestRequest(
        {
            ...options,
            method: "DELETE",
            path: "/delete",
            headers: {
                Cookie: validAuthCookie,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        },
        payload
    );
    makeTestRequest({ ...options, method: "GET", path: "/redirect" });

    function makeTestRequest(options, postData) {
        let data = [];
        const request = http.request(options, (res) => {
            res.on("data", (chunk) => data.push(chunk));
            res.on("end", () =>
                console.log(
                    options.method,
                    options.path,
                    res.statusCode,
                    Buffer.concat(data).toString()
                )
            );
        });
        request.on("error", (err) => console.error(err.message));
        request.write(postData || "");
        request.end();
    }
}

init(8000, "localhost", requestListener);