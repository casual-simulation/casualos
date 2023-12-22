import fs from 'fs';

const packagePath = process.argv[2];

const file = fs.readFileSync(packagePath, { encoding: 'utf-8' });

let json = JSON.parse(file);

delete json['devDependencies'];

fs.writeFileSync(packagePath, JSON.stringify(json, undefined, 2), {
    encoding: 'utf-8',
});
