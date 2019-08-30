import 'platform';
import Benchmark from 'benchmark';
import AuxCommonBenchmarks from '@casual-simulation/aux-common/benchmarks';
import CausalTreeBenchmarks from '@casual-simulation/causal-trees/benchmarks';
import fs from 'fs';
import path from 'path';
const profiler = require('v8-profiler');

run([...CausalTreeBenchmarks, ...AuxCommonBenchmarks]);

async function run(benchmarks: Benchmark.Suite[]) {
    const shouldProfile = process.argv.some(a => a === '--profile');
    const id = 'bench-profile.json';

    if (shouldProfile) {
        console.log('Profiling...');
        profiler.startProfiling(id);
    }

    for (let bench of benchmarks) {
        bench
            .on('complete', () => {
                console.log(`${formatSuite(bench)}`);
                for (let t of bench.map(formatBenchmark)) {
                    console.log(`- ${t}`);
                }
            })
            .run({ async: true });
    }

    if (shouldProfile) {
        const profile = profiler.stopProfiling(id);
        fs.writeFile(path.join(__dirname, id), profile, () => {
            process.exit();
        });
    }
}

function formatSuite(suite: Benchmark.Suite) {
    return (<any>suite).name;
}

function formatBenchmark(b: Benchmark) {
    return b.toString();
}
