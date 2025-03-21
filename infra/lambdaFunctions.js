const aws = require('@pulumi/aws');
const pulumi = require('@pulumi/pulumi');
const { apiGateway } = require('./apiGateway');
const { mainTable, logsTable, cloneTable } = require('./dynamodb');
const { queue } = require('./sqs');

const crypto = require('crypto');
const fs = require('fs');

// Đọc file và tạo hash MD5
const mainHandlerfileBuffer = fs.readFileSync('./handlers/mainHandler.zip');
const mainHandlerfileHash = crypto.createHash('md5').update(mainHandlerfileBuffer).digest('hex');

const sqsHandlerfileBuffer = fs.readFileSync('./handlers/sqsHandler.zip');
const sqsHandlerfileHash = crypto.createHash('md5').update(sqsHandlerfileBuffer).digest('hex');

const cloneDataHandlerfileBuffer = fs.readFileSync('./handlers/cloneDataHandler.zip');
const cloneDataHandlerfileHash = crypto
    .createHash('md5')
    .update(cloneDataHandlerfileBuffer)
    .digest('hex');

const bucket = new aws.s3.Bucket('lambdaBucket');

// Upload file ZIP lên S3
const mainLambdaZip = new aws.s3.BucketObject('mainHandlerBucket', {
    bucket: bucket.id,
    key: `mainHandler-${mainHandlerfileHash}.zip`,
    source: new pulumi.asset.FileAsset('./handlers/mainHandler.zip'),
    contentType: 'application/zip',
});

const sqsLambdaZip = new aws.s3.BucketObject('sqsHandlerBucket', {
    bucket: bucket.id,
    key: `sqsHandler-${sqsHandlerfileHash}.zip`,
    source: new pulumi.asset.FileAsset('./handlers/sqsHandler.zip'),
    contentType: 'application/zip',
});

const cloneDataLambdaZip = new aws.s3.BucketObject('cloneDataHandlerBucket', {
    bucket: bucket.id,
    key: `cloneDataHandler-${cloneDataHandlerfileHash}.zip`,
    source: new pulumi.asset.FileAsset('./handlers/cloneDataHandler.zip'),
    contentType: 'application/zip',
});

// Tạo IAM Role cho Lambda
const mainLambdaRole = new aws.iam.Role('mainLambdaRole', {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'lambda.amazonaws.com' }),
});

// Gán quyền AWSLambdaBasicExecutionRole để ghi log vào CloudWatch
const lambdaPolicyAttachment = new aws.iam.RolePolicyAttachment('lambdaBasicExecution', {
    role: mainLambdaRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

const mainLambdaPolicy = new aws.iam.Policy('mainLambdaPolicy', {
    policy: pulumi.all([mainTable.arn, queue.arn]).apply(([mainTableArn, queueArn]) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem'],
                    Resource: mainTableArn,
                },
                {
                    Effect: 'Allow',
                    Action: ['sqs:SendMessage'],
                    Resource: queueArn,
                },
            ],
        })
    ),
});

// Gán policy vào IAM Role
new aws.iam.RolePolicyAttachment('mainLambdaPolicyAttachment', {
    role: mainLambdaRole.name,
    policyArn: mainLambdaPolicy.arn,
});

const mainLambda = new aws.lambda.Function(
    'mainHandler',
    {
        runtime: 'nodejs20.x',
        role: mainLambdaRole.arn,
        handler: 'mainHandler.handler',
        s3Bucket: bucket.id,
        s3Key: mainLambdaZip.key,
        environment: {
            variables: {
                SQS_QUEUE_URL: queue.url,
                NAME_MAIN_DATA_TABLE: mainTable.name,
            },
        },
    },
    { dependsOn: [lambdaPolicyAttachment] }
);

// Gán quyền để API Gateway gọi Lambda
const lambdaPermission = new aws.lambda.Permission(
    'apiGatewayInvoke',
    {
        action: 'lambda:InvokeFunction',
        function: mainLambda.arn,
        principal: 'apigateway.amazonaws.com',
        sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`,
    },
    { dependsOn: [apiGateway, mainLambda] }
);

// Tích hợp Lambda với API Gateway
const integration = new aws.apigatewayv2.Integration(
    'lambdaIntegration',
    {
        apiId: apiGateway.id,
        integrationType: 'AWS_PROXY',
        integrationUri: mainLambda.arn,
    },
    { dependsOn: [lambdaPermission] }
);

// Tạo route `/add`
const route = new aws.apigatewayv2.Route('route', {
    apiId: apiGateway.id,
    routeKey: 'POST /add',
    target: pulumi.interpolate`integrations/${integration.id}`,
});

// Triển khai API Gateway
const deployment = new aws.apigatewayv2.Deployment(
    'deployment',
    {
        apiId: apiGateway.id,
    },
    { dependsOn: [route] }
);

const stage = new aws.apigatewayv2.Stage(
    'stage',
    {
        apiId: apiGateway.id,
        name: 'test',
        deploymentId: deployment.id,
        autoDeploy: true,
    },
    { dependsOn: [deployment] }
);

// SQS_HANDLER

// Tạo IAM Role cho Lambda sqsHandler
const sqsLambdaRole = new aws.iam.Role('sqsLambdaRole', {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'lambda.amazonaws.com' }),
});

// Cấp quyền cho Lambda sqsLambda truy cập CloudWatch Logs và SQS
const sqsLambdaPolicy = new aws.iam.Policy('sqsLambdaPolicy', {
    policy: pulumi.all([queue.arn, logsTable.arn]).apply(([queueArn, logsTableArn]) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                    Resource: '*',
                },
                {
                    Effect: 'Allow',
                    Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
                    Resource: queueArn,
                },
                {
                    Effect: 'Allow',
                    Action: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem'],
                    Resource: logsTableArn,
                },
            ],
        })
    ),
});

// Gắn Policy vào Role của Lambda sqsLambdaPolicy
const sqsLambdaPolicyAttachment = new aws.iam.RolePolicyAttachment('sqsLambdaPolicyAttachment', {
    role: sqsLambdaRole.name,
    policyArn: sqsLambdaPolicy.arn,
});

// Tạo Lambda Function
const sqsLambda = new aws.lambda.Function(
    'sqsLambda',
    {
        runtime: 'nodejs20.x',
        role: sqsLambdaRole.arn,
        handler: 'sqsHandler.handler',
        s3Bucket: bucket.id,
        s3Key: sqsLambdaZip.key,
        environment: {
            variables: {
                NAME_LOGS_TABLE: logsTable.name,
            },
        },
    },
    { dependsOn: [sqsLambdaPolicyAttachment] }
);

// Thêm Trigger từ SQS đến sqsLambda
const eventSourceMapping = new aws.lambda.EventSourceMapping('sqsEventTrigger', {
    eventSourceArn: queue.arn,
    functionName: sqsLambda.arn,
    batchSize: 5, // Số lượng tin nhắn tối đa gửi vào Lambda mỗi lần
});

// TRIGGER LAMBDA

// Tạo IAM Role cho Lambda sqsHandler
const cloneDataLambdaRole = new aws.iam.Role('cloneDataLambdaRole', {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'lambda.amazonaws.com' }),
});

// Cấp quyền cho Lambda cloneDataLambda truy cập CloudWatch Logs và cloneData
const cloneDataLambdaPolicy = new aws.iam.Policy('cloneDataLambdaPolicy', {
    policy: pulumi.all([mainTable.streamArn, cloneTable.arn]).apply(([streamArn, cloneTableArn]) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                    Resource: '*',
                },
                {
                    Effect: 'Allow',
                    Action: [
                        'dynamodb:DescribeStream',
                        'dynamodb:GetRecords',
                        'dynamodb:GetShardIterator',
                    ],
                    Resource: streamArn,
                },
                {
                    Effect: 'Allow',
                    Action: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem'],
                    Resource: cloneTableArn,
                },
            ],
        })
    ),
});

// Gắn Policy vào Role của Lambda cloneDataLambdaPolicy
const cloneDataLambdaPolicyAttachment = new aws.iam.RolePolicyAttachment(
    'cloneDataLambdaPolicyAttachment',
    {
        role: cloneDataLambdaRole.name,
        policyArn: cloneDataLambdaPolicy.arn,
    }
);

// Tạo Lambda Function
const cloneDataLambda = new aws.lambda.Function(
    'cloneDataLambda',
    {
        runtime: 'nodejs20.x',
        role: cloneDataLambdaRole.arn,
        handler: 'cloneDataHandler.handler',
        s3Bucket: bucket.id,
        s3Key: cloneDataLambdaZip.key,
        environment: {
            variables: {
                NAME_CLONE_TABLE: cloneTable.name,
            },
        },
    },
    { dependsOn: [cloneDataLambdaPolicyAttachment] }
);

//  Thêm Trigger từ mainDataTable đến cloneDataLambda
const eventSourceMappingClone = new aws.lambda.EventSourceMapping(
    'triggerMainTableToCloneDataLambda',
    {
        eventSourceArn: mainTable.streamArn,
        functionName: cloneDataLambda.arn,
        startingPosition: 'LATEST',
        batchSize: 5, // Lấy tối đa 5 bản ghi mỗi lần
    }
);

module.exports = { mainLambda, cloneDataLambda, sqsLambda };
