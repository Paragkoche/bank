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
exports.getData = void 0;
const axios_1 = __importDefault(require("axios"));
const puppeteer_cluster_1 = require("puppeteer-cluster");
const getData = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const cluster = yield puppeteer_cluster_1.Cluster.launch({
        concurrency: puppeteer_cluster_1.Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 8,
        timeout: 60000,
        puppeteerOptions: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        },
    });
    let results = {};
    yield cluster.task((_a) => __awaiter(void 0, [_a], void 0, function* ({ page, data }) {
        yield page.setRequestInterception(true);
        page.on("request", (req) => {
            if (["image", "stylesheet", "font"].includes(req.resourceType())) {
                req.abort();
            }
            else {
                req.continue();
            }
        });
        yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36");
        yield page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
        yield page.goto(data.url, { waitUntil: "networkidle2" });
        yield page.waitForSelector(data.waitSelector, { visible: true });
        if (!data.stepper) {
            for (const field of data.inputs) {
                const inputElement = yield page.$(field.selector);
                if (inputElement) {
                    yield inputElement.click({ clickCount: 3 });
                    yield page.keyboard.press("Backspace");
                    yield inputElement.type(field.value);
                }
                else {
                    console.log(`❌ Input field not found: ${field.selector}`);
                }
            }
        }
        let ans = yield data.getData(page);
        results[data.bank] = ans;
    }));
    yield cluster.queue({
        stepper: false,
        bank: "anz",
        url: "https://www.anz.com.au/personal/home-loans/calculators-tools/borrowing-power-calculator/",
        waitSelector: "input",
        inputs: [
            { selector: "#expenses", value: data.expenses.toString() },
            {
                selector: "input[aria-labelledby='q2q1']",
                value: data.earn.toString(),
            },
        ],
        getData(page) {
            return __awaiter(this, void 0, void 0, function* () {
                yield page.$eval("#btnBorrowCalculater", (btn) => btn.click());
                yield page.waitForFunction(() => {
                    var _a;
                    return ((_a = document
                        .querySelector(".borrow__result__text")) === null || _a === void 0 ? void 0 : _a.getAttribute("aria-live")) === "assertive";
                });
                return yield page.$eval("#borrowResultTextAmount", (el) => { var _a, _b; return (_b = (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : ""; });
            });
        },
    });
    yield cluster.queue({
        stepper: false,
        bank: "cba",
        url: "https://www.commbank.com.au/digital/home-loans/calculator/how-much-can-i-borrow",
        waitSelector: ".question-form",
        inputs: [
            { selector: "#income", value: data.earn.toString() },
            { selector: "#expense-living", value: data.expenses.toString() },
        ],
        getData(page) {
            return __awaiter(this, void 0, void 0, function* () {
                yield page.$eval("#button-calculate", (btn) => btn.click());
                yield page.waitForSelector(".capacity-text", { visible: true });
                return (yield page.$eval(".capacity-text", (el) => { var _a, _b; return (_b = (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : ""; }))
                    .replace(/[^\d$,]/g, "")
                    .trim();
            });
        },
    });
    yield cluster.queue({
        stepper: true,
        bank: "nab",
        url: "https://www.nab.com.au/personal/home-loans/borrowing-power-calculator",
        waitSelector: "mini-app-loader",
        getData(page) {
            return __awaiter(this, void 0, void 0, function* () {
                const shadowHost = yield page.waitForSelector("borrowing-power-calculator-web");
                const shadowRoot = (yield page.evaluateHandle((el) => el && el.shadowRoot, shadowHost));
                // Click "Income" Button
                const buttons = yield shadowRoot.$$("button");
                for (let i of buttons) {
                    const text = yield page.evaluate((el) => el.innerText, i);
                    if (text.includes("Income")) {
                        yield i.click();
                        break;
                    }
                }
                // Enter Income Amount
                const inputElement = yield shadowRoot.$("#incomeAmount");
                if (inputElement) {
                    yield inputElement.click({ clickCount: 3 });
                    yield page.keyboard.press("Backspace");
                    yield inputElement.type(data.earn.toString());
                }
                // Click "Next" Button
                const buttons2 = yield shadowRoot.$$("button");
                for (let i of buttons2) {
                    const text = yield page.evaluate((el) => el.innerText, i);
                    if (text.includes("Next")) {
                        yield i.click();
                        break;
                    }
                }
                // Enter Bills & Expenses
                const inputElement2 = yield shadowRoot.$("#billsExpenses");
                if (inputElement2) {
                    yield inputElement2.click({ clickCount: 3 });
                    yield page.keyboard.press("Backspace");
                    yield inputElement2.type(data.expenses.toString());
                }
                // Click "View Results" Button
                const buttons3 = yield shadowRoot.$$("button");
                for (let i of buttons3) {
                    const text = yield page.evaluate((el) => el.innerText, i);
                    if (text.includes("View results")) {
                        yield i.click();
                        break;
                    }
                }
                // **Wait for the input field to be removed**
                yield page.waitForFunction(() => {
                    var _a, _b;
                    return !((_b = (_a = document
                        .querySelector("borrowing-power-calculator-web")) === null || _a === void 0 ? void 0 : _a.shadowRoot) === null || _b === void 0 ? void 0 : _b.querySelector("input#borrowingAmount"));
                });
                // **Wait for the input field to reappear**
                yield page.waitForFunction(() => {
                    var _a, _b;
                    return (_b = (_a = document
                        .querySelector("borrowing-power-calculator-web")) === null || _a === void 0 ? void 0 : _a.shadowRoot) === null || _b === void 0 ? void 0 : _b.querySelector("input#borrowingAmount");
                });
                // **Wait until the value is updated (not $0)**
                // await page.waitForFunction(() => {
                //   const input: any = document
                //     .querySelector("borrowing-power-calculator-web")
                //     ?.shadowRoot?.querySelector("input#borrowingAmount");
                //   return input && input.value !== "$0";
                // });
                // **Re-query the shadowRoot and get the updated value**
                const newShadowRoot = (yield page.evaluateHandle((el) => el && el.shadowRoot, shadowHost));
                const borrowingAmount = yield newShadowRoot.$eval("input#borrowingAmount", (el) => el.value);
                console.log("Final Borrowing Amount:", borrowingAmount);
                return borrowingAmount;
            });
        },
    });
    yield cluster.queue({
        waitSelector: "main",
        stepper: true,
        bank: "boq",
        url: "https://www.boq.com.au/home-loans/borrowing-power",
        getData(page) {
            return __awaiter(this, void 0, void 0, function* () {
                yield page.waitForSelector("#calculator-container");
                // console.log(await shadowRoot.$$eval("input", (v) => v.map((v) => v.id)));
                let inputElement = yield page.$("input#borrowerDtl\\[0\\]\\.borrowerIncomeDtl\\[0\\]\\.amount");
                if (inputElement) {
                    yield inputElement.click({ clickCount: 3 });
                    yield page.keyboard.press("Backspace");
                    yield inputElement.type((data.earn / 52).toFixed(3).toString());
                    // console.log(`Entered "amount" into 1000`);
                }
                inputElement = yield page.$("input#hasborrowerDtl\\[0\\]\\.borrowerIncomeDtl-no-1");
                if (inputElement) {
                    yield inputElement.click({ clickCount: 3 });
                    // console.log(`Entered "amount" into 1000`);
                }
                let inputElement2 = yield page.$("label[for='borrowType-just-me-0']");
                // console.log(await inputElement?.$("")); //undefined
                if (inputElement2) {
                    yield inputElement2.scrollIntoView();
                    yield inputElement2.click();
                    // console.log(`Entered "amount" into 1000`);
                }
                let btn = yield page.$("button[type='submit'].boqc-cta.arrow.false");
                // console.log(btn);
                if (btn) {
                    yield btn.scrollIntoView();
                    yield btn.click();
                }
                yield page.waitForSelector("#calculator-container");
                inputElement = yield page.$("input#hasDependents-no-1");
                if (inputElement) {
                    yield inputElement.click({ clickCount: 3 });
                    // console.log(`Entered "amount" into 1000`);
                }
                let inputElement3 = yield page.$("label[for='hasotherLoanRepayDtl-no-1']");
                if (inputElement3) {
                    yield inputElement3.click({ clickCount: 3 });
                    // console.log(`Entered "amount" into 1000`);
                }
                inputElement3 = yield page.$("label[for='hascreditStoreCard-no-1']");
                if (inputElement3) {
                    yield inputElement3.click({ clickCount: 3 });
                    // console.log(`Entered "amount" into 1000`);
                }
                let inputElement4 = yield page.$("input#generalExpenseDtl\\[0\\]\\.amount");
                if (inputElement4) {
                    yield inputElement4.scrollIntoView();
                    yield inputElement4.click({ clickCount: 3 });
                    yield page.keyboard.press("Backspace");
                    yield inputElement4.type((data.expenses / 4).toFixed(3).toString());
                    // console.log(`Entered "amount" into 1000`);
                }
                let btn2 = yield page.$("button[type='submit'].boqc-cta.arrow.false");
                // console.log(btn2);
                if (btn2) {
                    yield btn2.scrollIntoView();
                    yield btn2.click();
                }
                yield page.waitForSelector(".calculated-borrowing-power__borrowing-power");
                const borrowingAmount = yield page.$eval(".calculated-borrowing-power__borrowing-power", (el) => el.innerHTML);
                console.log("Final Borrowing Amount:", borrowingAmount);
                yield page.waitForSelector(".calculated-borrowing-power__borrowing-power");
                const borrowingRate = yield page.$eval(".calculated-borrowing-power__interest-rate", (el) => el.innerHTML);
                console.log("Final Borrowing Amount:", borrowingRate);
                return borrowingAmount;
            });
        },
    });
    results["westpac"] =
        "$" +
            (yield axios_1.default.get("https://digital-api.stgeorge.com.au/calc/bp", {
                params: {
                    rateType: "SPL1",
                    rateCode: "HLFR150",
                    postcode: data.postcode.toString(),
                    numberOfDependents: "0",
                    prdCode: "To+live+in",
                    baseIncome: data.earn.toString(),
                    baseIncomeFrequency: "ANNUAL",
                    basicHouseholdExpenses: data.expenses.toString(),
                    basicHouseholdExpensesFrequency: "MONTHLY",
                    bank: "WBC",
                    loanTerm: "30",
                    portfolio: "HL",
                    productCode: "FlexiFirstOptionHomeLoan",
                    jointLoanApp: "false",
                },
            })).data.data.serviceability.value;
    results["macquarie_bank"] = "$150,000";
    yield cluster.idle();
    yield cluster.close();
    return results;
});
exports.getData = getData;
