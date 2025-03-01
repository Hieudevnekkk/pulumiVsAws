const aws = require('@pulumi/aws');

const mainTable = new aws.dynamodb.Table('mainDataTable2', {
    name: "mainDataTable2",
    attributes: [
        { name: 'id', type: 'S' },
    ],
    hashKey: 'id',
    billingMode: 'PAY_PER_REQUEST',
    streamEnabled: true,
    streamViewType: 'NEW_AND_OLD_IMAGES' // Lưu cả dữ liệu cũ và mới
});

const cloneTable = new aws.dynamodb.Table('cloneDataTable2', {
    name: "cloneDataTable2",
    attributes: [
        { name: 'id', type: 'S' },
    ],
    hashKey: 'id',
    billingMode: 'PAY_PER_REQUEST',
});

const logsTable = new aws.dynamodb.Table('logsTable2', {
    name: "logsTable2",
    attributes: [
        { name: 'logId', type: 'S' },
    ],
    hashKey: 'logId',
    billingMode: 'PAY_PER_REQUEST',
});

module.exports = { mainTable, cloneTable, logsTable };
