const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_NAME = process.env.TASKS_TABLE || "Tasks";

const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

module.exports = {
  ddbDocClient,
  commands: {
    PutCommand,
    GetCommand,
    DeleteCommand,
    ScanCommand,
    UpdateCommand
  },
  TABLE_NAME
};
