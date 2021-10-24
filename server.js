const fs = require('fs')
const http = require('http');


const host = 'localhost';
const port = 8000;

const requestListener = (req, res) => {
    if (req.url === '/get' && req.method === 'GET') {
        try {
            const files = fs.readdirSync('./files');
            res.writeHead(200);
            res.end(files.join(', '));
            return;

        } catch (e) {
            res.writeHead(500);
            res.end('Internal server error');
            return;
        }
    };


    if (req.url === '/post' && req.method === 'POST') {
        res.writeHead(200);
        res.end('success');
        return;
    }

    if (req.url === '/delete' && req.method === 'DELETE') {
        res.writeHead(200);
        res.end('success');
        return;
    }

    if (req.url === '/redirect' && req.method === 'GET') {
        res.writeHead(301, {
            'location': '/redirected',
        });
        res.end('ресурс теперь постоянно доступен по адресу /redirected');
        return;
    }

    res.writeHead(405);
    res.end('HTTP method not allowed')
}


const server = http.createServer(requestListener);

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});