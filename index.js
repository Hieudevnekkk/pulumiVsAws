'use strict';
const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const awsx = require('@pulumi/awsx');

const { apiGateway } = require('./infra/apiGateway');
const { mainLambda } = require('./infra/lambdaFunctions');
const { queue } = require('./infra/sqs');
const { mainTable, cloneTable, logsTable } = require('./infra/dynamodb');


exports.queue = queue;
exports.mainTable = mainTable;
exports.cloneTable = cloneTable;
exports.logsTable = logsTable;
exports.apiGateway = apiGateway;
exports.mainLambda = mainLambda;

exports.queueUrl = queue.url;
exports.queueArn = queue.arn;

exports.apiUrl = pulumi.interpolate`${apiGateway.apiEndpoint}/test/add`;
