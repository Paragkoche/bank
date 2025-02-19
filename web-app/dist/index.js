"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const masterFrom_1 = require("./dto/masterFrom");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const dataExtractor_1 = require("./utils/dataExtractor");
const app = (0, express_1.default)();
const PORT = 3000;
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Set Pug as the view engine
app.set("view engine", "pug");
app.set("views", path_1.default.join(__dirname, "views"));
// Define a route
app.get("/", (req, res) => {
    res.render("index", {
        title: "Express + Pug + TypeScript",
        message: "Hello, World!",
    });
});
app.post("/submit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req.body);
    const result = masterFrom_1.bodyDto.safeParse({
        expenses: Number(req.body.expenses),
        earn: Number(req.body.earn),
        postcode: Number(req.body.postcode),
    });
    if (!result.success) {
        return res.status(400).json({ error: result.error.errors });
    }
    const data = yield (0, dataExtractor_1.getData)(result.data);
    console.log(data);
    return res.render("table", { data, formData: result.data });
}));
// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
