const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Khởi tạo DynamoDB và SQS client
const dynamoDBClient = new DynamoDBClient({});
const sqsClient = new SQSClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const TABLE_NAME = process.env.NAME_MAIN_DATA_TABLE;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

module.exports.handler = async (event) => {
    try {
        // Kiểm tra dữ liệu đầu vào
        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request: body is missing' }),
            };
        }

        const body = JSON.parse(event.body);

        if (!body.id || !body.data) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required fields: id, data' }),
            };
        }

        const item = { id: body.id, data: body.data };

        // Ghi dữ liệu vào DynamoDB
        await dynamoDB.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

        // Gửi message vào SQS (nếu cần)
        await sqsClient.send(
            new SendMessageCommand({
                QueueUrl: SQS_QUEUE_URL,
                MessageBody: JSON.stringify(item),
            })
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Thêm dữ liệu thành công', item }),
        };
    } catch (error) {
        console.error('Error processing request:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }
};
