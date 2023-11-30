# AWS Setup

To get started with hosting a serverless implementation of CasualOS, follow the instructions in this document.

## Prerequisites

-   An [AWS Account](https://aws.amazon.com/).

## Build and deploy

To deploy this project to AWS Lambda, follow these steps:

1. Create three S3 Buckets:
    - Create three S3 buckets with default options. One for the player website files, another for the auth website files, and the last for lambda code. (AWS Console -> S3 -> Create bucket)
    - Remember the bucket names.
2. Setup two CloudFront Distributions for the S3 buckets.
    - Create two distributions that reference two of the S3 buckets you created above. (AWS Console -> CloudFront -> Create distribution)
    - One distribution will be in charge of serving files for the player, and the other for the auth site. So, one should reference the player website files bucket and the other the auth website files.
    - For "Origin domain", choose the S3 buckets that you created above. (One per distribution)
    - Configure "Origin access" so that CloudFront has access to the bucket. (Choose an option - it's not particularly important for the bucket to be private, but it may be nice to have to prevent abuse)
    - Configure the default cache behavior to "Redirect HTTP to HTTPS" and use the "CachingOptimized" policy.
    - Configure each distrubution to return `/index.html` when a HTTP `403` error code occurs.
    - Remember the IDs of the distributions.
3. Setup a CockroachDB database.
    - You can do this either through the [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-3zbkzekdohwly?ref_=unifiedsearch) or the [Cockroach Labs website](https://www.cockroachlabs.com/).
    - We recommend starting with their free option.
    - Create a database and then write down the connection string for that database.
4. Setup a CodeBuild pipeline.
    1. Setup `https://github.com/casual-simulation/casualos` as the GitHub source for the pipeline.
    2. It should use [`.aws/casualos.buildspec.yml`](../../.aws/casualos.buildspec.yml) as the buildspec file.
    3. It should also use the `master` branch for builds.
    4. Configure the following environment variables:
        - `STACK_NAME` - The name of the CloudFormation stack that you want to be created.
        - `PLAYER_S3_BUCKET` - The S3 URL of the S3 bucket for the player website files. (ex. `s3://my-s3-bucket`)
        - `AUTH_S3_BUCKET` - The S3 URL name of the S3 bucket for the auth website files. (ex. `s3://my-s3-bucket`)
        - `LAMBDA_S3_BUCKET` - The name of the S3 bucket for the lambda code. (ex. `my-s3-bucket`)
        - `PLAYER_CLOUDFRONT_DISTRIBUTION` - The ID of the distribution for the player website.
        - `AUTH_CLOUDFRONT_DISTRIBUTION` - The ID of the distribution for the auth website.
        - `ALLOWED_ORIGINS` - The list of HTTP origins that are allowed to make API requests to the internal auth APIs. Should be aspace-separated list of HTTP(S) origins. This should include the domains that the auth site is hosted from but nothing else. (Always includes `http://localhost:3002`, `https://casualos.me`, `https://ab1.link`)
        - `ALLOWED_API_ORIGINS` - The HTTP Origins that the Records API can be used from. Used to limit the websites that can publish data to records. Should be a space-separated list of HTTP(S) origins. (Always includes `http://localhost:3000 http://localhost:3002 http://player.localhost:3000 https://casualos.com https://casualos.me https://ab1.link https://publicos.com https://alpha.casualos.com https://static.casualos.com https://stable.casualos.com`)
        - `FILES_STORAGE_CLASS` - The S3 Storage class that file records should be stored in. See x-amz-storage-class in https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
        - `DATABASE_URL` - The CockroachDB Database URL that you wrote down above.
        - `SERVER_CONFIG` - The config that should be used for the server. Provides the ability to configure TextIt, Livekit, Subscriptions, and more. See ServerBuilder.ts for the schema (BuilderOptions) that the SERVER_CONFIG uses.
        - `CAUSAL_REPO_CONNECTION_PROTOCOL` - Set this to `apiary-aws`.
        - `SHARED_PARTITIONS_VERSION` - Set this to `v2`.
        - `SES_IDENTITY_NAME` - The Simple Email Service identity that emails should be allowed to be sent from. Only used for granting permissions to send emails to the lambda function. Use `SERVER_CONFIG` to actually configure the server to use SES. (Optional)
        - Configure any other optional environment variables listed below.
5. Run a build.
6. After the build, go to CloudFormation and find the stack update.
    - Review the changes to ensure that they are correct and then execute the stack update.
7. After the stack has been updated, go to API Gateway and find the websocket API that was created for the stack.
    - Go to the "Prod" stage and write down the URL that is listed for it.
8. Go back to the CodeBuild pipeline and add the Websocket URL to the build:
    - Add the `CAUSAL_REPO_CONNECTION_URL` environment variable with the URL you grabbed above.
9. Run another build and update CloudFormation after the build is finished.

## Configuration

The build can be configured using the following environment variables. All the options and defaults are handled in `prerender-web-config.js`.

#### ab-1

Use the following environment variables to configure ab-1.

-   `AB1_BOOTSTRAP_URL`: The URL that ab-1 should be loaded from. If this is not specified, then ab-1 will be loaded from `https://bootstrap.casualos.com/ab1.aux` in production and `https://bootstrap.casualos.com/staging/ab1.aux` in staging.
-   `AUX_PLAYER_MODE`: The player mode that this instance should indicate to scripts. `"player"` indicates that the inst is supposed to be for playing AUXes while `"builder"` indicates that the inst is used for building AUXes. Defaults to `"builder"`.

#### Collaboration Features

Use the following environment variables to configure the inst collaboration features.

-   `DISABLE_COLLABORATION`: Set this to true to disable networking in the shared space. When true, the `shared` space will actually use a `tempLocal` partition. Defaults to `false`.
-   `CAUSAL_REPO_CONNECTION_PROTOCOL`: The connection protocol that should be used for causal repos. Controls which backends the causal repos can connect to. Possible options are `websocket` and `apiary-aws`. The `websocket` protocol works with Raspberry PIs and self-hosted servers (like in development). The `apiary-aws` protocol works with [CasualOS apiaries hosted on AWS](https://github.com/casual-simulation/casualos). Defaults to `websocket`.
-   `CAUSAL_REPO_CONNECTION_URL`: The URL that causal repos should connect to. If not specified, then the URL that the site is hosted from will be used. Useful in development to connect to a different causal repo host than the local websocket based one.
-   `SHARED_PARTITIONS_VERSION`: The version of the shared partitions that should be used. The "shared partitions" are the services used to implement the shared spaces (`shared`, `tempShared`, and `remoteTempShared`). Currently, the only possible option is `v2`. Defaults to `v2`.
-   `PREFERRED_INST_SOURCE`: The preferred source for loading instances. Possible options are `"public"` and `"private"`. `"public"` means that public instances will be loaded if not already specified in the URL. `"private"` means that private insts will be loaded if not already specified in the URL. Defaults to `"private"`.
-   `FRONTEND_ORIGIN`: The HTTP Origin that the CasualOS frontend is available at.
-   `COLLABORATIVE_REPO_LOCAL_PERSISTENCE`: Set this to `true` to enable local (IndexedDB) persistence for shared inst data. Currently experimental and may not work properly when enabled. Defaults to `false`.
-   `STATIC_REPO_LOCAL_PERSISTENCE`: Set this to `true` to enable local (IndexedDB) persistence for static inst data. Defaults to `true`.
-   `BIOS_OPTIONS`: The comma-separated list of allowed bios options. If omitted, then all options are enabled. Possible options are `enter join code`, `static inst`, `public inst`, `private inst`, `sign in`, `sign up`, `sign out`.
-   `DEFAULT_BIOS_OPTION`: The BIOS option that should be selected by default.

#### Privo Features

Use the following environment variables to configure privo features.

-   `REQUIRE_PRIVO_LOGIN` - Set to `true` to require that the user logs in with Privo before collaborative features are enabled.

#### mapPortal

Use the following to configure the mapPortal and mapping-related features:

-   `ARC_GIS_API_KEY`: The API Key that should be used to access the [ArcGIS API](https://developers.arcgis.com/).
-   `WHAT_3_WORDS_API_KEY`: The API Key that should be used for [what3words](https://what3words.com/) integration.

#### meetPortal

Use the following to configure the meetPortal:

-   `JITSI_APP_NAME`: The name of the Jitsi app that the meetPortal should use.

#### Records (Authentication)

Use the following to configure the records system:

-   `AUTH_ORIGIN`: The HTTP Origin that the player should use for auth. Defaults to `null` in production and `http://localhost:3002` in development.
-   `RECORDS_ORIGIN`: The HTTP Origin that records should be loaded from and published to. Defaults to `null` in production and `http://localhost:3002` in development.
-   `ENABLE_SMS_AUTHENTICATION`: Whether SMS phone numbers are allowed to be entered into the front-end and used for authentication. Defaults to `false`.

## Security Note

In the default configuration, CasualOS allows running arbitrary user scripts inside the web server process. Potential capabilities include filesystem access, executing commands, making arbitrary web requests, and reading environment variables.

Therefore, it is highly recommended to isolate the web server from other sensitive networks and components to ensure malicious scripts cannot infect them.

[docker]: https://www.docker.com/
[docker-install]: https://docs.docker.com/install/
[docker-compose]: https://docs.docker.com/compose/install/
[docker-compose-install]: https://docs.docker.com/compose/install/
