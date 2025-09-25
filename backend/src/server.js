const connectDb = require("../config/db");
const app = require("./index");

const PORT = 8081;

app.listen(PORT, async() => {
  await connectDb();
  console.log("port running on:", PORT);
});
