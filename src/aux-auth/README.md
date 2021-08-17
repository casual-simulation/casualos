# Aux Auth

A project that is able to provide a basic Login system for CasualOS.

### Building and Deploying

To build, simply run `npm run build`.

To deploy this project to AWS Lambda, follow these steps:

1. Setup a CodeBuild pipeline that points to [`.aws/auth.buildspec.yml`](../../.aws/auth.buildspec.yml).
2. Specify the following environment variables:
    - `S3_BUCKET` - The S3 bucket that the static HTML/CSS/JS should be deployed to. The CodeBuild pipeline needs to have write access to the specified bucket.
    - `LAMBDA_S3_BUCKET` - The S3 bucket that the the Lambda scripts should be packaged and deployed to. The CodeBuild pipeline needs to have write access to the specified bucket.
    - `CLOUDFRONT_DISTRIBUTION` - The Distribution ID on CloudFront that should be invalidated. This CloudFront Distribution should point to `S3_BUCKET`.
    - `AUTH_API_ENDPOINT` - The HTTPS Origin that the auth site should try to access. This should be the endpoint of the API Gateway that the lambda functions are behind. (Defaults to `https://api.casualos.me`)
    - `ALLOWED_CHILD_ORIGINS` - The HTTP Origins that the auth site can be loaded from. Used to limit the websites that can interface with the Auth Site via iframe. (Defaults to `http://localhost:3000 https://casualos.com https://static.casualos.com https://alpha.casualos.com https://stable.casualos.com`)
3. Run a build.
