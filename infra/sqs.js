const aws = require("@pulumi/aws");

const queue = new aws.sqs.Queue("dataQueue", {
    visibilityTimeoutSeconds: 30, // Thời gian chờ giữa các lần xử lý message
    messageRetentionSeconds: 345600, // Thời gian lưu trữ message (4 ngày)
    fifoQueue: false, // Nếu là FIFO queue, đặt thành true
});

module.exports = { queue };