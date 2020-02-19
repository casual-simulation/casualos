import 'platform';
import Benchmark from 'benchmark';
import CausalTreeBenchmarks from '@casual-simulation/causal-trees/benchmarks';

run([...CausalTreeBenchmarks]);

async function run(benchmarks: Benchmark.Suite[]) {
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
}

function formatSuite(suite: Benchmark.Suite) {
    return (<any>suite).name;
}

function formatBenchmark(b: Benchmark) {
    return b.toString();
}
