import path from "path";
import { bodyDto } from "./dto/masterFrom";
import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import bodyParser from "body-parser";
import { getData } from "./utils/dataExtractor";

const app = express();
const PORT = 80;
app.use(bodyParser.urlencoded({ extended: true }));
// Set Pug as the view engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Define a route
app.get("/", (req, res) => {
  res.render("index", {
    title: "Express + Pug + TypeScript",
    message: "Hello, World!",
  });
});

app.post("/submit", async (req: ExpressRequest, res: any) => {
  console.log(req.body);

  const result = bodyDto.safeParse({
    expenses: Number(req.body.expenses),
    earn: Number(req.body.earn),
    postcode: Number(req.body.postcode),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors });
  }

  const data = await getData(result.data);

  return res.render("table", { data, formData: result.data });
});
// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
