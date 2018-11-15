
import * as express from 'express';
import * as path from 'path';

const app = express();
const port = 3000;

console.log(__dirname);
var a = path.resolve(__dirname, '..', '..', 'WebClient', 'dist');
console.log("path a: " + a);
app.use('/', express.static(a));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));