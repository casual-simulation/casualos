import express, { Response, NextFunction } from 'express';
import path from 'path';

let app = express();

const dist = path.resolve(__dirname, '..', '..', 'web', 'dist');

app.use(express.static(dist));

app.get('*', (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
});

app.listen(3002, () => {
    console.log('[AuxAuth] Listening on port 3002');
});
