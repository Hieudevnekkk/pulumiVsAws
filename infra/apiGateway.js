const aws = require('@pulumi/aws');
const pulumi = require('@pulumi/pulumi');

const apiGateway = new aws.apigatewayv2.Api('apiGateway', {
    protocolType: 'HTTP',
});

module.exports = { apiGateway }; // ✅ Chỉ export API Gateway, không tích hợp Lambda ở đây
