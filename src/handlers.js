const { ddbDocClient, commands, TABLE_NAME } = require("./dynamo");
const { v4: uuidv4 } = require("uuid");

const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*", // adjust for production
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
};

exports.handler = async (event) => {
  try {
    // API Gateway proxy integration
    const method = event.httpMethod;
    const path = event.path || "/";

    // Parse body if present
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    // Routes:
    // GET /tasks        -> list all tasks
    // POST /tasks       -> create task
    // PUT /tasks/{id}   -> update task
    // DELETE /tasks/{id}-> delete task

    // Normalize path
    const segments = path.replace(/\/+$/,"").split("/").filter(Boolean); // e.g., ['api','tasks','<id>']
    // Accept either /tasks or /api/tasks depending on API stage
    const idx = segments.indexOf("tasks");
    const id = idx >= 0 && segments.length > idx+1 ? segments[idx+1] : null;

    if (method === "GET") {
      // list
      const data = await ddbDocClient.send(new commands.ScanCommand({ TableName: TABLE_NAME }));
      return {
        statusCode: 200,
        headers: defaultHeaders,
        body: JSON.stringify({ items: data.Items || [] })
      };
    }

    if (method === "POST") {
      const { title, description, dueDate, assignedTo } = body;
      if (!title) {
        return { statusCode: 400, headers: defaultHeaders, body: JSON.stringify({ error: "title required" }) };
      }
      const now = new Date().toISOString();
      const task = {
        taskId: uuidv4(),
        title,
        description: description || "",
        status: "active",
        createdAt: now,
        updatedAt: now
      };
      if (dueDate) task.dueDate = dueDate;
      if (assignedTo) task.assignedTo = assignedTo;

      await ddbDocClient.send(new commands.PutCommand({
        TableName: TABLE_NAME,
        Item: task
      }));
      return { statusCode: 201, headers: defaultHeaders, body: JSON.stringify(task) };
    }

    if (method === "PUT" && id) {
      // Update fields allowed: title, description, status, dueDate, assignedTo
      const updates = [];
      const exprAttrNames = {};
      const exprAttrValues = {};
      const allowed = ["title", "description", "status", "dueDate", "assignedTo"];
      allowed.forEach((k) => {
        if (body[k] !== undefined) {
          const name = `#${k}`;
          const value = `:${k}`;
          exprAttrNames[name] = k;
          exprAttrValues[value] = body[k];
          updates.push(`${name} = ${value}`);
        }
      });
      if (updates.length === 0) {
        return { statusCode: 400, headers: defaultHeaders, body: JSON.stringify({ error: "no updatable fields provided" }) };
      }
      // also update updatedAt
      exprAttrNames["#updatedAt"] = "updatedAt";
      exprAttrValues[":updatedAt"] = new Date().toISOString();
      const updateExpression = "SET " + updates.join(", ") + ", #updatedAt = :updatedAt";

      await ddbDocClient.send(new commands.UpdateCommand({
        TableName: TABLE_NAME,
        Key: { taskId: id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: "ALL_NEW"
      }));
      return { statusCode: 200, headers: defaultHeaders, body: JSON.stringify({ message: "updated" }) };
    }

    if (method === "DELETE" && id) {
      await ddbDocClient.send(new commands.DeleteCommand({
        TableName: TABLE_NAME,
        Key: { taskId: id }
      }));
      return { statusCode: 200, headers: defaultHeaders, body: JSON.stringify({ message: "deleted" }) };
    }

    // OPTIONS for CORS preflight
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: defaultHeaders, body: "" };
    }

    return { statusCode: 404, headers: defaultHeaders, body: JSON.stringify({ error: "Not found" }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: defaultHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
