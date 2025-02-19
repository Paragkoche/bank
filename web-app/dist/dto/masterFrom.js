"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bodyDto = void 0;
const zod_1 = require("zod");
exports.bodyDto = zod_1.z.object({
    expenses: zod_1.z.number().min(1),
    earn: zod_1.z.number().min(100000),
    postcode: zod_1.z.number().min(1000),
});
