
import * as express from 'express';
import * as path from 'path';
import * as httpProxy from 'http-proxy';

const app = express();
const port = 3000;
const proxy = httpProxy.createProxyServer({

});

console.log(__dirname);
var a = path.resolve(__dirname, '..', '..', 'WebClient', 'dist');
console.log("path a: " + a);

app.use('/git', (req, res) => {
    proxy.web(req, res, {
        target: 'http://localhost:4330/git'
    });
});
app.use('/', express.static(a));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));