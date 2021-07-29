import express, { Response, NextFunction } from 'express';
import path from 'path';

let app = express();

app.use(express.static(path.resolve(__dirname, '..', 'web', 'dist')));

app.listen(3002, () => {
    console.log('[AuxAuth] Listening on port 3002');
});
