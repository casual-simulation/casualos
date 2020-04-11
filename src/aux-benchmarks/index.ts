import 'platform';
import Benchmark from 'benchmark';
import CausalTreeBenchmarks from '@casual-simulation/causal-trees/benchmarks';
import RuntimeBenchmarks from '@casual-simulation/aux-common/benchmarks';

run([...RuntimeBenchmarks]);

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
    if (b.error) {
        console.error(b.error);
    }
    return b.toString();
}
