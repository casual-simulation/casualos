export interface AwsKeyspacesRegion {
    name: string;
    region: string;
    endpoint: string;
    port: number;
}

export const AWS_KEYSPACES_REGIONS = [
    {
        name: 'US East (N. Virginia)',
        region: 'us-east-1',
        endpoint: 'cassandra.us-east-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'US East (Ohio)',
        region: 'us-east-2',
        endpoint: 'cassandra.us-east-2.amazonaws.com',
        port: 9142,
    },
    {
        name: 'US West (N. California)',
        region: 'us-west-1',
        endpoint: 'cassandra.us-west-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'US West (Oregon)',
        region: 'us-west-2',
        endpoint: 'cassandra.us-west-2.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Canada (Central)',
        region: 'ca-central-1',
        endpoint: 'cassandra.ca-central-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'South America (São Paulo)',
        region: 'sa-east-1',
        endpoint: 'cassandra.sa-east-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Europe (Stockholm)',
        region: 'eu-north-1',
        endpoint: 'cassandra.eu-north-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Europe (Ireland)',
        region: 'eu-west-1',
        endpoint: 'cassandra.eu-west-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Europe (London)',
        region: 'eu-west-2',
        endpoint: 'cassandra.eu-west-2.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Europe (Paris)',
        region: 'eu-west-3',
        endpoint: 'cassandra.eu-west-3.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Europe (Frankfurt)',
        region: 'eu-central-1',
        endpoint: 'cassandra.eu-central-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Middle East (Bahrain)',
        region: 'me-south-1',
        endpoint: 'cassandra.me-south-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Mumbai)',
        region: 'ap-south-1',
        endpoint: 'cassandra.ap-south-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Hong Kong)',
        region: 'ap-east-1',
        endpoint: 'cassandra.ap-east-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Tokyo)',
        region: 'ap-northeast-1',
        endpoint: 'cassandra.ap-northeast-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Seoul)',
        region: 'ap-northeast-2',
        endpoint: 'cassandra.ap-northeast-2.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Singapore)',
        region: 'ap-southeast-1',
        endpoint: 'cassandra.ap-southeast-1.amazonaws.com',
        port: 9142,
    },
    {
        name: 'Asia Pacific (Sydney)',
        region: 'ap-southeast-2',
        endpoint: 'cassandra.ap-southeast-2.amazonaws.com',
        port: 9142,
    },
] as AwsKeyspacesRegion[];

export const AWS_KEYSPACES_REGION_MAP = new Map(
    AWS_KEYSPACES_REGIONS.map(r => [r.name, r])
);
