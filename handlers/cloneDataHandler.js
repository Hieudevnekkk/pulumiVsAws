const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamoDBClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const DEST_TABLE_NAME = process.env.NAME_CLONE_TABLE;

exports.handler = async (event) => {
    try {
        console.log('Event received:', JSON.stringify(event, null, 2));

        for (const record of event.Records) {
            if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
                const item = record.dynamodb.NewImage;

                // Chuyển đổi từ DynamoDB JSON sang JavaScript object
                const data = unmarshall(item); // <-- Đã thay đổi thành `unmarshall`

                console.log('Data to clone:', data);

                // Ghi dữ liệu vào bảng đích
                const params = {
                    TableName: DEST_TABLE_NAME,
                    Item: data,
                };

                await dynamoDB.send(new PutCommand(params));

                console.log('Data cloned successfully.');
            }
        }

        return { statusCode: 200, body: 'Clone successful' };
    } catch (error) {
        console.error('Error cloning data:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
