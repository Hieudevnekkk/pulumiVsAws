const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const dynamoDBClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const TABLE_NAME = process.env.NAME_LOGS_TABLE;

exports.handler = async (event) => {
    for (const record of event.Records) {
        const data = JSON.parse(record.body);

        const putParams = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                logId: data.id,
                logData: data.data,
            },
        });

        try {
            await dynamoDB.send(putParams);
            return { statusCode: 200, body: 'Logged successfully!' };
        } catch (error) {
            console.log('Logged error!');
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }
};
